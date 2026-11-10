const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');

const now = () => new Date().toISOString();
const text = (value, max = 5000) => String(value ?? '').trim().slice(0, max);
const date = value => value ? text(value, 10) : null;
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
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_goal ON milestones(goal_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status, target_date);
    PRAGMA user_version = 1;
  `);

  const getGoalLinks = db.prepare('SELECT goal_id FROM project_goal_links WHERE project_id = ?');
  const getTaskGoalLinks = db.prepare('SELECT goal_id FROM task_goal_links WHERE task_id = ?');
  const listGoals = () => db.prepare(`SELECT g.*,
      (SELECT COUNT(*) FROM milestones m WHERE m.goal_id=g.id) AS milestone_count,
      (SELECT COUNT(*) FROM milestones m WHERE m.goal_id=g.id AND m.status='completed') AS milestones_done
      FROM goals g WHERE g.archived_at IS NULL ORDER BY
      CASE g.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      COALESCE(g.target_date,'9999-12-31'), g.created_at DESC`).all();
  const listProjects = () => db.prepare(`SELECT p.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.archived_at IS NULL) AS task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status='completed' AND t.archived_at IS NULL) AS tasks_done
      FROM projects p WHERE p.archived_at IS NULL ORDER BY p.updated_at DESC`).all()
      .map(p => ({ ...p, goalIds: getGoalLinks.all(p.id).map(x => x.goal_id) }));
  const listTasks = () => db.prepare(`SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id=t.project_id
      WHERE t.archived_at IS NULL ORDER BY
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 WHEN 'inbox' THEN 2 ELSE 3 END,
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      COALESCE(t.due_date,'9999-12-31'), t.created_at DESC`).all()
      .map(t => ({ ...t, goalIds: getTaskGoalLinks.all(t.id).map(x => x.goal_id) }));
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
      for (const goalId of [...new Set(Array.isArray(input.goalIds) ? input.goalIds.map(x => text(x,80)) : [])]) {
        if (db.prepare('SELECT id FROM goals WHERE id=?').get(goalId)) link.run(id, goalId);
      }
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
    const row = { id, title, description: text(input.description),
      status: allowed(input.status, ['inbox','todo','in_progress','completed','cancelled'], 'todo'),
      priority: allowed(input.priority, ['low','medium','high','urgent'], 'medium'),
      start_date: date(input.startDate), due_date: date(input.dueDate),
      due_time: input.dueTime ? text(input.dueTime, 5) : null,
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
      for (const goalId of [...new Set(Array.isArray(input.goalIds) ? input.goalIds.map(x => text(x,80)) : [])]) {
        if (db.prepare('SELECT id FROM goals WHERE id=?').get(goalId)) link.run(id, goalId);
      }
    });
    save();
    return db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  }
  function toggleTask(id) {
    const row = db.prepare('SELECT status FROM tasks WHERE id=?').get(text(id,80));
    if (!row) throw new Error('Task not found.');
    const completed = row.status !== 'completed';
    db.prepare('UPDATE tasks SET status=?,completed_at=?,updated_at=? WHERE id=?')
      .run(completed ? 'completed' : 'todo', completed ? now() : null, now(), text(id,80));
    return { completed };
  }
  const remove = (table, id) => {
    if (!['goals','milestones','projects','tasks'].includes(table)) throw new Error('Unsupported record type.');
    return db.prepare('DELETE FROM ' + table + ' WHERE id=?').run(text(id,80)).changes > 0;
  };
  function loadWorkspace() {
    const goals = listGoals(), projects = listProjects(), tasks = listTasks(), milestones = listMilestones();
    const activeTasks = tasks.filter(t => !['completed','cancelled'].includes(t.status));
    return {
      goals, projects, tasks, milestones,
      summary: {
        activeGoals: goals.filter(g => g.status === 'active').length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        openTasks: activeTasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        overdueTasks: activeTasks.filter(t => t.due_date && t.due_date < new Date().toISOString().slice(0,10)).length
      }
    };
  }
  return {
    loadWorkspace, saveGoal, saveMilestone, saveProject, saveTask, toggleTask,
    deleteGoal: id => remove('goals', id), deleteMilestone: id => remove('milestones', id),
    deleteProject: id => remove('projects', id), deleteTask: id => remove('tasks', id),
    close: () => db.close(), filePath
  };
}

module.exports = { createDatabase };