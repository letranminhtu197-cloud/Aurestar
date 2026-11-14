const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createDatabase } = require('../src/core/sqlite.cjs');

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-phase2-'));
  const db=createDatabase(path.join(dir,'data.sqlite'));
  t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
  return db.phase2;
}

test('habits persist with daily completion logs and validate references',t=>{
  const p=fixture(t);
  const habit=p.saveHabit({name:'Read',frequency:'daily',targetCount:2});
  assert.equal(p.listHabits()[0].name,'Read');
  const log=p.logHabit({habitId:habit.id,date:'2026-11-10',completedCount:2});
  assert.equal(log.completed_count,2);
  assert.equal(p.listHabitLogs('2026-11-10','2026-11-10').length,1);
  assert.throws(()=>p.logHabit({habitId:'missing'}),/not found/i);
});

test('focus sessions link to tasks and aggregate insights',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-phase2-focus-'));
  const {createDatabase}=require('../src/core/sqlite.cjs');
  const db=createDatabase(path.join(dir,'db.sqlite'));
  t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
  const task=db.saveTask({title:'Study'});
  const session=db.phase2.saveFocusSession({taskId:task.id,startedAt:'2026-11-10T08:00:00.000Z',endedAt:'2026-11-10T08:25:00.000Z',actualSeconds:1500,status:'completed'});
  assert.equal(db.phase2.listFocusSessions()[0].id,session.id);
  assert.equal(db.phase2.getInsights('2026-11-10','2026-11-10').focus.seconds,1500);
  assert.throws(()=>db.phase2.saveFocusSession({taskId:'missing'}),/does not exist/i);
});

test('insights calculate weekly and monthly habit consistency over distinct windows',t=>{
 const p=fixture(t),habit=p.saveHabit({name:'Daily consistency',frequency:'daily'});
 for(let day=4;day<=10;day++)p.logHabit({habitId:habit.id,date:'2026-11-'+String(day).padStart(2,'0'),completedCount:1});
 const insight=p.getInsights('2026-10-12','2026-11-10');
 assert.equal(insight.habits.average_weekly_consistency,100);
 assert.equal(insight.habits.average_monthly_consistency,23);
});

test('journal and weekly review upsert by their natural dates',t=>{
  const p=fixture(t);
  p.saveJournalEntry({date:'2026-11-10',title:'Day 1',content:'Started'});
  p.saveJournalEntry({date:'2026-11-10',title:'Day 1 revised',content:'Updated'});
  assert.equal(p.listJournalEntries()[0].title,'Day 1 revised');
  p.saveWeeklyReview({weekStart:'2026-11-09',weekEnd:'2026-11-15',wins:'Good'});
  p.saveWeeklyReview({weekStart:'2026-11-09',weekEnd:'2026-11-15',wins:'Better'});
  assert.equal(p.listWeeklyReviews()[0].wins,'Better');
  assert.throws(()=>p.saveWeeklyReview({weekStart:'2026-11-15',weekEnd:'2026-11-09'}),/week end/i);
});

test('export preview and merge/update/replace imports are transactional',t=>{
  const p=fixture(t);
  const habit=p.saveHabit({name:'Existing'});
  const snapshot=p.exportData();
  assert.equal(p.previewImport(snapshot).valid,true);
  p.saveHabit({name:'Local only'});
  p.importData(snapshot,'merge');
  assert.equal(p.listHabits().length,2);
  p.importData(snapshot,'replace');
  assert.equal(p.listHabits().length,1);
  snapshot.tables.habits[0].name='Updated from backup';
  const updated=p.importData(snapshot,'update');
  assert.equal(updated.report.updated,1);
  assert.equal(p.listHabits()[0].name,'Updated from backup');
  const invalid={...snapshot,tables:{...snapshot.tables,habits:[{name:'invalid'}]}};
  assert.throws(()=>p.importData(invalid,'update'));
  assert.equal(p.listHabits()[0].id,habit.id);
});

