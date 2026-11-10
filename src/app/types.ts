export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type GoalStatus = 'not_started' | 'active' | 'on_hold' | 'completed' | 'archived';
export type TaskStatus = 'inbox' | 'todo' | 'in_progress' | 'completed' | 'cancelled';
export interface Goal {
  id: string; title: string; description: string; category: string; start_date: string | null;
  target_date: string | null; status: GoalStatus; priority: Priority; progress_mode: 'manual' | 'automatic';
  progress_value: number; milestone_count: number; milestones_done: number;
}
export interface Milestone {
  id: string; goal_id: string; goal_title: string; title: string; description: string;
  due_date: string | null; status: 'pending' | 'in_progress' | 'completed';
}
export interface Project {
  id: string; name: string; description: string; status: string; priority: Priority;
  start_date: string | null; due_date: string | null; color: string; task_count: number;
  tasks_done: number; goalIds: string[];
}
export interface Task {
  id: string; title: string; description: string; status: TaskStatus; priority: Priority;
  due_date: string | null; due_time: string | null; estimated_minutes: number | null;
  project_id: string | null; project_name: string | null; goalIds: string[];
  parent_task_id: string | null; completed_at: string | null;
}
export interface WorkspaceData {
  goals: Goal[]; projects: Project[]; tasks: Task[]; milestones: Milestone[];
  summary: { activeGoals: number; activeProjects: number; openTasks: number; completedTasks: number; overdueTasks: number };
}
export type GoalInput = Partial<Goal> & { title: string; startDate?: string; targetDate?: string; progressMode?: 'manual'|'automatic'; progressValue?: number };
export type MilestoneInput = { id?: string; goalId: string; title: string; description?: string; dueDate?: string; status?: string };
export type ProjectInput = Partial<Project> & { name: string; startDate?: string; dueDate?: string; goalIds?: string[] };
export type TaskInput = Partial<Task> & { title: string; startDate?: string; dueDate?: string; dueTime?: string; estimatedMinutes?: number; projectId?: string; parentTaskId?: string; goalIds?: string[] };
