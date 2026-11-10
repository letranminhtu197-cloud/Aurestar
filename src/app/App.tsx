import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, Check, CheckCircle2, ChevronDown, Circle, CircleDot,
  Command, FolderKanban, Goal as GoalIcon, LayoutDashboard, ListTodo, Plus, Search, Settings2,
  Sparkles, Target, Trash2, X, Pencil, Milestone as MilestoneIcon, AlertCircle, PanelLeftClose, Copy, Archive, RotateCcw, ArrowUpDown, Columns3, List, Settings
} from 'lucide-react';
import { useWorkspace } from './store';
import type { Goal, Milestone, Project, Task, Priority } from './types';

type Page = 'home' | 'goals' | 'projects' | 'tasks';
type Modal = null | { kind: 'goal'; item?: Goal } | { kind: 'project'; item?: Project } | { kind: 'task'; item?: Task } | { kind: 'milestone'; goalId: string; item?: Milestone };
const dateLabel = (value?: string | null) => value ? new Date(value + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date';
const priorityLabel: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const safeDate = (value?: string | null) => value || '';

function App() {
  const data = useWorkspace();
  const [page, setPage] = useState<Page>(() => (['home','goals','projects','tasks'].includes(location.hash.slice(1)) ? location.hash.slice(1) as Page : 'home'));
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all'|'today'|'upcoming'|'overdue'|'completed'|'inbox'|'archived'>('all');
  const [taskSort,setTaskSort]=useState<'due'|'priority'|'title'|'created'>('due');
  const [showArchived,setShowArchived]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [notice, setNotice] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('aurestar.theme') !== 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('aurestar.sidebar.collapsed') === 'true');
  useEffect(() => { void data.load(); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('aurestar.theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { if(!data.loading){ const saved=data.settings||{}; if(saved.theme==='dark'||saved.theme==='light')setDark(saved.theme==='dark'); else if(saved.theme==='system')setDark(window.matchMedia('(prefers-color-scheme: dark)').matches); if(typeof saved.sidebarCollapsed==='boolean')setSidebarCollapsed(saved.sidebarCollapsed); if(saved.density==='compact'||saved.density==='comfortable')document.documentElement.dataset.density=String(saved.density); if(['home','goals','projects','tasks'].includes(String(saved.defaultLandingPage)))setPage(saved.defaultLandingPage as Page); } }, [data.loading]);
  useEffect(() => { localStorage.setItem('aurestar.sidebar.collapsed', String(sidebarCollapsed)); }, [sidebarCollapsed]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector<HTMLInputElement>('.top-search input')?.focus(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setPage('tasks'); setModal({ kind: 'task' }); } else if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); setSettingsOpen(true); } else if (e.key === 'Escape') { setModal(null); setSettingsOpen(false); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  useEffect(() => {
    const stop = window.aurestarDesktop?.onQuickAdd?.(() => { setPage('tasks'); setModal({ kind: 'task' }); });
    return () => stop?.();
  }, []);
  useEffect(() => {
    const stop = window.aurestarDesktop?.onNavigate?.(view => { if(['home','goals','projects','tasks'].includes(view)) setPage(view as Page); });
    return () => stop?.();
  }, []);
  useEffect(() => { location.hash = page; }, [page]);
  const today = new Date().toISOString().slice(0,10);
  const filteredTasks = useMemo(() => data.tasks.filter(t => {
    const matches = !query || [t.title,t.description,t.project_name||'',...(t.tags||[])].some(v => v.toLowerCase().includes(query.toLowerCase()));
    const status = taskFilter === 'completed' ? t.status === 'completed' && !t.archived_at : taskFilter === 'today' ? t.due_date===today && !t.archived_at : taskFilter === 'upcoming' ? !!t.due_date && t.due_date>today && !['completed','cancelled'].includes(t.status) && !t.archived_at : taskFilter === 'overdue' ? !['completed','cancelled'].includes(t.status) && !!t.due_date && t.due_date<today && !t.archived_at : taskFilter === 'inbox' ? t.status==='inbox' && !t.archived_at : taskFilter === 'archived' ? !!t.archived_at : !t.archived_at;
    return matches && status;
  }).sort((a,b)=>taskSort==='title'?a.title.localeCompare(b.title):taskSort==='priority'?({urgent:0,high:1,medium:2,low:3}[a.priority]-{urgent:0,high:1,medium:2,low:3}[b.priority]):taskSort==='created'?b.created_at.localeCompare(a.created_at):(a.due_date||'9999').localeCompare(b.due_date||'9999')), [data.tasks, query, taskFilter, taskSort, today]);
  const filteredGoals = data.goals.filter(g => (!!g.archived_at===showArchived) && (!query || [g.title,g.description,g.category].some(v=>v.toLowerCase().includes(query.toLowerCase()))));
  const filteredProjects = data.projects.filter(p => (!!p.archived_at===showArchived) && (!query || [p.name,p.description].some(v=>v.toLowerCase().includes(query.toLowerCase()))));
  const globalResults = query.trim().length<2?[]:[
    ...data.goals.filter(g=>!g.archived_at&&g.title.toLowerCase().includes(query.toLowerCase())).map(item=>({type:'goal',id:item.id,title:item.title,item})),
    ...data.projects.filter(p=>!p.archived_at&&p.name.toLowerCase().includes(query.toLowerCase())).map(item=>({type:'project',id:item.id,title:item.name,item})),
    ...data.tasks.filter(t=>!t.archived_at&&t.title.toLowerCase().includes(query.toLowerCase())).map(item=>({type:'task',id:item.id,title:item.title,item}))
  ].slice(0,10);
  const open = (kind: Exclude<Modal,null>['kind'], item?: Goal|Project|Task|Milestone, goalId?: string) => {
    if (kind === 'milestone') setModal({ kind, goalId: goalId || '', item: item as Milestone|undefined });
    else if (kind === 'goal') setModal({ kind, item: item as Goal|undefined });
    else if (kind === 'project') setModal({ kind, item: item as Project|undefined });
    else setModal({ kind, item: item as Task|undefined });
  };
  const addButton = page === 'goals' ? ['New goal',()=>open('goal')] as const : page === 'projects' ? ['New project',()=>open('project')] as const : ['Quick Add',()=>open('task')] as const;
  const pageTitle = ({home:'Overview',goals:'Goals',projects:'Projects',tasks:'Tasks'} as const)[page];
  const handleError = (e: unknown) => setNotice(e instanceof Error ? e.message : 'Something went wrong.');
  const persistSettings = (patch:Record<string,unknown>) => { void data.saveSettings(patch).catch(handleError); };
  return <div className={'app-shell '+(sidebarCollapsed?'is-collapsed':'')}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span>A</span></div><div><b>AURESTAR</b><small>PERSONAL WORKSPACE</small></div></div>
      <div className="workspace-pill"><div className="avatar">A</div><div><b>My Workspace</b><small>Local · Private</small></div><ChevronDown size={15}/></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="nav-list">
        <NavItem active={page==='home'} icon={<LayoutDashboard/>} label="Overview" onClick={()=>setPage('home')}/>
        <NavItem active={page==='goals'} icon={<Target/>} label="Goals" onClick={()=>setPage('goals')}/>
        <NavItem active={page==='projects'} icon={<FolderKanban/>} label="Projects" onClick={()=>setPage('projects')}/>
        <NavItem active={page==='tasks'} icon={<ListTodo/>} label="Tasks" onClick={()=>setPage('tasks')}/>
      </nav>
      <div className="sidebar-bottom"><div className="offline-state"><span/> Offline-first storage</div><button className="nav-item" onClick={()=>setSettingsOpen(true)}><Settings2 size={18}/> Settings</button><div className="sidebar-foot">AURESTAR 3.0 · PHASE 1</div></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button sidebar-toggle" title={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setSidebarCollapsed(v=>{const next=!v;persistSettings({sidebarCollapsed:next});return next;})}><PanelLeftClose size={17}/></button>
        <div><div className="breadcrumb">AURESTAR <span>/</span> WORKSPACE</div><h1>{pageTitle}</h1></div>
        <div className="top-search-wrap"><div className="top-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>setSearchOpen(true)} onBlur={()=>window.setTimeout(()=>setSearchOpen(false),140)} placeholder="Search goals, projects, tasks…" /><kbd><Command size={11}/> K</kbd></div>{searchOpen&&query.trim().length>=2&&<div className="search-results">{globalResults.length?globalResults.map(result=><button key={result.type+result.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setPage(result.type==='goal'?'goals':result.type==='project'?'projects':'tasks');if(result.type==='goal')open('goal',result.item as Goal);if(result.type==='project')open('project',result.item as Project);if(result.type==='task')open('task',result.item as Task);setSearchOpen(false);}}><b>{result.title}</b><small>{result.type}</small></button>):<p>No matching records</p>}</div>}</div>
        <div className="top-actions"><button className="icon-button" title="Open settings" onClick={()=>setSettingsOpen(true)}><Settings size={17}/></button><button className="icon-button" title="Toggle theme" onClick={()=>{setDark(v=>{const next=!v;persistSettings({theme:next?'dark':'light'});return next;});}}><Sparkles size={17}/></button><button className="icon-button" title="Show Itsuki widget" onClick={()=>void window.aurestarDesktop?.showItsuki?.()}><Activity size={17}/></button><button className="primary-button compact" onClick={addButton[1]}><Plus size={16}/>{addButton[0]}</button></div>
      </header>
      {data.error && <div className="error-banner"><AlertCircle size={16}/>{data.error}<button onClick={()=>void data.load()}>Retry</button></div>}
      {data.loading ? <div className="loading-state"><span className="spinner"/> Loading your workspace…</div> :
        page==='home' ? <Dashboard data={data} onPage={setPage} onOpen={open} onTaskToggle={id=>void data.toggleTask(id).catch(handleError)}/> :
        page==='goals' ? <GoalsPage goals={filteredGoals} milestones={data.milestones} showArchived={showArchived} onToggleArchived={()=>setShowArchived(v=>!v)} onOpen={open} onDelete={id=>{if(window.confirm('Delete this goal and its milestones?'))void data.deleteGoal(id).catch(handleError);}} onArchive={(id,archived)=>void data.archiveGoal(id,archived).catch(handleError)} onDuplicate={id=>void data.duplicateGoal(id).catch(handleError)} onMilestoneDelete={id=>{if(window.confirm('Delete this milestone?'))void data.deleteMilestone(id).catch(handleError);}}/> :
        page==='projects' ? <ProjectsPage projects={filteredProjects} showArchived={showArchived} onToggleArchived={()=>setShowArchived(v=>!v)} onOpen={open} onDelete={id=>{if(window.confirm('Delete this project? Its tasks will remain.'))void data.deleteProject(id).catch(handleError);}} onArchive={(id,archived)=>void data.archiveProject(id,archived).catch(handleError)} onDuplicate={id=>void data.duplicateProject(id).catch(handleError)}/> :
        <TasksPage tasks={filteredTasks} filter={taskFilter} setFilter={setTaskFilter} sort={taskSort} setSort={setTaskSort} onOpen={open} onToggle={id=>void data.toggleTask(id).catch(handleError)} onStatus={(id,status)=>void data.setTaskStatus(id,status).catch(handleError)} onPriority={(task,priority)=>void data.saveTask({id:task.id,title:task.title,description:task.description,status:task.status,priority,startDate:task.start_date||undefined,dueDate:task.due_date||undefined,dueTime:task.due_time||undefined,estimatedMinutes:task.estimated_minutes||undefined,projectId:task.project_id||undefined,parentTaskId:task.parent_task_id||undefined,goalIds:task.goalIds,tags:task.tags}).catch(handleError)} onArchive={(id,archived)=>void data.archiveTask(id,archived).catch(handleError)} onDuplicate={id=>void data.duplicateTask(id).catch(handleError)} onDelete={id=>{if(window.confirm('Delete this task permanently?'))void data.deleteTask(id).catch(handleError);}}/>}
      {notice && <div className="toast"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={15}/></button></div>}
    </main>
    {settingsOpen&&<SettingsModal initialTheme={String(data.settings.theme|| (dark?'dark':'light'))} initialDensity={String(data.settings.density||'comfortable')} initialDefaultPage={String(data.settings.defaultLandingPage||'home')} onClose={()=>setSettingsOpen(false)} onSave={async values=>{await data.saveSettings(values);if(values.theme==='dark'||values.theme==='light')setDark(values.theme==='dark');else if(values.theme==='system')setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.density=String(values.density);setSettingsOpen(false);}}/>}
    {modal && <EditorModal modal={modal} goals={data.goals} projects={data.projects} tasks={data.tasks} onClose={()=>setModal(null)} onError={handleError}
      onSave={async value=>{try{if(modal.kind==='goal')await data.saveGoal(value as never);if(modal.kind==='project')await data.saveProject(value as never);if(modal.kind==='task')await data.saveTask(value as never);if(modal.kind==='milestone')await data.saveMilestone(value as never);setModal(null);}catch(e){handleError(e);}}}/>}
  </div>;
}

function NavItem({active,icon,label,onClick}:{active:boolean;icon:React.ReactNode;label:string;onClick:()=>void}) {
  return <button title={label} className={'nav-item '+(active?'active':'')} onClick={onClick}>{icon}<span>{label}</span>{active&&<i/>}</button>;
}

function Dashboard({data,onPage,onOpen,onTaskToggle}:{data:ReturnType<typeof useWorkspace.getState>;onPage:(p:Page)=>void;onOpen:(k:'goal'|'project'|'task'|'milestone',item?:Goal|Project|Task,goalId?:string)=>void;onTaskToggle:(id:string)=>void}) {
  const tasks=data.tasks.filter(t=>!t.archived_at&&!['completed','cancelled'].includes(t.status)).slice(0,6);
  const today=new Date().toISOString().slice(0,10); const dueToday=data.tasks.filter(t=>!t.archived_at&&t.due_date===today&&!['completed','cancelled'].includes(t.status)).length; const completedToday=data.tasks.filter(t=>!t.archived_at&&t.status==='completed'&&t.completed_at?.slice(0,10)===today).length;
  return <div className="page-content">
    <div className="welcome-row"><div><div className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:'long'}).toUpperCase()}, {new Date().toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}).toUpperCase()}</div><h2>A clearer space for meaningful progress.</h2><p>Your goals, projects and next actions — together in one calm workspace.</p></div><button className="secondary-button" onClick={()=>onPage('tasks')}>Open task list <ArrowUpRight size={15}/></button></div>
    <section className="metric-grid">
      <Metric icon={<ListTodo/>} label="Due today" value={dueToday} foot="Tasks scheduled for today"/>
      <Metric icon={<CheckCircle2/>} label="Completed today" value={completedToday} foot="Finished tasks today"/>
      <Metric icon={<Target/>} label="Active goals" value={data.summary.activeGoals} foot="Keep your direction clear"/>
      <Metric icon={<FolderKanban/>} label="Active projects" value={data.summary.activeProjects} foot="Work in progress"/>
      <Metric icon={<CheckCircle2/>} label="Completed tasks" value={data.summary.completedTasks} foot="Progress recorded locally"/>
    </section>
    <div className="dashboard-grid">
      <section className="panel tasks-panel"><PanelHead title="Next actions" subtitle="Your active task queue" action="All tasks" onAction={()=>onPage('tasks')}/>
        {tasks.length ? <div className="task-list">{tasks.map(t=><TaskRow key={t.id} task={t} onToggle={()=>onTaskToggle(t.id)} onEdit={()=>onOpen('task',t)}/>)}</div> : <Empty icon={<CheckCircle2/>} title="Nothing waiting" body="Add a task to give your next session a clear direction."/>}
      </section>
      <section className="panel goals-panel"><PanelHead title="Active goals" subtitle="The outcomes you are moving toward" action="View goals" onAction={()=>onPage('goals')}/>
        {data.goals.filter(g=>!g.archived_at&&g.status==='active').slice(0,4).map(g=><div className="goal-row" key={g.id}><div className="goal-icon"><GoalIcon size={17}/></div><div className="goal-main"><b>{g.title}</b><small>{g.category} · {g.milestones_done}/{g.milestone_count} milestones</small><div className="progress-track"><i style={{width:`${g.progress_value}%`}}/></div></div><strong>{Math.round(g.progress_value)}%</strong></div>)}
        {!data.goals.some(g=>!g.archived_at&&g.status==='active')&&<Empty icon={<Target/>} title="No active goals" body="Create a goal to define what progress means."/>}
      </section>
      <section className="panel projects-panel"><PanelHead title="Project overview" subtitle="A home for related tasks" action="All projects" onAction={()=>onPage('projects')}/>
        {data.projects.filter(p=>!p.archived_at).slice(0,3).map(p=><div className="project-row" key={p.id}><span className="project-dot" style={{background:p.color}}/><div><b>{p.name}</b><small>{p.tasks_done}/{p.task_count} tasks complete</small></div><span className="project-percent">{p.task_count?Math.round(p.tasks_done/p.task_count*100):0}%</span></div>)}
        {!data.projects.some(p=>!p.archived_at)&&<Empty icon={<FolderKanban/>} title="No projects yet" body="Projects help organize work across goals."/>}
      </section>
      <section className="panel milestone-panel"><PanelHead title="Upcoming milestones" subtitle="Small checkpoints, visible progress" action="Goals" onAction={()=>onPage('goals')}/>
        {data.milestones.filter(m=>m.status!=='completed'&&!data.goals.find(g=>g.id===m.goal_id)?.archived_at).slice(0,4).map(m=><div className="milestone-row" key={m.id}><span className="milestone-dot"/><div><b>{m.title}</b><small>{m.goal_title} · {dateLabel(m.due_date)}</small></div></div>)}
        {!data.milestones.some(m=>m.status!=='completed'&&!data.goals.find(g=>g.id===m.goal_id)?.archived_at)&&<Empty icon={<MilestoneIcon/>} title="No milestones yet" body="Add checkpoints to an active goal."/>}
      </section>
    </div>
  </div>;
}
function Metric({icon,label,value,foot}:{icon:React.ReactNode;label:string;value:number;foot:string}){return <article className="metric-card"><div className="metric-top">{icon}<span>{label}</span></div><strong>{value}</strong><small>{foot}</small></article>}
function PanelHead({title,subtitle,action,onAction}:{title:string;subtitle:string;action:string;onAction:()=>void}){return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div><button onClick={onAction}>{action}<ArrowUpRight size={14}/></button></div>}
function Empty({icon,title,body}:{icon:React.ReactNode;title:string;body:string}){return <div className="empty-state"><span>{icon}</span><b>{title}</b><p>{body}</p></div>}
function TaskRow({task,onToggle,onEdit}:{task:Task;onToggle:()=>void;onEdit:()=>void}){return <div className="task-row"><button className="check-button" onClick={onToggle} title="Complete task"><Circle size={19}/></button><button className="task-copy" onClick={onEdit}><b>{task.title}</b><small>{task.project_name||'Personal'} · {dateLabel(task.due_date)}</small></button><span className={'priority '+task.priority}>{priorityLabel[task.priority]}</span></div>}
function GoalsPage({goals,milestones,onOpen,onDelete,onMilestoneDelete,onArchive,onDuplicate,showArchived,onToggleArchived}:{goals:Goal[];milestones:Milestone[];onOpen:(k:'goal'|'milestone',item?:Goal|Milestone,goalId?:string)=>void;onDelete:(id:string)=>void;onMilestoneDelete:(id:string)=>void;onArchive:(id:string,archived:boolean)=>void;onDuplicate:(id:string)=>void;showArchived:boolean;onToggleArchived:()=>void}) {
  return <div className="page-content"><div className="section-intro"><div><div className="eyebrow">DIRECTION & OUTCOMES</div><h2>{showArchived?'Archived goals':'Goals'}</h2><p>Define outcomes, then break them into milestones you can act on.</p></div><div className="intro-actions"><button className="secondary-button" onClick={onToggleArchived}>{showArchived?'Active goals':'Archived'}</button><span className="count-pill">{goals.length} goals</span></div></div>
    <div className="entity-grid">{goals.map(g=><article className="entity-card" key={g.id}><div className="entity-card-head"><span className="entity-icon"><Target size={18}/></span><div className="entity-actions"><button title="Duplicate goal" onClick={()=>onDuplicate(g.id)}><Copy size={14}/></button><button title={g.archived_at?'Restore goal':'Archive goal'} onClick={()=>onArchive(g.id,!g.archived_at)}>{g.archived_at?<RotateCcw size={14}/>:<Archive size={14}/>}</button><button title="Edit goal" onClick={()=>onOpen('goal',g)}><Pencil size={15}/></button><button title="Delete goal" onClick={()=>onDelete(g.id)}><Trash2 size={15}/></button></div></div><div className="entity-meta">{g.category} · {g.priority} priority</div><h3>{g.title}</h3><p>{g.description||'No description added.'}</p><div className="goal-progress-line"><span>Progress</span><b>{Math.round(g.progress_value)}%</b></div><div className="progress-track"><i style={{width:g.progress_value+'%'}}/></div><div className="entity-foot"><span>{g.archived_at?'archived':g.status.replace('_',' ')}</span><span>{g.milestones_done}/{g.milestone_count} milestones · {g.linked_project_count} projects · {g.linked_task_count} tasks</span></div>
      {!g.archived_at&&<div className="milestone-list"><div className="mini-head"><b>Milestones</b><button onClick={()=>onOpen('milestone',undefined,g.id)}><Plus size={13}/> Add</button></div>{milestones.filter(m=>m.goal_id===g.id).map(m=><div className="mini-milestone" key={m.id}><span className={m.status==='completed'?'done':''}>{m.status==='completed'?<Check size={12}/>:<CircleDot size={12}/>}</span><div><b>{m.title}</b><small>{dateLabel(m.due_date)}</small></div><button title="Edit milestone" onClick={()=>onOpen('milestone',m,g.id)}><Pencil size={12}/></button><button title="Delete milestone" onClick={()=>onMilestoneDelete(m.id)}><X size={13}/></button></div>)}</div>}
    </article>)}</div>{!goals.length&&<Empty icon={<Target/>} title={showArchived?'No archived goals':'Start with a goal'} body={showArchived?'Archived goals will appear here.':'Goals are stored locally and can stand on their own, without a project.'}/>}</div>;
}
function ProjectsPage({projects,onOpen,onDelete,onArchive,onDuplicate,showArchived,onToggleArchived}:{projects:Project[];onOpen:(k:'project',item?:Project)=>void;onDelete:(id:string)=>void;onArchive:(id:string,archived:boolean)=>void;onDuplicate:(id:string)=>void;showArchived:boolean;onToggleArchived:()=>void}){
  const [view,setView]=useState<'list'|'board'>('list');
  const card=(p:Project)=><article className="entity-card project-card" key={p.id}><div className="entity-card-head"><span className="project-color-icon" style={{background:p.color}}><FolderKanban size={18}/></span><div className="entity-actions"><button title="Duplicate project" onClick={()=>onDuplicate(p.id)}><Copy size={14}/></button><button title={p.archived_at?'Restore project':'Archive project'} onClick={()=>onArchive(p.id,!p.archived_at)}>{p.archived_at?<RotateCcw size={14}/>:<Archive size={14}/>}</button><button title="Edit project" onClick={()=>onOpen('project',p)}><Pencil size={15}/></button><button title="Delete project" onClick={()=>onDelete(p.id)}><Trash2 size={15}/></button></div></div><div className="entity-meta">{p.archived_at?'archived':p.status.replace('_',' ')} · {p.priority} priority</div><h3>{p.name}</h3><p>{p.description||'No project description.'}</p><div className="project-stats"><b>{p.tasks_done}<small> completed</small></b><b>{p.task_count-p.tasks_done}<small> open</small></b></div><div className="progress-track"><i style={{width:(p.task_count?p.tasks_done/p.task_count*100:0)+'%',background:p.color}}/></div><div className="entity-foot"><span>{p.goalIds.length} linked goals</span><span>Due {dateLabel(p.due_date)}</span></div></article>;
  return <div className="page-content"><div className="section-intro"><div><div className="eyebrow">ORGANIZE YOUR WORK</div><h2>{showArchived?'Archived projects':'Projects'}</h2><p>Group related tasks while keeping goals optional and independent.</p></div><div className="intro-actions"><button className="secondary-button" onClick={()=>setView(v=>v==='list'?'board':'list')}>{view==='list'?<Columns3 size={14}/>:<List size={14}/>} {view==='list'?'Board':'List'}</button><button className="secondary-button" onClick={onToggleArchived}>{showArchived?'Active projects':'Archived'}</button><span className="count-pill">{projects.length} projects</span></div></div>
    {view==='list'?<div className="entity-grid">{projects.map(card)}</div>:<div className="project-board">{['active','on_hold','completed'].map(status=><section className="panel board-column" key={status}><h3>{status.replace('_',' ')}</h3>{projects.filter(p=>p.status===status).map(card)}</section>)}</div>}
    {!projects.length&&<Empty icon={<FolderKanban/>} title={showArchived?'No archived projects':'No projects yet'} body={showArchived?'Archived projects will appear here.':'Create a project to organize tasks around a shared outcome.'}/>}</div>;
}
function TasksPage({tasks,filter,setFilter,sort,setSort,onOpen,onToggle,onStatus,onPriority,onArchive,onDuplicate,onDelete}:{tasks:Task[];filter:'all'|'today'|'upcoming'|'overdue'|'completed'|'inbox'|'archived';setFilter:(v:'all'|'today'|'upcoming'|'overdue'|'completed'|'inbox'|'archived')=>void;sort:'due'|'priority'|'title'|'created';setSort:(v:'due'|'priority'|'title'|'created')=>void;onOpen:(k:'task',item?:Task)=>void;onToggle:(id:string)=>void;onStatus:(id:string,status:string)=>void;onPriority:(task:Task,priority:Priority)=>void;onArchive:(id:string,archived:boolean)=>void;onDuplicate:(id:string)=>void;onDelete:(id:string)=>void}){
  const [view,setView]=useState<'list'|'board'>('list');
  const statuses=['inbox','todo','in_progress','completed','cancelled'];
  return <div className="page-content"><div className="section-intro"><div><div className="eyebrow">CAPTURE & EXECUTE</div><h2>Tasks</h2><p>Keep next actions clear, prioritized and connected to your work.</p></div><span className="count-pill">{tasks.length} tasks</span></div>
    <div className="task-toolbar"><div className="filter-bar">{(['all','today','upcoming','overdue','inbox','completed','archived'] as const).map(f=><button key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div><div className="task-view-actions"><label><ArrowUpDown size={14}/><select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="due">Due date</option><option value="priority">Priority</option><option value="title">Title</option><option value="created">Recently added</option></select></label><button className="secondary-button" onClick={()=>setView(v=>v==='list'?'board':'list')}>{view==='list'?<Columns3 size={14}/>:<List size={14}/>} {view==='list'?'Board':'List'}</button></div></div>
    {view==='list'?<section className="panel task-table"><div className="task-table-head"><span>Task</span><span>Status</span><span>Priority</span><span>Project</span><span>Due date</span><span>Actions</span></div>{tasks.map(t=><div className={'task-table-row '+(t.status==='completed'?'is-complete':'')} key={t.id}><button className="check-button" onClick={()=>onToggle(t.id)} title={t.status==='completed'?'Reopen task':'Complete task'}>{t.status==='completed'?<CheckCircle2 size={19}/>:<Circle size={19}/>}</button><button className="table-task-title" onClick={()=>onOpen('task',t)}><b>{t.parent_task_id?'↳ ':''}{t.title}</b><small>{t.description||((t.tags||[]).join(' · ')||'No notes')}</small></button><select className="inline-select" value={t.status} onChange={e=>onStatus(t.id,e.target.value)}>{statuses.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select><select className="inline-select" value={t.priority} onChange={e=>onPriority(t,e.target.value as Priority)}>{(['urgent','high','medium','low'] as Priority[]).map(s=><option key={s} value={s}>{s}</option>)}</select><span className="table-project">{t.project_name||'—'}</span><span className="table-date">{dateLabel(t.due_date)}{t.due_time?' · '+t.due_time:''}</span><div className="entity-actions"><button title="Duplicate" onClick={()=>onDuplicate(t.id)}><Copy size={13}/></button><button title={t.archived_at?'Restore':'Archive'} onClick={()=>onArchive(t.id,!t.archived_at)}>{t.archived_at?<RotateCcw size={13}/>:<Archive size={13}/>}</button><button title="Edit" onClick={()=>onOpen('task',t)}><Pencil size={14}/></button><button title="Delete" onClick={()=>onDelete(t.id)}><Trash2 size={14}/></button></div></div>)}{!tasks.length&&<Empty icon={<ListTodo/>} title="No tasks match this view" body="Create a task or adjust your filters."/>}</section>:<div className="task-board">{['inbox','todo','in_progress','completed','cancelled'].map(status=><section className="panel board-column" key={status}><h3>{status.replace('_',' ')}</h3>{tasks.filter(t=>t.status===status).map(t=><article className="board-task" key={t.id}><b>{t.title}</b><small>{t.project_name||'Personal'} · {dateLabel(t.due_date)}</small><select className="inline-select" value={t.status} onChange={e=>onStatus(t.id,e.target.value)}>{statuses.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select><button className="text-action" onClick={()=>onOpen('task',t)}>Edit task</button></article>)}</section>)}</div>}
  </div>;
}
function EditorModal({modal,goals,projects,tasks,onClose,onSave,onError}:{modal:Exclude<Modal,null>;goals:Goal[];projects:Project[];tasks:Task[];onClose:()=>void;onSave:(v:Record<string,unknown>)=>Promise<void>;onError:(e:unknown)=>void}) {
  const item = 'item' in modal ? modal.item : undefined;
  const isGoal=modal.kind==='goal', isProject=modal.kind==='project', isTask=modal.kind==='task', isMilestone=modal.kind==='milestone';
  const [title,setTitle]=useState(isGoal?(item as Goal|undefined)?.title||'':isProject?(item as Project|undefined)?.name||'':isTask?(item as Task|undefined)?.title||'':isMilestone?(item as Milestone|undefined)?.title||'':'');
  const [description,setDescription]=useState(item?.description||'');
  const [priority,setPriority]=useState((item as Goal|Project|Task|undefined)?.priority||'medium');
  const [status,setStatus]=useState(item?.status|| (isGoal?'active':'todo'));
  const [startDate,setStartDate]=useState(safeDate(isGoal?(item as Goal|undefined)?.start_date:isProject?(item as Project|undefined)?.start_date:null));
  const [dueDate,setDueDate]=useState(safeDate(isGoal?(item as Goal|undefined)?.target_date:isProject?(item as Project|undefined)?.due_date:isTask?(item as Task|undefined)?.due_date:(item as Milestone|undefined)?.due_date));
  const [category,setCategory]=useState(isGoal?(item as Goal|undefined)?.category||'Personal':'Personal');
  const [progress,setProgress]=useState(String(isGoal?(item as Goal|undefined)?.progress_value||0:0));
  const [progressMode,setProgressMode]=useState<'manual'|'automatic'>(isGoal?(item as Goal|undefined)?.progress_mode||'manual':'manual');
  const [projectId,setProjectId]=useState((item as Task|undefined)?.project_id||'');
  const [parentTaskId,setParentTaskId]=useState((item as Task|undefined)?.parent_task_id||'');
  const [estimatedMinutes,setEstimatedMinutes]=useState(String((item as Task|undefined)?.estimated_minutes||''));
  const [dueTime,setDueTime]=useState((item as Task|undefined)?.due_time||'');
  const [tags,setTags]=useState(((item as Task|undefined)?.tags||[]).join(', '));
  const [goalIds,setGoalIds]=useState<string[]>(isProject?(item as Project|undefined)?.goalIds||[]:isTask?(item as Task|undefined)?.goalIds||[]:[]);
  const [color,setColor]=useState(isProject?(item as Project|undefined)?.color||'#B94A62':'#B94A62');
  const [milestoneStatus,setMilestoneStatus]=useState<string>((item as Milestone|undefined)?.status||'pending');
  const [saving,setSaving]=useState(false);
  const titleLabel=isMilestone?(item?'Edit milestone':'New milestone'):isGoal?'Goal':isProject?'Project':'Task';
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{
    if(modal.kind==='milestone')await onSave({id:item?.id,goalId:modal.goalId,title,description,dueDate,status:milestoneStatus});
    else await onSave({id:item?.id,title,...(isGoal?{description,category,priority,status,startDate,targetDate:dueDate,progressMode,progressValue:Number(progress)}:isProject?{description,priority,status,startDate,dueDate,color,goalIds}:{description,priority,status,startDate,dueDate,projectId,goalIds,parentTaskId,dueTime,estimatedMinutes:Number(estimatedMinutes)||undefined,tags:tags.split(',').map(x=>x.trim()).filter(Boolean)})});
  }catch(e){onError(e);}finally{setSaving(false);}};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="editor-modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">{item?'EDIT':'CREATE'} · AURESTAR</div><h2>{titleLabel}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div>
    <label className="field"><span>{isProject?'Project name':isGoal?'Goal title':modal.kind==='milestone'?'Milestone title':'Task title'}</span><input autoFocus required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} placeholder={isGoal?'e.g. Reach IELTS 7.5':isProject?'e.g. IELTS preparation':'e.g. Complete Biology review'}/></label>
    <label className="field"><span>Description</span><textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Add useful context (optional)"/></label>
    {modal.kind==='milestone'?<><label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label className="field"><span>Status</span><select value={milestoneStatus} onChange={e=>setMilestoneStatus(e.target.value)}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label></>:
    <><div className="form-grid"><label className="field"><span>Priority</span><select value={priority} onChange={e=>setPriority(e.target.value as Priority)}>{Object.keys(priorityLabel).map(p=><option key={p} value={p}>{priorityLabel[p as Priority]}</option>)}</select></label><label className="field"><span>Status</span><select value={status} onChange={e=>setStatus(e.target.value)}>{(isGoal?['not_started','active','on_hold','completed']:isProject?['active','on_hold','completed']:['inbox','todo','in_progress','completed','cancelled']).map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></label></div>
    <div className="form-grid"><label className="field"><span>Start date</span><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label className="field"><span>{isGoal?'Target date':'Due date'}</span><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>
    {isGoal&&<><div className="form-grid"><label className="field"><span>Category</span><input value={category} onChange={e=>setCategory(e.target.value)}/></label><label className="field"><span>Progress mode</span><select value={progressMode} onChange={e=>setProgressMode(e.target.value as 'manual'|'automatic')}><option value="manual">Manual</option><option value="automatic">Automatic</option></select></label></div>{progressMode==='manual'?<label className="field"><span>Progress (%)</span><input type="number" min="0" max="100" value={progress} onChange={e=>setProgress(e.target.value)}/></label>:<div className="settings-note">Progress is calculated from linked task completion and milestone completion.</div>}</>}
    {isProject&&<label className="field"><span>Project accent</span><input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>}
    {isTask&&<><label className="field"><span>Project</span><select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">No project</option>{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label className="field"><span>Due time</span><input type="time" value={dueTime} onChange={e=>setDueTime(e.target.value)}/></label><div className="form-grid"><label className="field"><span>Estimated minutes</span><input type="number" min="1" max="100000" value={estimatedMinutes} onChange={e=>setEstimatedMinutes(e.target.value)} placeholder="e.g. 30"/></label><label className="field"><span>Parent task</span><select value={parentTaskId} onChange={e=>setParentTaskId(e.target.value)}><option value="">No parent</option>{tasks.filter(t=>t.id!==item?.id).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div><label className="field"><span>Tags (comma separated)</span><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="study, biology, revision"/></label><div className="field"><span>Linked goals</span><div className="checkbox-grid">{goals.map(g=><label key={g.id}><input type="checkbox" checked={goalIds.includes(g.id)} onChange={e=>setGoalIds(v=>e.target.checked?[...v,g.id]:v.filter(x=>x!==g.id))}/>{g.title}</label>)}</div></div></>}
    {isProject&&<div className="field"><span>Linked goals</span><div className="checkbox-grid">{goals.map(g=><label key={g.id}><input type="checkbox" checked={goalIds.includes(g.id)} onChange={e=>setGoalIds(v=>e.target.checked?[...v,g.id]:v.filter(x=>x!==g.id))}/>{g.title}</label>)}</div></div>}
    </>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving||!title.trim()}><Check size={16}/>{saving?'Saving…':item?'Save changes':'Create '+titleLabel.toLowerCase()}</button></div>
  </form></div>;
}

function SettingsModal({initialTheme,initialDensity,initialDefaultPage,onClose,onSave}:{initialTheme:string;initialDensity:string;initialDefaultPage:string;onClose:()=>void;onSave:(v:Record<string,unknown>)=>Promise<void>}){
  const [theme,setTheme]=useState(initialTheme);
  const [density,setDensity]=useState(initialDensity);
  const [defaultPage,setDefaultPage]=useState(initialDefaultPage);
  const [saving,setSaving]=useState(false);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="editor-modal settings-modal" onSubmit={async e=>{e.preventDefault();setSaving(true);try{await onSave({theme,density,defaultLandingPage:defaultPage});}finally{setSaving(false);}}}>
    <div className="modal-head"><div><div className="eyebrow">PREFERENCES · LOCAL ONLY</div><h2>Settings</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div>
    <label className="field"><span>Appearance</span><select value={theme} onChange={e=>setTheme(e.target.value)}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>
    <label className="field"><span>Interface density</span><select value={density} onChange={e=>setDensity(e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
    <label className="field"><span>Default page on launch</span><select value={defaultPage} onChange={e=>setDefaultPage(e.target.value)}><option value="home">Overview</option><option value="goals">Goals</option><option value="projects">Projects</option><option value="tasks">Tasks</option></select></label>
    <div className="settings-note">Preferences are stored locally in the Aurestar SQLite database.</div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving?'Saving…':'Save settings'}</button></div>
  </form></div>;
}

export default App;