test('daily plans are included in JSON export, preview and transactional replace import',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-daily-plan-import-'));
 const db=createDatabase(path.join(dir,'db.sqlite'));
 t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
 const task=db.saveTask({title:'Exported MIT'});
 db.saveDailyPlan({date:'2026-11-14',intention:'Export this plan',mitTaskIds:[task.id]});
 const snapshot=db.phase2.exportData();
 assert.equal(snapshot.tables.daily_plans.length,1);
 assert.equal(snapshot.tables.daily_mit_items.length,1);
 assert.equal(db.phase2.previewImport(snapshot).valid,true);
 db.saveDailyPlan({date:'2026-11-15',intention:'Temporary plan',mitTaskIds:[task.id]});
 db.phase2.importData(snapshot,'replace');
 const restored=db.getDailyPlan('2026-11-14');
 assert.equal(restored.intention,'Export this plan');
 assert.equal(restored.items.length,1);
 assert.equal(db.getDailyPlan('2026-11-15').items.length,0);
});

test('replace with an empty validated export clears every workspace table safely',t=>{
 const p=fixture(t);
 const habit=p.saveHabit({name:'Clear habit'});
 p.logHabit({habitId:habit.id,date:'2026-11-10',completedCount:1});
 p.saveFocusSession({id:'clear-focus',sessionType:'focus',startedAt:'2026-11-10T08:00:00.000Z',endedAt:'2026-11-10T08:25:00.000Z',plannedSeconds:1500,actualSeconds:1500,status:'completed'});
 p.saveJournalEntry({date:'2026-11-10',title:'Clear journal',content:'Temporary'});
 p.saveWeeklyReview({weekStart:'2026-11-09',weekEnd:'2026-11-15',wins:'Temporary'});
 const snapshot=p.exportData();
 const empty={...snapshot,tables:Object.fromEntries(Object.keys(snapshot.tables).map(table=>[table,[]]))};
 assert.equal(p.previewImport(empty).valid,true);
 const result=p.importData(empty,'replace');
 assert.equal(result.ok,true);
 assert.equal(p.listHabits().length,0);
 assert.equal(p.listHabitLogs('2026-11-10','2026-11-10').length,0);
 assert.equal(p.listFocusSessions().length,0);
 assert.equal(p.listJournalEntries().length,0);
 assert.equal(p.listWeeklyReviews().length,0);
 assert.equal(p.searchAll('Clear').length,0);
});

test('global search finds journal and habits',t=>{
  const p=fixture(t);
  p.saveHabit({name:'Read biology'});
  p.saveJournalEntry({date:'2026-11-10',title:'Biology reflection'});
  const results=p.searchAll('biology');
  assert.ok(results.some(x=>x.type==='habit'));
  assert.ok(results.some(x=>x.type==='journal'));
});

test('habit streaks preserve history and archive does not delete logs',t=>{
 const p=fixture(t),habit=p.saveHabit({name:'Daily habit',frequency:'daily'});
 const today=new Date(),yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
 const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 p.logHabit({habitId:habit.id,date:fmt(yesterday),completedCount:1});
 p.logHabit({habitId:habit.id,date:fmt(today),completedCount:1});
 const stats=p.listHabits()[0];
 assert.equal(stats.current_streak,2);
 assert.equal(stats.longest_streak,2);
 p.archiveHabit(habit.id,true);
 assert.equal(p.listHabitLogs(fmt(yesterday),fmt(today)).length,2);
});

test('journal reflection fields and goal/project/task links are stored atomically',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-journal-'));
 const {createDatabase}=require('../src/core/sqlite.cjs');
 const db=createDatabase(path.join(dir,'db.sqlite'));
 t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
 const goal=db.saveGoal({title:'Journal goal'}),project=db.saveProject({name:'Journal project'}),task=db.saveTask({title:'Journal task'});
 const entry=db.phase2.saveJournalEntry({date:'2026-11-10',entryType:'reflection',mood:'calm',energy:4,wins:'Win',challenges:'Challenge',lessons:'Lesson',tomorrowFocus:'Next',notes:'Note',goalIds:[goal.id],projectIds:[project.id],taskIds:[task.id]});
 assert.equal(entry.mood,'calm');assert.equal(entry.energy,4);assert.equal(entry.wins,'Win');
 assert.deepEqual(entry.goalIds,[goal.id]);assert.deepEqual(entry.projectIds,[project.id]);assert.deepEqual(entry.taskIds,[task.id]);
 assert.equal(db.phase2.listJournalEntries()[0].tomorrow_focus,'Next');
 assert.ok(db.phase2.searchAll('Challenge').some(x=>x.type==='journal'&&x.id===entry.id));
 assert.equal(db.phase2.deleteJournalEntry(entry.id),true);
 assert.equal(db.phase2.listJournalEntries().length,0);
});

