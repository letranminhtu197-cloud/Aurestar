const { randomUUID } = require('node:crypto');
const now = () => new Date().toISOString();
const clean = (v, max=5000) => String(v ?? '').trim().slice(0,max);
const date = v => {
  if (!v) return null;
  const s=String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s+'T00:00:00Z')) || new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s) throw new Error('Invalid calendar date.');
  return s;
};
const enumValue = (v, values, fallback) => values.includes(v) ? v : fallback;

function attachPhase2(db) {
  const habitList = () => {
    const habits=db.prepare(`SELECT h.*,COALESCE((SELECT SUM(completed_count) FROM habit_logs l WHERE l.habit_id=h.id),0) AS total_completions,
      (SELECT completed_count FROM habit_logs l WHERE l.habit_id=h.id AND l.log_date=date('now','localtime')) AS today_count
      FROM habits h ORDER BY h.archived_at IS NOT NULL,h.created_at DESC`).all();
    const allLogs=db.prepare('SELECT habit_id,log_date,completed,completed_count FROM habit_logs ORDER BY log_date').all();
    const today=new Date();today.setHours(12,0,0,0);
    const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const shift=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
    return habits.map(h=>{
      const logs=allLogs.filter(x=>x.habit_id===h.id), done=new Set(logs.filter(x=>x.completed&&x.completed_count>0).map(x=>x.log_date));
      let weekdays=[];try{weekdays=JSON.parse(h.selected_weekdays||'[]');}catch{}
      const scheduled=d=>{const key=fmt(d);if(h.start_date&&key<h.start_date)return false;if(h.end_date&&key>h.end_date)return false;const day=d.getDay();if(h.frequency==='daily')return true;if(h.frequency==='weekdays')return weekdays.length?weekdays.includes(day):day>=1&&day<=5;if(h.frequency==='weekly')return true;return weekdays.includes(day);};
      let current=0, longest=0, streak=0;let first=logs[0]?.log_date||h.start_date||fmt(shift(today,-365));const firstDate=new Date(first+'T12:00:00');
      for(let d=new Date(firstDate);d<=today;d=shift(d,1)){if(!scheduled(d))continue;if(done.has(fmt(d))){streak++;longest=Math.max(longest,streak);}else streak=0;}
      let cursor=new Date(today);for(let n=0;n<370;n++,cursor=shift(cursor,-1)){if(!scheduled(cursor))continue;if(done.has(fmt(cursor)))current++;else break;}
      const period=(days)=>{const from=shift(today,-days+1);const scheduledDays=[];for(let d=new Date(from);d<=today;d=shift(d,1))if(scheduled(d))scheduledDays.push(fmt(d));if(h.frequency==='weekly'){const total=logs.filter(x=>x.log_date>=fmt(from)&&x.log_date<=fmt(today)).reduce((n,x)=>n+(x.completed_count||0),0);return Math.min(100,Math.round(total/Math.max(1,h.target_count*(days/7))*100));}return scheduledDays.length?Math.round(scheduledDays.filter(d=>done.has(d)).length/scheduledDays.length*100):0;};
      return {...h,current_streak:current,longest_streak:longest,weekly_consistency:period(7),monthly_consistency:period(30)};
    });
  };
  function saveHabit(input={}) {
    const id=clean(input.id,80)||randomUUID(), name=clean(input.name,160);
    if(!name) throw new Error('Habit name is required.');
    const stamp=now(), frequency=enumValue(input.frequency,['daily','weekdays','weekly','custom'],'daily');
    const target=Math.max(1,Math.min(100,Math.round(Number(input.targetCount)||1)));
    const weekdays=[...new Set((Array.isArray(input.selectedWeekdays)?input.selectedWeekdays:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))];
    const startDate=date(input.startDate),endDate=date(input.endDate);if(startDate&&endDate&&endDate<startDate)throw new Error('Habit end date must be on or after start date.');
    db.prepare(`INSERT INTO habits(id,name,description,frequency,target_count,color,selected_weekdays,start_date,end_date,unit,icon,archived_at,created_at,updated_at)
      VALUES(@id,@name,@description,@frequency,@target_count,@color,@selected_weekdays,@start_date,@end_date,@unit,@icon,@archived_at,@created_at,@updated_at)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,frequency=excluded.frequency,
      target_count=excluded.target_count,color=excluded.color,selected_weekdays=excluded.selected_weekdays,start_date=excluded.start_date,
      end_date=excluded.end_date,unit=excluded.unit,icon=excluded.icon,archived_at=excluded.archived_at,updated_at=excluded.updated_at`)
      .run({id,name,description:clean(input.description),frequency,target_count:target,
        color:/^#[0-9a-f]{6}$/i.test(input.color||'')?input.color:'#B94A62',selected_weekdays:JSON.stringify(weekdays),start_date:startDate,end_date:endDate,
        unit:clean(input.unit,30)||'times',icon:clean(input.icon,50)||'check-circle',archived_at:input.active===false?stamp:null,created_at:stamp,updated_at:stamp});
    return db.prepare('SELECT * FROM habits WHERE id=?').get(id);
  }
  function deleteHabit(id) { return db.prepare('DELETE FROM habits WHERE id=?').run(clean(id,80)).changes>0; }
  function archiveHabit(id,archived=true) { const stamp=archived?now():null; const result=db.prepare('UPDATE habits SET archived_at=?,updated_at=? WHERE id=?').run(stamp,now(),clean(id,80)); if(!result.changes)throw new Error('Habit not found.'); return {archived:Boolean(stamp)}; }
  function logHabit(input={}) {
    const habitId=clean(input.habitId,80), logDate=date(input.date)||new Date().toISOString().slice(0,10);
    if(!db.prepare('SELECT id FROM habits WHERE id=? AND archived_at IS NULL').get(habitId)) throw new Error('Habit not found.');
    const count=Math.max(0,Math.min(100,Math.round(Number(input.completedCount)||0))), stamp=now();
    const completed=input.completed===undefined?count>0:Boolean(input.completed), value=Math.max(0,Math.min(100000,Number(input.value??count)||0));
    db.prepare(`INSERT INTO habit_logs(id,habit_id,log_date,completed_count,note,completed,value,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(habit_id,log_date) DO UPDATE SET completed_count=excluded.completed_count,note=excluded.note,completed=excluded.completed,value=excluded.value,updated_at=excluded.updated_at`)
      .run(randomUUID(),habitId,logDate,count,clean(input.note,1000),completed?1:0,value,stamp,stamp);
    return db.prepare('SELECT * FROM habit_logs WHERE habit_id=? AND log_date=?').get(habitId,logDate);
  }
  function listHabitLogs(from,to) {
    const a=date(from)||'0001-01-01', b=date(to)||'9999-12-31';
    return db.prepare('SELECT * FROM habit_logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date DESC').all(a,b);
  }
  function saveFocusSession(input={}) {
    const id=clean(input.id,80)||randomUUID(), taskId=clean(input.taskId,80)||null, stamp=now();
    if(taskId&&!db.prepare('SELECT id FROM tasks WHERE id=?').get(taskId)) throw new Error('Linked task does not exist.');
    const started=input.startedAt?new Date(input.startedAt).toISOString():stamp;
    const ended=input.endedAt?new Date(input.endedAt).toISOString():null;
    const planned=Math.max(60,Math.min(86400,Math.round(Number(input.plannedSeconds)||1500)));
    const actual=Math.max(0,Math.min(86400,Math.round(Number(input.actualSeconds)||0)));
    const type=enumValue(input.sessionType,['focus','short_break','long_break'],'focus');
    const status=enumValue(input.status,['running','paused','completed','cancelled'],'completed');
    db.prepare(`INSERT INTO focus_sessions(id,task_id,session_type,started_at,ended_at,planned_seconds,actual_seconds,status,note,created_at)
      VALUES(@id,@task_id,@session_type,@started_at,@ended_at,@planned_seconds,@actual_seconds,@status,@note,@created_at)
      ON CONFLICT(id) DO UPDATE SET task_id=excluded.task_id,session_type=excluded.session_type,started_at=excluded.started_at,
      ended_at=excluded.ended_at,planned_seconds=excluded.planned_seconds,actual_seconds=excluded.actual_seconds,status=excluded.status,note=excluded.note`)
      .run({id,task_id:taskId,session_type:type,started_at:started,ended_at:ended,planned_seconds:planned,actual_seconds:actual,status,note:clean(input.note,1000),created_at:stamp});
    return db.prepare('SELECT * FROM focus_sessions WHERE id=?').get(id);
  }
  function listFocusSessions(limit=500) {
    return db.prepare('SELECT f.*,t.title AS task_title FROM focus_sessions f LEFT JOIN tasks t ON t.id=f.task_id ORDER BY f.started_at DESC LIMIT ?').all(Math.max(1,Math.min(5000,Number(limit)||500)));
  }
  function saveJournalEntry(input={}) {
    const entryDate=date(input.date)||new Date().toISOString().slice(0,10), id=clean(input.id,80)||randomUUID(), stamp=now();
    const entryType=enumValue(input.entryType,['reflection','freewriting'],'reflection');
    const mood=clean(input.mood,40)||null,energy=input.energy==null?null:Math.max(1,Math.min(5,Math.round(Number(input.energy)||1)));
    const transaction=db.transaction(()=>{
      db.prepare(`INSERT INTO journal_entries(id,entry_date,title,content,mood,energy,entry_type,wins,challenges,lessons,tomorrow_focus,notes,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET entry_date=excluded.entry_date,title=excluded.title,content=excluded.content,
        mood=excluded.mood,energy=excluded.energy,entry_type=excluded.entry_type,wins=excluded.wins,challenges=excluded.challenges,
        lessons=excluded.lessons,tomorrow_focus=excluded.tomorrow_focus,notes=excluded.notes,updated_at=excluded.updated_at`)
        .run(id,entryDate,clean(input.title,180),clean(input.content,20000),mood,energy,entryType,clean(input.wins,5000),clean(input.challenges,5000),
          clean(input.lessons,5000),clean(input.tomorrowFocus,5000),clean(input.notes,10000),stamp,stamp);
      const saved=db.prepare('SELECT * FROM journal_entries WHERE id=?').get(id);
      for(const [kind,table,field,ids] of [['goal','journal_goal_links','goal_id',input.goalIds],['project','journal_project_links','project_id',input.projectIds],['task','journal_task_links','task_id',input.taskIds]]){
        db.prepare('DELETE FROM '+table+' WHERE journal_id=?').run(saved.id);
        const add=db.prepare('INSERT INTO '+table+'(journal_id,'+field+') VALUES(?,?)');
        for(const linked of [...new Set(Array.isArray(ids)?ids.map(x=>clean(x,80)).filter(Boolean):[])]){if(!db.prepare('SELECT id FROM '+(kind==='goal'?'goals':kind==='project'?'projects':'tasks')+' WHERE id=?').get(linked))throw new Error('Linked '+kind+' does not exist.');add.run(saved.id,linked);}
      }
      return saved;
    });
    const saved=transaction();
    return {...saved,goalIds:db.prepare('SELECT goal_id FROM journal_goal_links WHERE journal_id=?').all(saved.id).map(x=>x.goal_id),
      projectIds:db.prepare('SELECT project_id FROM journal_project_links WHERE journal_id=?').all(saved.id).map(x=>x.project_id),
      taskIds:db.prepare('SELECT task_id FROM journal_task_links WHERE journal_id=?').all(saved.id).map(x=>x.task_id)};
  }
  function deleteJournalEntry(id) { return db.prepare('DELETE FROM journal_entries WHERE id=?').run(clean(id,80)).changes>0; }
  function listJournalEntries(limit=365) {
    return db.prepare('SELECT * FROM journal_entries ORDER BY entry_date DESC LIMIT ?').all(Math.max(1,Math.min(5000,Number(limit)||365))).map(row=>({...row,
      goalIds:db.prepare('SELECT goal_id FROM journal_goal_links WHERE journal_id=?').all(row.id).map(x=>x.goal_id),
      projectIds:db.prepare('SELECT project_id FROM journal_project_links WHERE journal_id=?').all(row.id).map(x=>x.project_id),
      taskIds:db.prepare('SELECT task_id FROM journal_task_links WHERE journal_id=?').all(row.id).map(x=>x.task_id)}));
  }
  function getWeeklyReviewSummary(from,to) {
    const start=date(from);if(!start)throw new Error('Week start is required.');
    const end=date(to);if(!end||end<start)throw new Error('Week end must be on or after week start.');
    const tasks=db.prepare(`SELECT COUNT(*) created,(SELECT COUNT(*) FROM tasks WHERE archived_at IS NULL AND date(completed_at) BETWEEN ? AND ?) completed,
      (SELECT COUNT(*) FROM tasks WHERE archived_at IS NULL AND due_date BETWEEN ? AND ? AND status NOT IN ('completed','cancelled')) open_due
      FROM tasks WHERE archived_at IS NULL AND date(created_at) BETWEEN ? AND ?`).get(start,end,start,end,start,end);
    const focus=db.prepare(`SELECT COUNT(*) sessions,COALESCE(SUM(actual_seconds),0) seconds FROM focus_sessions
      WHERE session_type='focus' AND status='completed' AND date(started_at) BETWEEN ? AND ?`).get(start,end);
    const goals=db.prepare(`SELECT SUM(status='active') active,SUM(status='completed') completed,COALESCE(AVG(progress_value),0) average_progress
      FROM goals WHERE archived_at IS NULL`).get();
    const habits=db.prepare(`SELECT COUNT(*) logs,COALESCE(SUM(completed_count),0) completions,
      COUNT(DISTINCT habit_id) habits_tracked FROM habit_logs WHERE log_date BETWEEN ? AND ? AND completed=1`).get(start,end);
    const milestones=db.prepare(`SELECT COUNT(*) total,SUM(status='completed') completed FROM milestones WHERE date(updated_at) BETWEEN ? AND ?`).get(start,end);
    return {from:start,to:end,tasks,focus,goals,habits,milestones};
  }
  function saveWeeklyReview(input={}) {
    const start=date(input.weekStart); if(!start) throw new Error('Week start is required.');
    const end=date(input.weekEnd); if(!end||end<start) throw new Error('Week end must be on or after week start.');
    const id=clean(input.id,80)||randomUUID(), stamp=now(), rating=input.rating==null?null:Math.max(1,Math.min(5,Math.round(Number(input.rating)||1)));
    db.prepare(`INSERT INTO weekly_reviews(id,week_start,week_end,wins,challenges,lessons,next_week,rating,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(week_start) DO UPDATE SET week_end=excluded.week_end,wins=excluded.wins,
      challenges=excluded.challenges,lessons=excluded.lessons,next_week=excluded.next_week,rating=excluded.rating,updated_at=excluded.updated_at`)
      .run(id,start,end,clean(input.wins,5000),clean(input.challenges,5000),clean(input.lessons,5000),clean(input.nextWeek,5000),rating,stamp,stamp);
    return db.prepare('SELECT * FROM weekly_reviews WHERE week_start=?').get(start);
  }
  function listWeeklyReviews(limit=52) {
    return db.prepare('SELECT * FROM weekly_reviews ORDER BY week_start DESC LIMIT ?').all(Math.max(1,Math.min(520,Number(limit)||52)));
  }
  function searchAll(query,limit=50) {
    const q=clean(query,200); if(q.length<2) return [];
    const like='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
    const rows=[];
    for(const [type,table,field] of [['goal','goals','title'],['project','projects','name'],['task','tasks','title'],['habit','habits','name'],['journal','journal_entries','title'],['weekly_review','weekly_reviews','wins']]) {
      const extra=type==='journal'?' OR content LIKE ? ESCAPE \'\\\'':type==='weekly_review'?' OR challenges LIKE ? ESCAPE \'\\\' OR lessons LIKE ? ESCAPE \'\\\'':'';
      const params=extra?extra.includes('lessons')?[like,like,like]:[like,like]:[like];
      const result=db.prepare(`SELECT id,${field} AS title,updated_at FROM ${table} WHERE ${field} LIKE ? ESCAPE '\\'${extra} ORDER BY updated_at DESC LIMIT ?`).all(...params,Math.max(1,Math.min(200,limit)));
      rows.push(...result.map(x=>({...x,type})));
    }
    return rows.sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,Math.max(1,Math.min(200,limit)));
  }
  function getInsights(from,to) {
    const start=date(from)||new Date(Date.now()-29*86400000).toISOString().slice(0,10),end=date(to)||new Date().toISOString().slice(0,10);
    if(end<start)throw new Error('Insights end date must be on or after start date.');
    const tasks=db.prepare(`SELECT COUNT(*) created,
      (SELECT COUNT(*) FROM tasks WHERE archived_at IS NULL AND date(completed_at) BETWEEN ? AND ?) completed,
      (SELECT COUNT(*) FROM tasks WHERE archived_at IS NULL AND due_date BETWEEN ? AND ? AND status NOT IN ('completed','cancelled')) overdue
      FROM tasks WHERE archived_at IS NULL AND date(created_at) BETWEEN ? AND ?`).get(start,end,start,end,start,end);
    tasks.completion_rate=tasks.created?Math.round(tasks.completed/tasks.created*100):0;
    const taskTrend=db.prepare(`SELECT date(completed_at) day,COUNT(*) completed FROM tasks WHERE archived_at IS NULL AND status='completed'
      AND date(completed_at) BETWEEN ? AND ? GROUP BY date(completed_at) ORDER BY day`).all(start,end);
    const focus=db.prepare(`SELECT COUNT(*) sessions,COALESCE(SUM(actual_seconds),0) seconds,
      COALESCE(AVG(actual_seconds),0) average_seconds FROM focus_sessions WHERE session_type='focus' AND status='completed'
      AND date(started_at) BETWEEN ? AND ?`).get(start,end);
    const daily=db.prepare(`SELECT date(started_at) day,COUNT(*) sessions,COALESCE(SUM(actual_seconds),0) seconds FROM focus_sessions
      WHERE session_type='focus' AND status='completed' AND date(started_at) BETWEEN ? AND ? GROUP BY date(started_at) ORDER BY day`).all(start,end);
    const byWeekday=db.prepare(`SELECT strftime('%w',started_at) weekday,COUNT(*) sessions,COALESCE(SUM(actual_seconds),0) seconds FROM focus_sessions
      WHERE session_type='focus' AND status='completed' AND date(started_at) BETWEEN ? AND ? GROUP BY weekday ORDER BY weekday`).all(start,end);
    const byHour=db.prepare(`SELECT strftime('%H',started_at) hour,COUNT(*) sessions FROM focus_sessions
      WHERE session_type='focus' AND status='completed' AND date(started_at) BETWEEN ? AND ? GROUP BY hour ORDER BY hour`).all(start,end);
    const byTask=db.prepare(`SELECT t.id task_id,t.title,COUNT(f.id) sessions,COALESCE(SUM(f.actual_seconds),0) seconds FROM focus_sessions f
      LEFT JOIN tasks t ON t.id=f.task_id WHERE f.session_type='focus' AND f.status='completed' AND date(f.started_at) BETWEEN ? AND ?
      GROUP BY t.id,t.title ORDER BY seconds DESC LIMIT 20`).all(start,end);
    const goals=db.prepare(`SELECT SUM(status='active' AND archived_at IS NULL) active,SUM(status='completed' AND archived_at IS NULL) completed,
      COALESCE(AVG(CASE WHEN archived_at IS NULL THEN progress_value END),0) average_progress FROM goals`).get();
    const milestones=db.prepare(`SELECT COUNT(*) total,SUM(status='completed') completed FROM milestones`).get();
    const habits=db.prepare(`SELECT COUNT(*) logs,COALESCE(SUM(completed_count),0) completions,COUNT(DISTINCT habit_id) tracked
      FROM habit_logs WHERE log_date BETWEEN ? AND ? AND completed=1`).get(start,end);
    const habitStats=habitList().filter(h=>!h.archived_at);
    habits.average_weekly_consistency=habitStats.length?Math.round(habitStats.reduce((n,h)=>n+h.weekly_consistency,0)/habitStats.length):0;
    habits.average_monthly_consistency=habitStats.length?Math.round(habitStats.reduce((n,h)=>n+h.monthly_consistency,0)/habitStats.length):0;
    return {from:start,to:end,tasks,taskTrend,focus,daily,byWeekday,byHour,byTask,goals,milestones,habits};
  }
  function savePreference(key,value) {
    const k=clean(key,80); if(!k) throw new Error('Setting key is required.');
    db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at')
      .run(k,JSON.stringify(value),now());
    return value;
  }
  const exportTables=['goals','milestones','projects','project_goal_links','tasks','task_goal_links','tags','task_tags','settings','habits','habit_logs','focus_sessions','journal_entries','journal_goal_links','journal_project_links','journal_task_links','weekly_reviews'];
  const importKeys={project_goal_links:['project_id','goal_id'],task_goal_links:['task_id','goal_id'],task_tags:['task_id','tag_id'],habit_logs:['habit_id','log_date'],journal_entries:['id'],weekly_reviews:['week_start'],settings:['key'],journal_goal_links:['journal_id','goal_id'],journal_project_links:['journal_id','project_id'],journal_task_links:['journal_id','task_id']};
  function exportData() {
    const data={format:'aurestar-sqlite-export',version:2,schemaVersion:db.pragma('user_version',{simple:true}),exportedAt:now(),app:'Aurestar',tables:{}};
    for(const table of exportTables) data.tables[table]=db.prepare('SELECT * FROM '+table).all();
    return data;
  }
  function previewImport(payload) {
    if(!payload||payload.format!=='aurestar-sqlite-export'||!payload.tables||typeof payload.tables!=='object'||Array.isArray(payload.tables)) throw new Error('Unsupported Aurestar export format.');
    const schemaVersion=Number(payload.schemaVersion||1),currentVersion=db.pragma('user_version',{simple:true});
    if(!Number.isInteger(schemaVersion)||schemaVersion<1||schemaVersion>currentVersion) throw new Error('Backup schema version is not supported by this application.');
    for(const table of Object.keys(payload.tables)) if(!exportTables.includes(table)) throw new Error('Unsupported table in import: '+table);
    const summary={};
    for(const table of exportTables) {
      const rows=payload.tables[table]??[];
      if(!Array.isArray(rows)) throw new Error('Invalid table data: '+table);
      const columns=new Set(db.pragma('table_info('+table+')').map(column=>column.name));
      const keys=importKeys[table]||['id'];
      let duplicates=0;
      for(const row of rows) {
        if(!row||typeof row!=='object'||Array.isArray(row)) throw new Error('Invalid row in '+table);
        const rowKeys=Object.keys(row);
        if(rowKeys.some(key=>!columns.has(key))) throw new Error('Unknown column in '+table);
        if(!keys.every(key=>Object.hasOwn(row,key))) throw new Error('Missing primary key in '+table);
        if(db.prepare('SELECT 1 FROM '+table+' WHERE '+keys.map(key=>'`'+key+'`=?').join(' AND ')).get(...keys.map(key=>row[key]))) duplicates++;
      }
      summary[table]={incoming:rows.length,existing:db.prepare('SELECT COUNT(*) n FROM '+table).get().n,duplicates,newRecords:rows.length-duplicates};
    }
    return {valid:true,version:payload.version||0,schemaVersion,summary};
  }
  function importData(payload,mode='merge') {
    const preview=previewImport(payload);
    if(!['merge','update','replace'].includes(mode)) throw new Error('Unsupported import mode.');
    const tables=['goals','projects','tasks','tags','milestones','project_goal_links','task_goal_links','task_tags','habits','habit_logs','focus_sessions','journal_entries','weekly_reviews','settings','journal_goal_links','journal_project_links','journal_task_links'];
    const report={inserted:0,updated:0,skipped:0};
    const transaction=db.transaction(()=>{
      if(mode==='replace') for(const table of ['habit_logs','focus_sessions','journal_goal_links','journal_project_links','journal_task_links','journal_entries','weekly_reviews','task_tags','task_goal_links','project_goal_links','milestones','tasks','projects','goals','tags','habits','settings']) db.prepare('DELETE FROM '+table).run();
      for(const table of tables) {
        const rows=payload.tables[table]||[],keys=importKeys[table]||['id'];
        const columns=new Set(db.pragma('table_info('+table+')').map(column=>column.name));
        for(const row of rows) {
          const rowKeys=Object.keys(row);
          if(rowKeys.some(key=>!columns.has(key))) throw new Error('Unknown column in '+table);
          if(!keys.every(key=>Object.hasOwn(row,key))) throw new Error('Missing primary key in '+table);
          const exists=Boolean(db.prepare('SELECT 1 FROM '+table+' WHERE '+keys.map(key=>'`'+key+'`=?').join(' AND ')).get(...keys.map(key=>row[key])));
          if(mode==='merge'&&exists){report.skipped++;continue;}
          const cols=rowKeys.map(key=>'`'+key+'`').join(','),placeholders=rowKeys.map(()=>'?').join(',');
          const updates=rowKeys.filter(key=>!keys.includes(key)).map(key=>'`'+key+'`=excluded.`'+key+'`').join(',');
          const sql=`INSERT INTO ${table}(${cols}) VALUES(${placeholders}) ON CONFLICT(${keys.join(',')}) ${updates?'DO UPDATE SET '+updates:'DO NOTHING'}`;
          db.prepare(sql).run(...rowKeys.map(key=>row[key]));
          if(mode==='update'&&exists)report.updated++;else report.inserted++;
        }
      }
      const fk=db.pragma('foreign_key_check');
      if(fk.length) throw new Error('Import failed integrity validation: foreign key violations were detected.');
      const check=db.pragma('quick_check',{simple:true});
      if(check!=='ok') throw new Error('Import failed SQLite integrity verification.');
    });
    transaction();
    return {ok:true,mode,report,preview,integrity:'ok'};
  }
  return {saveHabit,deleteHabit,archiveHabit,logHabit,listHabits:habitList,listHabitLogs,saveFocusSession,listFocusSessions,
    saveJournalEntry,deleteJournalEntry,listJournalEntries,saveWeeklyReview,listWeeklyReviews,getWeeklyReviewSummary,searchAll,getInsights,
    savePreference,exportData,previewImport,importData};
}
module.exports={attachPhase2};
