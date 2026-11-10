const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../../src/core/sqlite.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurestar-phase1-'));
  const db = createDatabase(path.join(dir, 'data.sqlite'));
  t.after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return db;
}

test('creates and persists goals, projects, tasks and milestones', t => {
  const db = fixture(t);
  const goal = db.saveGoal({ title: 'Complete Phase 1', progressValue: 25 });
  const project = db.saveProject({ name: 'Aurestar rebuild', goalIds: [goal.id] });
  const task = db.saveTask({ title: 'Implement SQLite', projectId: project.id, goalIds: [goal.id] });
  const milestone = db.saveMilestone({ goalId: goal.id, title: 'Database schema' });
  const data = db.loadWorkspace();
  assert.equal(data.goals.length, 1);
  assert.equal(data.projects[0].goalIds[0], goal.id);
  assert.equal(data.tasks[0].project_id, project.id);
  assert.equal(data.tasks[0].goalIds[0], goal.id);
  assert.equal(data.milestones[0].id, milestone.id);
  assert.equal(data.summary.openTasks, 1);
});

test('task completion is reversible and updates dashboard counters', t => {
  const db = fixture(t);
  const task = db.saveTask({ title: 'Test task' });
  assert.equal(db.toggleTask(task.id).completed, true);
  assert.equal(db.loadWorkspace().summary.completedTasks, 1);
  assert.equal(db.toggleTask(task.id).completed, false);
  assert.equal(db.loadWorkspace().summary.openTasks, 1);
});

test('validates required fields and preserves relational integrity', t => {
  const db = fixture(t);
  assert.throws(() => db.saveGoal({ title: ' ' }), /required/i);
  assert.throws(() => db.saveMilestone({ goalId: 'missing', title: 'x' }), /existing goal/i);
  assert.throws(() => db.saveTask({ title: 'Self parent', parentTaskId: 'same', id: 'same' }), /own parent/i);
});

test('deleting a goal removes its links and milestones but preserves tasks', t => {
  const db = fixture(t);
  const goal = db.saveGoal({ title: 'Goal' });
  const task = db.saveTask({ title: 'Task', goalIds: [goal.id] });
  db.saveMilestone({ goalId: goal.id, title: 'Milestone' });
  assert.equal(db.deleteGoal(goal.id), true);
  const data = db.loadWorkspace();
  assert.equal(data.goals.length, 0);
  assert.equal(data.milestones.length, 0);
  assert.equal(data.tasks.length, 1);
  assert.deepEqual(data.tasks[0].goalIds, []);
});

