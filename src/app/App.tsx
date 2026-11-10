import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, Check, CheckCircle2, ChevronDown, Circle, CircleDot,
  Command, FolderKanban, Goal as GoalIcon, LayoutDashboard, ListTodo, Plus, Search, Settings2,
  Sparkles, Target, Trash2, X, Pencil, Milestone as MilestoneIcon, AlertCircle, PanelLeftClose
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
  const [taskFilter, setTaskFilter] = useState<'all'|'open'|'completed'|'overdue'>('all');
  const [notice, setNotice] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('aurestar.theme') !== 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('aurestar.sidebar.collapsed') === 'true');
  useEffect(() => { void data.load(); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('aurestar.theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { localStorage.setItem('aurestar.sidebar.collapsed', String(sidebarCollapsed)); }, [sidebarCollapsed]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector<HTMLInputElement>('.top-search input')?.focus(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setPage('tasks'); setModal({ kind: 'task' }); } else if (e.key === 'Escape') setModal(null); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  useEffect(() => {
    const stop = window.aurestarDesktop?.onQuickAdd?.(() => { setPage('tasks'); setModal({ kind: 'task' }); });
    return () => stop?.();
  }, []);
  useEffect(() => { location.hash = page; }, [page]);
  const filteredTasks = useMemo(() => data.tasks.filter(t => {
    const matches = !query || [t.title,t.description,t.project_name||''].some(v => v.toLowerCase().includes(query.toLowerCase()));
    const status = taskFilter === 'completed' ? t.status === 'completed' : taskFilter === 'open' ? !['completed','cancelled'].includes(t.status) : taskFilter === 'overdue' ? t.status !== 'completed' && !!t.due_date && t.due_date < new Date().toISOString().slice(0,10) : true;
    return matches && status;
  }), [data.tasks, query, taskFilter]);
  const filteredGoals = data.goals.filter(g => !query || [g.title,g.description,g.category].some(v=>v.toLowerCase().includes(query.toLowerCase())));
  const filteredProjects = data.projects.filter(p => !query || [p.name,p.description].some(v=>v.toLowerCase().includes(query.toLowerCase())));
  const open = (kind: Exclude<Modal,null>['kind'], item?: Goal|Project|Task|Milestone, goalId?: string) => {
    if (kind === 'milestone') setModal({ kind, goalId: goalId || '', item: item as Milestone|undefined });
    else if (kind === 'goal') setModal({ kind, item: item as Goal|undefined });
    else if (kind === 'project') setModal({ kind, item: item as Project|undefined });
    else setModal({ kind, item: item as Task|undefined });
  };
  const addButton = page === 'goals' ? ['New goal',()=>open('goal')] as const : page === 'projects' ? ['New project',()=>open('project')] as const : ['New task',()=>open('task')] as const;
  const pageTitle = ({home:'Overview',goals:'Goals',projects:'Projects',tasks:'Tasks'} as const)[page];
  const handleError = (e: unknown) => setNotice(e instanceof Error ? e.message : 'Something went wrong.');
  return <div className={'app-shell '+(sidebarCollapsed?'is-collapsed':'')}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span>✦</span></div><div><b>AURESTAR</b><small>PERSONAL WORKSPACE</small></div></div>
      <div className="workspace-pill"><div className="avatar">A</div><div><b>My Workspace</b><small>Local · Private</small></div><ChevronDown size={15}/></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="nav-list">
        <NavItem active={page==='home'} icon={<LayoutDashboard/>} label="Overview" onClick={()=>setPage('home')}/>
        <NavItem active={page==='goals'} icon={<Target/>} label="Goals" onClick={()=>setPage('goals')}/>
        <NavItem active={page==='projects'} icon={<FolderKanban/>} label="Projects" onClick={()=>setPage('projects')}/>
        <NavItem active={page==='tasks'} icon={<ListTodo/>} label="Tasks" onClick={()=>setPage('tasks')}/>
      </nav>
      <div className="sidebar-bottom"><div className="offline-state"><span/> Offline-first storage</div><button className="nav-item" onClick={()=>setNotice('Settings are scheduled for Phase 2.')}><Settings2 size={18}/> Settings <span className="soon">Later</span></button><div className="sidebar-foot">AURESTAR 3.0 · PHASE 1</div></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button sidebar-toggle" title={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setSidebarCollapsed(v=>!v)}><PanelLeftClose size={17}/></button>
        <div><div className="breadcrumb">AURESTAR <span>/</span> WORKSPACE</div><h1>{pageTitle}</h1></div>
        <div className="top-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search this workspace…" /><kbd><Command size={11}/> K</kbd></div>
        <div className="top-actions"><button className="icon-button" title="Toggle theme" onClick={()=>setDark(v=>!v)}><Sparkles size={17}/></button><button className="icon-button" title="Show Itsuki widget" onClick={()=>void window.aurestarDesktop?.showItsuki?.()}><Activity size={17}/></button><button className="primary-button compact" onClick={addButton[1]}><Plus size={16}/>{addButton[0]}</button></div>
      </header>
      {data.error && <div className="error-banner"><AlertCircle size={16}/>{data.error}<button onClick={()=>void data.load()}>Retry</button></div>}
      {data.loading ? <div className="loading-state"><span className="spinner"/> Loading your workspace…</div> :
        page==='home' ? <Dashboard data={data} onPage={setPage} onOpen={open} onTaskToggle={id=>void data.toggleTask(id).catch(handleError)}/> :
        page==='goals' ? <GoalsPage goals={filteredGoals} milestones={data.milestones} onOpen={open} onDelete={id=>void data.deleteGoal(id).catch(handleError)} onMilestoneDelete={id=>void data.deleteMilestone(id).catch(handleError)}/> :
        page==='projects' ? <ProjectsPage projects={filteredProjects} onOpen={open} onDelete={id=>void data.deleteProject(id).catch(handleError)}/> :
        <TasksPage tasks={filteredTasks} filter={taskFilter} setFilter={setTaskFilter} onOpen={open} onToggle={id=>void data.toggleTask(id).catch(handleError)} onDelete={id=>void data.deleteTask(id).catch(handleError)}/>}
      {notice && <div className="toast"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={15}/></button></div>}
    </main>
    {modal && <EditorModal modal={modal} goals={data.goals} projects={data.projects} tasks={data.tasks} onClose={()=>setModal(null)} onError={handleError}
      onSave={async value=>{try{if(modal.kind==='goal')await data.saveGoal(value as never);if(modal.kind==='project')await data.saveProject(value as never);if(modal.kind==='task')await data.saveTask(value as never);if(modal.kind==='milestone')await data.saveMilestone(value as never);setModal(null);}catch(e){handleError(e);}}}/>}
  </div>;
}

