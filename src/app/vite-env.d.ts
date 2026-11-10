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
      listHabits(): Promise<any[]>; saveHabit(input:any):Promise<any>; deleteHabit(id:string):Promise<boolean>; archiveHabit(id:string,archived:boolean):Promise<any>; logHabit(input:any):Promise<any>; listHabitLogs(from?:string,to?:string):Promise<any[]>;
      saveFocusSession(input:any):Promise<any>; listFocusSessions(limit?:number):Promise<any[]>;
      saveJournalEntry(input:any):Promise<any>; deleteJournalEntry(id:string):Promise<boolean>; listJournalEntries(limit?:number):Promise<any[]>;
      saveWeeklyReview(input:any):Promise<any>; getWeeklyReviewSummary(from:string,to:string):Promise<any>; listWeeklyReviews(limit?:number):Promise<any[]>;
      searchAll(query:string,limit?:number):Promise<any[]>; getInsights(from?:string,to?:string):Promise<any>;
      exportData():Promise<any>; previewImport(payload:any):Promise<any>; applyImport(payload:any,mode:'merge'|'update'|'replace'):Promise<any>;
      createZipBackup():Promise<any>; previewZipBackup():Promise<any>; restoreZipBackup(payload:any,mode:'merge'|'update'|'replace'):Promise<any>;
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