test('database can be reopened without losing records', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurestar-reopen-'));
  const file = path.join(dir, 'data.sqlite');
  const first = createDatabase(file);
  first.saveGoal({ title: 'Persistent goal' });
  first.close();
  const second = createDatabase(file);
  assert.equal(second.loadWorkspace().goals[0].title, 'Persistent goal');
  second.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
test('task tags are normalized, persisted and removed when task is deleted', t => { const db = fixture(t); const task = db.saveTask({ title: 'Tagged task', tags: [' Biology ', 'study', 'biology'] }); assert.deepEqual(db.loadWorkspace().tasks[0].tags, ['Biology', 'study']); db.deleteTask(task.id); assert.equal(db.loadWorkspace().tasks.length, 0); });

test('schema migrations and settings survive database reopen', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurestar-settings-'));
  const file = path.join(dir, 'data.sqlite');
  const first = createDatabase(file);
  first.saveSettings({ theme: 'light', density: 'compact', sidebarCollapsed: true, defaultLandingPage: 'tasks' });
  assert.deepEqual(first.getSettings(), { theme: 'light', density: 'compact', sidebarCollapsed: true, defaultLandingPage: 'tasks' });
  first.close();
  const second = createDatabase(file);
  assert.equal(second.getSettings().theme, 'light');
  assert.equal(second.getSettings().density, 'compact');
  second.close();
  const raw = require('better-sqlite3')(file);
  assert.equal(raw.pragma('user_version', { simple: true }), 2);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n, 2);
  raw.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('archive and restore preserve records while excluding them from active dashboard counts', t => {
  const db = fixture(t);
  const goal = db.saveGoal({ title: 'Archive goal' });
  const project = db.saveProject({ name: 'Archive project' });
  const task = db.saveTask({ title: 'Archive task', projectId: project.id });
  db.setArchived('goal', goal.id, true);
  db.setArchived('project', project.id, true);
  db.setArchived('task', task.id, true);
  let data = db.loadWorkspace();
  assert.equal(data.goals.length, 1);
  assert.equal(data.projects.length, 1);
  assert.equal(data.tasks.length, 1);
  assert.equal(data.summary.activeGoals, 0);
  assert.equal(data.summary.activeProjects, 0);
  assert.equal(data.summary.openTasks, 0);
  db.setArchived('task', task.id, false);
  data = db.loadWorkspace();
  assert.equal(data.tasks[0].archived_at, null);
  assert.equal(data.summary.openTasks, 1);
});

test('duplicate operations create independent records and preserve links', t => {
  const db = fixture(t);
  const goal = db.saveGoal({ title: 'Goal to duplicate' });
  const project = db.saveProject({ name: 'Linked project', goalIds: [goal.id] });
  const task = db.saveTask({ title: 'Linked task', projectId: project.id, goalIds: [goal.id], tags: ['study'] });
  db.saveMilestone({ goalId: goal.id, title: 'First checkpoint' });
  const goalCopy = db.duplicateGoal(goal.id);
  const projectCopy = db.duplicateProject(project.id);
  const taskCopy = db.duplicateTask(task.id);
  const data = db.loadWorkspace();
  assert.notEqual(goalCopy.id, goal.id);
  assert.equal(data.milestones.filter(m => m.goal_id === goalCopy.id).length, 1);
  assert.equal(data.projects.find(p => p.id === projectCopy.id).goalIds[0], goal.id);
  const copiedTask = data.tasks.find(t => t.id === taskCopy.id);
  assert.equal(copiedTask.project_id, project.id);
  assert.deepEqual(copiedTask.goalIds, [goal.id]);
  assert.deepEqual(copiedTask.tags, ['study']);
  assert.equal(copiedTask.status, 'todo');
});

test('task status can be changed, completed and reopened without losing completion metadata incorrectly', t => {
  const db = fixture(t);
  const task = db.saveTask({ title: 'Status transitions' });
  db.setTaskStatus(task.id, 'in_progress');
  assert.equal(db.loadWorkspace().tasks[0].status, 'in_progress');
  db.setTaskStatus(task.id, 'completed');
  assert.ok(db.loadWorkspace().tasks[0].completed_at);
  db.setTaskStatus(task.id, 'inbox');
  assert.equal(db.loadWorkspace().tasks[0].completed_at, null);
  assert.equal(db.loadWorkspace().tasks[0].status, 'inbox');
});

test('task hierarchy rejects indirect cycles and validates due time', t => {
  const db = fixture(t);
  const parent = db.saveTask({ title: 'Parent' });
  const child = db.saveTask({ title: 'Child', parentTaskId: parent.id });
  assert.throws(() => db.saveTask({ id: parent.id, title: 'Parent', parentTaskId: child.id }), /cycle/i);
  assert.throws(() => db.saveTask({ title: 'Invalid time', dueTime: '25:61' }), /HH:MM/i);
  assert.throws(() => db.saveTask({ title: 'Missing parent', parentTaskId: 'missing' }), /does not exist/i);
  assert.equal(db.loadWorkspace().tasks.length, 2);
});

test('invalid linked goals roll back project and task writes', t => {
  const db = fixture(t);
  assert.throws(() => db.saveProject({ name: 'Bad project', goalIds: ['missing'] }), /linked goal/i);
  assert.throws(() => db.saveTask({ title: 'Bad task', goalIds: ['missing'] }), /linked goal/i);
  assert.equal(db.loadWorkspace().projects.length, 0);
  assert.equal(db.loadWorkspace().tasks.length, 0);
});

test('automatic goal progress derives from linked tasks and milestones', t => {
  const db = fixture(t);
  const goal = db.saveGoal({ title: 'Automatic progress', progressMode: 'automatic' });
  const task = db.saveTask({ title: 'Linked work', goalIds: [goal.id] });
  db.saveMilestone({ goalId: goal.id, title: 'Checkpoint' });
  assert.equal(db.loadWorkspace().goals[0].progress_value, 0);
  db.setTaskStatus(task.id, 'completed');
  assert.equal(db.loadWorkspace().goals[0].progress_value, 50);
  const milestone = db.loadWorkspace().milestones[0];
  db.saveMilestone({ id: milestone.id, goalId: goal.id, title: milestone.title, status: 'completed' });
  assert.equal(db.loadWorkspace().goals[0].progress_value, 100);
});

test('calendar dates reject normalized but impossible dates', t => {
  const db = fixture(t);
  assert.throws(() => db.saveTask({ title: 'Invalid calendar date', dueDate: '2026-02-31' }), /valid YYYY-MM-DD/i);
  assert.throws(() => db.saveGoal({ title: 'Invalid date', targetDate: '2026-13-01' }), /valid YYYY-MM-DD/i);
  assert.equal(db.loadWorkspace().tasks.length, 0);
  assert.equal(db.loadWorkspace().goals.length, 0);
});