function NavItem({active,icon,label,onClick}:{active:boolean;icon:React.ReactNode;label:string;onClick:()=>void}) {
  return <button title={label} className={'nav-item '+(active?'active':'')} onClick={onClick}>{icon}<span>{label}</span>{active&&<i/>}</button>;
}

function Dashboard({data,onPage,onOpen,onTaskToggle}:{data:ReturnType<typeof useWorkspace.getState>;onPage:(p:Page)=>void;onOpen:(k:'goal'|'project'|'task'|'milestone',item?:Goal|Project|Task,goalId?:string)=>void;onTaskToggle:(id:string)=>void}) {
  const tasks=data.tasks.filter(t=>!['completed','cancelled'].includes(t.status)).slice(0,6);
  const dueToday=data.tasks.filter(t=>t.due_date===new Date().toISOString().slice(0,10)&&t.status!=='completed').length;
  return <div className="page-content">
    <div className="welcome-row"><div><div className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:'long'}).toUpperCase()}, {new Date().toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}).toUpperCase()}</div><h2>A clearer space for meaningful progress.</h2><p>Your goals, projects and next actions — together in one calm workspace.</p></div><button className="secondary-button" onClick={()=>onPage('tasks')}>Open task list <ArrowUpRight size={15}/></button></div>
    <section className="metric-grid">
      <Metric icon={<ListTodo/>} label="Open tasks" value={data.summary.openTasks} foot={`${dueToday} due today`}/>
      <Metric icon={<Target/>} label="Active goals" value={data.summary.activeGoals} foot="Keep your direction clear"/>
      <Metric icon={<FolderKanban/>} label="Active projects" value={data.summary.activeProjects} foot="Work in progress"/>
      <Metric icon={<CheckCircle2/>} label="Completed tasks" value={data.summary.completedTasks} foot="Progress recorded locally"/>
    </section>
    <div className="dashboard-grid">
      <section className="panel tasks-panel"><PanelHead title="Next actions" subtitle="Your active task queue" action="All tasks" onAction={()=>onPage('tasks')}/>
        {tasks.length ? <div className="task-list">{tasks.map(t=><TaskRow key={t.id} task={t} onToggle={()=>onTaskToggle(t.id)} onEdit={()=>onOpen('task',t)}/>)}</div> : <Empty icon={<CheckCircle2/>} title="Nothing waiting" body="Add a task to give your next session a clear direction."/>}
      </section>
      <section className="panel goals-panel"><PanelHead title="Active goals" subtitle="The outcomes you are moving toward" action="View goals" onAction={()=>onPage('goals')}/>
        {data.goals.filter(g=>g.status==='active').slice(0,4).map(g=><div className="goal-row" key={g.id}><div className="goal-icon"><GoalIcon size={17}/></div><div className="goal-main"><b>{g.title}</b><small>{g.category} · {g.milestones_done}/{g.milestone_count} milestones</small><div className="progress-track"><i style={{width:`${g.progress_value}%`}}/></div></div><strong>{Math.round(g.progress_value)}%</strong></div>)}
        {!data.goals.some(g=>g.status==='active')&&<Empty icon={<Target/>} title="No active goals" body="Create a goal to define what progress means."/>}
      </section>
      <section className="panel projects-panel"><PanelHead title="Project overview" subtitle="A home for related tasks" action="All projects" onAction={()=>onPage('projects')}/>
        {data.projects.slice(0,3).map(p=><div className="project-row" key={p.id}><span className="project-dot" style={{background:p.color}}/><div><b>{p.name}</b><small>{p.tasks_done}/{p.task_count} tasks complete</small></div><span className="project-percent">{p.task_count?Math.round(p.tasks_done/p.task_count*100):0}%</span></div>)}
        {!data.projects.length&&<Empty icon={<FolderKanban/>} title="No projects yet" body="Projects help organize work across goals."/>}
      </section>
      <section className="panel milestone-panel"><PanelHead title="Upcoming milestones" subtitle="Small checkpoints, visible progress" action="Goals" onAction={()=>onPage('goals')}/>
        {data.milestones.filter(m=>m.status!=='completed').slice(0,4).map(m=><div className="milestone-row" key={m.id}><span className="milestone-dot"/><div><b>{m.title}</b><small>{m.goal_title} · {dateLabel(m.due_date)}</small></div></div>)}
        {!data.milestones.some(m=>m.status!=='completed')&&<Empty icon={<MilestoneIcon/>} title="No milestones yet" body="Add checkpoints to an active goal."/>}
      </section>
    </div>
  </div>;
}
function Metric({icon,label,value,foot}:{icon:React.ReactNode;label:string;value:number;foot:string}){return <article className="metric-card"><div className="metric-top">{icon}<span>{label}</span></div><strong>{value}</strong><small>{foot}</small></article>}
function PanelHead({title,subtitle,action,onAction}:{title:string;subtitle:string;action:string;onAction:()=>void}){return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div><button onClick={onAction}>{action}<ArrowUpRight size={14}/></button></div>}
function Empty({icon,title,body}:{icon:React.ReactNode;title:string;body:string}){return <div className="empty-state"><span>{icon}</span><b>{title}</b><p>{body}</p></div>}
function TaskRow({task,onToggle,onEdit}:{task:Task;onToggle:()=>void;onEdit:()=>void}){return <div className="task-row"><button className="check-button" onClick={onToggle} title="Complete task"><Circle size={19}/></button><button className="task-copy" onClick={onEdit}><b>{task.title}</b><small>{task.project_name||'Personal'} · {dateLabel(task.due_date)}</small></button><span className={'priority '+task.priority}>{priorityLabel[task.priority]}</span></div>}
function GoalsPage({goals,milestones,onOpen,onDelete,onMilestoneDelete}:{goals:Goal[];milestones:Milestone[];onOpen:(k:'goal'|'milestone',item?:Goal|Milestone,goalId?:string)=>void;onDelete:(id:string)=>void;onMilestoneDelete:(id:string)=>void}) {
  return <div className="page-content"><div className="section-intro"><div><div className="eyebrow">DIRECTION & OUTCOMES</div><h2>Goals</h2><p>Define outcomes, then break them into milestones you can act on.</p></div><span className="count-pill">{goals.length} goals</span></div>
    <div className="entity-grid">{goals.map(g=><article className="entity-card" key={g.id}><div className="entity-card-head"><span className="entity-icon"><Target size={18}/></span><div className="entity-actions"><button title="Edit goal" onClick={()=>onOpen('goal',g)}><Pencil size={15}/></button><button title="Delete goal" onClick={()=>onDelete(g.id)}><Trash2 size={15}/></button></div></div><div className="entity-meta">{g.category} · {g.priority} priority</div><h3>{g.title}</h3><p>{g.description||'No description added.'}</p><div className="goal-progress-line"><span>Progress</span><b>{Math.round(g.progress_value)}%</b></div><div className="progress-track"><i style={{width:`${g.progress_value}%`}}/></div><div className="entity-foot"><span>{g.status.replace('_',' ')}</span><span>{g.milestones_done}/{g.milestone_count} milestones</span></div>
      <div className="milestone-list"><div className="mini-head"><b>Milestones</b><button onClick={()=>onOpen('milestone',undefined,g.id)}><Plus size={13}/> Add</button></div>{milestones.filter(m=>m.goal_id===g.id).map(m=><div className="mini-milestone" key={m.id}><span className={m.status==='completed'?'done':''}>{m.status==='completed'?<Check size={12}/>:<CircleDot size={12}/>}</span><div><b>{m.title}</b><small>{dateLabel(m.due_date)}</small></div><button title="Edit milestone" onClick={()=>onOpen('milestone',m,g.id)}><Pencil size={12}/></button><button title="Delete milestone" onClick={()=>onMilestoneDelete(m.id)}><X size={13}/></button></div>)}</div>
    </article>)}</div>{!goals.length&&<Empty icon={<Target/>} title="Start with a goal" body="Goals are stored locally and can stand on their own, without a project."/>}</div>;
}
function ProjectsPage({projects,onOpen,onDelete}:{projects:Project[];onOpen:(k:'project',item?:Project)=>void;onDelete:(id:string)=>void}){return <div className="page-content"><div className="section-intro"><div><div className="eyebrow">ORGANIZE YOUR WORK</div><h2>Projects</h2><p>Group related tasks while keeping goals optional and independent.</p></div><span className="count-pill">{projects.length} projects</span></div><div className="entity-grid">{projects.map(p=><article className="entity-card project-card" key={p.id}><div className="entity-card-head"><span className="project-color-icon" style={{background:p.color}}><FolderKanban size={18}/></span><div className="entity-actions"><button title="Edit project" onClick={()=>onOpen('project',p)}><Pencil size={15}/></button><button title="Delete project" onClick={()=>onDelete(p.id)}><Trash2 size={15}/></button></div></div><div className="entity-meta">{p.status.replace('_',' ')} · {p.priority} priority</div><h3>{p.name}</h3><p>{p.description||'No project description.'}</p><div className="project-stats"><b>{p.tasks_done}<small> completed</small></b><b>{p.task_count-p.tasks_done}<small> open</small></b></div><div className="progress-track"><i style={{width:`${p.task_count? p.tasks_done/p.task_count*100:0}%`,background:p.color}}/></div><div className="entity-foot"><span>{p.goalIds.length} linked goals</span><span>Due {dateLabel(p.due_date)}</span></div></article>)}</div>{!projects.length&&<Empty icon={<FolderKanban/>} title="No projects yet" body="Create a project to organize tasks around a shared outcome."/>}</div>}
function TasksPage({tasks,filter,setFilter,onOpen,onToggle,onDelete}:{tasks:Task[];filter:'all'|'open'|'completed'|'overdue';setFilter:(v:'all'|'open'|'completed'|'overdue')=>void;onOpen:(k:'task',item?:Task)=>void;onToggle:(id:string)=>void;onDelete:(id:string)=>void}){return <div className="page-content"><div className="section-intro"><div><div className="eyebrow">CAPTURE & EXECUTE</div><h2>Tasks</h2><p>Keep next actions clear, prioritized and connected to your work.</p></div><span className="count-pill">{tasks.length} tasks</span></div><div className="filter-bar">{(['all','open','completed','overdue'] as const).map(f=><button key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div><section className="panel task-table"><div className="task-table-head"><span>Task</span><span>Priority</span><span>Project</span><span>Due date</span><span/></div>{tasks.map(t=><div className={'task-table-row '+(t.status==='completed'?'is-complete':'')} key={t.id}><button className="check-button" onClick={()=>onToggle(t.id)} title="Toggle complete">{t.status==='completed'?<CheckCircle2 size={19}/>:<Circle size={19}/>}</button><button className="table-task-title" onClick={()=>onOpen('task',t)}><b>{t.title}</b><small>{t.description||'No description'}</small></button><span className={'priority '+t.priority}>{priorityLabel[t.priority]}</span><span className="table-project">{t.project_name||'—'}</span><span className="table-date">{dateLabel(t.due_date)}</span><div className="entity-actions"><button title="Edit" onClick={()=>onOpen('task',t)}><Pencil size={14}/></button><button title="Delete" onClick={()=>onDelete(t.id)}><Trash2 size={14}/></button></div></div>)}{!tasks.length&&<Empty icon={<ListTodo/>} title="No tasks match this view" body="Create a task or adjust your filters."/>}</section></div>}
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
  const [projectId,setProjectId]=useState((item as Task|undefined)?.project_id||'');
  const [parentTaskId,setParentTaskId]=useState((item as Task|undefined)?.parent_task_id||'');
  const [estimatedMinutes,setEstimatedMinutes]=useState(String((item as Task|undefined)?.estimated_minutes||''));
  const [tags,setTags]=useState(((item as Task|undefined)?.tags||[]).join(', '));
  const [goalIds,setGoalIds]=useState<string[]>(isProject?(item as Project|undefined)?.goalIds||[]:isTask?(item as Task|undefined)?.goalIds||[]:[]);
  const [color,setColor]=useState(isProject?(item as Project|undefined)?.color||'#B94A62':'#B94A62');
  const [milestoneStatus,setMilestoneStatus]=useState<string>((item as Milestone|undefined)?.status||'pending');
  const [saving,setSaving]=useState(false);
  const titleLabel=isMilestone?(item?'Edit milestone':'New milestone'):isGoal?'Goal':isProject?'Project':'Task';
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{
    if(modal.kind==='milestone')await onSave({id:item?.id,goalId:modal.goalId,title,description,dueDate,status:milestoneStatus});
    else await onSave({id:item?.id,title,...(isGoal?{description,category,priority,status,startDate,targetDate:dueDate,progressValue:Number(progress)}:isProject?{description,priority,status,startDate,dueDate,color,goalIds}:{description,priority,status,startDate,dueDate,projectId,goalIds,parentTaskId,estimatedMinutes:Number(estimatedMinutes)||undefined,tags:tags.split(',').map(x=>x.trim()).filter(Boolean)})});
  }catch(e){onError(e);}finally{setSaving(false);}};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="editor-modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">{item?'EDIT':'CREATE'} · AURESTAR</div><h2>{titleLabel}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div>
    <label className="field"><span>{isProject?'Project name':isGoal?'Goal title':modal.kind==='milestone'?'Milestone title':'Task title'}</span><input autoFocus required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} placeholder={isGoal?'e.g. Reach IELTS 7.5':isProject?'e.g. IELTS preparation':'e.g. Complete Biology review'}/></label>
    <label className="field"><span>Description</span><textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Add useful context (optional)"/></label>
    {modal.kind==='milestone'?<><label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label className="field"><span>Status</span><select value={milestoneStatus} onChange={e=>setMilestoneStatus(e.target.value)}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label></>:
    <><div className="form-grid"><label className="field"><span>Priority</span><select value={priority} onChange={e=>setPriority(e.target.value as Priority)}>{Object.keys(priorityLabel).map(p=><option key={p} value={p}>{priorityLabel[p as Priority]}</option>)}</select></label><label className="field"><span>Status</span><select value={status} onChange={e=>setStatus(e.target.value)}>{(isGoal?['not_started','active','on_hold','completed','archived']:isProject?['active','on_hold','completed','archived']:['inbox','todo','in_progress','completed','cancelled']).map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></label></div>
    <div className="form-grid"><label className="field"><span>Start date</span><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label className="field"><span>{isGoal?'Target date':'Due date'}</span><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>
    {isGoal&&<div className="form-grid"><label className="field"><span>Category</span><input value={category} onChange={e=>setCategory(e.target.value)}/></label><label className="field"><span>Progress (%)</span><input type="number" min="0" max="100" value={progress} onChange={e=>setProgress(e.target.value)}/></label></div>}
    {isProject&&<label className="field"><span>Project accent</span><input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>}
    {isTask&&<><label className="field"><span>Project</span><select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">No project</option>{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><div className="form-grid"><label className="field"><span>Estimated minutes</span><input type="number" min="1" max="100000" value={estimatedMinutes} onChange={e=>setEstimatedMinutes(e.target.value)} placeholder="e.g. 30"/></label><label className="field"><span>Parent task</span><select value={parentTaskId} onChange={e=>setParentTaskId(e.target.value)}><option value="">No parent</option>{tasks.filter(t=>t.id!==item?.id).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div><label className="field"><span>Tags (comma separated)</span><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="study, biology, revision"/></label><div className="field"><span>Linked goals</span><div className="checkbox-grid">{goals.map(g=><label key={g.id}><input type="checkbox" checked={goalIds.includes(g.id)} onChange={e=>setGoalIds(v=>e.target.checked?[...v,g.id]:v.filter(x=>x!==g.id))}/>{g.title}</label>)}</div></div></>}
    {isProject&&<div className="field"><span>Linked goals</span><div className="checkbox-grid">{goals.map(g=><label key={g.id}><input type="checkbox" checked={goalIds.includes(g.id)} onChange={e=>setGoalIds(v=>e.target.checked?[...v,g.id]:v.filter(x=>x!==g.id))}/>{g.title}</label>)}</div></div>}
    </>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving||!title.trim()}><Check size={16}/>{saving?'Saving…':item?'Save changes':'Create '+titleLabel.toLowerCase()}</button></div>
  </form></div>;
}
export default App;