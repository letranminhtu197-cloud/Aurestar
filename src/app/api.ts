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
  setTaskStatus: (id: string,status: string) => api().setTaskStatus(id,status),
  archiveGoal: (id: string,archived: boolean) => api().archiveGoal(id,archived),
  archiveProject: (id: string,archived: boolean) => api().archiveProject(id,archived),
  archiveTask: (id: string,archived: boolean) => api().archiveTask(id,archived),
  duplicateGoal: (id: string) => api().duplicateGoal(id),
  duplicateProject: (id: string) => api().duplicateProject(id),
  duplicateTask: (id: string) => api().duplicateTask(id),
  saveSettings: (input: Record<string,unknown>) => api().saveSettings(input),
  deleteGoal: (id: string) => api().deleteGoal(id),
  deleteMilestone: (id: string) => api().deleteMilestone(id),
  deleteProject: (id: string) => api().deleteProject(id),
  deleteTask: (id: string) => api().deleteTask(id)
};
export type { WorkspaceData };