test('journal title, body and global-search record survive a full database restart',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-journal-restart-'));
 const file=path.join(dir,'db.sqlite');
 const first=createDatabase(file);
 const saved=first.phase2.saveJournalEntry({date:'2026-11-14',title:'Restart persistence marker',content:'Journal body survives restart'});
 first.close();
 const second=createDatabase(file);
 t.after(()=>{second.close();fs.rmSync(dir,{recursive:true,force:true});});
 const restored=second.phase2.listJournalEntries(100).find(row=>row.id===saved.id);
 assert.ok(restored);
 assert.equal(restored.title,'Restart persistence marker');
 assert.equal(restored.content,'Journal body survives restart');
 assert.ok(second.phase2.searchAll('Restart persistence marker',200).some(row=>row.id===saved.id));
});

test('focus analytics attribute UTC events to the operating-system local calendar date',t=>{
 const script=[
  "const fs=require('node:fs'),os=require('node:os'),path=require('node:path');",
  "const {createDatabase}=require('./src/core/sqlite.cjs');",
  "const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-local-analytics-'));",
  "const db=createDatabase(path.join(dir,'db.sqlite'));",
  "db.phase2.saveFocusSession({startedAt:'2026-11-14T18:30:00.000Z',endedAt:'2026-11-14T18:55:00.000Z',plannedSeconds:1500,actualSeconds:1500,status:'completed'});",
  "const data=db.phase2.getInsights('2026-11-15','2026-11-15');",
  "process.stdout.write(JSON.stringify({seconds:data.focus.seconds,day:data.daily[0]?.day,hour:data.byHour[0]?.hour,weekday:data.byWeekday[0]?.weekday}));",
  "db.close();fs.rmSync(dir,{recursive:true,force:true});"
 ].join('');
 const result=spawnSync(process.execPath,['-e',script],{encoding:'utf8',env:{...process.env,TZ:'Asia/Ho_Chi_Minh'}});
 assert.equal(result.status,0,result.stderr);
 assert.deepEqual(JSON.parse(result.stdout),{seconds:1500,day:'2026-11-15',hour:'01',weekday:'0'});
});

test('daily plan enforces three MIT tasks and persists selections across restart',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-daily-plan-'));
 const file=path.join(dir,'db.sqlite');
 const first=createDatabase(file);
 const tasks=['One','Two','Three','Four'].map(title=>first.saveTask({title}));
 const saved=first.saveDailyPlan({date:'2026-11-14',intention:'Protect focused time',mitTaskIds:tasks.slice(0,3).map(task=>task.id)});
 assert.equal(saved.items.length,3);
 assert.deepEqual(saved.items.map(item=>item.task_id),tasks.slice(0,3).map(task=>task.id));
 assert.throws(()=>first.saveDailyPlan({date:'2026-11-14',mitTaskIds:tasks.map(task=>task.id)}),/no more than three/i);
 assert.throws(()=>first.saveDailyPlan({date:'2026-11-14',mitTaskIds:['missing-task']}),/does not exist or is archived/i);
 first.close();
 const second=createDatabase(file);
 t.after(()=>{second.close();fs.rmSync(dir,{recursive:true,force:true});});
 const restored=second.getDailyPlan('2026-11-14');
 assert.equal(restored.intention,'Protect focused time');
 assert.deepEqual(restored.items.map(item=>item.task_id),tasks.slice(0,3).map(task=>task.id));
 const raw=new (require('better-sqlite3'))(file,{readonly:true});
 try{assert.equal(raw.pragma('user_version',{simple:true}),8);}finally{raw.close();}
});

