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
  saveSettings: input => invoke('v2:settings:save',input),
  deleteTask: id => invoke('v2:task:delete', id)
};
const desktop = {
  showItsuki: () => invoke('itsuki:show'),
  hideItsuki: () => invoke('itsuki:hide'),
  getVersion: () => invoke('app:version'),
  onQuickAdd: fn => {
    if (typeof fn !== 'function') return () => {};
    const handler = () => fn();
    ipcRenderer.on('aurestar:quick-add', handler);
    return () => ipcRenderer.removeListener('aurestar:quick-add', handler);
  }
};
contextBridge.exposeInMainWorld('aurestarV2', api);
contextBridge.exposeInMainWorld('aurestarDesktop', desktop);