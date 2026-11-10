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