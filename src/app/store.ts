import { create } from 'zustand';
import { workspaceApi } from './api';
import type { WorkspaceData, GoalInput, ProjectInput, TaskInput, MilestoneInput } from './types';
type Store = WorkspaceData & {
  loading: boolean; error: string | null;
  load: () => Promise<void>;
  saveGoal: (v: GoalInput) => Promise<void>; saveProject: (v: ProjectInput) => Promise<void>;
  saveTask: (v: TaskInput) => Promise<void>; saveMilestone: (v: MilestoneInput) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>; deleteProject: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>; deleteMilestone: (id: string) => Promise<void>;
};
const empty: WorkspaceData = { goals: [], projects: [], tasks: [], milestones: [], summary: { activeGoals: 0, activeProjects: 0, openTasks: 0, completedTasks: 0, overdueTasks: 0 } };
export const useWorkspace = create<Store>((set) => {
  const reload = async () => { const data = await workspaceApi.load(); set({ ...data, loading: false, error: null }); };
  const mutate = async (fn: () => Promise<unknown>) => { set({ error: null }); try { await fn(); await reload(); } catch (e) { const message = e instanceof Error ? e.message : 'An unexpected error occurred.'; set({ error: message }); throw e; } };
  return {
    ...empty, loading: true, error: null,
    load: async () => { set({ loading: true, error: null }); try { await reload(); } catch (e) { set({ loading: false, error: e instanceof Error ? e.message : 'Could not load the local database.' }); } },
    saveGoal: v => mutate(() => workspaceApi.saveGoal(v)),
    saveProject: v => mutate(() => workspaceApi.saveProject(v)),
    saveTask: v => mutate(() => workspaceApi.saveTask(v)),
    saveMilestone: v => mutate(() => workspaceApi.saveMilestone(v)),
    toggleTask: id => mutate(() => workspaceApi.toggleTask(id)),
    deleteGoal: id => mutate(() => workspaceApi.deleteGoal(id)),
    deleteProject: id => mutate(() => workspaceApi.deleteProject(id)),
    deleteTask: id => mutate(() => workspaceApi.deleteTask(id)),
    deleteMilestone: id => mutate(() => workspaceApi.deleteMilestone(id))
  };
});