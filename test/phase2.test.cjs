const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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
  const invalid={...snapshot,tables:{...snapshot.tables,habits:[{name:'invalid'}]}};
  assert.throws(()=>p.importData(invalid,'update'));
  assert.equal(p.listHabits()[0].id,habit.id);
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
 assert.equal(db.phase2.deleteJournalEntry(entry.id),true);
 assert.equal(db.phase2.listJournalEntries().length,0);
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
 try{assert.equal(raw.pragma('user_version',{simple:true}),6);}finally{raw.close();}
});
