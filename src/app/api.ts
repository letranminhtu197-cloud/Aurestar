import type { GoalInput, MilestoneInput, ProjectInput, TaskInput, WorkspaceData } from './types';
const api = () => {
  if (!window.aurestarV2) throw new Error('Aurestar desktop bridge is unavailable. Restart the application.');
  return window.aurestarV2;
};
export const workspaceApi = {
  load: () => api().loadWorkspace(),
  saveGoal: (input: GoalInput) => api().saveGoal(input),
  saveMilestone: (input: MilestoneInput) => api().saveMilestone(input),
  saveProject: (input: ProjectInput) => api().saveProject(input),
  saveTask: (input: TaskInput) => api().saveTask(input),
  toggleTask: (id: string) => api().toggleTask(id),
  deleteGoal: (id: string) => api().deleteGoal(id),
  deleteMilestone: (id: string) => api().deleteMilestone(id),
  deleteProject: (id: string) => api().deleteProject(id),
  deleteTask: (id: string) => api().deleteTask(id)
};
export type { WorkspaceData };