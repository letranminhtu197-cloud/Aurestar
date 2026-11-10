import { create } from 'zustand';
import { workspaceApi } from './api';
import type { WorkspaceData, GoalInput, ProjectInput, TaskInput, MilestoneInput } from './types';
type Store = WorkspaceData & {
  loading: boolean; error: string | null;
  load: () => Promise<void>;
  saveGoal: (v: GoalInput) => Promise<void>; saveProject: (v: ProjectInput) => Promise<void>;
  saveTask: (v: TaskInput) => Promise<void>; saveMilestone: (v: MilestoneInput) => Promise<void>;
  toggleTask: (id: string) => Promise<void>; setTaskStatus: (id:string,status:string)=>Promise<void>;
  archiveGoal:(id:string,archived:boolean)=>Promise<void>; archiveProject:(id:string,archived:boolean)=>Promise<void>; archiveTask:(id:string,archived:boolean)=>Promise<void>;
  duplicateGoal:(id:string)=>Promise<void>; duplicateProject:(id:string)=>Promise<void>; duplicateTask:(id:string)=>Promise<void>; saveSettings:(v:Record<string,unknown>)=>Promise<void>;
  deleteGoal: (id: string) => Promise<void>; deleteProject: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>; deleteMilestone: (id: string) => Promise<void>;
};
const empty: WorkspaceData = { goals: [], projects: [], tasks: [], milestones: [], summary: { activeGoals: 0, activeProjects: 0, openTasks: 0, completedTasks: 0, overdueTasks: 0 }, settings: {} };
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
    setTaskStatus: (id,status) => mutate(() => workspaceApi.setTaskStatus(id,status)),
    archiveGoal: (id,archived) => mutate(() => workspaceApi.archiveGoal(id,archived)),
    archiveProject: (id,archived) => mutate(() => workspaceApi.archiveProject(id,archived)),
    archiveTask: (id,archived) => mutate(() => workspaceApi.archiveTask(id,archived)),
    duplicateGoal: id => mutate(() => workspaceApi.duplicateGoal(id)),
    duplicateProject: id => mutate(() => workspaceApi.duplicateProject(id)),
    duplicateTask: id => mutate(() => workspaceApi.duplicateTask(id)),
    saveSettings: v => mutate(() => workspaceApi.saveSettings(v)),
    deleteGoal: id => mutate(() => workspaceApi.deleteGoal(id)),
    deleteProject: id => mutate(() => workspaceApi.deleteProject(id)),
    deleteTask: id => mutate(() => workspaceApi.deleteTask(id)),
    deleteMilestone: id => mutate(() => workspaceApi.deleteMilestone(id))
  };
});