test('schema migration is idempotent across database restarts',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-migration-restart-'));
 const file=path.join(dir,'db.sqlite');
 const {createDatabase}=require('../src/core/sqlite.cjs');
 const first=createDatabase(file);const goal=first.saveGoal({title:'Persistent across migration'});first.close();
 const second=createDatabase(file);
 t.after(()=>{second.close();fs.rmSync(dir,{recursive:true,force:true});});
 assert.equal(second.loadWorkspace().goals[0].id,goal.id);
 const Database=require('better-sqlite3');const raw=new Database(file,{readonly:true});
 try{assert.equal(raw.pragma('user_version',{simple:true}),8);}finally{raw.close();}
});

test('active focus timer state survives database restart',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-focus-recovery-'));
 const file=path.join(dir,'db.sqlite');
 const {createDatabase}=require('../src/core/sqlite.cjs');
 const first=createDatabase(file);
 const state={id:'session-recovery',status:'running',sessionType:'focus',plannedSeconds:1500,remainingSeconds:900,endTimestamp:Date.now()+900000};
 first.saveSettings({focusTimerState:state});first.close();
 const second=createDatabase(file);
 t.after(()=>{second.close();fs.rmSync(dir,{recursive:true,force:true});});
 assert.equal(second.loadWorkspace().settings.focusTimerState.id,'session-recovery');
 assert.equal(second.loadWorkspace().settings.focusTimerState.endTimestamp,state.endTimestamp);
});

test('journal entries and entity links survive schema migration',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-journal-migration-'));
 const file=path.join(dir,'db.sqlite');
 const {createDatabase}=require('../src/core/sqlite.cjs');
 const first=createDatabase(file),goal=first.saveGoal({title:'Keep journal relation'});
 const entry=first.phase2.saveJournalEntry({date:'2026-11-10',title:'Preserve me',goalIds:[goal.id]});
 first.close();
 const Database=require('better-sqlite3'),raw=new Database(file);raw.pragma('user_version = 6');raw.close();
 const second=createDatabase(file);
 t.after(()=>{second.close();fs.rmSync(dir,{recursive:true,force:true});});
 const restored=second.phase2.listJournalEntries()[0];
 assert.equal(restored.id,entry.id);assert.deepEqual(restored.goalIds,[goal.id]);
 assert.equal(second.loadWorkspace().goals[0].id,goal.id);
});

test('insights aggregate focus, habit and goal data over a selected period',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aurestar-insights-'));
 const {createDatabase}=require('../src/core/sqlite.cjs'),db=createDatabase(path.join(dir,'db.sqlite'));
 t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
 const goal=db.saveGoal({title:'Analytics goal'});
 const habit=db.phase2.saveHabit({name:'Analytics habit',frequency:'daily'});
 const today=new Date().toISOString().slice(0,10);
 db.phase2.logHabit({habitId:habit.id,date:today,completedCount:1});
 db.phase2.saveFocusSession({sessionType:'focus',startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),plannedSeconds:1500,actualSeconds:1200,status:'completed'});
 const data=db.phase2.getInsights('2000-01-01','2999-12-31');
 assert.equal(data.focus.sessions,1);assert.equal(data.focus.seconds,1200);
 assert.equal(data.habits.completions,1);assert.equal(data.goals.active,1);
 assert.ok(data.habits.average_weekly_consistency>=0);
});

test('habit consistency analytics respect the selected historical date range',t=>{
 const p=fixture(t);
 const habit=p.saveHabit({name:'Historical reading',frequency:'daily',startDate:'2026-11-01'});
 p.logHabit({habitId:habit.id,date:'2026-11-01',completedCount:1});
 p.logHabit({habitId:habit.id,date:'2026-11-03',completedCount:1});
 const insights=p.getInsights('2026-11-01','2026-11-03');
 assert.equal(insights.habits.average_weekly_consistency,67);
 assert.equal(insights.habits.average_monthly_consistency,67);
 const review=p.getWeeklyReviewSummary('2026-11-01','2026-11-03');
 assert.equal(review.habits.consistency,67);
});

test('global search includes habit descriptions and journal body content',t=>{
 const p=fixture(t);
 p.saveHabit({name:'Morning routine',description:'Read astronomy notes'});
 p.saveJournalEntry({date:'2026-11-10',title:'Evening notes',content:'Remember the lunar eclipse'});
 assert.ok(p.searchAll('astronomy').some(x=>x.type==='habit'));
 assert.ok(p.searchAll('lunar eclipse').some(x=>x.type==='journal'));
});
