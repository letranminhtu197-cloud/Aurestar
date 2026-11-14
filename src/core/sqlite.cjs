const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { attachPhase2 } = require('./phase2.cjs');
const { formatLocalDate } = require('./date-utils.cjs');

const now = () => new Date().toISOString();
const text = (value, max = 5000) => String(value ?? '').trim().slice(0, max);
const date = value => { if (!value) return null; const v = String(value).trim(); const parsed = new Date(v + 'T00:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== v) throw new Error('Date must use a valid YYYY-MM-DD calendar date.'); return v; };
const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;

function createDatabase(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Personal', start_date TEXT, target_date TEXT,
      status TEXT NOT NULL DEFAULT 'active', priority TEXT NOT NULL DEFAULT 'medium',
      progress_mode TEXT NOT NULL DEFAULT 'manual', progress_value REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
    );
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', due_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending', sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active', priority TEXT NOT NULL DEFAULT 'medium',
      start_date TEXT, due_date TEXT, color TEXT NOT NULL DEFAULT '#B94A62',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
    );
    CREATE TABLE IF NOT EXISTS project_goal_links (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      PRIMARY KEY(project_id, goal_id)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo', priority TEXT NOT NULL DEFAULT 'medium',
      start_date TEXT, due_date TEXT, due_time TEXT, estimated_minutes INTEGER,
      actual_minutes INTEGER NOT NULL DEFAULT 0,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT, archived_at TEXT
    );
    CREATE TABLE IF NOT EXISTS task_goal_links (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      PRIMARY KEY(task_id, goal_id)
    );
    CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS task_tags (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY(task_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_goal ON milestones(goal_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status, target_date);
  `);
  if (db.pragma('user_version', { simple: true }) < 1) db.pragma('user_version = 1');

  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);');
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(1, now());
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_goal_goal ON project_goal_links(goal_id); CREATE INDEX IF NOT EXISTS idx_task_goal_goal ON task_goal_links(goal_id); CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id); CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);');
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(2, now());
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(3, now());

  // Phase 2 migration: additive-only tables. Existing Phase 1 rows are never rewritten.
  const migration4 = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        frequency TEXT NOT NULL DEFAULT 'daily', target_count INTEGER NOT NULL DEFAULT 1,
        color TEXT NOT NULL DEFAULT '#B94A62', archived_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS habit_logs (
        id TEXT PRIMARY KEY, habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        log_date TEXT NOT NULL, completed_count INTEGER NOT NULL DEFAULT 1,
        note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(habit_id, log_date)
      );
      CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(log_date, habit_id);
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY, task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        session_type TEXT NOT NULL DEFAULT 'focus', started_at TEXT NOT NULL,
        ended_at TEXT, planned_seconds INTEGER NOT NULL DEFAULT 1500,
        actual_seconds INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'completed',
        note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_started ON focus_sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id);
      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY, entry_date TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '', mood TEXT, energy INTEGER,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date DESC);
      CREATE TABLE IF NOT EXISTS weekly_reviews (
        id TEXT PRIMARY KEY, week_start TEXT NOT NULL UNIQUE, week_end TEXT NOT NULL,
        wins TEXT NOT NULL DEFAULT '', challenges TEXT NOT NULL DEFAULT '',
        lessons TEXT NOT NULL DEFAULT '', next_week TEXT NOT NULL DEFAULT '',
        rating INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_weekly_reviews_start ON weekly_reviews(week_start DESC);
    `);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(4, now());
    db.pragma('user_version = 4');
  });
  if (db.pragma('user_version', { simple: true }) < 4) migration4();

  const migration5 = db.transaction(() => {
    const addColumn = (table, name, definition) => {
      const columns = db.pragma('table_info(' + table + ')');
      if (!columns.some(column => column.name === name)) db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + name + ' ' + definition);
    };
    addColumn('habits','selected_weekdays',"TEXT NOT NULL DEFAULT '[]'");
    addColumn('habits','start_date','TEXT');
    addColumn('habits','end_date','TEXT');
    addColumn('habits','unit',"TEXT NOT NULL DEFAULT 'times'");
    addColumn('habits','icon',"TEXT NOT NULL DEFAULT 'check-circle'");
    addColumn('habit_logs','completed','INTEGER NOT NULL DEFAULT 1');
    addColumn('habit_logs','value','REAL NOT NULL DEFAULT 1');
    db.exec(`
      CREATE TABLE IF NOT EXISTS journal_goal_links (
        journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        PRIMARY KEY(journal_id,goal_id)
      );
      CREATE TABLE IF NOT EXISTS journal_project_links (
        journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        PRIMARY KEY(journal_id,project_id)
      );
      CREATE TABLE IF NOT EXISTS journal_task_links (
        journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY(journal_id,task_id)
      );
      CREATE INDEX IF NOT EXISTS idx_journal_goal_goal ON journal_goal_links(goal_id);
      CREATE INDEX IF NOT EXISTS idx_journal_project_project ON journal_project_links(project_id);
      CREATE INDEX IF NOT EXISTS idx_journal_task_task ON journal_task_links(task_id);
    `);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(5, now());
    db.pragma('user_version = 5');
  });
  if (db.pragma('user_version', { simple: true }) < 5) migration5();

  const migration6 = db.transaction(() => {
    const addColumn = (table, name, definition) => {
      const columns = db.pragma('table_info(' + table + ')');
      if (!columns.some(column => column.name === name)) db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + name + ' ' + definition);
    };
    addColumn('journal_entries','entry_type',"TEXT NOT NULL DEFAULT 'reflection'");
    addColumn('journal_entries','wins',"TEXT NOT NULL DEFAULT ''");
    addColumn('journal_entries','challenges',"TEXT NOT NULL DEFAULT ''");
    addColumn('journal_entries','lessons',"TEXT NOT NULL DEFAULT ''");
    addColumn('journal_entries','tomorrow_focus',"TEXT NOT NULL DEFAULT ''");
    addColumn('journal_entries','notes',"TEXT NOT NULL DEFAULT ''");
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(6, now());
    db.pragma('user_version = 6');
  });
  if (db.pragma('user_version', { simple: true }) < 6) migration6();

  const migration7 = db.transaction(() => {
    db.exec(`
      CREATE TABLE journal_entries_new (
        id TEXT PRIMARY KEY, entry_date TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '', mood TEXT, energy INTEGER,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        entry_type TEXT NOT NULL DEFAULT 'reflection', wins TEXT NOT NULL DEFAULT '',
        challenges TEXT NOT NULL DEFAULT '', lessons TEXT NOT NULL DEFAULT '',
        tomorrow_focus TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT ''
      );
      INSERT INTO journal_entries_new(id,entry_date,title,content,mood,energy,created_at,updated_at,entry_type,wins,challenges,lessons,tomorrow_focus,notes)
        SELECT id,entry_date,title,content,mood,energy,created_at,updated_at,entry_type,wins,challenges,lessons,tomorrow_focus,notes FROM journal_entries;
      CREATE TEMP TABLE journal_goal_links_backup AS SELECT * FROM journal_goal_links;
      CREATE TEMP TABLE journal_project_links_backup AS SELECT * FROM journal_project_links;
      CREATE TEMP TABLE journal_task_links_backup AS SELECT * FROM journal_task_links;
      DROP TABLE journal_goal_links;
      DROP TABLE journal_project_links;
      DROP TABLE journal_task_links;
      DROP TABLE journal_entries;
      ALTER TABLE journal_entries_new RENAME TO journal_entries;
      CREATE TABLE journal_goal_links (
        journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        PRIMARY KEY(journal_id,goal_id)
      );
      CREATE TABLE journal_project_links (
        journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        PRIMARY KEY(journal_id,project_id)
      );
      CREATE TABLE journal_task_links (
        journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY(journal_id,task_id)
      );
      INSERT INTO journal_goal_links SELECT * FROM journal_goal_links_backup;
      INSERT INTO journal_project_links SELECT * FROM journal_project_links_backup;
      INSERT INTO journal_task_links SELECT * FROM journal_task_links_backup;
      DROP TABLE journal_goal_links_backup;
      DROP TABLE journal_project_links_backup;
      DROP TABLE journal_task_links_backup;
      CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date DESC);
      CREATE INDEX IF NOT EXISTS idx_journal_goal_goal ON journal_goal_links(goal_id);
      CREATE INDEX IF NOT EXISTS idx_journal_project_project ON journal_project_links(project_id);
      CREATE INDEX IF NOT EXISTS idx_journal_task_task ON journal_task_links(task_id);
    `);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(7, now());
    db.pragma('user_version = 7');
  });
  if (db.pragma('user_version', { simple: true }) < 7) migration7();

  const migration8 = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_plans (
        plan_date TEXT PRIMARY KEY, intention TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_mit_items (
        id TEXT PRIMARY KEY,
        plan_date TEXT NOT NULL REFERENCES daily_plans(plan_date) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 3),
        created_at TEXT NOT NULL,
        UNIQUE(plan_date, task_id),
        UNIQUE(plan_date, position)
      );
      CREATE INDEX IF NOT EXISTS idx_daily_mit_task ON daily_mit_items(task_id);
    `);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(8, now());
    db.pragma('user_version = 8');
  });
  if (db.pragma('user_version', { simple: true }) < 8) migration8();




  db.exec('CREATE INDEX IF NOT EXISTS idx_project_goal_goal ON project_goal_links(goal_id); CREATE INDEX IF NOT EXISTS idx_task_goal_goal ON task_goal_links(goal_id); CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id); CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);');

  const getGoalLinks = db.prepare('SELECT goal_id FROM project_goal_links WHERE project_id = ?');
  const getTaskGoalLinks = db.prepare('SELECT goal_id FROM task_goal_links WHERE task_id = ?');
  const getTaskTags = db.prepare('SELECT g.name FROM task_tags l JOIN tags g ON g.id=l.tag_id WHERE l.task_id=? ORDER BY g.name');
  const listGoals = () => db.prepare(`SELECT g.*,
      (SELECT COUNT(*) FROM milestones m WHERE m.goal_id=g.id) AS milestone_count,
      (SELECT COUNT(*) FROM milestones m WHERE m.goal_id=g.id AND m.status='completed') AS milestones_done,
      (SELECT COUNT(*) FROM project_goal_links l WHERE l.goal_id=g.id) AS linked_project_count,
      (SELECT COUNT(DISTINCT t.id) FROM tasks t WHERE t.archived_at IS NULL AND (EXISTS(SELECT 1 FROM task_goal_links tl WHERE tl.task_id=t.id AND tl.goal_id=g.id) OR EXISTS(SELECT 1 FROM project_goal_links pl WHERE pl.project_id=t.project_id AND pl.goal_id=g.id))) AS linked_task_count,
      (SELECT COUNT(DISTINCT t.id) FROM tasks t WHERE t.archived_at IS NULL AND t.status='completed' AND (EXISTS(SELECT 1 FROM task_goal_links tl WHERE tl.task_id=t.id AND tl.goal_id=g.id) OR EXISTS(SELECT 1 FROM project_goal_links pl WHERE pl.project_id=t.project_id AND pl.goal_id=g.id))) AS linked_task_done
      FROM goals g ORDER BY
      CASE g.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      COALESCE(g.target_date,'9999-12-31'), g.created_at DESC`).all()
      .map(g => ({ ...g, progress_value: g.progress_mode === 'automatic'
        ? (g.milestone_count + g.linked_task_count ? Math.round((g.milestones_done + g.linked_task_done) * 100 / (g.milestone_count + g.linked_task_count)) : 0)
        : g.progress_value }));
  const listProjects = () => db.prepare(`SELECT p.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.archived_at IS NULL) AS task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status='completed' AND t.archived_at IS NULL) AS tasks_done
      FROM projects p ORDER BY p.updated_at DESC`).all()
      .map(p => ({ ...p, goalIds: getGoalLinks.all(p.id).map(x => x.goal_id) }));
  const listTasks = () => db.prepare(`SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id=t.project_id
      ORDER BY
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 WHEN 'inbox' THEN 2 ELSE 3 END,
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      COALESCE(t.due_date,'9999-12-31'), t.created_at DESC`).all()
      .map(t => ({ ...t, goalIds: getTaskGoalLinks.all(t.id).map(x => x.goal_id), tags: getTaskTags.all(t.id).map(x => x.name) }));
  const listMilestones = () => db.prepare(`SELECT m.*, g.title AS goal_title FROM milestones m
      JOIN goals g ON g.id=m.goal_id ORDER BY m.due_date IS NULL, m.due_date, m.sort_order, m.created_at`).all();

  function saveGoal(input = {}) {
    const title = text(input.title, 180);
    if (!title) throw new Error('Goal title is required.');
    const id = text(input.id, 80) || randomUUID(), stamp = now();
    const row = {
      id, title, description: text(input.description), category: text(input.category, 80) || 'Personal',
      start_date: date(input.startDate), target_date: date(input.targetDate),
      status: allowed(input.status, ['not_started','active','on_hold','completed','archived'], 'active'),
      priority: allowed(input.priority, ['low','medium','high','urgent'], 'medium'),
      progress_mode: allowed(input.progressMode, ['manual','automatic'], 'manual'),
      progress_value: Math.max(0, Math.min(100, Number(input.progressValue) || 0))
    };
    const exists = db.prepare('SELECT id FROM goals WHERE id=?').get(id);
    if (exists) db.prepare(`UPDATE goals SET title=@title,description=@description,category=@category,start_date=@start_date,
      target_date=@target_date,status=@status,priority=@priority,progress_mode=@progress_mode,
      progress_value=@progress_value,updated_at=@updated_at WHERE id=@id`).run({ ...row, updated_at: stamp });
    else db.prepare(`INSERT INTO goals (id,title,description,category,start_date,target_date,status,priority,progress_mode,progress_value,created_at,updated_at)
      VALUES (@id,@title,@description,@category,@start_date,@target_date,@status,@priority,@progress_mode,@progress_value,@created_at,@updated_at)`)
      .run({ ...row, created_at: stamp, updated_at: stamp });
    return db.prepare('SELECT * FROM goals WHERE id=?').get(id);
  }
  function saveMilestone(input = {}) {
    const goalId = text(input.goalId, 80), title = text(input.title, 180);
    if (!goalId || !db.prepare('SELECT id FROM goals WHERE id=?').get(goalId)) throw new Error('Select an existing goal.');
    if (!title) throw new Error('Milestone title is required.');
    const id = text(input.id, 80) || randomUUID(), stamp = now();
    const row = { id, goal_id: goalId, title, description: text(input.description), due_date: date(input.dueDate),
      status: allowed(input.status, ['pending','in_progress','completed'], 'pending'), sort_order: Number(input.sortOrder) || 0 };
    const exists = db.prepare('SELECT id FROM milestones WHERE id=?').get(id);
    if (exists) db.prepare(`UPDATE milestones SET goal_id=@goal_id,title=@title,description=@description,due_date=@due_date,status=@status,sort_order=@sort_order,updated_at=@updated_at WHERE id=@id`)
      .run({ ...row, updated_at: stamp });
    else db.prepare(`INSERT INTO milestones (id,goal_id,title,description,due_date,status,sort_order,created_at,updated_at)
      VALUES (@id,@goal_id,@title,@description,@due_date,@status,@sort_order,@created_at,@updated_at)`)
      .run({ ...row, created_at: stamp, updated_at: stamp });
    return db.prepare('SELECT * FROM milestones WHERE id=?').get(id);
  }
  function saveProject(input = {}) {
    const name = text(input.name, 180);
    if (!name) throw new Error('Project name is required.');
    const id = text(input.id, 80) || randomUUID(), stamp = now();
    const row = { id, name, description: text(input.description),
      status: allowed(input.status, ['active','on_hold','completed','archived'], 'active'),
      priority: allowed(input.priority, ['low','medium','high','urgent'], 'medium'),
      start_date: date(input.startDate), due_date: date(input.dueDate),
      color: /^#[0-9a-f]{6}$/i.test(String(input.color || '')) ? input.color : '#B94A62' };
    const save = db.transaction(() => {
      const exists = db.prepare('SELECT id FROM projects WHERE id=?').get(id);
      if (exists) db.prepare(`UPDATE projects SET name=@name,description=@description,status=@status,priority=@priority,
        start_date=@start_date,due_date=@due_date,color=@color,updated_at=@updated_at WHERE id=@id`).run({ ...row, updated_at: stamp });
      else db.prepare(`INSERT INTO projects (id,name,description,status,priority,start_date,due_date,color,created_at,updated_at)
        VALUES (@id,@name,@description,@status,@priority,@start_date,@due_date,@color,@created_at,@updated_at)`).run({ ...row, created_at: stamp, updated_at: stamp });
      db.prepare('DELETE FROM project_goal_links WHERE project_id=?').run(id);
      const link = db.prepare('INSERT OR IGNORE INTO project_goal_links(project_id,goal_id) VALUES (?,?)');
      const requestedGoals = [...new Set(Array.isArray(input.goalIds) ? input.goalIds.map(x => text(x,80)).filter(Boolean) : [])];
      for (const goalId of requestedGoals) { if (!db.prepare('SELECT id FROM goals WHERE id=?').get(goalId)) throw new Error('A linked goal no longer exists.'); link.run(id, goalId); }
    });
    save();
    return db.prepare('SELECT * FROM projects WHERE id=?').get(id);
  }
  function saveTask(input = {}) {
    const title = text(input.title, 240);
    if (!title) throw new Error('Task title is required.');
    const id = text(input.id, 80) || randomUUID(), stamp = now();
    const projectId = text(input.projectId, 80) || null;
    const parentId = text(input.parentTaskId, 80) || null;
    if (parentId === id) throw new Error('A task cannot be its own parent.');
    if (parentId && !db.prepare('SELECT id FROM tasks WHERE id=?').get(parentId)) throw new Error('Parent task does not exist.');
    let ancestor = parentId;
    while (ancestor) { if (ancestor === id) throw new Error('A task hierarchy cannot contain a cycle.'); const parent = db.prepare('SELECT parent_task_id FROM tasks WHERE id=?').get(ancestor); ancestor = parent?.parent_task_id || null; }
    const dueTime = input.dueTime ? text(input.dueTime,5) : null;
    if (dueTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) throw new Error('Due time must use HH:MM format.');
    const row = { id, title, description: text(input.description),
      status: allowed(input.status, ['inbox','todo','in_progress','completed','cancelled'], 'todo'),
      priority: allowed(input.priority, ['low','medium','high','urgent'], 'medium'),
      start_date: date(input.startDate), due_date: date(input.dueDate),
      due_time: dueTime,
      estimated_minutes: Number.isFinite(Number(input.estimatedMinutes)) && Number(input.estimatedMinutes)>0 ? Math.min(100000, Math.round(Number(input.estimatedMinutes))) : null,
      project_id: projectId, parent_task_id: parentId,
      completed_at: allowed(input.status, ['completed'], '') ? stamp : null };
    const save = db.transaction(() => {
      const exists = db.prepare('SELECT id,created_at FROM tasks WHERE id=?').get(id);
      if (exists) db.prepare(`UPDATE tasks SET title=@title,description=@description,status=@status,priority=@priority,start_date=@start_date,
        due_date=@due_date,due_time=@due_time,estimated_minutes=@estimated_minutes,project_id=@project_id,parent_task_id=@parent_task_id,
        completed_at=CASE WHEN @status='completed' THEN COALESCE(completed_at,@completed_at) ELSE NULL END,updated_at=@updated_at WHERE id=@id`)
        .run({ ...row, updated_at: stamp });
      else db.prepare(`INSERT INTO tasks (id,title,description,status,priority,start_date,due_date,due_time,estimated_minutes,project_id,parent_task_id,created_at,updated_at,completed_at)
        VALUES (@id,@title,@description,@status,@priority,@start_date,@due_date,@due_time,@estimated_minutes,@project_id,@parent_task_id,@created_at,@updated_at,@completed_at)`)
        .run({ ...row, created_at: stamp, updated_at: stamp });
      db.prepare('DELETE FROM task_goal_links WHERE task_id=?').run(id);
      const link = db.prepare('INSERT OR IGNORE INTO task_goal_links(task_id,goal_id) VALUES (?,?)');
      const requestedGoals = [...new Set(Array.isArray(input.goalIds) ? input.goalIds.map(x => text(x,80)).filter(Boolean) : [])];
      for (const goalId of requestedGoals) { if (!db.prepare('SELECT id FROM goals WHERE id=?').get(goalId)) throw new Error('A linked goal no longer exists.'); link.run(id, goalId); }
      db.prepare('DELETE FROM task_tags WHERE task_id=?').run(id);
      const addTag = db.prepare('INSERT OR IGNORE INTO tags(id,name,created_at) VALUES (?,?,?)');
      const findTag = db.prepare('SELECT id FROM tags WHERE name=? COLLATE NOCASE');
      const addTaskTag = db.prepare('INSERT OR IGNORE INTO task_tags(task_id,tag_id) VALUES (?,?)');
      for (const name of [...new Set(Array.isArray(input.tags) ? input.tags.map(x => text(x,40)).filter(Boolean) : [])].slice(0,20)) {
        addTag.run(randomUUID(), name, stamp);
        const tag = findTag.get(name);
        if (tag) addTaskTag.run(id, tag.id);
      }
    });
    save();
    return db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  }
  function setTaskStatus(id, status) {
    const value = allowed(status, ['inbox','todo','in_progress','completed','cancelled'], null);
    if (!value) throw new Error('Invalid task status.');
    const stamp = now();
    const result = db.prepare("UPDATE tasks SET status=?, completed_at=CASE WHEN ?='completed' THEN COALESCE(completed_at, ?) ELSE NULL END, updated_at=? WHERE id=?").run(value, value, stamp, stamp, text(id,80));
    if (!result.changes) throw new Error('Task not found.');
    return db.prepare('SELECT * FROM tasks WHERE id=?').get(text(id,80));
  }
  function toggleTask(id) {
    const row = db.prepare('SELECT status FROM tasks WHERE id=?').get(text(id,80));
    if (!row) throw new Error('Task not found.');
    const completed = row.status !== 'completed';
    setTaskStatus(id, completed ? 'completed' : 'todo');
    return { completed };
  }
  const remove = (table, id) => {
    if (!['goals','milestones','projects','tasks'].includes(table)) throw new Error('Unsupported record type.');
    return db.prepare('DELETE FROM ' + table + ' WHERE id=?').run(text(id,80)).changes > 0;
  };
  function setArchived(kind, id, archived = true) {
    const table = ({ goal: 'goals', project: 'projects', task: 'tasks' })[kind];
    if (!table) throw new Error('Unsupported archive type.');
    const stamp = archived ? now() : null;
    const result = db.prepare('UPDATE ' + table + ' SET archived_at=?, updated_at=? WHERE id=?').run(stamp, now(), text(id,80));
    if (!result.changes) throw new Error('Record not found.');
    return { archived: Boolean(stamp) };
  }
  function duplicateGoal(id) {
    const source = db.prepare('SELECT * FROM goals WHERE id=?').get(text(id,80));
    if (!source) throw new Error('Goal not found.');
    const nextId = randomUUID(), stamp = now();
    db.transaction(() => {
      db.prepare('INSERT INTO goals(id,title,description,category,start_date,target_date,status,priority,progress_mode,progress_value,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(nextId, source.title + ' (copy)', source.description, source.category, source.start_date, source.target_date, 'not_started', source.priority, source.progress_mode, 0, stamp, stamp);
      const add = db.prepare('INSERT INTO milestones(id,goal_id,title,description,due_date,status,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
      for (const m of db.prepare('SELECT * FROM milestones WHERE goal_id=?').all(source.id)) add.run(randomUUID(), nextId, m.title, m.description, m.due_date, 'pending', m.sort_order, stamp, stamp);
    })();
    return db.prepare('SELECT * FROM goals WHERE id=?').get(nextId);
  }
  function duplicateProject(id) {
    const source = db.prepare('SELECT * FROM projects WHERE id=?').get(text(id,80));
    if (!source) throw new Error('Project not found.');
    const nextId = randomUUID(), stamp = now();
    db.transaction(() => {
      db.prepare('INSERT INTO projects(id,name,description,status,priority,start_date,due_date,color,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(nextId, source.name + ' (copy)', source.description, 'active', source.priority, source.start_date, source.due_date, source.color, stamp, stamp);
      for (const row of db.prepare('SELECT goal_id FROM project_goal_links WHERE project_id=?').all(source.id)) db.prepare('INSERT OR IGNORE INTO project_goal_links(project_id,goal_id) VALUES(?,?)').run(nextId,row.goal_id);
    })();
    return db.prepare('SELECT * FROM projects WHERE id=?').get(nextId);
  }
  function duplicateTask(id) {
    const source = db.prepare('SELECT * FROM tasks WHERE id=?').get(text(id,80));
    if (!source) throw new Error('Task not found.');
    const nextId = randomUUID(), stamp = now();
    db.transaction(() => {
      db.prepare('INSERT INTO tasks(id,title,description,status,priority,start_date,due_date,due_time,estimated_minutes,actual_minutes,project_id,parent_task_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(nextId, source.title + ' (copy)', source.description, 'todo', source.priority, source.start_date, source.due_date, source.due_time, source.estimated_minutes, 0, source.project_id, source.parent_task_id, stamp, stamp);
      for (const row of db.prepare('SELECT goal_id FROM task_goal_links WHERE task_id=?').all(source.id)) db.prepare('INSERT OR IGNORE INTO task_goal_links(task_id,goal_id) VALUES(?,?)').run(nextId,row.goal_id);
      for (const row of db.prepare('SELECT tag_id FROM task_tags WHERE task_id=?').all(source.id)) db.prepare('INSERT OR IGNORE INTO task_tags(task_id,tag_id) VALUES(?,?)').run(nextId,row.tag_id);
    })();
    return db.prepare('SELECT * FROM tasks WHERE id=?').get(nextId);
  }
  function getSettings() {
    const result = {};
    for (const row of db.prepare('SELECT key,value FROM settings').all()) { try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = null; } }
    return result;
  }
  function saveSettings(input = {}) {
    const keys = new Set(['theme','density','sidebarCollapsed','defaultLandingPage','accentColor','fontSize','language','dateFormat','timeFormat','weekStartsOn','taskDefaultPriority','taskDefaultView','taskSort','focusDurationMinutes','shortBreakMinutes','longBreakMinutes','longBreakInterval','focusSoundEnabled','focusAutoStartBreaks','focusAutoStartSessions','journalDefaultType','journalAutosave','notificationsEnabled','privacyMode','backupReminderEnabled','focusTimerState']);
    const stamp = now(), upsert = db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at');
    const normalized = {};
    for (const [key,value] of Object.entries(input)) {
      if (!keys.has(key)) continue;
      if (key === 'theme' && !['dark','light','system'].includes(value)) throw new Error('Invalid theme setting.');
      if (key === 'density' && !['comfortable','compact'].includes(value)) throw new Error('Invalid density setting.');
      if (key === 'sidebarCollapsed' && typeof value !== 'boolean') throw new Error('Invalid sidebar setting.');
      if (key === 'defaultLandingPage' && !['home','goals','projects','tasks','habits','focus','journal' ,'review','insights','data'].includes(value)) throw new Error('Invalid default page.');
      if (key === 'weekStartsOn' && ![0,1,2,3,4,5,6].includes(value)) throw new Error('Invalid first day of week.');
      if (['focusDurationMinutes','shortBreakMinutes','longBreakMinutes','longBreakInterval','fontSize'].includes(key) && (!Number.isInteger(value) || value<1 || value>180)) throw new Error('Invalid numeric preference: '+key+'.');
      if (['journalAutosave','notificationsEnabled','privacyMode','backupReminderEnabled','focusSoundEnabled','focusAutoStartBreaks','focusAutoStartSessions'].includes(key) && typeof value!=='boolean') throw new Error('Invalid boolean preference: '+key+'.');
      if (key==='taskDefaultPriority' && !['low','medium','high','urgent'].includes(value)) throw new Error('Invalid task priority.');
      if (key==='taskDefaultView' && !['list','board','calendar'].includes(value)) throw new Error('Invalid task view.');
      if (key==='taskSort' && !['due','priority','title','created'].includes(value)) throw new Error('Invalid task sorting.');
      if (key==='language' && !['en','vi'].includes(value)) throw new Error('Invalid language.');
      if (key==='dateFormat' && !['yyyy-MM-dd','dd/MM/yyyy','MM/dd/yyyy'].includes(value)) throw new Error('Invalid date format.');
      if (key==='timeFormat' && !['12h','24h'].includes(value)) throw new Error('Invalid time format.');
      if (key==='journalDefaultType' && !['reflection','freewriting'].includes(value)) throw new Error('Invalid journal type.');
      if (key==='accentColor' && !/^#[0-9a-f]{6}$/i.test(String(value))) throw new Error('Invalid accent color.');
      if (key==='focusTimerState' && value!==null && (typeof value!=='object'||Array.isArray(value))) throw new Error('Invalid focus timer state.');
      normalized[key] = value;
    }
    db.transaction(() => { for (const [key,value] of Object.entries(normalized)) upsert.run(key, JSON.stringify(value), stamp); })();
    return getSettings();
  }
  function getDailyPlan(value) {
    const planDate = date(value) || formatLocalDate();
    const plan = db.prepare('SELECT * FROM daily_plans WHERE plan_date=?').get(planDate);
    const items = db.prepare(`SELECT i.id,i.plan_date,i.task_id,i.position,t.title,t.description,t.status,t.priority,t.due_date,t.due_time,t.project_id
      FROM daily_mit_items i JOIN tasks t ON t.id=i.task_id WHERE i.plan_date=? ORDER BY i.position`).all(planDate);
    return { date: planDate, intention: plan?.intention || '', items };
  }
  function saveDailyPlan(input = {}) {
    const planDate = date(input.date) || formatLocalDate();
    const intention = text(input.intention, 1000);
    const taskIds = [...new Set(Array.isArray(input.mitTaskIds) ? input.mitTaskIds.map(id => text(id, 80)).filter(Boolean) : [])];
    if (taskIds.length > 3) throw new Error('A daily plan can contain no more than three MIT tasks.');
    const stamp = now();
    const save = db.transaction(() => {
      for (const taskId of taskIds) {
        if (!db.prepare('SELECT id FROM tasks WHERE id=? AND archived_at IS NULL').get(taskId)) {
          throw new Error('A selected MIT task does not exist or is archived.');
        }
      }
      db.prepare(`INSERT INTO daily_plans(plan_date,intention,created_at,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(plan_date) DO UPDATE SET intention=excluded.intention,updated_at=excluded.updated_at`)
        .run(planDate,intention,stamp,stamp);
      db.prepare('DELETE FROM daily_mit_items WHERE plan_date=?').run(planDate);
      const add = db.prepare('INSERT INTO daily_mit_items(id,plan_date,task_id,position,created_at) VALUES(?,?,?,?,?)');
      taskIds.forEach((taskId,index) => add.run(randomUUID(),planDate,taskId,index+1,stamp));
    });
    save();
    return getDailyPlan(planDate);
  }

  function loadWorkspace() {
    const goals = listGoals(), projects = listProjects(), tasks = listTasks(), milestones = listMilestones();
    const activeGoals = goals.filter(g => !g.archived_at);
    const activeProjects = projects.filter(p => !p.archived_at);
    const activeTasks = tasks.filter(t => !t.archived_at && !['completed','cancelled'].includes(t.status));
    return {
      goals, projects, tasks, milestones, dailyPlan: getDailyPlan(formatLocalDate()), settings: getSettings(),
      summary: {
        activeGoals: activeGoals.filter(g => g.status === 'active').length,
        activeProjects: activeProjects.filter(p => p.status === 'active').length,
        openTasks: activeTasks.length,
        completedTasks: tasks.filter(t => !t.archived_at && t.status === 'completed').length,
        overdueTasks: activeTasks.filter(t => t.due_date && t.due_date < formatLocalDate()).length
      }
    };
  }
  const phase2 = attachPhase2(db);
  return {
    phase2,
    loadWorkspace, getDailyPlan, saveDailyPlan, saveGoal, saveMilestone, saveProject, saveTask, toggleTask, setTaskStatus,
    setArchived, duplicateGoal, duplicateProject, duplicateTask, getSettings, saveSettings,
    deleteGoal: id => remove('goals', id), deleteMilestone: id => remove('milestones', id),
    deleteProject: id => remove('projects', id), deleteTask: id => remove('tasks', id),
    backupTo: destination => db.backup(destination),
    exportBackupData: backupPath => {
      const snapshot=new Database(backupPath,{readonly:true,fileMustExist:true});
      try {
        const tables=['goals','milestones','projects','project_goal_links','tasks','task_goal_links','tags','task_tags','settings','habits','habit_logs','focus_sessions','journal_entries','journal_goal_links','journal_project_links','journal_task_links','weekly_reviews','daily_plans','daily_mit_items'];
        const payload={format:'aurestar-sqlite-export',version:2,schemaVersion:snapshot.pragma('user_version',{simple:true}),exportedAt:new Date().toISOString(),app:'Aurestar',tables:{}};
        for(const table of tables)payload.tables[table]=snapshot.prepare('SELECT * FROM '+table).all();
        return payload;
      } finally { snapshot.close(); }
    },
    close: () => db.close(), filePath
  };
}

module.exports = { createDatabase };