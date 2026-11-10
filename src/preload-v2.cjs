const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const api = {
  loadWorkspace: () => invoke('v2:workspace:load'),
  saveGoal: input => invoke('v2:goal:save', input),
  deleteGoal: id => invoke('v2:goal:delete', id),
  saveMilestone: input => invoke('v2:milestone:save', input),
  deleteMilestone: id => invoke('v2:milestone:delete', id),
  saveProject: input => invoke('v2:project:save', input),
  deleteProject: id => invoke('v2:project:delete', id),
  saveTask: input => invoke('v2:task:save', input),
  toggleTask: id => invoke('v2:task:toggle', id),
  setTaskStatus: (id,status) => invoke('v2:task:status',id,status),
  archiveGoal: (id,archived) => invoke('v2:goal:archive',id,archived),
  archiveProject: (id,archived) => invoke('v2:project:archive',id,archived),
  archiveTask: (id,archived) => invoke('v2:task:archive',id,archived),
  duplicateGoal: id => invoke('v2:goal:duplicate',id),
  duplicateProject: id => invoke('v2:project:duplicate',id),
  duplicateTask: id => invoke('v2:task:duplicate',id),
  saveSettings: input => invoke('v2:settings:save',input), getAppInfo: () => invoke('v2:app:info'), showNotification: input => invoke('v2:notification:show',input),
  deleteTask: id => invoke('v2:task:delete', id),
  listHabits: () => invoke('v2:phase2:habits:list'), saveHabit: input => invoke('v2:phase2:habits:save',input), deleteHabit: id => invoke('v2:phase2:habits:delete',id), archiveHabit: (id,archived) => invoke('v2:phase2:habits:archive',id,archived),
  logHabit: input => invoke('v2:phase2:habits:log',input), listHabitLogs: (from,to) => invoke('v2:phase2:habits:logs',from,to),
  saveFocusSession: input => invoke('v2:phase2:focus:save',input), listFocusSessions: limit => invoke('v2:phase2:focus:list',limit),
  saveJournalEntry: input => invoke('v2:phase2:journal:save',input), deleteJournalEntry: id => invoke('v2:phase2:journal:delete',id), listJournalEntries: limit => invoke('v2:phase2:journal:list',limit),
  saveWeeklyReview: input => invoke('v2:phase2:review:save',input), getWeeklyReviewSummary: (from,to) => invoke('v2:phase2:review:summary',from,to), listWeeklyReviews: limit => invoke('v2:phase2:review:list',limit),
  searchAll: (query,limit) => invoke('v2:phase2:search',query,limit), getInsights: (from,to) => invoke('v2:phase2:insights',from,to),
  exportData: () => invoke('v2:phase2:export'), previewImport: payload => invoke('v2:phase2:import:preview',payload),
  applyImport: (payload,mode) => invoke('v2:phase2:import:apply',payload,mode),
  createZipBackup: () => invoke('v2:phase2:zip:export'), previewZipBackup: () => invoke('v2:phase2:zip:preview'), restoreZipBackup: (payload,mode) => invoke('v2:phase2:zip:restore',payload,mode)
};
const desktop = {
  showItsuki: () => invoke('itsuki:show'),
  hideItsuki: () => invoke('itsuki:hide'),
  getVersion: () => invoke('app:version'),
  onNavigate: fn => {
    if (typeof fn !== 'function') return () => {};
    const handler = (_event, view) => fn(view);
    ipcRenderer.on('aurestar:navigate', handler);
    return () => ipcRenderer.removeListener('aurestar:navigate', handler);
  },
  onQuickAdd: fn => {
    if (typeof fn !== 'function') return () => {};
    const handler = () => fn();
    ipcRenderer.on('aurestar:quick-add', handler);
    return () => ipcRenderer.removeListener('aurestar:quick-add', handler);
  }
};
contextBridge.exposeInMainWorld('aurestarV2', api);
contextBridge.exposeInMainWorld('aurestarDesktop', desktop);