import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, Check, CheckCircle2, ChevronDown, Circle, CircleDot,
  Command, FolderKanban, Goal as GoalIcon, LayoutDashboard, ListTodo, Plus, Search, Settings2,
  Sparkles, Target, Trash2, X, Pencil, Milestone as MilestoneIcon, AlertCircle, PanelLeftClose, Copy, Archive, RotateCcw, ArrowUpDown, Columns3, List, Settings
} from 'lucide-react';
import { useWorkspace } from './store';
import type { Goal, Milestone, Project, Task, Priority } from './types';
import { Phase2Page, DataTools } from './Phase2Pages';

function errorText(error:unknown):string {
 const message=error instanceof Error?error.message:String(error??'');
 const exact:Record<string,string>={
 'Invalid calendar date.':'Ngày không hợp lệ.',
 'Habit name is required.':'Vui lòng nhập tên thói quen.',
 'Habit end date must be on or after start date.':'Ngày kết thúc thói quen phải bằng hoặc sau ngày bắt đầu.',
 'Habit not found.':'Không tìm thấy thói quen.',
 'Linked task does not exist.':'Công việc được liên kết không tồn tại.',
 'A different journal entry already exists for this date.':'Đã có một mục nhật ký khác cho ngày này.',
 'Week start is required.':'Vui lòng chọn ngày bắt đầu tuần.',
 'Week end must be on or after week start.':'Ngày kết thúc tuần phải bằng hoặc sau ngày bắt đầu.',
 'Insights end date must be on or after start date.':'Ngày kết thúc phân tích phải bằng hoặc sau ngày bắt đầu.',
 'Setting key is required.':'Thiếu khóa cài đặt.',
 'Unsupported Aurestar export format.':'Định dạng dữ liệu Aurestar không được hỗ trợ.',
 'Backup schema version is not supported by this application.':'Phiên bản cấu trúc bản sao lưu không được ứng dụng này hỗ trợ.',
 'Unsupported import mode.':'Chế độ nhập dữ liệu không được hỗ trợ.',
 'Import failed integrity validation: foreign key violations were detected.':'Không thể nhập dữ liệu vì phát hiện quan hệ tham chiếu không hợp lệ.',
 'Import failed SQLite integrity verification.':'Không thể nhập dữ liệu vì kiểm tra toàn vẹn SQLite thất bại.',
 'Date must use a valid YYYY-MM-DD calendar date.':'Ngày phải đúng định dạng YYYY-MM-DD và là ngày hợp lệ.',
 'Goal title is required.':'Vui lòng nhập tên mục tiêu.',
 'Select an existing goal.':'Hãy chọn một mục tiêu đang tồn tại.',
 'Milestone title is required.':'Vui lòng nhập tên cột mốc.',
 'Project name is required.':'Vui lòng nhập tên dự án.',
 'A linked goal no longer exists.':'Mục tiêu được liên kết không còn tồn tại.',
 'Task title is required.':'Vui lòng nhập tên công việc.',
 'A task cannot be its own parent.':'Một công việc không thể là công việc cha của chính nó.',
 'Parent task does not exist.':'Công việc cha không tồn tại.',
 'A task hierarchy cannot contain a cycle.':'Cấu trúc công việc không được chứa vòng lặp.',
 'Due time must use HH:MM format.':'Giờ đến hạn phải theo định dạng HH:MM.',
 'Invalid task status.':'Trạng thái công việc không hợp lệ.',
 'Task not found.':'Không tìm thấy công việc.',
 'Unsupported record type.':'Loại bản ghi không được hỗ trợ.',
 'Unsupported archive type.':'Loại dữ liệu lưu trữ không được hỗ trợ.',
 'Record not found.':'Không tìm thấy bản ghi.',
 'Goal not found.':'Không tìm thấy mục tiêu.',
 'Project not found.':'Không tìm thấy dự án.',
 'Invalid theme setting.':'Cài đặt giao diện không hợp lệ.',
 'Invalid density setting.':'Cài đặt mật độ giao diện không hợp lệ.',
 'Invalid sidebar setting.':'Cài đặt thanh bên không hợp lệ.',
 'Invalid default page.':'Trang mặc định không hợp lệ.',
 'Invalid first day of week.':'Ngày đầu tuần không hợp lệ.',
 'Invalid task priority.':'Mức ưu tiên công việc không hợp lệ.',
 'Invalid task view.':'Chế độ xem công việc không hợp lệ.',
 'Invalid task sorting.':'Cách sắp xếp công việc không hợp lệ.',
 'Invalid language.':'Ngôn ngữ không hợp lệ.',
 'Invalid date format.':'Định dạng ngày không hợp lệ.',
 'Invalid time format.':'Định dạng giờ không hợp lệ.',
 'Invalid journal type.':'Loại nhật ký không hợp lệ.',
 'Invalid accent color.':'Màu nhấn không hợp lệ.',
 'Invalid focus timer state.':'Trạng thái đồng hồ tập trung không hợp lệ.',
 'JSON file is too large or not a regular file':'Tệp JSON quá lớn hoặc không phải tệp hợp lệ.',
 'JSON root must be an object':'Dữ liệu JSON phải có đối tượng gốc.',
 'Aurestar data could not be read. The original file was preserved; no empty data file was written.':'Không thể đọc dữ liệu Aurestar. Tệp gốc đã được giữ nguyên và không tạo tệp dữ liệu rỗng.',
 'Unsafe ZIP entry path.':'Đường dẫn tệp bên trong ZIP không an toàn.',
 'Invalid ZIP backup: end record not found.':'Bản sao lưu ZIP không hợp lệ: thiếu bản ghi kết thúc.',
 'Invalid ZIP central directory.':'Danh mục trung tâm của ZIP không hợp lệ.',
 'ZIP backup exceeds the supported size limit.':'Bản sao lưu ZIP vượt quá giới hạn dung lượng được hỗ trợ.',
 'Invalid ZIP local header.':'Tiêu đề tệp ZIP không hợp lệ.',
 'ZIP local and central entry names do not match.':'Tên tệp trong phần đầu và danh mục ZIP không khớp.',
 'Unsupported ZIP compression method.':'Phương thức nén ZIP không được hỗ trợ.',
 'ZIP backup integrity check failed.':'Kiểm tra toàn vẹn bản sao lưu ZIP thất bại.',
 'Duplicate ZIP manifest.':'Bản sao lưu ZIP có nhiều tệp kê khai trùng lặp.',
 'Duplicate ZIP export.':'Bản sao lưu ZIP có nhiều tệp dữ liệu xuất trùng lặp.',
 'ZIP backup manifest is missing required database or metadata files.':'Tệp kê khai ZIP thiếu cơ sở dữ liệu hoặc thông tin phiên bản bắt buộc.',
 'ZIP backup does not contain a valid Aurestar export.':'Bản sao lưu ZIP không chứa dữ liệu Aurestar hợp lệ.'
 };
 if(exact[message])return exact[message];
 const prefixes:Array<[string,string]>= [
  ['Unsupported table in import: ','Bảng dữ liệu không được hỗ trợ khi nhập: '],
  ['Invalid table data: ','Dữ liệu bảng không hợp lệ: '],
  ['Invalid row in ','Bản ghi không hợp lệ trong bảng '],
  ['Unknown column in ','Cột dữ liệu không được hỗ trợ trong bảng '],
  ['Missing primary key in ','Thiếu khóa chính trong bảng '],
  ['Invalid numeric preference: ','Giá trị số không hợp lệ cho tùy chọn '],
  ['Invalid boolean preference: ','Giá trị bật/tắt không hợp lệ cho tùy chọn ']
 ];
 for(const [prefix,translation] of prefixes)if(message.startsWith(prefix))return translation+message.slice(prefix.length);
 if(message.startsWith('Linked '))return 'Dữ liệu được liên kết không còn tồn tại hoặc không hợp lệ.';
 if(/JSON|Unexpected token/i.test(message))return 'Tệp JSON không hợp lệ hoặc không thể đọc.';
 console.error('Aurestar operation failed:',error);
 return 'Đã xảy ra lỗi khi xử lý dữ liệu. Vui lòng kiểm tra thông tin và thử lại.';
}
\ntype Page = 'home' | 'goals' | 'projects' | 'tasks' | 'habits' | 'focus' | 'journal' | 'review' | 'insights' | 'data';
type Modal = null | { kind: 'goal'; item?: Goal } | { kind: 'project'; item?: Project } | { kind: 'task'; item?: Task } | { kind: 'milestone'; goalId: string; item?: Milestone };
const dateLabel = (value?: string | null) => { if(!value)return 'Chưa có ngày';const d=new Date(value+'T12:00:00'),locale=document.documentElement.dataset.locale||undefined,format=document.documentElement.dataset.dateFormat;if(format==='dd/MM/yyyy')return d.toLocaleDateString(locale,{day:'2-digit',month:'2-digit',year:'numeric'});if(format==='MM/dd/yyyy')return d.toLocaleDateString(locale,{month:'2-digit',day:'2-digit',year:'numeric'});return d.toLocaleDateString(locale,{month:'short',day:'numeric',year:'numeric'}); };
const priorityLabel: Record<Priority, string> = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', urgent: 'Khẩn cấp' };
const safeDate = (value?: string | null) => value || '';
const statusLabel = (value:string) => ({not_started:'Chưa bắt đầu',active:'Đang thực hiện',on_hold:'Tạm hoãn',completed:'Đã hoàn thành',pending:'Đang chờ',todo:'Cần làm',in_progress:'Đang thực hiện',cancelled:'Đã hủy',inbox:'Hộp thư đến'} as Record<string,string>)[value] || value.replace('_',' ');

