import type { WorkspaceData, GoalInput, MilestoneInput, ProjectInput, TaskInput } from './types';
/// <reference types="vite/client" />
declare global {
  interface Window {
    aurestarV2: {
      loadWorkspace(): Promise<WorkspaceData>;
      saveGoal(input: GoalInput): Promise<unknown>;
      saveMilestone(input: MilestoneInput): Promise<unknown>;
      saveProject(input: ProjectInput): Promise<unknown>;
      saveTask(input: TaskInput): Promise<unknown>;
      toggleTask(id: string): Promise<{ completed: boolean }>;
      setTaskStatus(id:string,status:string):Promise<unknown>;
      archiveGoal(id:string,archived:boolean):Promise<unknown>;
      archiveProject(id:string,archived:boolean):Promise<unknown>;
      archiveTask(id:string,archived:boolean):Promise<unknown>;
      duplicateGoal(id:string):Promise<unknown>;
      duplicateProject(id:string):Promise<unknown>;
      duplicateTask(id:string):Promise<unknown>;
      saveSettings(input:Record<string,unknown>):Promise<Record<string,unknown>>;
      deleteGoal(id: string): Promise<boolean>;
      deleteMilestone(id: string): Promise<boolean>;
      deleteProject(id: string): Promise<boolean>;
      deleteTask(id: string): Promise<boolean>;
    };
    aurestarDesktop?: {
      showItsuki?: () => Promise<unknown>;
      hideItsuki?: () => Promise<unknown>;
      onQuickAdd?: (fn: () => void) => () => void;
      onNavigate?: (fn: (view:string) => void) => () => void;
    };
  }
}
export {};
