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
      deleteGoal(id: string): Promise<boolean>;
      deleteMilestone(id: string): Promise<boolean>;
      deleteProject(id: string): Promise<boolean>;
      deleteTask(id: string): Promise<boolean>;
    };
    aurestarDesktop?: {
      showItsuki?: () => Promise<unknown>;
      hideItsuki?: () => Promise<unknown>;
      onQuickAdd?: (fn: () => void) => () => void;
    };
  }
}
export {};