function App() {
  const data = useWorkspace();
  const [page, setPage] = useState<Page>(() => (['home','goals','projects','tasks','habits','focus','journal','review','insights','data'].includes(location.hash.slice(1)) ? location.hash.slice(1) as Page : 'home'));
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState('');
  const [phase2Results,setPhase2Results] = useState<any[]>([]);
  const [taskFilter, setTaskFilter] = useState<'all'|'today'|'upcoming'|'overdue'|'completed'|'inbox'|'archived'>('all');
  const [taskSort,setTaskSort]=useState<'due'|'priority'|'title'|'created'>('due');
  const [showArchived,setShowArchived]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [notice, setNotice] = useState('');
  const [dark, setDark] = useState(() => localStorage.getItem('aurestar.theme') !== 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('aurestar.sidebar.collapsed') === 'true');
  useEffect(() => { void data.load(); }, []);
  useEffect(()=>{const root=document.documentElement;const locale='vi-VN';root.lang='vi';root.dataset.locale=locale;if(data.settings.language!=='vi')void window.aurestarV2.saveSettings({language:'vi'}).catch(()=>{});root.dataset.dateFormat=String(data.settings.dateFormat||'dd/MM/yyyy');root.dataset.timeFormat=String(data.settings.timeFormat||'24h');if(data.settings.accentColor)root.style.setProperty('--primary',String(data.settings.accentColor));if(data.settings.fontSize)root.style.fontSize=Number(data.settings.fontSize)+'px';},[data.settings.language,data.settings.dateFormat,data.settings.timeFormat,data.settings.accentColor,data.settings.fontSize]);

  useEffect(()=>{const value=String(data.settings.taskSort||'due');if(['due','priority','title','created'].includes(value))setTaskSort(value as 'due'|'priority'|'title'|'created');},[data.settings.taskSort]);
  useEffect(() => { const value=query.trim(); if(value.length<2){setPhase2Results([]);return;} const timer=window.setTimeout(()=>{void window.aurestarV2.searchAll(value,10).then(setPhase2Results).catch(()=>setPhase2Results([]));},180); return ()=>window.clearTimeout(timer); }, [query]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('aurestar.theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { if(!data.loading){ const saved=data.settings||{}; if(saved.theme==='dark'||saved.theme==='light')setDark(saved.theme==='dark'); else if(saved.theme==='system')setDark(window.matchMedia('(prefers-color-scheme: dark)').matches); if(typeof saved.sidebarCollapsed==='boolean')setSidebarCollapsed(saved.sidebarCollapsed); if(saved.density==='compact'||saved.density==='comfortable')document.documentElement.dataset.density=String(saved.density); if(['home','goals','projects','tasks','habits','focus','journal','review','insights','data'].includes(String(saved.defaultLandingPage)))setPage(saved.defaultLandingPage as Page); } }, [data.loading]);
  useEffect(() => { localStorage.setItem('aurestar.sidebar.collapsed', String(sidebarCollapsed)); }, [sidebarCollapsed]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector<HTMLInputElement>('.top-search input')?.focus(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setPage('tasks'); setModal({ kind: 'task' }); } else if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); setSettingsOpen(true); } else if (e.key === 'Escape') { setModal(null); setSettingsOpen(false); setSearchOpen(false); setQuery(''); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  useEffect(() => {
    const stop = window.aurestarDesktop?.onQuickAdd?.(() => { setPage('tasks'); setModal({ kind: 'task' }); });
    return () => stop?.();
  }, []);
  useEffect(() => {
    const stop = window.aurestarDesktop?.onNavigate?.(view => { if(['home','goals','projects','tasks','habits','focus','journal','review','insights','data'].includes(view)) setPage(view as Page); });
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
  ,...phase2Results.filter(item=>['habit','journal'].includes(item.type)).map(item=>({type:item.type,id:item.id,title:item.title,item}))].slice(0,10);
  const open = (kind: Exclude<Modal,null>['kind'], item?: Goal|Project|Task|Milestone, goalId?: string) => {
    if (kind === 'milestone') setModal({ kind, goalId: goalId || '', item: item as Milestone|undefined });
    else if (kind === 'goal') setModal({ kind, item: item as Goal|undefined });
    else if (kind === 'project') setModal({ kind, item: item as Project|undefined });
    else setModal({ kind, item: item as Task|undefined });
  };
  const addButton = page === 'goals' ? ['Mục tiêu mới',()=>open('goal')] as const : page === 'projects' ? ['Dự án mới',()=>open('project')] as const : ['Thêm nhanh',()=>open('task')] as const;
  const pageTitle = ({home:'Tổng quan',goals:'Mục tiêu',projects:'Dự án',tasks:'Công việc',habits:'Thói quen',focus:'Tập trung',journal:'Nhật ký',review:'Tổng kết tuần',insights:'Phân tích',data:'Quản lý dữ liệu'} as const)[page];
  const handleError = (e: unknown) => setNotice(errorText(e));
  const persistSettings = (patch:Record<string,unknown>) => { void data.saveSettings(patch).catch(handleError); };
  return <div className={'app-shell '+(sidebarCollapsed?'is-collapsed':'')}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span>A</span></div><div><b>AURESTAR</b><small>KHÔNG GIAN CÁ NHÂN</small></div></div>
      <div className="workspace-pill"><div className="avatar">A</div><div><b>Không gian làm việc của tôi</b><small>Cục bộ · Riêng tư</small></div><ChevronDown size={15}/></div>
      <div className="nav-caption">KHÔNG GIAN LÀM VIỆC</div>
      <nav className="nav-list">
        <NavItem active={page==='home'} icon={<LayoutDashboard/>} label="Tổng quan" onClick={()=>setPage('home')}/>
        <NavItem active={page==='goals'} icon={<Target/>} label="Mục tiêu" onClick={()=>setPage('goals')}/>
        <NavItem active={page==='projects'} icon={<FolderKanban/>} label="Dự án" onClick={()=>setPage('projects')}/>
        <NavItem active={page==='tasks'} icon={<ListTodo/>} label="Công việc" onClick={()=>setPage('tasks')}/>
        <NavItem active={page==='habits'} icon={<CheckCircle2/>} label="Thói quen" onClick={()=>setPage('habits')}/>
        <NavItem active={page==='focus'} icon={<Activity/>} label="Tập trung" onClick={()=>setPage('focus')}/>
        <NavItem active={page==='journal'} icon={<Pencil/>} label="Nhật ký" onClick={()=>setPage('journal')}/>
        <NavItem active={page==='review'} icon={<Check/>} label="Tổng kết tuần" onClick={()=>setPage('review')}/>
        <NavItem active={page==='insights'} icon={<ArrowUpRight/>} label="Phân tích" onClick={()=>setPage('insights')}/>
        <NavItem active={page==='data'} icon={<Archive/>} label="Quản lý dữ liệu" onClick={()=>setPage('data')}/>
      </nav>
      <div className="sidebar-bottom"><div className="offline-state"><span/> Lưu trữ ưu tiên ngoại tuyến</div><button className="nav-item" onClick={()=>setSettingsOpen(true)}><Settings2 size={18}/> Cài đặt</button><div className="sidebar-foot">AURESTAR 3.0 · KHÔNG GIAN NĂNG SUẤT CÁ NHÂN</div></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button sidebar-toggle" title={sidebarCollapsed?'Mở rộng thanh bên':'Thu gọn thanh bên'} onClick={()=>setSidebarCollapsed(v=>{const next=!v;persistSettings({sidebarCollapsed:next});return next;})}><PanelLeftClose size={17}/></button>
        <div><div className="breadcrumb">AURESTAR <span>/</span> KHÔNG GIAN LÀM VIỆC</div><h1>{pageTitle}</h1></div>
        <div className="top-search-wrap"><div className="top-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>setSearchOpen(true)} onBlur={()=>window.setTimeout(()=>setSearchOpen(false),140)} placeholder="Tìm mục tiêu, dự án, công việc…" /><kbd><Command size={11}/> K</kbd></div>{searchOpen&&query.trim().length>=2&&<div className="search-results">{globalResults.length?globalResults.map(result=><button key={result.type+result.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setPage(result.type==='goal'?'goals':result.type==='project'?'projects':result.type==='task'?'tasks':result.type==='habit'?'habits':'journal');if(result.type==='goal')open('goal',result.item as Goal);if(result.type==='project')open('project',result.item as Project);if(result.type==='task')open('task',result.item as Task);setSearchOpen(false);}}><b>{result.title}</b><small>{{goal:'Mục tiêu',project:'Dự án',task:'Công việc',habit:'Thói quen',journal:'Nhật ký'} as Record<string,string>)[result.type]||result.type}</small></button>):<p>Không tìm thấy dữ liệu phù hợp</p>}</div>}</div>
        <div className="top-actions"><button className="icon-button" title="Mở cài đặt" onClick={()=>setSettingsOpen(true)}><Settings size={17}/></button><button className="icon-button" title="Đổi giao diện sáng/tối" onClick={()=>{setDark(v=>{const next=!v;persistSettings({theme:next?'dark':'light'});return next;});}}><Sparkles size={17}/></button>{data.settings.privacyMode!==true&&<button className="icon-button" title="Hiện tiện ích Itsuki" onClick={()=>void window.aurestarDesktop?.showItsuki?.()}><Activity size={17}/></button>}<button className="primary-button compact" onClick={addButton[1]}><Plus size={16}/>{addButton[0]}</button></div>
      </header>
      {data.error && <div className="error-banner"><AlertCircle size={16}/>{data.error}<button onClick={()=>void data.load()}>Thử lại</button></div>}
      {data.loading ? <div className="loading-state"><span className="spinner"/> Đang tải không gian làm việc…</div> :
        page==='home' ? <Dashboard data={data} onPage={setPage} onOpen={open} onTaskToggle={id=>void data.toggleTask(id).catch(handleError)}/> :
        page==='goals' ? <GoalsPage goals={filteredGoals} milestones={data.milestones} showArchived={showArchived} onToggleArchived={()=>setShowArchived(v=>!v)} onOpen={open} onDelete={id=>{if(window.confirm('Xóa mục tiêu này và toàn bộ cột mốc?'))void data.deleteGoal(id).catch(handleError);}} onArchive={(id,archived)=>void data.archiveGoal(id,archived).catch(handleError)} onDuplicate={id=>void data.duplicateGoal(id).catch(handleError)} onMilestoneDelete={id=>{if(window.confirm('Xóa cột mốc này?'))void data.deleteMilestone(id).catch(handleError);}}/> :
        page==='projects' ? <ProjectsPage projects={filteredProjects} showArchived={showArchived} onToggleArchived={()=>setShowArchived(v=>!v)} onOpen={open} onDelete={id=>{if(window.confirm('Xóa dự án này? Các công việc liên quan sẽ được giữ lại.'))void data.deleteProject(id).catch(handleError);}} onArchive={(id,archived)=>void data.archiveProject(id,archived).catch(handleError)} onDuplicate={id=>void data.duplicateProject(id).catch(handleError)}/> :
        page==='tasks' ? <TasksPage initialView={(data.settings.taskDefaultView==='board'?'board':'list')} tasks={filteredTasks} filter={taskFilter} setFilter={setTaskFilter} sort={taskSort} setSort={setTaskSort} onOpen={open} onToggle={id=>void data.toggleTask(id).catch(handleError)} onStatus={(id,status)=>void data.setTaskStatus(id,status).catch(handleError)} onPriority={(task,priority)=>void data.saveTask({id:task.id,title:task.title,description:task.description,status:task.status,priority,startDate:task.start_date||undefined,dueDate:task.due_date||undefined,dueTime:task.due_time||undefined,estimatedMinutes:task.estimated_minutes||undefined,projectId:task.project_id||undefined,parentTaskId:task.parent_task_id||undefined,goalIds:task.goalIds,tags:task.tags}).catch(handleError)} onArchive={(id,archived)=>void data.archiveTask(id,archived).catch(handleError)} onDuplicate={id=>void data.duplicateTask(id).catch(handleError)} onDelete={id=>{if(window.confirm('Xóa vĩnh viễn công việc này?'))void data.deleteTask(id).catch(handleError);}}/> : page==='data' ? <div className="page-content"><DataTools/></div> : <Phase2Page page={page as 'habits'|'focus'|'journal'|'review'|'insights'}/>} 
      {notice && <div className="toast"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={15}/></button></div>}
    </main>
    {settingsOpen&&<SettingsModal initialTheme={String(data.settings.theme|| (dark?'dark':'light'))} initialDensity={String(data.settings.density||'comfortable')} initialDefaultPage={String(data.settings.defaultLandingPage||'home')} initialSettings={data.settings} onClose={()=>setSettingsOpen(false)} onSave={async values=>{await data.saveSettings(values);if(values.theme==='dark'||values.theme==='light')setDark(values.theme==='dark');else if(values.theme==='system')setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.density=String(values.density);document.documentElement.style.setProperty('--primary',String(values.accentColor||'#B94A62'));document.documentElement.style.fontSize=(Number(values.fontSize)||14)+'px';setSettingsOpen(false);}}/>}
    {modal && <EditorModal modal={modal} goals={data.goals} projects={data.projects} tasks={data.tasks} onClose={()=>setModal(null)} onError={handleError}
      defaultTaskPriority={String(data.settings.taskDefaultPriority||'medium')} onSave={async value=>{try{if(modal.kind==='goal')await data.saveGoal(value as never);if(modal.kind==='project')await data.saveProject(value as never);if(modal.kind==='task')await data.saveTask(value as never);if(modal.kind==='milestone')await data.saveMilestone(value as never);setModal(null);}catch(e){handleError(e);}}}/>}
  </div>;
}

function NavItem({active,icon,label,onClick}:{active:boolean;icon:React.ReactNode;label:string;onClick:()=>void}) {
  return <button title={label} className={'nav-item '+(active?'active':'')} onClick={onClick}>{icon}<span>{label}</span>{active&&<i/>}</button>;
}

function Dashboard({data,onPage,onOpen,onTaskToggle}:{data:ReturnType<typeof useWorkspace.getState>;onPage:(p:Page)=>void;onOpen:(k:'goal'|'project'|'task'|'milestone',item?:Goal|Project|Task,goalId?:string)=>void;onTaskToggle:(id:string)=>void}) {
  const tasks=data.tasks.filter(t=>!t.archived_at&&!['completed','cancelled'].includes(t.status)).slice(0,6);
  const today=new Date().toISOString().slice(0,10); const dueToday=data.tasks.filter(t=>!t.archived_at&&t.due_date===today&&!['completed','cancelled'].includes(t.status)).length; const completedToday=data.tasks.filter(t=>!t.archived_at&&t.status==='completed'&&t.completed_at?.slice(0,10)===today).length;
  return <div className="page-content">
    <div className="welcome-row"><div><div className="eyebrow">{new Date().toLocaleDateString(document.documentElement.dataset.locale||'vi-VN',{weekday:'long'}).toUpperCase()}, {new Date().toLocaleDateString(document.documentElement.dataset.locale||'vi-VN',{month:'long',day:'numeric',year:'numeric'}).toUpperCase()}</div><h2>Không gian rõ ràng để tạo nên tiến bộ có ý nghĩa.</h2><p>Mục tiêu, dự án và những việc cần làm — tất cả trong một không gian gọn gàng.</p></div><button className="secondary-button" onClick={()=>onPage('tasks')}>Mở danh sách công việc <ArrowUpRight size={15}/></button></div>
    <section className="metric-grid">
      <Metric icon={<ListTodo/>} label="Đến hạn hôm nay" value={dueToday} foot="Công việc được lên lịch hôm nay"/>
      <Metric icon={<CheckCircle2/>} label="Hoàn thành hôm nay" value={completedToday} foot="Công việc đã hoàn thành hôm nay"/>
      <Metric icon={<Target/>} label="Mục tiêu đang thực hiện" value={data.summary.activeGoals} foot="Giữ vững định hướng"/>
      <Metric icon={<FolderKanban/>} label="Dự án đang thực hiện" value={data.summary.activeProjects} foot="Công việc đang triển khai"/>
      <Metric icon={<CheckCircle2/>} label="Công việc đã hoàn thành" value={data.summary.completedTasks} foot="Tiến độ được lưu trên thiết bị"/>
    </section>
    <div className="dashboard-grid">
      <section className="panel tasks-panel"><PanelHead title="Việc cần làm tiếp theo" subtitle="Danh sách công việc đang thực hiện" action="Tất cả công việc" onAction={()=>onPage('tasks')}/>
        {tasks.length ? <div className="task-list">{tasks.map(t=><TaskRow key={t.id} task={t} onToggle={()=>onTaskToggle(t.id)} onEdit={()=>onOpen('task',t)}/>)}</div> : <Empty icon={<CheckCircle2/>} title="Không có việc đang chờ" body="Thêm công việc để xác định rõ việc cần làm tiếp theo."/>}
      </section>
      <section className="panel goals-panel"><PanelHead title="Mục tiêu đang thực hiện" subtitle="Những kết quả bạn đang hướng tới" action="Xem mục tiêu" onAction={()=>onPage('goals')}/>
        {data.goals.filter(g=>!g.archived_at&&g.status==='active').slice(0,4).map(g=><div className="goal-row" key={g.id}><div className="goal-icon"><GoalIcon size={17}/></div><div className="goal-main"><b>{g.title}</b><small>{g.category} · {g.milestones_done}/{g.milestone_count} cột mốc</small><div className="progress-track"><i style={{width:`${g.progress_value}%`}}/></div></div><strong>{Math.round(g.progress_value)}%</strong></div>)}
        {!data.goals.some(g=>!g.archived_at&&g.status==='active')&&<Empty icon={<Target/>} title="Chưa có mục tiêu đang thực hiện" body="Tạo mục tiêu để xác định tiến độ cần đạt."/>}
      </section>
      <section className="panel projects-panel"><PanelHead title="Tổng quan dự án" subtitle="Nơi tập hợp các công việc liên quan" action="Tất cả dự án" onAction={()=>onPage('projects')}/>
        {data.projects.filter(p=>!p.archived_at).slice(0,3).map(p=><div className="project-row" key={p.id}><span className="project-dot" style={{background:p.color}}/><div><b>{p.name}</b><small>{p.tasks_done}/{p.task_count} công việc hoàn thành</small></div><span className="project-percent">{p.task_count?Math.round(p.tasks_done/p.task_count*100):0}%</span></div>)}
        {!data.projects.some(p=>!p.archived_at)&&<Empty icon={<FolderKanban/>} title="Chưa có dự án" body="Dự án giúp sắp xếp công việc theo từng mục tiêu."/>}
      </section>
      <section className="panel milestone-panel"><PanelHead title="Cột mốc sắp tới" subtitle="Các mốc nhỏ giúp theo dõi tiến độ" action="Mục tiêu" onAction={()=>onPage('goals')}/>
        {data.milestones.filter(m=>m.status!=='completed'&&!data.goals.find(g=>g.id===m.goal_id)?.archived_at).slice(0,4).map(m=><div className="milestone-row" key={m.id}><span className="milestone-dot"/><div><b>{m.title}</b><small>{m.goal_title} · {dateLabel(m.due_date)}</small></div></div>)}
        {!data.milestones.some(m=>m.status!=='completed'&&!data.goals.find(g=>g.id===m.goal_id)?.archived_at)&&<Empty icon={<MilestoneIcon/>} title="Chưa có cột mốc" body="Thêm cột mốc cho mục tiêu đang thực hiện."/>}
      </section>
    </div>
  </div>;
}
function Metric({icon,label,value,foot}:{icon:React.ReactNode;label:string;value:number;foot:string}){return <article className="metric-card"><div className="metric-top">{icon}<span>{label}</span></div><strong>{value}</strong><small>{foot}</small></article>}
function PanelHead({title,subtitle,action,onAction}:{title:string;subtitle:string;action:string;onAction:()=>void}){return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div><button onClick={onAction}>{action}<ArrowUpRight size={14}/></button></div>}
function Empty({icon,title,body}:{icon:React.ReactNode;title:string;body:string}){return <div className="empty-state"><span>{icon}</span><b>{title}</b><p>{body}</p></div>}
function TaskRow({task,onToggle,onEdit}:{task:Task;onToggle:()=>void;onEdit:()=>void}){return <div className="task-row"><button className="check-button" onClick={onToggle} title="Hoàn thành công việc"><Circle size={19}/></button><button className="task-copy" onClick={onEdit}><b>{task.title}</b><small>{task.project_name||'Cá nhân'} · {dateLabel(task.due_date)}</small></button><span className={'priority '+task.priority}>{priorityLabel[task.priority]}</span></div>}
function GoalsPage({goals,milestones,onOpen,onDelete,onMilestoneDelete,onArchive,onDuplicate,showArchived,onToggleArchived}:{goals:Goal[];milestones:Milestone[];onOpen:(k:'goal'|'milestone',item?:Goal|Milestone,goalId?:string)=>void;onDelete:(id:string)=>void;onMilestoneDelete:(id:string)=>void;onArchive:(id:string,archived:boolean)=>void;onDuplicate:(id:string)=>void;showArchived:boolean;onToggleArchived:()=>void}) {
  return <div className="page-content"><div className="section-intro"><div><div className="eyebrow">ĐỊNH HƯỚNG VÀ KẾT QUẢ</div><h2>{showArchived?'Mục tiêu đã lưu trữ':'Mục tiêu'}</h2><p>Xác định kết quả mong muốn, sau đó chia thành các cột mốc có thể thực hiện.</p></div><div className="intro-actions"><button className="secondary-button" onClick={onToggleArchived}>{showArchived?'Mục tiêu đang thực hiện':'Đã lưu trữ'}</button><span className="count-pill">{goals.length} mục tiêu</span></div></div>
    <div className="entity-grid">{goals.map(g=><article className="entity-card" key={g.id}><div className="entity-card-head"><span className="entity-icon"><Target size={18}/></span><div className="entity-actions"><button title="Nhân bản mục tiêu" onClick={()=>onDuplicate(g.id)}><Copy size={14}/></button><button title={g.archived_at?'Khôi phục mục tiêu':'Lưu trữ mục tiêu'} onClick={()=>onArchive(g.id,!g.archived_at)}>{g.archived_at?<RotateCcw size={14}/>:<Archive size={14}/>}</button><button title="Sửa mục tiêu" onClick={()=>onOpen('goal',g)}><Pencil size={15}/></button><button title="Xóa mục tiêu" onClick={()=>onDelete(g.id)}><Trash2 size={15}/></button></div></div><div className="entity-meta">{g.category} · {priorityLabel[g.priority]} ưu tiên</div><h3>{g.title}</h3><p>{g.description||'Chưa có mô tả.'}</p><div className="goal-progress-line"><span>Tiến độ</span><b>{Math.round(g.progress_value)}%</b></div><div className="progress-track"><i style={{width:g.progress_value+'%'}}/></div><div className="entity-foot"><span>{g.archived_at?'Đã lưu trữ':statusLabel(g.status)}</span><span>{g.milestones_done}/{g.milestone_count} cột mốc · {g.linked_project_count} dự án · {g.linked_task_count} công việc</span></div>
      {!g.archived_at&&<div className="milestone-list"><div className="mini-head"><b>Cột mốc</b><button onClick={()=>onOpen('milestone',undefined,g.id)}><Plus size={13}/> Thêm</button></div>{milestones.filter(m=>m.goal_id===g.id).map(m=><div className="mini-milestone" key={m.id}><span className={m.status==='completed'?'done':''}>{m.status==='completed'?<Check size={12}/>:<CircleDot size={12}/>}</span><div><b>{m.title}</b><small>{dateLabel(m.due_date)}</small></div><button title="Sửa cột mốc" onClick={()=>onOpen('milestone',m,g.id)}><Pencil size={12}/></button><button title="Xóa cột mốc" onClick={()=>onMilestoneDelete(m.id)}><X size={13}/></button></div>)}</div>}
    </article>)}</div>{!goals.length&&<Empty icon={<Target/>} title={showArchived?'Không có mục tiêu đã lưu trữ':'Bắt đầu bằng một mục tiêu'} body={showArchived?'Mục tiêu đã lưu trữ sẽ xuất hiện tại đây.':'Mục tiêu được lưu trên thiết bị và có thể hoạt động độc lập, không cần dự án.'}/>}</div>;
}
function ProjectsPage({projects,onOpen,onDelete,onArchive,onDuplicate,showArchived,onToggleArchived}:{projects:Project[];onOpen:(k:'project',item?:Project)=>void;onDelete:(id:string)=>void;onArchive:(id:string,archived:boolean)=>void;onDuplicate:(id:string)=>void;showArchived:boolean;onToggleArchived:()=>void}){
  const [view,setView]=useState<'list'|'board'>('list');
  const card=(p:Project)=><article className="entity-card project-card" key={p.id}><div className="entity-card-head"><span className="project-color-icon" style={{background:p.color}}><FolderKanban size={18}/></span><div className="entity-actions"><button title="Nhân bản dự án" onClick={()=>onDuplicate(p.id)}><Copy size={14}/></button><button title={p.archived_at?'Khôi phục dự án':'Lưu trữ dự án'} onClick={()=>onArchive(p.id,!p.archived_at)}>{p.archived_at?<RotateCcw size={14}/>:<Archive size={14}/>}</button><button title="Sửa dự án" onClick={()=>onOpen('project',p)}><Pencil size={15}/></button><button title="Xóa dự án" onClick={()=>onDelete(p.id)}><Trash2 size={15}/></button></div></div><div className="entity-meta">{p.archived_at?'Đã lưu trữ':statusLabel(p.status)} · {priorityLabel[p.priority]} ưu tiên</div><h3>{p.name}</h3><p>{p.description||'Chưa có mô tả dự án.'}</p><div className="project-stats"><b>{p.tasks_done}<small> Đã hoàn thành</small></b><b>{p.task_count-p.tasks_done}<small> Đang mở</small></b></div><div className="progress-track"><i style={{width:(p.task_count?p.tasks_done/p.task_count*100:0)+'%',background:p.color}}/></div><div className="entity-foot"><span>{p.goalIds.length} mục tiêu liên kết</span><span>Hạn {dateLabel(p.due_date)}</span></div></article>;
  return <div className="page-content"><div className="section-intro"><div><div className="eyebrow">TỔ CHỨC CÔNG VIỆC</div><h2>{showArchived?'Dự án đã lưu trữ':'Dự án'}</h2><p>Nhóm các công việc liên quan; mục tiêu vẫn có thể hoạt động độc lập.</p></div><div className="intro-actions"><button className="secondary-button" onClick={()=>setView(v=>v==='list'?'board':'list')}>{view==='list'?<Columns3 size={14}/>:<List size={14}/>} {view==='list'?'Bảng':'Danh sách'}</button><button className="secondary-button" onClick={onToggleArchived}>{showArchived?'Dự án đang thực hiện':'Đã lưu trữ'}</button><span className="count-pill">{projects.length} dự án</span></div></div>
    {view==='list'?<div className="entity-grid">{projects.map(card)}</div>:<div className="project-board">{['active','on_hold','completed'].map(status=><section className="panel board-column" key={status}><h3>{statusLabel(status)}</h3>{projects.filter(p=>p.status===status).map(card)}</section>)}</div>}
    {!projects.length&&<Empty icon={<FolderKanban/>} title={showArchived?'Không có dự án đã lưu trữ':'Chưa có dự án'} body={showArchived?'Dự án đã lưu trữ sẽ xuất hiện tại đây.':'Tạo dự án để tổ chức các công việc cùng hướng đến một kết quả.'}/>}</div>;
}
function TasksPage({tasks,filter,setFilter,sort,setSort,onOpen,onToggle,onStatus,onPriority,onArchive,onDuplicate,onDelete,initialView}:{tasks:Task[];filter:'all'|'today'|'upcoming'|'overdue'|'completed'|'inbox'|'archived';setFilter:(v:'all'|'today'|'upcoming'|'overdue'|'completed'|'inbox'|'archived')=>void;sort:'due'|'priority'|'title'|'created';setSort:(v:'due'|'priority'|'title'|'created')=>void;onOpen:(k:'task',item?:Task)=>void;onToggle:(id:string)=>void;onStatus:(id:string,status:string)=>void;onPriority:(task:Task,priority:Priority)=>void;onArchive:(id:string,archived:boolean)=>void;onDuplicate:(id:string)=>void;onDelete:(id:string)=>void;initialView:'list'|'board'}){
  const [view,setView]=useState<'list'|'board'>(initialView);
  useEffect(()=>setView(initialView),[initialView]);
  const statuses=['inbox','todo','in_progress','completed','cancelled'];
  return <div className="page-content"><div className="section-intro"><div><div className="eyebrow">GHI NHẬN VÀ THỰC HIỆN</div><h2>Công việc</h2><p>Giữ các việc cần làm rõ ràng, có thứ tự ưu tiên và liên kết với công việc của bạn.</p></div><span className="count-pill">{tasks.length} công việc</span></div>
    <div className="task-toolbar"><div className="filter-bar">{(['all','today','upcoming','overdue','inbox','completed','archived'] as const).map(f=><button key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{{all:'Tất cả',today:'Hôm nay',upcoming:'Sắp tới',overdue:'Quá hạn',completed:'Đã hoàn thành',inbox:'Hộp thư đến',archived:'Đã lưu trữ'} as Record<string,string>)[f]}</button>)}</div><div className="task-view-actions"><label><ArrowUpDown size={14}/><select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="due">Ngày đến hạn</option><option value="priority">Mức ưu tiên</option><option value="title">Tiêu đề</option><option value="created">Mới thêm gần đây</option></select></label><button className="secondary-button" onClick={()=>setView(v=>v==='list'?'board':'list')}>{view==='list'?<Columns3 size={14}/>:<List size={14}/>} {view==='list'?'Bảng':'Danh sách'}</button></div></div>
    {view==='list'?<section className="panel task-table"><div className="task-table-head"><span>Công việc</span><span>Trạng thái</span><span>Mức ưu tiên</span><span>Dự án</span><span>Ngày đến hạn</span><span>Thao tác</span></div>{tasks.map(t=><div className={'task-table-row '+(t.status==='completed'?'is-complete':'')} key={t.id}><button className="check-button" onClick={()=>onToggle(t.id)} title={t.status==='completed'?'Mở lại công việc':'Hoàn thành công việc'}>{t.status==='completed'?<CheckCircle2 size={19}/>:<Circle size={19}/>}</button><button className="table-task-title" onClick={()=>onOpen('task',t)}><b>{t.parent_task_id?'↳ ':''}{t.title}</b><small>{t.description||((t.tags||[]).join(' · ')||'Chưa có ghi chú')}</small></button><select className="inline-select" value={t.status} onChange={e=>onStatus(t.id,e.target.value)}>{statuses.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select><select className="inline-select" value={t.priority} onChange={e=>onPriority(t,e.target.value as Priority)}>{(['urgent','high','medium','low'] as Priority[]).map(s=><option key={s} value={s}>{priorityLabel[s]}</option>)}</select><span className="table-project">{t.project_name||'—'}</span><span className="table-date">{dateLabel(t.due_date)}{t.due_time?' · '+t.due_time:''}</span><div className="entity-actions"><button title="Nhân bản" onClick={()=>onDuplicate(t.id)}><Copy size={13}/></button><button title={t.archived_at?'Khôi phục':'Lưu trữ'} onClick={()=>onArchive(t.id,!t.archived_at)}>{t.archived_at?<RotateCcw size={13}/>:<Archive size={13}/>}</button><button title="Sửa" onClick={()=>onOpen('task',t)}><Pencil size={14}/></button><button title="Xóa" onClick={()=>onDelete(t.id)}><Trash2 size={14}/></button></div></div>)}{!tasks.length&&<Empty icon={<ListTodo/>} title="Không có công việc phù hợp với chế độ xem này" body="Tạo công việc hoặc điều chỉnh bộ lọc."/>}</section>:<div className="task-board">{['inbox','todo','in_progress','completed','cancelled'].map(status=><section className="panel board-column" key={status}><h3>{statusLabel(status)}</h3>{tasks.filter(t=>t.status===status).map(t=><article className="board-task" key={t.id}><b>{t.title}</b><small>{t.project_name||'Cá nhân'} · {dateLabel(t.due_date)}</small><select className="inline-select" value={t.status} onChange={e=>onStatus(t.id,e.target.value)}>{statuses.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select><button className="text-action" onClick={()=>onOpen('task',t)}>Sửa công việc</button></article>)}</section>)}</div>}
  </div>;
}
function EditorModal({modal,goals,projects,tasks,onClose,onSave,onError,defaultTaskPriority}:{modal:Exclude<Modal,null>;defaultTaskPriority:string;goals:Goal[];projects:Project[];tasks:Task[];onClose:()=>void;onSave:(v:Record<string,unknown>)=>Promise<void>;onError:(e:unknown)=>void}) {
  const item = 'item' in modal ? modal.item : undefined;
  const isGoal=modal.kind==='goal', isProject=modal.kind==='project', isTask=modal.kind==='task', isMilestone=modal.kind==='milestone';
  const [title,setTitle]=useState(isGoal?(item as Goal|undefined)?.title||'':isProject?(item as Project|undefined)?.name||'':isTask?(item as Task|undefined)?.title||'':isMilestone?(item as Milestone|undefined)?.title||'':'');
  const [description,setDescription]=useState(item?.description||'');
  const [priority,setPriority]=useState((item as Goal|Project|Task|undefined)?.priority||(isTask?defaultTaskPriority:'medium'));
  const [status,setStatus]=useState(item?.status|| (isGoal?'active':'todo'));
  const [startDate,setStartDate]=useState(safeDate(isGoal?(item as Goal|undefined)?.start_date:isProject?(item as Project|undefined)?.start_date:null));
  const [dueDate,setDueDate]=useState(safeDate(isGoal?(item as Goal|undefined)?.target_date:isProject?(item as Project|undefined)?.due_date:isTask?(item as Task|undefined)?.due_date:(item as Milestone|undefined)?.due_date));
  const [category,setCategory]=useState(isGoal?(item as Goal|undefined)?.category||'Cá nhân':'Cá nhân');
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
  const titleLabel=isMilestone?(item?'Sửa cột mốc':'Cột mốc mới'):isGoal?'Mục tiêu':isProject?'Dự án':'Công việc';
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{
    if(modal.kind==='milestone')await onSave({id:item?.id,goalId:modal.goalId,title,description,dueDate,status:milestoneStatus});
    else await onSave({id:item?.id,title,...(isGoal?{description,category,priority,status,startDate,targetDate:dueDate,progressMode,progressValue:Number(progress)}:isProject?{description,priority,status,startDate,dueDate,color,goalIds}:{description,priority,status,startDate,dueDate,projectId,goalIds,parentTaskId,dueTime,estimatedMinutes:Number(estimatedMinutes)||undefined,tags:tags.split(',').map(x=>x.trim()).filter(Boolean)})});
  }catch(e){onError(e);}finally{setSaving(false);}};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="editor-modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">{item?'CHỈNH SỬA':'TẠO MỚI'} · AURESTAR</div><h2>{titleLabel}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div>
    <label className="field"><span>{isProject?'Tên dự án':isGoal?'Tên mục tiêu':modal.kind==='milestone'?'Tên cột mốc':'Tên công việc'}</span><input autoFocus required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} placeholder={isGoal?'Ví dụ: Đạt IELTS 7.5':isProject?'Ví dụ: Ôn luyện IELTS':'Ví dụ: Hoàn thành ôn tập Sinh học'}/></label>
    <label className="field"><span>Mô tả</span><textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Thêm thông tin bổ sung (không bắt buộc)"/></label>
    {modal.kind==='milestone'?<><label className="field"><span>Ngày đến hạn</span><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label className="field"><span>Trạng thái</span><select value={milestoneStatus} onChange={e=>setMilestoneStatus(e.target.value)}><option value="pending">Đang chờ</option><option value="in_progress">Đang thực hiện</option><option value="completed">Đã hoàn thành</option></select></label></>:
    <><div className="form-grid"><label className="field"><span>Mức ưu tiên</span><select value={priority} onChange={e=>setPriority(e.target.value as Priority)}>{Object.keys(priorityLabel).map(p=><option key={p} value={p}>{priorityLabel[p as Priority]}</option>)}</select></label><label className="field"><span>Trạng thái</span><select value={status} onChange={e=>setStatus(e.target.value)}>{(isGoal?['not_started','active','on_hold','completed']:isProject?['active','on_hold','completed']:['inbox','todo','in_progress','completed','cancelled']).map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></label></div>
    <div className="form-grid"><label className="field"><span>Ngày bắt đầu</span><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label className="field"><span>{isGoal?'Ngày mục tiêu':'Ngày đến hạn'}</span><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>
    {isGoal&&<><div className="form-grid"><label className="field"><span>Danh mục</span><input value={category} onChange={e=>setCategory(e.target.value)}/></label><label className="field"><span>Cách tính tiến độ</span><select value={progressMode} onChange={e=>setProgressMode(e.target.value as 'manual'|'automatic')}><option value="manual">Thủ công</option><option value="automatic">Tự động</option></select></label></div>{progressMode==='manual'?<label className="field"><span>Tiến độ (%)</span><input type="number" min="0" max="100" value={progress} onChange={e=>setProgress(e.target.value)}/></label>:<div className="settings-note">Tiến độ được tính dựa trên công việc và cột mốc đã hoàn thành.</div>}</>}
    {isProject&&<label className="field"><span>Màu dự án</span><input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>}
    {isTask&&<><label className="field"><span>Dự án</span><select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Không thuộc dự án</option>{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label className="field"><span>Giờ đến hạn</span><input type="time" value={dueTime} onChange={e=>setDueTime(e.target.value)}/></label><div className="form-grid"><label className="field"><span>Thời lượng dự kiến (phút)</span><input type="number" min="1" max="100000" value={estimatedMinutes} onChange={e=>setEstimatedMinutes(e.target.value)} placeholder="Ví dụ: 30"/></label><label className="field"><span>Công việc cha</span><select value={parentTaskId} onChange={e=>setParentTaskId(e.target.value)}><option value="">Không có công việc cha</option>{tasks.filter(t=>t.id!==item?.id).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div><label className="field"><span>Thẻ (phân tách bằng dấu phẩy)</span><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="học tập, sinh học, ôn tập"/></label><div className="field"><span>Mục tiêu liên kết</span><div className="checkbox-grid">{goals.map(g=><label key={g.id}><input type="checkbox" checked={goalIds.includes(g.id)} onChange={e=>setGoalIds(v=>e.target.checked?[...v,g.id]:v.filter(x=>x!==g.id))}/>{g.title}</label>)}</div></div></>}
    {isProject&&<div className="field"><span>Mục tiêu liên kết</span><div className="checkbox-grid">{goals.map(g=><label key={g.id}><input type="checkbox" checked={goalIds.includes(g.id)} onChange={e=>setGoalIds(v=>e.target.checked?[...v,g.id]:v.filter(x=>x!==g.id))}/>{g.title}</label>)}</div></div>}
    </>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving||!title.trim()}><Check size={16}/>{saving?'Đang lưu…':item?'Lưu thay đổi':'Tạo '+titleLabel.toLowerCase()}</button></div>
  </form></div>;
}

function SettingsModal({initialTheme,initialDensity,initialDefaultPage,initialSettings,onClose,onSave}:{initialTheme:string;initialDensity:string;initialDefaultPage:string;initialSettings:Record<string,any>;onClose:()=>void;onSave:(v:Record<string,unknown>)=>Promise<void>}){
  const [theme,setTheme]=useState(initialTheme);
  const [density,setDensity]=useState(initialDensity);
  const [defaultPage,setDefaultPage]=useState(initialDefaultPage);
  const [accentColor,setAccentColor]=useState(String(initialSettings.accentColor||'#B94A62'));
  const [fontSize,setFontSize]=useState(Number(initialSettings.fontSize)||14);
  const [language,setLanguage]=useState('vi');
  const [dateFormat,setDateFormat]=useState(String(initialSettings.dateFormat||'dd/MM/yyyy'));
  const [timeFormat,setTimeFormat]=useState(String(initialSettings.timeFormat||'24h'));
  const [weekStartsOn,setWeekStartsOn]=useState(Number(initialSettings.weekStartsOn??1));
  const [taskDefaultPriority,setTaskDefaultPriority]=useState(String(initialSettings.taskDefaultPriority||'medium'));
  const [taskDefaultView,setTaskDefaultView]=useState(String(initialSettings.taskDefaultView||'list'));
  const [taskSort,setTaskSort]=useState(String(initialSettings.taskSort||'due'));
  const [focusDurationMinutes,setFocusDurationMinutes]=useState(Number(initialSettings.focusDurationMinutes)||25);
  const [shortBreakMinutes,setShortBreakMinutes]=useState(Number(initialSettings.shortBreakMinutes)||5);
  const [longBreakMinutes,setLongBreakMinutes]=useState(Number(initialSettings.longBreakMinutes)||15);
  const [longBreakInterval,setLongBreakInterval]=useState(Number(initialSettings.longBreakInterval)||4);
  const [focusSoundEnabled,setFocusSoundEnabled]=useState(initialSettings.focusSoundEnabled!==false);
  const [focusAutoStartBreaks,setFocusAutoStartBreaks]=useState(Boolean(initialSettings.focusAutoStartBreaks));
  const [focusAutoStartSessions,setFocusAutoStartSessions]=useState(Boolean(initialSettings.focusAutoStartSessions));
  const [journalDefaultType,setJournalDefaultType]=useState(String(initialSettings.journalDefaultType||'reflection'));
  const [journalAutosave,setJournalAutosave]=useState(initialSettings.journalAutosave!==false);
  const [journalMarkdownPreview,setJournalMarkdownPreview]=useState(initialSettings.journalMarkdownPreview!==false);
  const [notificationsEnabled,setNotificationsEnabled]=useState(initialSettings.notificationsEnabled!==false);
  const [privacyMode,setPrivacyMode]=useState(Boolean(initialSettings.privacyMode));
  const [appInfo,setAppInfo]=useState<any>(null);
  useEffect(()=>{void window.aurestarV2.getAppInfo().then(setAppInfo).catch(()=>{});},[]);
  const [saving,setSaving]=useState(false);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="editor-modal settings-modal" onSubmit={async e=>{e.preventDefault();setSaving(true);try{await onSave({theme,density,defaultLandingPage:defaultPage,accentColor,fontSize,language,dateFormat,timeFormat,weekStartsOn,taskDefaultPriority,taskDefaultView,taskSort,focusDurationMinutes,shortBreakMinutes,longBreakMinutes,longBreakInterval,focusSoundEnabled,focusAutoStartBreaks,focusAutoStartSessions,journalDefaultType,journalAutosave,journalMarkdownPreview,notificationsEnabled,privacyMode});}finally{setSaving(false);}}}>
    <div className="modal-head"><div><div className="eyebrow">TÙY CHỌN · CHỈ LƯU CỤC BỘ</div><h2>Cài đặt</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18}/></button></div>
    <label className="field"><span>Giao diện</span><select value={theme} onChange={e=>setTheme(e.target.value)}><option value="dark">Tối</option><option value="light">Sáng</option><option value="system">Theo hệ thống</option></select></label>
    <label className="field"><span>Mật độ giao diện</span><select value={density} onChange={e=>setDensity(e.target.value)}><option value="comfortable">Thoáng</option><option value="compact">Gọn</option></select></label>
    <label className="field"><span>Trang mặc định khi khởi động</span><select value={defaultPage} onChange={e=>setDefaultPage(e.target.value)}><option value="home">Tổng quan</option><option value="goals">Mục tiêu</option><option value="projects">Dự án</option><option value="tasks">Công việc</option><option value="habits">Thói quen</option><option value="focus">Tập trung</option><option value="journal">Nhật ký</option><option value="review">Tổng kết tuần</option><option value="insights">Phân tích</option><option value="data">Quản lý dữ liệu</option></select></label>
    <div className="settings-section"><h3>Giao diện</h3><label className="field"><span>Màu nhấn</span><input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)}/></label><label className="field"><span>Cỡ chữ</span><input type="number" min="12" max="24" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))}/></label></div>
    <div className="settings-section"><h3>Chung</h3><label className="field"><span>Ngôn ngữ</span><select value={language} onChange={e=>setLanguage(e.target.value)}><option value="vi">Tiếng Việt</option></select></label><label className="field"><span>Định dạng ngày</span><select value={dateFormat} onChange={e=>setDateFormat(e.target.value)}><option value="yyyy-MM-dd">YYYY-MM-DD</option><option value="dd/MM/yyyy">DD/MM/YYYY</option><option value="MM/dd/yyyy">MM/DD/YYYY</option></select></label><label className="field"><span>Định dạng giờ</span><select value={timeFormat} onChange={e=>setTimeFormat(e.target.value)}><option value="24h">24 giờ</option><option value="12h">12 giờ</option></select></label><label className="field"><span>Ngày đầu tuần</span><select value={weekStartsOn} onChange={e=>setWeekStartsOn(Number(e.target.value))}><option value={1}>Thứ Hai</option><option value={0}>Chủ Nhật</option><option value={6}>Thứ Bảy</option></select></label></div>
    <div className="settings-section"><h3>Công việc</h3><label className="field"><span>Mức ưu tiên mặc định</span><select value={taskDefaultPriority} onChange={e=>setTaskDefaultPriority(e.target.value)}>{['low','medium','high','urgent'].map(v=><option key={v} value={v}>{priorityLabel[v as Priority]}</option>)}</select></label><label className="field"><span>Chế độ xem mặc định</span><select value={taskDefaultView} onChange={e=>setTaskDefaultView(e.target.value)}><option value="list">Danh sách</option><option value="board">Bảng</option></select></label><label className="field"><span>Sắp xếp mặc định</span><select value={taskSort} onChange={e=>setTaskSort(e.target.value)}><option value="due">Ngày đến hạn</option><option value="priority">Mức ưu tiên</option><option value="title">Tiêu đề</option><option value="created">Ngày tạo</option></select></label></div>
    <div className="settings-section"><h3>Tập trung</h3>{[['Thời lượng tập trung',focusDurationMinutes,setFocusDurationMinutes],['Nghỉ ngắn',shortBreakMinutes,setShortBreakMinutes],['Nghỉ dài',longBreakMinutes,setLongBreakMinutes],['Chu kỳ nghỉ dài',longBreakInterval,setLongBreakInterval]].map(([label,value,setter]:any)=><label className="field" key={label}><span>{label} (phút / số phiên)</span><input type="number" min="1" max="180" value={value} onChange={e=>setter(Number(e.target.value))}/></label>)}<label className="field"><span>Âm thanh</span><input type="checkbox" checked={focusSoundEnabled} onChange={e=>setFocusSoundEnabled(e.target.checked)}/></label><label className="field"><span>Tự động bắt đầu giờ nghỉ</span><input type="checkbox" checked={focusAutoStartBreaks} onChange={e=>setFocusAutoStartBreaks(e.target.checked)}/></label><label className="field"><span>Tự động bắt đầu phiên tập trung</span><input type="checkbox" checked={focusAutoStartSessions} onChange={e=>setFocusAutoStartSessions(e.target.checked)}/></label></div>
    <div className="settings-section"><h3>Nhật ký và quyền riêng tư</h3><label className="field"><span>Loại nhật ký mặc định</span><select value={journalDefaultType} onChange={e=>setJournalDefaultType(e.target.value)}><option value="reflection">Tự nhìn lại mỗi ngày</option><option value="freewriting">Viết tự do</option></select></label><label className="field"><span>Tự động lưu</span><input type="checkbox" checked={journalAutosave} onChange={e=>setJournalAutosave(e.target.checked)}/></label><label className="field"><span>Cho phép xem trước Markdown</span><input type="checkbox" checked={journalMarkdownPreview} onChange={e=>setJournalMarkdownPreview(e.target.checked)}/></label><label className="field"><span>Thông báo</span><input type="checkbox" checked={notificationsEnabled} onChange={e=>setNotificationsEnabled(e.target.checked)}/></label><label className="field"><span>Chế độ riêng tư</span><input type="checkbox" checked={privacyMode} onChange={e=>setPrivacyMode(e.target.checked)}/></label></div>
    <div className="settings-section"><h3>Quản lý dữ liệu</h3><p className="settings-note">Xuất dữ liệu không gian làm việc, tạo bản sao lưu ZIP, kiểm tra dữ liệu nhập và khôi phục bản sao lưu. Hệ thống tự tạo bản sao lưu an toàn trước mỗi lần nhập.</p><DataTools/></div>
    <div className="settings-section"><h3>Giới thiệu</h3><p className="settings-note">AURESTAR · Ứng dụng quản lý năng suất cá nhân</p><p className="settings-note">Phiên bản: {appInfo?.version||'—'} · Electron: {appInfo?.electron||'—'} · Node.js: {appInfo?.node||'—'}</p><p className="settings-note">Nền tảng: {appInfo?.platform||'—'} / {appInfo?.arch||'—'}</p><p className="settings-note">Thiết kế và phát triển sản phẩm: Aurestar.</p><p className="settings-note">Thông tin giấy phép được cung cấp trong tài liệu phát hành của ứng dụng.</p><p className="settings-note">Ưu tiên ngoại tuyến · Lưu trữ SQLite cục bộ · Không cần tài khoản</p></div><div className="settings-note">Các tùy chọn được lưu cục bộ trong cơ sở dữ liệu SQLite của Aurestar.</div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving?'Đang lưu…':'Lưu cài đặt'}</button></div>
  </form></div>;
}

export default App;