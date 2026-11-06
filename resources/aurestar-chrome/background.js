const VERSION = 53;
const PROGRESSION_VERSION = 14;
const BASE_LEVEL_XP = 100;
// Streak XP Buff: +0.01× per streak day, reaching exactly x2.00 at Day 100.
// Day 1 = x1.01; Day 100+ = x2.00.
const STREAK_MULTIPLIER_STEP = 0.01;
const STREAK_MULTIPLIER_CAP = 2.0;
const LEVEL_XP_CAP = 12500;
// Level progression: +100 XP per level until the per-level requirement reaches 12,500 XP.
// Progression is unlimited; 12,500 XP is the maximum XP required for any single level-up.
// Daily Quest targets are 8 Tasks + 4 Habits + 4 Focus sessions.
// The progression reference cap uses this expected daily workload, with the daily quest reward included.
const DAILY_TARGET_TASKS = 8;
const DAILY_TARGET_HABITS = 4;
const DAILY_TARGET_FOCUS = 4;
const DAILY_TARGET_QUEST_XP = 200;
const MAX_STREAK_DAILY_XP = DAILY_TARGET_TASKS*scaledXPBase(50,STREAK_MULTIPLIER_CAP)+DAILY_TARGET_HABITS*scaledXPBase(30,STREAK_MULTIPLIER_CAP)+DAILY_TARGET_FOCUS*scaledXPBase(60,STREAK_MULTIPLIER_CAP)+scaledXPBase(DAILY_TARGET_QUEST_XP,STREAK_MULTIPLIER_CAP);
const PROGRESSION_XP_CAP = MAX_STREAK_DAILY_XP*5;
function scaledXPBase(amount,multiplier){return Math.max(1,Math.round(Math.max(1,Math.round(Number(amount)||0))*multiplier));}
// Levels are unlimited. The 12,500 XP cap applies only to the requirement for one level-up.
function pointsPerLevel(level){const l=Math.max(2,Math.floor(Number(level)||2));if(l<=10)return 1;if(l<=25)return 2;if(l<=50)return 3;if(l<=75)return 4;return 5;}
const AUTO_BACKUP_FILENAME = "Aurestar/itsuki-study-data.json";
const BACKUP_FILE_NAME = "itsuki-study-data.json";
const COINS_PER_POINT = 80;
const DEFAULT_SETTINGS = {
  privacyMode: false,
  notifications: true,
  dailyReminder: "08:00",
  taskReminders: true,
  alarmSound: false,
  alarmVolume: 1,
  alarmDuration: 12,
  autoBackup: true,
  backupTime: "23:30",
  blockedWebsites: ["tiktok.com","facebook.com"],
  focusAutoBreak: false,
  focusAutoStart: false,
  focusAutoCycle: false,
  focusBanBreak: false,
  focusCountdown: true,
  focusPreset: 25,
  focusShortBreak: 5,
  focusLongBreak: 15,
  focusLongBreakEvery: 4,
  focusWidgetEnabled: true,
  focusWidgetPosition: {top: 18, right: 18},
  itsukiCompanionEnabled: true,
  itsukiCompanionNotifications: false,
  itsukiCompanionDailyReminder: false,
  language: "en"
};
const DEFAULT_LISTS = [
  {id:"inbox",name:"Inbox",icon:"▣",color:"red",createdAt:0,system:true}
];
const START_ATTRIBUTES = {
  discipline:1, ambition:1, physical:1, mental:1, intellect:1
};
const DEFAULT_PROFILE = {
  xp:100, level:1, totalFocusMinutes:0, createdAt:Date.now(),
  xpHistory:[], levelHistory:[], xpAwards:[], coins:0,
  dailyQuestClaims:[], questClaims:[], milestoneClaims:[], loginStreak:0, lastLoginDate:"", loginCoinClaims:[],
  points:1, pointsHistory:[], levelPointsGrantedThrough:1, attributes:START_ATTRIBUTES,
  attributeSeedVersion:5, character:{class:"Operator",title:"Novice",hp:100,maxHp:100}, statTitleHistory:[]
};
const DEFAULT_STATE = {
  schemaVersion:VERSION,
  settings:DEFAULT_SETTINGS,
  profile:DEFAULT_PROFILE,
  lists:DEFAULT_LISTS,
  tasks:[], habits:[], challenges:[], goals:[], focusSessions:[],
  completions:[], achievements:[], reviews:[], motivationVideos:[], workoutSessions:[], workoutEngine:{active:false,phase:"idle",paused:false,date:"",startedAt:0,phaseStartedAt:0,endsAt:0,remaining:0,taskIds:[],taskIndex:0,setIndex:0,circuitRound:0,circuitIndex:0,session:null,timerKind:"countdown"}, focusPresence:{active:false,lastHeartbeat:0,startedAt:0}, focusEngine:{active:false,phase:"idle",mode:25,startedAt:0,endsAt:0,remaining:0,paused:false,pomodorosCompleted:0,roundsTarget:4,taskId:"",breakKind:"short",free:false,sessionStartedAt:0}, motivationLastVideoId:"", motivationLastOpenedAt:0,
  dataMeta:{revision:0,updatedAt:0,deviceId:""}
};
const uid=p=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const dateFromKey=k=>{const [y,m,d]=String(k).split("-").map(Number);return new Date(y||1970,(m||1)-1,d||1)};
const shiftDate=(k,n)=>{const d=dateFromKey(k);d.setDate(d.getDate()+n);return dateKey(d)};
const weekday=k=>dateFromKey(k).getDay();
const startOfWeek=k=>{const d=dateFromKey(k);d.setDate(d.getDate()-((d.getDay()+6)%7));return dateKey(d)};
function getStreakMultiplier(streak){
  const n=Math.max(1,Math.floor(Number(streak)||1));
  return Math.min(STREAK_MULTIPLIER_CAP,1+n*STREAK_MULTIPLIER_STEP);
}
function scaledXP(amount,streak=1){
  const base=Math.max(1,Math.round(Number(amount)||0));
  return Math.max(1,Math.round(base*getStreakMultiplier(streak)));
}
function xpToNextLevel(level){
  const l=Math.max(1,Math.floor(Number(level)||1));
  return Math.min(LEVEL_XP_CAP,BASE_LEVEL_XP+(l-1)*100);
}
const LEVEL_THRESHOLD_CACHE=[100];
function threshold(level){
  const target=Math.max(1,Math.floor(Number(level)||1));
  while(LEVEL_THRESHOLD_CACHE.length<=target){
    const lv=LEVEL_THRESHOLD_CACHE.length;
    LEVEL_THRESHOLD_CACHE.push(LEVEL_THRESHOLD_CACHE[lv-1]+xpToNextLevel(lv));
  }
  return LEVEL_THRESHOLD_CACHE[target-1];
}
function levelForXP(xp){
  const value=Math.max(100,Number(xp)||100);
  let lo=1,hi=2;
  while(threshold(hi)<=value){
    lo=hi;
    hi*=2;
  }
  while(lo<hi){
    const mid=Math.floor((lo+hi+1)/2);
    if(threshold(mid)<=value)lo=mid;else hi=mid-1;
  }
  return lo;
}

function rankForLevel(level){const l=Math.max(1,Number(level)||1);if(l>=1000)return"Immortal Productivity";if(l>=501)return"Transcendent";if(l>=251)return"Visionary";if(l>=101)return"Grandmaster";if(l>=51)return"Master";if(l>=26)return"Performer";if(l>=11)return"Achiever";return"Novice";}
function milestoneTitle(level){const l=Math.max(1,Number(level)||1);const m=[[10000,"System Apex"],[7500,"Beyond Human Limits"],[5000,"Aurestar Sovereign"],[4000,"Infinite Architect"],[3000,"Reality Breaker"],[2500,"Mythic Executor"],[2000,"Eternal Entity"],[1500,"Eternal Strategist"],[1250,"Cosmic Operator"],[1000,"Reality Architect"],[750,"Sovereign of Productivity"],[600,"Transcendent Builder"],[500,"Awakened Monarch"],[400,"Apex Architect"],[300,"Reality Weaver"],[250,"Grand Strategist"],[200,"Time Master"],[150,"High Ascendant"],[125,"Ascendant"],[100,"Pillar of Excellence"],[75,"Elite Operator"],[50,"Productivity Titan"],[25,"Rising Vanguard"],[20,"Evolved Self"],[10,"First Evolution"],[5,"The Initiator"]];return m.find(([n])=>l>=n)?.[1]||"";}
const LEVEL_MILESTONE_REWARDS=[[5,50],[10,75],[20,100],[25,125],[50,200],[75,300],[100,500],[125,650],[150,800],[200,1000],[250,1200],[300,1400],[400,1600],[500,1800],[600,2000],[750,2250],[1000,2500],[1250,2750],[1500,3000],[2000,3250],[2500,3500],[3000,3750],[4000,4000],[5000,4250],[7500,4750],[10000,5000]];
function milestoneCoinReward(level){const hit=LEVEL_MILESTONE_REWARDS.find(([lv])=>lv===Number(level));return hit?hit[1]:0;}
function grantMilestoneCoins(s,fromLevel,toLevel){let awarded=0;s.profile.milestoneClaims=Array.isArray(s.profile.milestoneClaims)?s.profile.milestoneClaims:[];for(const [lv] of LEVEL_MILESTONE_REWARDS){if(lv>fromLevel&&lv<=toLevel&&!s.profile.milestoneClaims.includes(lv)){const coins=milestoneCoinReward(lv);s.profile.milestoneClaims.push(lv);awarded+=coins;s.profile.xpHistory.push({id:uid("milestone"),amount:0,baseAmount:0,streak:1,streakMultiplier:1,levelMultiplier:1,reason:`Milestone · Lv.${lv} · ${milestoneTitle(lv)}`,date:dateKey(),at:Date.now(),key:`milestone:${lv}`,coins});}}if(awarded)s.profile.coins=Math.max(0,Number(s.profile.coins)||0)+awarded;return awarded;}
function characterRank(ovr){if(ovr>=100)return"Transcendent";if(ovr>=75)return"Elite";if(ovr>=50)return"Master";if(ovr>=25)return"Veteran";if(ovr>=15)return"Achiever";if(ovr>=5)return"Rising";return"Awakened";}
function attributeLabel(key){return {discipline:"Discipline",ambition:"Ambition",physical:"Physical",mental:"Mental",intellect:"Intellect"}[key]||key;}
const STAT_TITLE_TABLE={discipline:[[25,"Routine Pathfinder"],[50,"Architect of Will"],[100,"Iron-Clad Monarch"],[200,"Master of Order"],[350,"Unbroken Sovereign"],[500,"Imperium of Discipline"],[750,"Dominion of Focus"],[1000,"Eternal Vanguard"]],ambition:[[25,"Spark of Purpose"],[50,"Apex Pursuer"],[100,"Horizon Breaker"],[200,"World Shaper"],[350,"Destiny Carver"],[500,"Infinite Sovereign"],[750,"Cosmic Conqueror"],[1000,"Supreme Architect"]],physical:[[25,"Vigor Initiate"],[50,"Prime Kinetic"],[100,"Titan Vessel"],[200,"Unstoppable Force"],[350,"Indestructible Core"],[500,"Apex Predator"],[750,"Immortal Engine"],[1000,"God-Forge Body"]],mental:[[25,"Stillwater Mind"],[50,"Stoic Citadel"],[100,"Unshakable Psyche"],[200,"Sanctuary of Will"],[350,"Zenith Awakener"],[500,"Transcendent Consciousness"],[750,"Absolute Sanctuary"],[1000,"Cosmic Mind"]],intellect:[[25,"Keen Analyst"],[50,"Deep-Mind Scholar"],[100,"Master Polymath"],[200,"Omniscient Sage"],[350,"Grand Strategist"],[500,"Sovereign Intelligence"],[750,"Infinite Knowledge"],[1000,"Omni-Dimensional Mind"]]};
function statTitle(key,value){const v=Math.max(1,Number(value)||1),found=[...(STAT_TITLE_TABLE[key]||[])].reverse().find(([n])=>v>=n);return found?found[1]:v>=1000?`${attributeLabel(key)} Sovereign Grade ${Math.floor(v/500)}`:"";}
function harmonyTitle(a){const vals=Object.values(a||{}).map(v=>Number(v)||1);if(vals.length!==5)return"";const min=Math.min(...vals);if(min>=1000)return"Omnipotent Catalyst";if(min>=500)return"Transcendent Being";if(min>=250)return"Apex Human Paradigm";if(min>=100)return"Centurion of Perfection";if(min>=50)return"Harmonized Entity";if(min>=25)return"Synergy Operator";return"";}
function overallRating(s){const a=s.profile.attributes||START_ATTRIBUTES,total=Object.keys(START_ATTRIBUTES).reduce((sum,k)=>sum+Math.max(1,Number(a[k]||1)),0),avg=total/5,level=Math.max(1,Number(s.profile.level)||1);return Math.max(1,Math.round(avg)+Math.floor((level-1)/4));}
function normalizeFocusMinutes(value){const n=Math.round(Number(value)||25);return Math.min(120,Math.max(15,n));}
function normalize(raw){
  const s={...DEFAULT_STATE,...(raw||{})};
  s.settings={...DEFAULT_SETTINGS,...(raw?.settings||{})};
  s.settings.language="en";
  if(s.settings.privacyMode===true){s.settings.notifications=false;s.settings.taskReminders=false;s.settings.alarmSound=false;s.settings.itsukiCompanionEnabled=false;s.settings.itsukiCompanionNotifications=false;s.settings.itsukiCompanionDailyReminder=false;}
  s.settings.focusAutoBreak=false;
  s.settings.focusAutoStart=false;
  s.settings.focusAutoCycle=s.settings.focusAutoCycle===true;
  s.settings.focusBanBreak=s.settings.focusBanBreak===true;
  s.settings.focusCountdown=true;
  s.settings.focusShortBreak=Math.min(30,Math.max(1,Math.floor(Number(s.settings.focusShortBreak)||5)));
  s.settings.focusLongBreak=Math.min(60,Math.max(s.settings.focusShortBreak,Math.floor(Number(s.settings.focusLongBreak)||15)));
  s.settings.focusLongBreakEvery=Math.min(12,Math.max(1,Math.floor(Number(s.settings.focusLongBreakEvery)||4)));
  s.settings.focusWidgetEnabled=s.settings.focusWidgetEnabled!==false;
  const fp=s.settings.focusWidgetPosition||{}; const fpTop=fp.top==null?NaN:Number(fp.top),fpRight=fp.right==null?NaN:Number(fp.right); s.settings.focusWidgetPosition={top:Math.min(80,Math.max(0,Number.isFinite(fpTop)?fpTop:18)),right:Math.min(80,Math.max(0,Number.isFinite(fpRight)?fpRight:18))};
  s.settings.dailyFocusGoalMin=Math.min(600,Math.max(15,Math.floor(Number(s.settings.dailyFocusGoalMin)||120)));
  s.settings.focusPreset=Math.min(120,Math.max(15,Math.floor(Number(s.settings.focusPreset)||25)));
  s.settings.blockedWebsites=Array.isArray(s.settings.blockedWebsites)?[...new Set(s.settings.blockedWebsites.map(normalizeBlockedDomain).filter(Boolean))].slice(0,100):[...DEFAULT_SETTINGS.blockedWebsites];
  delete s.ai;
  delete s.discipline;
  s.profile.dailyQuestClaims=Array.isArray(s.profile.dailyQuestClaims)?s.profile.dailyQuestClaims:[];
  s.profile.questClaims=Array.isArray(s.profile.questClaims)?s.profile.questClaims:[];
  s.profile.questChains=(s.profile.questChains&&typeof s.profile.questChains==='object')?s.profile.questChains:{};
  for(const key of Object.keys(s.profile.questChains)){
    const m=String(key).match(/^(task|focus|habit)-chain-(\d+)$/);
    if(m && Number(m[2])<LONG_TERM_START_TIER) delete s.profile.questChains[key];
  }
  s.profile.loginStreak=Math.max(0,Number(s.profile.loginStreak)||0);s.profile.lastLoginDate=String(s.profile.lastLoginDate||"");s.profile.loginCoinClaims=Array.isArray(s.profile.loginCoinClaims)?s.profile.loginCoinClaims:[];
  if((Number(s.profile.attributeSeedVersion)||0)<5){const old=Number(s.profile.attributes?.social)||1;s.profile.points=Math.max(0,Number(s.profile.points)||0)+Math.max(0,old-1);s.profile.attributeSeedVersion=5;}
  const nextAttrs={...START_ATTRIBUTES};for(const k of Object.keys(nextAttrs))nextAttrs[k]=Math.max(1,Number(s.profile.attributes?.[k])||1);s.profile.attributes=nextAttrs;
  s.profile.statTitleHistory=Array.isArray(s.profile.statTitleHistory)?s.profile.statTitleHistory:[];
  s.profile.progressionVersion=PROGRESSION_VERSION;
  s.profile.achievements=Array.isArray(s.profile.achievements)?s.profile.achievements:[];
  if((Number(s.profile.level)||1)===1 && (Number(s.profile.xp)||0)<100)s.profile.xp=100;
  s.profile.level=levelForXP(s.profile.xp);
  s.profile={...DEFAULT_PROFILE,...(raw?.profile||{})};
  // v52 removes progression/economy systems. Keep only a neutral compatibility shell for legacy callers.
  s.profile.xp=0;s.profile.level=1;s.profile.xpHistory=[];s.profile.levelHistory=[];s.profile.xpAwards=[];s.profile.coins=0;s.profile.points=0;s.profile.pointsHistory=[];s.profile.levelPointsGrantedThrough=1;s.profile.attributes={...START_ATTRIBUTES};s.profile.dailyQuestClaims=[];s.profile.questClaims=[];s.profile.questChains={};s.profile.milestoneClaims=[];s.profile.loginStreak=0;s.profile.lastLoginDate="";s.profile.loginCoinClaims=[];s.profile.statTitleHistory=[];s.profile.achievements=[];s.profile.questProgress={task:0,focus:0,habit:0};
  s.achievements=[];s.challenges=[];
  s.profile.questProgress={task:0,focus:0,habit:0,...(raw?.profile?.questProgress||{})};
  if(!raw?.profile?.questProgress){
    const totals={task:s.completions.filter(c=>c.kind==="task").length,focus:s.focusSessions.length,habit:s.completions.filter(c=>c.kind==="habit").length};
    for(const kind of ["task","focus","habit"]){let tier=LONG_TERM_START_TIER,consumed=0;while(tier<LONG_TERM_MAX_TIER&&s.profile.questChains?.[`${kind}-chain-${tier}`]?.claimed){consumed+=tier;tier++;}if(tier===LONG_TERM_MAX_TIER&&s.profile.questChains?.[`${kind}-chain-${tier}`]?.claimed)consumed+=tier;s.profile.questProgress[kind]=Math.max(0,totals[kind]-consumed);}
  }
  s.profile.xp=Number(s.profile.xp)||0;s.profile.level=levelForXP(s.profile.xp);s.profile.totalFocusMinutes=Number(s.profile.totalFocusMinutes)||0;
  if(s.profile.level>1)grantMilestoneCoins(s,0,s.profile.level);
  s.focusPresence={active:Boolean(raw?.focusPresence?.active),lastHeartbeat:Number(raw?.focusPresence?.lastHeartbeat)||0,startedAt:Number(raw?.focusPresence?.startedAt)||0};
  const fe=raw?.focusEngine||{}; s.focusEngine={active:Boolean(fe.active),phase:["focus","break","idle"].includes(String(fe.phase))?String(fe.phase):"idle",mode:normalizeFocusMinutes(fe.mode||25),startedAt:Number(fe.startedAt)||0,endsAt:Number(fe.endsAt)||0,remaining:Math.max(0,Number(fe.remaining)||0),paused:Boolean(fe.paused),pomodorosCompleted:Math.max(0,Math.floor(Number(fe.pomodorosCompleted)||0)),roundsTarget:Math.min(20,Math.max(1,Math.floor(Number(fe.roundsTarget)||4))),taskId:String(fe.taskId||""),breakKind:["short","long"].includes(String(fe.breakKind))?String(fe.breakKind):"short",free:false,sessionStartedAt:Number(fe.sessionStartedAt||fe.startedAt)||0,countdown:true};
  s.motivationLastVideoId=String(raw?.motivationLastVideoId||"");s.motivationLastOpenedAt=Number(raw?.motivationLastOpenedAt)||0;
  // Preserve legacy video records as opaque backup data; the application no longer exposes a player.
  s.motivationVideos=Array.isArray(s.motivationVideos)?s.motivationVideos:[];
  s.profile.xpHistory=Array.isArray(s.profile.xpHistory)?s.profile.xpHistory:[];s.profile.levelHistory=Array.isArray(s.profile.levelHistory)?s.profile.levelHistory:[];s.profile.xpAwards=Array.isArray(s.profile.xpAwards)?s.profile.xpAwards:[];
  s.profile.coins=Number(s.profile.coins)||0;s.profile.milestoneClaims=Array.isArray(s.profile.milestoneClaims)?s.profile.milestoneClaims:[];s.profile.points=Number(s.profile.points)||0;s.profile.pointsHistory=Array.isArray(s.profile.pointsHistory)?s.profile.pointsHistory:[];s.profile.levelPointsGrantedThrough=Math.max(1,Number(s.profile.levelPointsGrantedThrough)||1);
  const attrs={...START_ATTRIBUTES};
  if((Number(s.profile.attributeSeedVersion)||0)<5){s.profile.points=Math.max(0,Number(s.profile.points)||0)+Math.max(0,(Number(s.profile.attributes?.social)||1)-1);s.profile.attributeSeedVersion=5;}
  s.profile.attributes={...attrs,...(s.profile.attributes||{})};
  for(const k of Object.keys(attrs))s.profile.attributes[k]=Math.max(1,Number(s.profile.attributes[k])||1);
  delete s.profile.attributes.social;
  // v31: Master EXP override — task/habit/focus rewards and level formulas are authoritative.
  if(Number(s.dataMeta.masterExpVersion||0)<2){
    s.tasks=(s.tasks||[]).map(t=>({...t,xp:taskXP(t)}));
    s.habits=(s.habits||[]).map(h=>({...h,xp:habitXP(h)}));
    s.focusSessions=(s.focusSessions||[]).map(x=>({...x,xp:focusXP(x.minutes)}));
    s.completions=(s.completions||[]).filter(c=>c.kind!=="challenge").map(c=>{
      if(c.kind==="task"){const t=s.tasks.find(t=>String(t.id)===String(c.id));return {...c,xp:t?taskXP(t):35};}
      if(c.kind==="habit"){const h=s.habits.find(h=>String(h.id)===String(c.id));return {...c,xp:h?habitXP(h):25};}
      if(c.kind==="focus")return {...c,xp:focusXP(c.minutes)};
      return c;
    });
    s.profile.xpHistory=(s.profile.xpHistory||[]).map(x=>{
      const reason=String(x.reason||"");
      if(/^Task · /.test(reason)){const title=reason.slice(7);const t=s.tasks.find(t=>String(t.title)===title);const n=t?taskXP(t):Number(x.amount)||25;return {...x,baseAmount:n,amount:n,levelMultiplier:1};}
      if(/^Habit · /.test(reason)){const title=reason.slice(8);const h=s.habits.find(h=>String(h.title)===title);const n=h?habitXP(h):25;return {...x,baseAmount:n,amount:n,levelMultiplier:1};}
      if(/^Focus · (\d+) minutes/.test(reason)){const n=focusXP(Number(reason.match(/^Focus · (\d+)/)?.[1]||25));return {...x,baseAmount:n,amount:n,levelMultiplier:1};}
      return x;
    });
    // Rebuild historical XP from the corrected reward table so old saves do not
    // keep the obsolete 5/2/2 XP values.
    const earnedXp=(s.profile.xpHistory||[]).reduce((sum,x)=>sum+Math.max(0,Number(x.amount)||0),0);
    s.profile.xp=Math.max(100,100+earnedXp);
    s.profile.level=levelForXP(s.profile.xp);
    const granted=Math.max(1,Number(s.profile.levelPointsGrantedThrough)||1);
    if(s.profile.level>granted){
      for(let lv=granted+1;lv<=s.profile.level;lv++){
        const pts=pointsPerLevel(lv);
        s.profile.points=Math.max(0,Number(s.profile.points)||0)+pts;
        s.profile.pointsHistory=Array.isArray(s.profile.pointsHistory)?s.profile.pointsHistory:[];
        s.profile.pointsHistory.push({id:uid("pointmig"),type:"level_reward",amount:pts,cost:0,date:dateKey(),at:Date.now(),level:lv,reason:`Level ${lv} · +${pts} Points · reward migration`});
      }
      s.profile.levelPointsGrantedThrough=s.profile.level;
    }
    // Remove legacy discipline/penalty state from imported backups.
    delete s.discipline;
    delete s.profile.ovrPenalty;
    s.dataMeta.masterExpVersion=2;
  }
  // Focus/task integrity: task focus count and total focus minutes are derived from recorded sessions.
  // This makes imports/restores resilient: focus history is the canonical source of truth.
  {
    const focusCountByTask=new Map();
    for(const fs of (s.focusSessions||[])){
      const tid=String(fs?.taskId||"");
      if(tid) focusCountByTask.set(tid,(focusCountByTask.get(tid)||0)+1);
    }
    s.tasks=(s.tasks||[]).map(t=>({...t,pomodorosDone:focusCountByTask.get(String(t.id))||0}));
    s.profile.totalFocusMinutes=(s.focusSessions||[]).reduce((sum,fs)=>sum+Math.max(0,Number(fs?.minutes)||0),0);
  }
  // v14: repair stored reward fields that older migration code could overwrite.
  if(Number(s.dataMeta.masterExpVersion||0)<4){
    s.tasks=(s.tasks||[]).map(t=>({...t,xp:taskXP(t)}));
    s.habits=(s.habits||[]).map(h=>({...h,xp:habitXP(h)}));
    s.focusSessions=(s.focusSessions||[]).map(x=>({...x,xp:focusXP(x.minutes)}));
    s.completions=(s.completions||[]).map(c=>{
      if(c.kind==="task"){const t=s.tasks.find(t=>String(t.id)===String(c.id));return {...c,xp:t?taskXP(t):Number(c.xp)||25};}
      if(c.kind==="habit"){const h=s.habits.find(h=>String(h.id)===String(c.id));return {...c,xp:h?habitXP(h):Number(c.xp)||25};}
      if(c.kind==="focus")return {...c,xp:focusXP(c.minutes)};
      return c;
    });
    s.dataMeta.masterExpVersion=4;
  }
  // v15: canonical gamification engine migration.
  if(Number(s.dataMeta.progressionVersion||0)<11){
    s.profile.questChains={};
    s.dataMeta.progressionVersion=11;
    s.dataMeta.masterExpVersion=5;
    // Rebase displayed reward values; historical XP remains historical, new awards use v15 rules.
  }
  s.profile.character={class:"Operator",title:"Discipline builder",hp:100,maxHp:100,...(s.profile.character||{})};
  s.profile.character.maxHp=Math.max(1,Number(s.profile.character.maxHp)||100);
  s.profile.character.hp=Math.max(0,Math.min(s.profile.character.maxHp,Number.isFinite(Number(s.profile.character.hp))?Number(s.profile.character.hp):s.profile.character.maxHp));
  for(const k of ["lists","tasks","habits","goals","focusSessions","completions","achievements","reviews","motivationVideos","workoutSessions"])if(!Array.isArray(s[k]))s[k]=[];
  s.workoutSessions=Array.isArray(s.workoutSessions)?s.workoutSessions:[];
  s.workoutEngine={active:false,phase:"idle",paused:false,date:"",startedAt:0,phaseStartedAt:0,endsAt:0,remaining:0,elapsedBase:0,taskIds:[],taskIndex:0,setIndex:0,circuitRound:0,circuitIndex:0,session:null,timerKind:"countdown",...(raw?.workoutEngine||{})};
  s.tasks=s.tasks.map(t=>({...t,workoutConfig:workoutEnsureTaskConfig(t).workoutConfig}));
  s.dataMeta={revision:0,updatedAt:0,deviceId:"",...(raw?.dataMeta||{})};
  s.dataMeta.revision=Math.max(0,Number(s.dataMeta.revision)||0);
  s.dataMeta.updatedAt=Number(s.dataMeta.updatedAt)||0;
  s.dataMeta.deviceId=String(s.dataMeta.deviceId||uid("device"));
  migrate(s);removeLegacyChallenges(s);recalcDerived(s);s.schemaVersion=VERSION;return s;
}
function migrate(s){
  // v25: reset runtime/progression data while preserving the user's task, habit, and challenge definitions.
  // Tasks/habits/challenges are intentionally carried over untouched; everything else starts clean.
  if(Number(s.schemaVersion||0)<25 && !s.dataMeta.v25SelectiveReset){
    const keepTasks=Array.isArray(s.tasks)?s.tasks:[];
    const keepHabits=Array.isArray(s.habits)?s.habits:[];
    const neededListIds=new Set(keepTasks.map(t=>String(t.listId||"inbox")));
    const lists=Array.isArray(s.lists)?s.lists:[];
    const keptLists=lists.filter(l=>String(l.id)==="inbox"||neededListIds.has(String(l.id)));
    if(!keptLists.some(l=>String(l.id)==="inbox"))keptLists.unshift({...DEFAULT_LISTS[0],createdAt:Date.now()});
    const freshProfile={...DEFAULT_PROFILE,createdAt:Date.now(),attributes:{...START_ATTRIBUTES},xpHistory:[],levelHistory:[],xpAwards:[],pointsHistory:[],levelPointsGrantedThrough:1,character:{class:"Operator",title:"Rookie Protocol",hp:100,maxHp:100}};
    s.settings={...DEFAULT_SETTINGS};
    s.profile=freshProfile;
    s.lists=keptLists;
    s.tasks=keepTasks;
    s.habits=keepHabits;
    s.goals=[];
    s.focusSessions=[];
    s.completions=[];
    s.achievements=[];
    s.reviews=[];
    s.dataMeta.v25SelectiveReset=true;
  // v40: unified Ascended 13 economy and clean legacy penalty data.
  if(Number(s.dataMeta.ascended13EconomyVersion||0)<1){
    s.tasks=(s.tasks||[]).map(t=>({...t,xp:taskXP(t)}));
    s.habits=(s.habits||[]).map(h=>({...h,xp:habitXP(h)}));
    s.dataMeta.ascended13EconomyVersion=1;
  }
  // Reward economy v3: legacy migration marker retained; current XP/coin/point rules are defined above.
  if(Number(s.dataMeta.rewardEconomyVersion||0)<3){
    s.tasks=s.tasks.map(t=>({...t,xp:taskXP(t)}));
    s.dataMeta.rewardEconomyVersion=3;
  }
    s.dataMeta.workoutScheduleVersion=1;
    s.dataMeta.revision=0;
    s.dataMeta.updatedAt=Date.now();
  }
  // v36: retain legacy video records for backup compatibility; the retired screen cannot edit them.
  if(Number(s.schemaVersion||0)<36 && !s.dataMeta.v36YouTubeMotivation){
    s.motivationVideos=Array.isArray(s.motivationVideos)?s.motivationVideos:[];
    s.dataMeta.v36YouTubeMotivation=true;
    s.dataMeta.updatedAt=Date.now();
  }
  // v14: every new character starts with 1 Stat Point at Level 1.
  // This keeps Level 1→100 at 340 total level-system Points (including the starting point).
  if(Number(s.dataMeta.initialStatPointVersion||0)<1){
    s.profile.points=Math.max(0,Number(s.profile.points)||0)+1;
    s.profile.pointsHistory=Array.isArray(s.profile.pointsHistory)?s.profile.pointsHistory:[];
    s.profile.pointsHistory.push({id:uid("pointseed"),type:"initial_reward",amount:1,cost:0,date:dateKey(),at:Date.now(),level:1,reason:"Level 1 · +1 Point · starting reward"});
    s.dataMeta.initialStatPointVersion=1;
  }
  // One-time repair for profiles created before level-ups granted Points.
  // Each level above 1 represents one Point that can be used to raise an attribute.
  const reachedLevel=Math.max(1,Number(s.profile.level)||1);
  const grantedThrough=Math.max(1,Number(s.profile.levelPointsGrantedThrough)||1);
  if(grantedThrough<reachedLevel){
    const from=Math.max(2,grantedThrough+1),to=reachedLevel;
    for(let lv=from;lv<=to;lv++){const pts=pointsPerLevel(lv);s.profile.points+=pts;s.profile.pointsHistory.push({id:uid("pointlvl"),type:"level_reward",amount:pts,cost:0,date:dateKey(),at:Date.now(),level:lv,reason:`Level ${lv} · +${pts} Points`});}
    s.profile.levelPointsGrantedThrough=reachedLevel;
  }
  if(!s.lists.length)s.lists=DEFAULT_LISTS.map(x=>({...x,createdAt:Date.now()}));
  if(!s.lists.some(x=>x.id==="inbox"))s.lists.unshift({...DEFAULT_LISTS[0],createdAt:Date.now()});
  const ids=new Set(s.lists.map(x=>x.id));
  s.lists=s.lists.map(l=>({...l,id:String(l.id||uid("list")),name:String(l.name||"List"),icon:String(l.icon||"○"),color:l.color||"red",createdAt:Number(l.createdAt)||Date.now(),system:!!l.system||l.id==="inbox"}));
  s.tasks=s.tasks.map(t=>{const r=t.repeat||{};const rt=["none","daily","weekly"].includes(r.type)?r.type:"none";const days=Array.isArray(r.weekdays)?[...new Set(r.weekdays.map(Number).filter(n=>n>=0&&n<=6))]:[];return {id:t.id||uid("task"),title:String(t.title||"Untitled task"),listId:ids.has(t.listId)?t.listId:"inbox",priority:["low","medium","high","urgent"].includes(t.priority)?t.priority:"medium",estimate:Math.max(5,Number(t.estimate)||25),dueDate:t.dueDate||"",dueTime:t.dueTime||"",repeat:{type:rt,weekdays:days,startDate:r.startDate||((rt!=="none")?t.dueDate||dateKey():"")},notes:String(t.notes||""),reminderAt:t.reminderAt||null,reminderEnabled:!!t.reminderEnabled||!!t.reminderAt,completedDates:Array.isArray(t.completedDates)?[...new Set(t.completedDates)]:t.completedOn?[t.completedOn]:[],archived:!!t.archived,createdAt:Number(t.createdAt)||Date.now(),activatedAt:Number(t.activatedAt)||Number(t.createdAt)||Date.now(),xp:taskXP(t),checklist:Array.isArray(t.checklist)?t.checklist.map(x=>({id:x.id||uid("sub"),text:String(x.text||x.title||"").trim(),done:!!x.done})).filter(x=>x.text):[],workoutConfig:workoutEnsureTaskConfig(t).workoutConfig};});
  // Recurrence integrity repair: recurring tasks always retain a concrete anchor date.
  for(const t of s.tasks){
    if(t.repeat?.type!=="none"){
      const anchor=String(t.repeat.startDate||t.dueDate||"").slice(0,10);
      const stable=/^\d{4}-\d{2}-\d{2}$/.test(anchor)?anchor:(/^\d{4}-\d{2}-\d{2}$/.test(String(t.createdAtDate||""))?String(t.createdAtDate):dateKey(new Date(Number(t.createdAt)||Date.now())));
      t.repeat.startDate=stable;
      t.dueDate=stable;
      if(t.repeat.type==="weekly" && !Array.isArray(t.repeat.weekdays)) t.repeat.weekdays=[weekday(stable)];
    }
  }
  s.habits=s.habits.map(h=>({...h,id:h.id||uid("habit"),title:String(h.title||"Habit"),completions:Array.isArray(h.completions)?[...new Set(h.completions)]:(h.lastCompleted?[h.lastCompleted]:[]),xp:habitXP(h),frequency:["daily","weekly"].includes(h.frequency)?h.frequency:"daily",weekdays:[...new Set((h.weekdays||[]).map(Number).filter(n=>n>=0&&n<=6))],createdAt:Number(h.createdAt)||Date.now()}));
  s.goals=s.goals.map(g=>({...g,id:g.id||uid("goal"),title:String(g.title||"Goal"),target:Math.max(1,Number(g.target)||30),scope:g.scope||"all",createdAt:Number(g.createdAt)||Date.now()}));
  for(const c of s.completions){if(!c.completedAt)c.completedAt=c.at||Date.now();if(!c.date)c.date=dateKey(new Date(c.completedAt));}
  // Workout exercises are internal steps; migrate historical per-exercise task records into one Workout task per fully completed day.
  const workoutTaskIds=new Set(s.tasks.filter(t=>t.workoutConfig?.enabled).map(t=>String(t.id)));
  const workoutCompletionDays=new Set(s.completions.filter(c=>c.kind==="task"&&workoutTaskIds.has(String(c.id))).map(c=>String(c.date||"")));
  for(const session of s.workoutSessions||[])if(session?.completed&&session.date)workoutCompletionDays.add(String(session.date));
  s.completions=s.completions.filter(c=>!(c.kind==="task"&&workoutTaskIds.has(String(c.id))));
  for(const day of workoutCompletionDays){
    const gym=plannedForDate(s,day).filter(t=>!t.archived&&t.workoutConfig?.enabled);
    if(gym.length&&gym.every(t=>(t.completedDates||[]).includes(day))&&!s.completions.some(c=>c.kind==="task"&&c.id===`workout:${day}`&&c.date===day))s.completions.push({id:`workout:${day}`,kind:"task",date:day,xp:0,baseXp:0,workout:true,exerciseCount:gym.length,completedAt:Date.now()});
  }
  // User content is persistent: tasks, habits, and goals are preserved during migrations.
  const a=s.profile.attributes||{};const oldDemoBaseline=Number(a.discipline)===84&&Number(a.ambition)===96&&Number(a.physical)===70&&Number(a.mental)===70&&Number(a.intellect)===90&&(Number(s.profile.points)||0)===0&&(Number(s.profile.coins)||0)===0&&(!s.profile.xpHistory||s.profile.xpHistory.length===0);const needsCharacterReset=oldDemoBaseline;
  if(needsCharacterReset){
    s.profile.xp=0;s.profile.level=1;s.profile.xpHistory=[];s.profile.levelHistory=[];s.profile.xpAwards=[];s.profile.coins=0;s.profile.points=1;s.profile.pointsHistory=[];
    s.profile.attributes={...START_ATTRIBUTES};
    s.profile.attributeSeedVersion=5;
    s.profile.character={class:"Operator",title:"Discipline protocol",hp:100,maxHp:100};
  } else { s.profile.attributeSeedVersion=5; }
  // v11.0 one-time merge: preserve existing local data and add the supplied current state + workout schedule.
  if(!s.dataMeta.workoutScheduleVersion){
    const NOW=Date.now(), START="2026-10-03";
    const pushId="list_push", pullId="list_pull", legsId="list_legs";
    const ensureList=(id,name,icon,color)=>{if(!s.lists.some(x=>x.id===id))s.lists.push({id,name,icon,color,createdAt:NOW,system:false});};
    ensureList(pushId,"PUSH","▲","red"); ensureList(pullId,"PULL","◆","blue"); ensureList(legsId,"LEGS","●","green");
    const baseTask=(id,title,listId,dueTime,weekdays,estimate,notes)=>({id,title,listId,priority:"medium",estimate,dueDate:START,dueTime,repeat:{type:"weekly",weekdays,startDate:START},notes,reminderAt:null,reminderEnabled:false,completedDates:[],archived:false,createdAt:NOW,activatedAt:NOW,xp:25,checklist:[]});
    const workoutTasks=[
      baseTask("workout_push_prone_t_raise","Prone T Raise — 2 sets × 12–15 reps · Rest 30–45 sec",pushId,"06:05",[1,4],5,"PUSH · 2 sets × 12–15 reps · Rest 30–45 sec"),
      baseTask("workout_push_push_up","Push-up (Chống đẩy) — 3 sets × 8–15 reps · Rest 60–75 sec",pushId,"06:05",[1,4],8,"PUSH · 3 sets × 8–15 reps · Rest 60–75 sec"),
      baseTask("workout_push_leg_raise","Leg Raise (Nâng chân) — 2 sets × 8–12 reps · Rest 45 sec",pushId,"06:05",[1,4],5,"PUSH · 2 sets × 8–12 reps · Rest 45 sec"),
      baseTask("workout_push_plank","Plank — 2 sets × 30–45 sec · Rest 45 sec",pushId,"06:05",[1,4],5,"PUSH · 2 sets × 30–45 sec · Rest 45 sec"),
      baseTask("workout_push_chin_tuck","Chin Tuck — 2 sets × 10 reps · Hold 3–5 sec each · Rest 30 sec",pushId,"06:05",[1,4],5,"PUSH · 2 sets × 10 reps · Hold 3–5 sec each · Rest 30 sec"),
      baseTask("workout_push_stretch","Stretch — 4–5 min" ,pushId,"06:05",[1,4],5,"PUSH · Stretch for 4–5 minutes"),
      baseTask("workout_push_running","Running — 15–18 min",pushId,"18:00",[1,4],18,"PUSH · Run for 15–18 minutes"),
      baseTask("workout_pull_scapular_pullup","Scapular Pull-up — 2 sets × 8–12 reps · Rest 45 sec",pullId,"06:05",[2,5],5,"PULL · 2 sets × 8–12 reps · Rest 45 sec"),
      baseTask("workout_pull_chin_up","Chin-up (Hít xà ngửa tay) — 3 sets × 4–8 reps · Rest 75–90 sec",pullId,"06:05",[2,5],8,"PULL · 3 sets × 4–8 reps · Rest 75–90 sec"),
      baseTask("workout_pull_crunch","Crunch (Gập bụng) — 2 sets × 12–15 reps · Rest 30–45 sec",pullId,"06:05",[2,5],5,"PULL · 2 sets × 12–15 reps · Rest 30–45 sec"),
      baseTask("workout_pull_dead_hang","Dead Hang (Treo xà) — 3 sets × 20–30 sec · Rest 45–60 sec",pullId,"06:05",[2,5],5,"PULL · 3 sets × 20–30 sec · Rest 45–60 sec"),
      baseTask("workout_pull_stretch","Stretch — 5 min",pullId,"06:05",[2,5],5,"PULL · Stretch for 5 minutes"),
      baseTask("workout_legs_squat","Squat — 3 sets × 10–15 reps · Rest 60–75 sec",legsId,"06:05",[3,6],8,"LEGS · 3 sets × 10–15 reps · Rest 60–75 sec"),
      baseTask("workout_legs_lunge","Lunge — 2 sets × 8–12 reps per leg · Rest 60–75 sec",legsId,"06:05",[3,6],8,"LEGS · 2 sets × 8–12 reps per leg · Rest 60–75 sec"),
      baseTask("workout_legs_glute_bridge","Glute Bridge — 2 sets × 12–15 reps · Rest 45–60 sec",legsId,"06:05",[3,6],5,"LEGS · 2 sets × 12–15 reps · Rest 45–60 sec"),
      baseTask("workout_legs_calf_raise","Calf Raise (Nhón gót) — 2 sets × 15–20 reps · Rest 45 sec",legsId,"06:05",[3,6],5,"LEGS · 2 sets × 15–20 reps · Rest 45 sec"),
      baseTask("workout_legs_russian_twist","Russian Twist — 2 sets × 16–20 reps · Rest 30–45 sec",legsId,"06:05",[3,6],5,"LEGS · 2 sets × 16–20 reps · Rest 30–45 sec"),
      baseTask("workout_legs_stretch","Stretch — 4–5 min",legsId,"06:05",[3,6],5,"LEGS · Stretch for 4–5 minutes"),
      baseTask("workout_legs_running","Running — 15 min",legsId,"18:00",[3,6],15,"LEGS · Run for 15 minutes")
    ];
    const existingTaskIds=new Set(s.tasks.map(x=>String(x.id))); for(const wt of workoutTasks){const ex=s.tasks.find(x=>String(x.id)===String(wt.id)); if(ex){ex.title=wt.title;} else {s.tasks.push(wt);}}
    const fresh=Number(s.profile.xp)===0&&Number(s.profile.level)===1&&Number(s.profile.points)===0&&Number(s.profile.coins)===0&&Object.values(s.profile.attributes||{}).every(v=>Number(v)===1);
    if(fresh && s.habits.length===0){
      const currentHabits=[
        {bestStreak:0,completions:[],createdAt:1791035311578,frequency:"daily",id:"habit_musg6j16_i8u7su",streak:0,title:"Uống 6 cốc nước",weekdays:[],xp:20},
        {bestStreak:0,completions:[],createdAt:1791035316050,frequency:"daily",id:"habit_musg6mhe_0pr8qm",streak:0,title:"Ngủ trước 9h15",weekdays:[],xp:20},
        {bestStreak:0,completions:[],createdAt:1791035319915,frequency:"daily",id:"habit_musg6pgq_wwhzu5",streak:0,title:"Dậy lúc 6h",weekdays:[],xp:20},
        {bestStreak:0,completions:[],createdAt:1791035518838,frequency:"daily",id:"habit_musgayye_lab2er",streak:0,title:"Uống đủ thuốc, canxi,....",weekdays:[],xp:20},
        {bestStreak:0,completions:[],createdAt:1791035526584,frequency:"daily",id:"habit_musgb4xk_5tf652",streak:0,title:"Dọn phòng khi thức dậy",weekdays:[],xp:20}
      ];
      const currentGoals=[
        {createdAt:1791035596301,currentStreak:3,description:"",id:"goal_musgcmq5_vqm453",progress:0,progressPct:0,scope:"all",target:50,title:"50 Ngày thay đổi"},
        {createdAt:1791035610818,currentStreak:3,description:"",id:"goal_musgcxxe_6h1x3b",progress:0,progressPct:0,scope:"all",target:365,title:"1 Năm kỉ luật"}
      ];
      const merge=(arr,items)=>{const ids=new Set(arr.map(x=>String(x.id)));for(const x of items)if(!ids.has(String(x.id)))arr.push(x);};
      merge(s.habits,currentHabits); merge(s.goals,currentGoals);
      s.profile.character={class:"Operator",title:"Discipline protocol",hp:100,maxHp:100};
      s.dataMeta.revision=1791035610819; s.dataMeta.updatedAt=1791035610818; s.dataMeta.deviceId=String(s.dataMeta.deviceId||"device_museh37s_xci51u");
    }
    s.dataMeta.workoutScheduleVersion=1;
  }
  delete s.rewards;delete s.profile.rewardHistory;delete s.rewardShop;delete s.profile.rewards;delete s.profile.gems;
}
function eligibleTask(t,k){if(t.archived)return false;const r=t.repeat?.type||"none";if(r==="daily")return !t.repeat.startDate||k>=t.repeat.startDate;if(r==="weekly")return (!t.repeat.startDate||k>=t.repeat.startDate)&&(t.repeat.weekdays||[]).map(Number).includes(weekday(k));return !!t.dueDate&&t.dueDate===k;}
function plannedTasks(s,k){return s.tasks.filter(t=>eligibleTask(t,k)).sort((a,b)=>((a.dueTime||"99:99").localeCompare(b.dueTime||"99:99")||priorityWeight(b.priority)-priorityWeight(a.priority)));}
function priorityWeight(p){return {urgent:4,high:3,medium:2,low:1}[p]||2;}
function completedTaskOn(t,k){return (t.completedDates||[]).includes(k);}
function completionDatesForScope(s,scope){const set=new Set();for(const c of s.completions){if(scope!=="all"&&c.kind!==scope)continue;if(c.date)set.add(c.date)}return set;}
function longestStreak(set){let best=0,run=0,prev=null;for(const k of [...set].sort()){run=prev&&shiftDate(prev,1)===k?run+1:1;best=Math.max(best,run);prev=k;}return best;}
function currentStreak(set,end=dateKey()){let n=0,k=end;while(set.has(k)){n++;k=shiftDate(k,-1)}return n;}
function syncGoals(s){for(const g of s.goals){const dates=completionDatesForScope(s,g.scope||"all");const streak=currentStreak(dates);g.currentStreak=streak;g.progress=Math.min(Math.max(1,Number(g.target)||30),streak);g.progressPct=Math.round(g.progress/g.target*100);}}
function recalcHabits(s){for(const h of s.habits){const set=new Set(h.completions||[]);h.streak=currentStreak(set);h.bestStreak=Math.max(Number(h.bestStreak)||0,longestStreak(set));}}
function recalcStudyStreak(s,end=dateKey()){
  const validKinds=new Set(["task","habit","focus"]);
  const activeDates=new Set((s.completions||[])
    .filter(c=>validKinds.has(String(c.kind||""))&&/^\d{4}-\d{2}-\d{2}$/.test(String(c.date||""))&&String(c.date)<=end)
    .map(c=>String(c.date)));
  for(const session of (s.workoutSessions||[])){
    if(session?.completed===true&&/^\d{4}-\d{2}-\d{2}$/.test(String(session.date||""))&&String(session.date)<=end)activeDates.add(String(session.date));
  }
  const anchor=activeDates.has(end)?end:shiftDate(end,-1);
  const current=currentStreak(activeDates,anchor);
  const previous=s.profile?.studyStreak||{};
  const lastActiveDate=[...activeDates].sort().at(-1)||"";
  s.profile.studyStreak={
    current,
    best:Math.max(Math.max(0,Number(previous.best)||0),longestStreak(activeDates)),
    lastActiveDate,
    activeToday:activeDates.has(end)
  };
}
function achievementCheck(s){
  const xp=Number(s.profile.xp)||0;
  const level=Number(s.profile.level)||1;
  const totalTasks=s.completions.filter(c=>c.kind==="task").length;
  const totalFocus=s.focusSessions.length;
  const totalHabits=s.completions.filter(c=>c.kind==="habit").length;
  const totalFocusMinutes=s.focusSessions.reduce((n,x)=>n+Math.max(0,Number(x.minutes)||0),0);
  const bestHabit=Math.max(0,...s.habits.map(h=>h.bestStreak||0));
  const daily=longestStreak(completionDatesForScope(s,"all"));
  const activeDays=new Set(s.completions.map(c=>c.date).filter(Boolean)).size;
  const maxDayActions=Math.max(0,...Array.from(new Set(s.completions.map(c=>c.date).filter(Boolean))).map(d=>s.completions.filter(c=>c.date===d).length));
  const dailyClaims=(s.profile.dailyQuestClaims||[]).length;
  const questClaims=Object.values(s.profile.questChains||{}).filter(q=>q&&q.claimed).length;
  const defs=[
    ["first","First Step","Complete your first action",s.completions.length>=1,25],
    ["task5","Task Spark","Complete 5 tasks",totalTasks>=5,25],
    ["task10","Task Starter","Complete 10 tasks",totalTasks>=10,50],
    ["task25","Task Builder","Complete 25 tasks",totalTasks>=25,75],
    ["task50","Task Machine","Complete 50 tasks",totalTasks>=50,125],
    ["task100","Task Master","Complete 100 tasks",totalTasks>=100,200],
    ["task250","Task Titan","Complete 250 tasks",totalTasks>=250,300],
    ["task500","Task Colossus","Complete 500 tasks",totalTasks>=500,400],
    ["task1000","Task Overlord","Complete 1,000 tasks",totalTasks>=1000,500],
    ["task2500","Task Sovereign","Complete 2,500 tasks",totalTasks>=2500,700],
    ["task5000","Task Dominion","Complete 5,000 tasks",totalTasks>=5000,850],
    ["task10000","Task Infinite","Complete 10,000 tasks",totalTasks>=10000,1000],
    ["focus5","Focus Spark","Complete 5 focus sessions",totalFocus>=5,25],
    ["focus10","Focus Starter","Complete 10 focus sessions",totalFocus>=10,50],
    ["focus25","Flow State","Complete 25 focus sessions",totalFocus>=25,75],
    ["focus50","Deep Worker","Complete 50 focus sessions",totalFocus>=50,125],
    ["focus100","Focus Master","Complete 100 focus sessions",totalFocus>=100,200],
    ["focus250","Deep Work Titan","Complete 250 focus sessions",totalFocus>=250,300],
    ["focus500","Focus Colossus","Complete 500 focus sessions",totalFocus>=500,400],
    ["focus1000","Focus Overlord","Complete 1,000 focus sessions",totalFocus>=1000,500],
    ["focus2500","Focus Sovereign","Complete 2,500 focus sessions",totalFocus>=2500,700],
    ["focus5000","Focus Dominion","Complete 5,000 focus sessions",totalFocus>=5000,850],
    ["focus10000","Focus Infinite","Complete 10,000 focus sessions",totalFocus>=10000,1000],
    ["habit5","Habit Spark","Complete 5 habit check-ins",totalHabits>=5,25],
    ["habit10","Habit Starter","Complete 10 habit check-ins",totalHabits>=10,50],
    ["habit25","Routine Builder","Complete 25 habit check-ins",totalHabits>=25,75],
    ["habit50","Routine Keeper","Complete 50 habit check-ins",totalHabits>=50,100],
    ["habit100","Routine Master","Complete 100 habit check-ins",totalHabits>=100,175],
    ["habit250","Habit Titan","Complete 250 habit check-ins",totalHabits>=250,300],
    ["habit500","Habit Colossus","Complete 500 habit check-ins",totalHabits>=500,400],
    ["habit1000","Habit Overlord","Complete 1,000 habit check-ins",totalHabits>=1000,500],
    ["habit2500","Habit Sovereign","Complete 2,500 habit check-ins",totalHabits>=2500,700],
    ["habit5000","Habit Dominion","Complete 5,000 habit check-ins",totalHabits>=5000,850],
    ["habit10000","Habit Infinite","Complete 10,000 habit check-ins",totalHabits>=10000,1000],
    ["focusmin300","Focus · 5 Hours","Accumulate 5 hours of focus time",totalFocusMinutes>=300,51],
    ["focusmin600","Focus · 10 Hours","Accumulate 10 hours of focus time",totalFocusMinutes>=600,52],
    ["focusmin1500","Focus · 25 Hours","Accumulate 25 hours of focus time",totalFocusMinutes>=1500,55],
    ["focusmin3000","Focus · 50 Hours","Accumulate 50 hours of focus time",totalFocusMinutes>=3000,60],
    ["focusmin6000","Focus · 100 Hours","Accumulate 100 hours of focus time",totalFocusMinutes>=6000,70],
    ["focusmin15000","Focus · 250 Hours","Accumulate 250 hours of focus time",totalFocusMinutes>=15000,100],
    ["focusmin30000","Focus · 500 Hours","Accumulate 500 hours of focus time",totalFocusMinutes>=30000,150],
    ["focusmin60000","Focus · 1,000 Hours","Accumulate 1,000 hours of focus time",totalFocusMinutes>=60000,250],
    ["focusmin120000","Focus · 2,000 Hours","Accumulate 2,000 hours of focus time",totalFocusMinutes>=120000,450],
    ["streak7","Steel Week","Reach a 7-day activity streak",daily>=7,78],
    ["streak14","Two-Week Iron","Reach a 14-day activity streak",daily>=14,82],
    ["streak30","Unbreakable","Reach a 30-day activity streak",daily>=30,90],
    ["streak60","Iron Quarter","Reach a 60-day activity streak",daily>=60,105],
    ["streak100","Century Streak","Reach a 100-day activity streak",daily>=100,125],
    ["streak180","Half-Year Discipline","Reach a 180-day activity streak",daily>=180,165],
    ["streak365","Year of Ascension","Reach a 365-day activity streak",daily>=365,257],
    ["streak730","Two-Year Ascension","Reach a 730-day activity streak",daily>=730,440],
    ["streak1000","Millennium Streak","Reach a 1000-day activity streak",daily>=1000,575],
    ["habitstreak7","Habit Flame","Reach a 7-day streak on any habit",bestHabit>=7,78],
    ["habitstreak14","Habit Forge","Reach a 14-day streak on any habit",bestHabit>=14,82],
    ["habitstreak30","Habit Citadel","Reach a 30-day streak on any habit",bestHabit>=30,90],
    ["habitstreak60","Habit Fortress","Reach a 60-day streak on any habit",bestHabit>=60,105],
    ["habitstreak100","Habit Century","Reach a 100-day streak on any habit",bestHabit>=100,125],
    ["habitstreak180","Habit Dynasty","Reach a 180-day streak on any habit",bestHabit>=180,165],
    ["habitstreak365","Habit Eternal","Reach a 365-day streak on any habit",bestHabit>=365,257],
    ["xp1000","XP · 1,000","Earn 1,000 total XP",xp>=1000,75],
    ["xp5000","XP · 5,000","Earn 5,000 total XP",xp>=5000,75],
    ["xp10000","XP · 10,000","Earn 10,000 total XP",xp>=10000,76],
    ["xp25000","XP · 25,000","Earn 25,000 total XP",xp>=25000,77],
    ["xp50000","XP · 50,000","Earn 50,000 total XP",xp>=50000,80],
    ["xp100000","XP · 100,000","Earn 100,000 total XP",xp>=100000,85],
    ["xp250000","XP · 250,000","Earn 250,000 total XP",xp>=250000,100],
    ["xp500000","XP · 500,000","Earn 500,000 total XP",xp>=500000,125],
    ["xp1000000","XP · 1,000,000","Earn 1,000,000 total XP",xp>=1000000,175],
    ["xp2500000","XP · 2,500,000","Earn 2,500,000 total XP",xp>=2500000,325],
    ["xp5000000","XP · 5,000,000","Earn 5,000,000 total XP",xp>=5000000,575],
    ["activedays7","Active · 7 Days","Complete at least one action on 7 different days",activeDays>=7,76],
    ["activedays30","Active · 30 Days","Complete at least one action on 30 different days",activeDays>=30,81],
    ["activedays60","Active · 60 Days","Complete at least one action on 60 different days",activeDays>=60,87],
    ["activedays100","Active · 100 Days","Complete at least one action on 100 different days",activeDays>=100,95],
    ["activedays180","Active · 180 Days","Complete at least one action on 180 different days",activeDays>=180,111],
    ["activedays365","Active · 365 Days","Complete at least one action on 365 different days",activeDays>=365,148],
    ["activedays730","Active · 730 Days","Complete at least one action on 730 different days",activeDays>=730,221],
    ["activedays1000","Active · 1000 Days","Complete at least one action on 1,000 different days",activeDays>=1000,275],
    ["activedays2000","Active · 2000 Days","Complete at least one action on 2,000 different days",activeDays>=2000,475],
    ["dayactions5","Daybreaker · 5","Complete 5 actions in a single day",maxDayActions>=5,125],
    ["dayactions10","Daybreaker · 10","Complete 10 actions in a single day",maxDayActions>=10,175],
    ["dayactions15","Daybreaker · 15","Complete 15 actions in a single day",maxDayActions>=15,225],
    ["dayactions20","Daybreaker · 20","Complete 20 actions in a single day",maxDayActions>=20,275],
    ["dayactions25","Daybreaker · 25","Complete 25 actions in a single day",maxDayActions>=25,325],
    ["dayactions50","Daybreaker · 50","Complete 50 actions in a single day",maxDayActions>=50,575],
    ["dailyquest1","Daily Protocol · 1","Claim the Daily Quest 1 times",dailyClaims>=1,50],
    ["dailyquest7","Daily Protocol · 7","Claim the Daily Quest 7 times",dailyClaims>=7,53],
    ["dailyquest30","Daily Protocol · 30","Claim the Daily Quest 30 times",dailyClaims>=30,65],
    ["dailyquest100","Daily Protocol · 100","Claim the Daily Quest 100 times",dailyClaims>=100,100],
    ["dailyquest365","Daily Protocol · 365","Claim the Daily Quest 365 times",dailyClaims>=365,232],
    ["dailyquest1000","Daily Protocol · 1000","Claim the Daily Quest 1,000 times",dailyClaims>=1000,550],
    ["questclaims1","Quest Hunter · 1","Claim 1 Long-Term Quest tiers",questClaims>=1,80],
    ["questclaims5","Quest Hunter · 5","Claim 5 Long-Term Quest tiers",questClaims>=5,100],
    ["questclaims10","Quest Hunter · 10","Claim 10 Long-Term Quest tiers",questClaims>=10,125],
    ["questclaims20","Quest Hunter · 20","Claim 20 Long-Term Quest tiers",questClaims>=20,175],
    ["questclaims31","Quest Hunter · 31","Claim 31 Long-Term Quest tiers",questClaims>=31,230],
    ["questclaims50","Quest Hunter · 50","Claim 50 Long-Term Quest tiers",questClaims>=50,325],
    ["level5","Level 5","Reach Level 5",level>=5,50],
    ["level10","Level 10","Reach Level 10",level>=10,51],
    ["level20","Level 20","Reach Level 20",level>=20,52],
    ["level25","Level 25","Reach Level 25",level>=25,52],
    ["level50","Level 50","Reach Level 50",level>=50,55],
    ["level75","Level 75","Reach Level 75",level>=75,57],
    ["level100","Level 100","Reach Level 100",level>=100,60],
    ["level150","Level 150","Reach Level 150",level>=150,65],
    ["level200","Level 200","Reach Level 200",level>=200,70],
    ["level300","Level 300","Reach Level 300",level>=300,80],
    ["level500","Level 500","Reach Level 500",level>=500,100],
    ["level750","Level 750","Reach Level 750",level>=750,125],
    ["level1000","Level 1,000","Reach Level 1,000",level>=1000,150],
    ["level1500","Level 1,500","Reach Level 1,500",level>=1500,200],
    ["level2000","Level 2,000","Reach Level 2,000",level>=2000,250],
    ["level3000","Level 3,000","Reach Level 3,000",level>=3000,350],
    ["level5000","Level 5,000","Reach Level 5,000",level>=5000,550],
    ["level7500","Level 7,500","Reach Level 7,500",level>=7500,800],
    ["level10000","Level 10,000","Reach Level 10,000",level>=10000,1000],
  ];
  for(const d of defs){
    const existing=s.achievements.find(a=>a.id===d[0]);
    if(existing){existing.title=d[1];existing.description=d[2];continue;}
    if(!d[3])continue;
    const rewardKey=`achievement:${d[0]}`;
    const r=awardOnce(s,rewardKey,d[4],`Achievement · ${d[1]}`);
    if(r.awarded){
      s.achievements.push({id:d[0],title:d[1],description:d[2],earnedAt:Date.now(),xpReward:r.xpAwarded,baseXpReward:d[4],streak:Number(r.streak||1),streakMultiplier:Number(r.levelMultiplier||1),coinReward:Number(r.coinAwarded||0)});
      s.profile.coins=Math.max(0,Number(s.profile.coins)||0)+Number(r.coinAwarded||0);
    }
  }
}
function recalcDerived(s){recalcHabits(s);recalcStudyStreak(s);syncGoals(s);achievementCheck(s);}
let bootstrapPromise=null;
function emptyStateSeed(){
  const now=Date.now();
  return {
    ...DEFAULT_STATE,
    schemaVersion:VERSION,
    settings:{...DEFAULT_SETTINGS,focusWidgetPosition:{...DEFAULT_SETTINGS.focusWidgetPosition}},
    profile:{...DEFAULT_PROFILE,createdAt:now,attributes:{...START_ATTRIBUTES},character:{...DEFAULT_PROFILE.character},xpHistory:[],levelHistory:[],xpAwards:[],dailyQuestClaims:[],questClaims:[],questChains:{},milestoneClaims:[],loginCoinClaims:[],pointsHistory:[],statTitleHistory:[],achievements:[],questProgress:{task:0,focus:0,habit:0}},
    lists:DEFAULT_LISTS.map(x=>({...x,createdAt:now})),tasks:[],habits:[],challenges:[],goals:[],focusSessions:[],completions:[],achievements:[],reviews:[],motivationVideos:[],workoutSessions:[],
    focusPresence:{active:false,lastHeartbeat:0,startedAt:0},focusEngine:{...DEFAULT_STATE.focusEngine},workoutEngine:{...DEFAULT_STATE.workoutEngine,taskIds:[]},dataMeta:{revision:0,updatedAt:0,deviceId:""}
  };
}
async function getState(){
  // Existing installs can read their persisted state immediately instead of
  // waiting for every optional background bootstrap task to finish. This keeps
  // the dashboard from failing to boot if an alarm/widget sync is slow.
  let raw=await chrome.storage.local.get(null);
  let hasState=!!(raw&&((raw.schemaVersion!==undefined)||raw.profile||Array.isArray(raw.tasks)||Array.isArray(raw.habits)));
  // A fresh install still waits for the one-time seed, then rereads storage.
  if(!hasState&&bootstrapPromise){
    await bootstrapPromise;
    raw=await chrome.storage.local.get(null);
    hasState=!!(raw&&((raw.schemaVersion!==undefined)||raw.profile||Array.isArray(raw.tasks)||Array.isArray(raw.habits)));
  }
  const s=normalize(hasState?raw:emptyStateSeed());
  if(!hasState){
    await chrome.storage.local.set(s);
    try{await scheduleAlarms(s);}catch(e){console.warn("Initial alarm scheduling",e);}
  }
  if(registerLogin(s))await chrome.storage.local.set({profile:s.profile});
  return s;
}

// Itsuki expression system: image + expression label + English study/sleep line are written
// as one storage record. The catalog is strictly local and only includes verified files.
const ITSUKI_LOCAL_CATALOG_PATH = 'assets/itsuki/expressions.json';
let itsukiCatalogPromise = null;
let itsukiExpressionQueue = Promise.resolve();
const ITSUKI_EVENT_PROFILE = {
  'widget-open': {moods:['cheerful','supportive','confident'],kind:'encouragement'},
  'click': {moods:['cheerful','supportive','thoughtful'],kind:'encouragement'},
  'tab-change': {moods:['supportive','thoughtful','determined'],kind:'encouragement'},
  'focus-start': {moods:['determined','supportive'],kind:'focus'},
  'focus-pause': {moods:['relaxed','supportive'],kind:'pause'},
  'focus-resume': {moods:['determined','supportive'],kind:'focus'},
  'focus-stop': {moods:['supportive','thoughtful'],kind:'encouragement'},
  'break-start': {moods:['relaxed','supportive'],kind:'break'},
  'break-end': {moods:['determined','supportive'],kind:'focus'},
  'focus-complete': {moods:['cheerful','supportive','confident'],kind:'encouragement'},
  'focus-reminder': {moods:['supportive','determined'],kind:'focus'},
  'idle-reminder': {moods:['supportive','thoughtful'],kind:'encouragement'},
  'distraction': {moods:['supportive','thoughtful'],kind:'focus'},
  'water': {moods:['supportive','relaxed'],kind:'focus'},
  'return': {moods:['cheerful','supportive','thoughtful'],kind:'encouragement'},
  'wind-down': {moods:['relaxed','supportive'],kind:'wind-down'},
  'sleep': {moods:['relaxed','supportive'],kind:'sleep'},
  'periodic': {moods:[],kind:'encouragement'}
};
function itsukiExpressionTone(item){
  const e=String(item?.primaryExpression||'').toLowerCase();
  if(['cheerful','confident','supportive'].includes(e))return 'bright';
  if(['serious','determined','displeased','angry'].includes(e))return 'stern';
  if(['surprised','shy'].includes(e))return 'flustered';
  return 'gentle';
}

async function loadItsukiLocalCatalog(){
  if(itsukiCatalogPromise)return itsukiCatalogPromise;
  itsukiCatalogPromise=(async()=>{
    const fallback={id:'itsuki-chibi-fallback',src:'assets/itsuki/itsuki-pet.png',primaryExpression:'cheerful',expressions:['cheerful','supportive'],dialogue:'Từng việc một thôi nhé. Bước nhỏ cũng đưa cậu tiến lên.'};
    let raw=[];
    try{
      const response=await fetch(chrome.runtime.getURL(ITSUKI_LOCAL_CATALOG_PATH),{cache:'force-cache'});
      if(response.ok){const data=await response.json();raw=Array.isArray(data?.images)?data.images:[];}
    }catch{}
    const valid=[],seen=new Set();
    for(const item of raw){
      const id=String(item?.id||'').trim(),src=String(item?.src||'').trim();
      // The chibi fallback is only used if all 30 numbered portraits fail validation.
      if(id==='itsuki-chibi-fallback')continue;
      if(!id||seen.has(id)||!src.startsWith('assets/itsuki/')||src.includes('..'))continue;
      seen.add(id);
      try{
        const response=await fetch(chrome.runtime.getURL(src),{cache:'force-cache'});
        const type=String(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
        if(!response.ok||!type.startsWith('image/'))continue;
        const blob=await response.blob();if(blob.size<1024||blob.size>5000000)continue;
        const expressions=Array.isArray(item.expressions)?item.expressions.map(x=>String(x)):[];
        valid.push({id,src,primaryExpression:String(item.primaryExpression||expressions[0]||'supportive'),expressions,dialogue:String(item.dialogue||'Từng việc một thôi nhé. Bước nhỏ cũng đưa cậu tiến lên.')});
      }catch{}
    }
    if(!valid.length){
      // Keep a single verified extension-local fallback path; never try online URLs.
      try{
        const response=await fetch(chrome.runtime.getURL(fallback.src),{cache:'force-cache'});
        if(response.ok&&String(response.headers.get('content-type')||'').toLowerCase().startsWith('image/'))valid.push(fallback);
      }catch{}
    }
    return valid;
  })().catch(()=>[]);
  return itsukiCatalogPromise;
}
const ITSUKI_STUDY_LINES=[
  "Choose one clear task and begin with its first small step.",
  "Stay with the task in front of you. You are making steady progress.",
  "Take a calm breath, open your notes, and start where you left off.",
  "One focused step is enough to get moving.",
  "Keep your attention on the task you chose. You can do this.",
  "Make the next step clear, then give it your full attention.",
  "Progress grows one small action at a time.",
  "Take your time and return to the work when you are ready."
];
const ITSUKI_WIND_DOWN_LINES=[
  "Wind down now. Close distractions and give yourself time to rest.",
  "Ease into the evening. Put work aside and prepare for sleep.",
  "A steady day ends with a quiet wind-down."
];
const ITSUKI_SLEEP_LINES=[
  "Your day is complete. Put your devices away and get ready for sleep.",
  "Close your screens and let yourself rest. Tomorrow can wait.",
  "You have done enough for today. Let your mind settle and rest."
];
function itsukiTimeBand(now=new Date()){
  const minute=now.getHours()*60+now.getMinutes();
  if(minute>=1260||minute<330)return {kind:'sleep',interval:1440,lines:ITSUKI_SLEEP_LINES};
  if(minute>=1245&&minute<1260)return {kind:'wind-down',interval:15,lines:ITSUKI_WIND_DOWN_LINES};
  return {kind:'focus',interval:12,lines:ITSUKI_STUDY_LINES};
}
async function nextItsukiTimedLine(){
  const band=itsukiTimeBand(),stored=await chrome.storage.local.get(['itsukiTimedDialogueHistory','itsukiTimedDialogueCursor']);
  const history=Array.isArray(stored.itsukiTimedDialogueHistory)?stored.itsukiTimedDialogueHistory:[],cursor=Math.max(0,Number(stored.itsukiTimedDialogueCursor)||0);
  let candidates=band.lines.filter(line=>!history.slice(-3).includes(line));if(!candidates.length)candidates=band.lines;
  const line=candidates[cursor%candidates.length];
  await chrome.storage.local.set({itsukiTimedDialogueHistory:[...history,line].slice(-8),itsukiTimedDialogueCursor:cursor+1});
  return line;
}
function nextItsukiRotationDelay(now=Date.now()){
  const date=new Date(now),band=itsukiTimeBand(date),minute=date.getHours()*60+date.getMinutes(),boundaries=[330,1245,1260];
  let minutesToBoundary=Infinity;
  for(const boundary of boundaries){let delta=boundary-minute;if(delta<=0)delta+=1440;minutesToBoundary=Math.min(minutesToBoundary,delta);}
  return Math.max(30*1000,Math.min(band.interval,minutesToBoundary)*60*1000);
}
async function commitItsukiExpression(eventName,messageOverride=""){
  const event=Object.prototype.hasOwnProperty.call(ITSUKI_EVENT_PROFILE,eventName)?eventName:'idle-reminder';
  const now=Date.now();
  const stored=await chrome.storage.local.get(['itsukiExpressionState','itsukiRecentImageIds','itsukiRecentDialogueLines','itsukiLastWaterReminderAt','itsukiImageCursor','itsukiDialogueRotation']);
  const previous=stored.itsukiExpressionState||{};
  const lastAt=Number(previous.updatedAt)||0;
  const repeatMs=event==='periodic'?140000:event==='widget-open'?8000:event==='focus-reminder'?120000:0;
  if(Number(previous.schemaVersion)>=11&&previous.event===event&&repeatMs&&now-lastAt<repeatMs)return {ok:true,state:previous,unchanged:true,imageChanged:false};
  // Debounce duplicate focus events sent by multiple injected tabs, but never
  // debounce an explicit click or a real tab switch: those must change the art.
  if(Number(previous.schemaVersion)>=11&&!['click','periodic','tab-change'].includes(event)&&previous.event===event&&now-lastAt<9000)return {ok:true,state:previous,unchanged:true,imageChanged:false};
  const catalog=await loadItsukiLocalCatalog();
  if(!catalog.length){
    return {ok:false,error:'No valid local companion images are packaged in the extension.'};
  }
  const profile=ITSUKI_EVENT_PROFILE[event]||ITSUKI_EVENT_PROFILE.periodic;
  // One circular cursor is shared by timed rotation and event reactions. Timed
  // rotation walks all 30 portraits in order; contextual events scan forward to
  // the next portrait whose expression suits the event, keeping art and tone aligned.
  const lastId=String(previous.imageId||'');
  let cursor=Math.max(0,Number(stored.itsukiImageCursor)||0)%catalog.length;
  let chosenIndex=cursor;
  if(event!=='periodic'&&Array.isArray(profile.moods)&&profile.moods.length){
    for(let offset=0;offset<catalog.length;offset++){
      const i=(cursor+offset)%catalog.length, item=catalog[i];
      const expressions=Array.isArray(item.expressions)?item.expressions:[];
      if(profile.moods.some(mood=>String(item.primaryExpression||'')===mood)){chosenIndex=i;break;}
    }
  }
  const chosen=catalog[chosenIndex]||catalog[0];
  cursor=(chosenIndex+1)%catalog.length;
  const lineHistory=Array.isArray(stored.itsukiRecentDialogueLines)?stored.itsukiRecentDialogueLines:[];
  const timeBand=itsukiTimeBand(new Date(now));
  const message=await nextItsukiTimedLine();
  const context=['wind-down','sleep'].includes(event)?event:timeBand.kind;
  const revision=Math.max(Number(previous.revision)||0,now)+1;
  const state={schemaVersion:11,revision,event,kind:profile.kind,context,imageId:chosen.id,imageSrc:chosen.src,expression:chosen.primaryExpression,message,updatedAt:now,imageChanged:chosen.id!==lastId};
  const recentImages=Array.isArray(stored.itsukiRecentImageIds)?stored.itsukiRecentImageIds:[];
  const nextImages=[...recentImages.filter(id=>id!==chosen.id),chosen.id].slice(-29);
  const nextLines=[...lineHistory.filter(line=>line!==message),message].slice(-12);
  const setData={itsukiExpressionState:state,itsukiRecentImageIds:nextImages,itsukiRecentDialogueLines:nextLines,itsukiImageCursor:cursor};
  if(event==='water')setData.itsukiLastWaterReminderAt=now;
  await chrome.storage.local.set(setData);
  return {ok:true,state,unchanged:false,imageChanged:state.imageChanged,availableImages:catalog.length};
}
function requestItsukiExpression(eventName,messageOverride=""){
  const task=itsukiExpressionQueue.then(()=>commitItsukiExpression(eventName,messageOverride),()=>commitItsukiExpression(eventName,messageOverride));
  itsukiExpressionQueue=task.catch(()=>{});
  return task;
}
function blockedDomainMatches(url,domains){
  try{
    const host=new URL(String(url||'')).hostname.toLowerCase().replace(/^www\./,'');
    return (Array.isArray(domains)?domains:[]).some(value=>{
      const d=normalizeBlockedDomain(value).replace(/^www\./,'');
      return d&&(host===d||host.endsWith('.'+d));
    });
  }catch{return false;}
}
async function maybeWarnForConfiguredBlockedTab(tabId){
  try{
    const s=await getState(),f=s.focusEngine||{};
    if(!f.active||f.phase!=='focus'||s.settings?.focusWidgetEnabled===false||s.settings?.itsukiCompanionEnabled===false||s.settings?.privacyMode===true)return;
    const tab=await chrome.tabs.get(tabId);
    const url=tab?.url||tab?.pendingUrl||'';
    // Warn only for the user's configured blocked-domain list; do not guess that
    // an unfamiliar or education-related site is distracting.
    if(blockedDomainMatches(url,s.settings?.blockedWebsites))await requestItsukiExpression('distraction');
  }catch{}
}
chrome.tabs.onActivated?.addListener(info=>{
  if(info?.tabId==null)return;
  (async()=>{
    try{
      const [s,tab]=await Promise.all([getState(),chrome.tabs.get(info.tabId)]);
      if(s.settings?.focusWidgetEnabled===false||s.settings?.itsukiCompanionEnabled===false||s.settings?.privacyMode===true)return;
      const url=String(tab?.url||tab?.pendingUrl||'');
      if(!/^https?:$/i.test(url.split('/')[0]))return;
      const f=s.focusEngine||{};
      const isConfiguredDistraction=!!f.active&&f.phase==='focus'&&blockedDomainMatches(url,s.settings?.blockedWebsites);
      await requestItsukiExpression(isConfiguredDistraction?'distraction':'tab-change');
    }catch{}
  })();
});
chrome.tabs.onUpdated?.addListener((tabId,changeInfo,tab)=>{
  if(tab?.active&&(changeInfo?.url||changeInfo?.status==='complete'))maybeWarnForConfiguredBlockedTab(tabId);
});
try{chrome.idle.setDetectionInterval(60);}catch{}
chrome.idle?.onStateChanged?.addListener(async state=>{
  try{
    if(state==='idle'||state==='locked'){
      await chrome.storage.local.set({itsukiInactiveSince:Date.now()});
      return;
    }
    if(state==='active'){
      const data=await chrome.storage.local.get(['itsukiInactiveSince','itsukiComputerActiveSince']);
      const inactiveSince=Number(data.itsukiInactiveSince)||0;
      await chrome.storage.local.set({itsukiComputerActiveSince:Date.now()});
      await chrome.storage.local.remove('itsukiInactiveSince');
      if(inactiveSince&&Date.now()-inactiveSince>=5*60*1000)await requestItsukiExpression('return');
    }
  }catch{}
});

async function save(s,opts={}){
  recalcDerived(s);
  s.dataMeta=s.dataMeta||{};
  s.dataMeta.deviceId=String(s.dataMeta.deviceId||uid("device"));
  if(opts.increment!==false){
    s.dataMeta.revision=Math.max(Date.now(),Number(s.dataMeta.revision)||0)+1;
    s.dataMeta.updatedAt=Date.now();
  }
  await chrome.storage.local.set(s);
  await chrome.storage.local.remove("discipline").catch(()=>{});
  try{await scheduleUtilityAlarms(s)}catch(e){console.warn("utility alarms",e)}
}
function openBackupHandleDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open("ascended-backup",1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("handles"))r.result.createObjectStore("handles")};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error("Unable to open backup storage"));});}
async function getBackupDirectoryHandle(){try{const db=await openBackupHandleDB();return await new Promise((resolve,reject)=>{const tx=db.transaction("handles","readonly"),req=tx.objectStore("handles").get("directory");req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error("Unable to read backup folder"));});}catch(e){console.warn("backup handle",e);return null}}
async function saveBackupDirectoryHandle(handle){const db=await openBackupHandleDB();return await new Promise((resolve,reject)=>{const tx=db.transaction("handles","readwrite");tx.objectStore("handles").put(handle,"directory");tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error("Unable to save backup folder"));});}
async function writeBackupToDirectory(s,payload){const dir=await getBackupDirectoryHandle();if(!dir)return false;try{const permission=await dir.queryPermission?.({mode:"readwrite"});if(permission!=="granted")return false;const file=await dir.getFileHandle(BACKUP_FILE_NAME,{create:true});const writable=await file.createWritable();await writable.write(payload);await writable.close();return true;}catch(e){console.warn("direct backup",e);return false;}}
async function downloadBackup(s){
  const backupState={...s}; delete backupState.itsukiPasswordRecord;
  const payload=JSON.stringify({...backupState,backupMeta:{formatVersion:1,appVersion:"16.16.22",createdAt:Date.now()}},null,2);
  const direct=await writeBackupToDirectory(s,payload);
  if(direct){await chrome.storage.local.set({backupMeta:{filename:BACKUP_FILE_NAME,lastBackupAt:Date.now(),lastDownloadId:null,location:"selected-folder",revision:Number(s.dataMeta?.revision)||0}});return "selected-folder";}
  const url=`data:application/json;charset=utf-8,${encodeURIComponent(payload)}`;
  const id=await chrome.downloads.download({url,filename:AUTO_BACKUP_FILENAME,saveAs:false,conflictAction:"overwrite"});
  await chrome.storage.local.set({backupMeta:{filename:AUTO_BACKUP_FILENAME,lastBackupAt:Date.now(),lastDownloadId:id,location:"downloads-fallback",revision:Number(s.dataMeta?.revision)||0}});
  return id;
}
// v29: Challenges feature removed. Keep Tasks/Habits/Goals intact, clear legacy challenge data.
function removeLegacyChallenges(s){ s.challenges=[]; s.completions=(s.completions||[]).filter(c=>c.kind!=="challenge"); return s; }
function taskXP(t){ return 50; }
function habitXP(h){ return 30; }
function focusXP(minutes){ return 60; }
function coinsFromXP(xp){ return Math.floor(Math.max(0,Number(xp)||0)/10); }
function activityStreakForDay(s,day=dateKey()){
  const dates=completionDatesForScope(s,"all");
  dates.add(day);
  return currentStreak(dates,day);
}
function streakRecoveryCost(lostStreak){
  const n=Math.max(1,Math.floor(Number(lostStreak)||1));
  return Math.min(500,30+(n-1)*5);
}
function legacyAwarded(s,kind,title,date){const label={task:"Task",habit:"Habit",challenge:"Challenge"}[kind];return !!label&&s.profile.xpHistory.some(x=>x.date===date&&x.reason===`${label} · ${title}`&&Number(x.amount)>0);}
function awardOnce(s,key,amount,reason,legacy,streakOverride){
  return {awarded:false,xpAwarded:0,baseAmount:0,streak:1,levelMultiplier:1,leveledUp:false,level:1,levelPoints:0,coinAwarded:0,milestoneCoins:0};
}
const LONG_TERM_START_TIER=20;
const LONG_TERM_MAX_TIER=50;
function questChains(s){
  const progress=s.profile.questProgress||{task:0,focus:0,habit:0};
  const defs={task:{title:"Task Hunter",stepReward:25,label:"tasks"},focus:{title:"Deep Work",stepReward:30,label:"focus sessions"},habit:{title:"Routine",stepReward:15,label:"habit check-ins"}};
  return Object.entries(defs).map(([kind,d])=>{
    let tier=LONG_TERM_START_TIER;
    while(tier<LONG_TERM_MAX_TIER&&s.profile.questChains?.[`${kind}-chain-${tier}`]?.claimed)tier++;
    const target=tier,reward=target*d.stepReward,id=`${kind}-chain-${tier}`,claimed=Boolean(s.profile.questChains?.[id]?.claimed),value=Math.max(0,Math.floor(Number(progress[kind])||0));
    return{id,kind,tier,title:d.title,description:`Complete ${target} ${d.label}`,value,target,reward,displayXp:scaledXP(reward,activityStreakForDay(s,dateKey())),coins:Math.floor(reward/10),claimed,maxed:tier===LONG_TERM_MAX_TIER&&claimed};
  });
}
function registerLogin(s){
  const day=dateKey(),last=String(s.profile.lastLoginDate||"");
  if(last===day)return false;
  s.profile.loginStreak=last&&last===shiftDate(day,-1)?Math.max(0,Number(s.profile.loginStreak)||0)+1:1;
  s.profile.lastLoginDate=day;
  if(!s.profile.loginCoinClaims.includes(day)){s.profile.loginCoinClaims.push(day);s.profile.xpHistory.push({id:uid("login"),amount:0,reason:`Login streak · Day ${s.profile.loginStreak}`,date:day,at:Date.now(),key:`login:${day}`,coins:0});}
  return true;
}
function dailyQuestState(s,day=dateKey()){
  const tasks=s.tasks.filter(t=>!t.archived&&((t.repeat?.type==="daily")||(t.repeat?.type==="weekly"&&t.repeat?.weekdays?.includes(weekday(day)))||t.dueDate===day));
  const taskDone=tasks.filter(t=>(t.completedDates||[]).includes(day)).length;
  const focus=s.focusSessions.filter(x=>x.date===day).length;
  const habits=s.habits.filter(h=>(h.completions||[]).includes(day)).length;
  const targetTasks=8,targetFocus=4,targetHabits=4;
  return {day,taskDone,focus,habits,targetTasks,targetFocus,targetHabits,complete:taskDone>=targetTasks&&focus>=targetFocus&&habits>=targetHabits};
}
function questProgress(s){return questChains(s).map(q=>({id:q.id,kind:q.kind,tier:q.tier,title:q.title,description:q.description,value:q.value,target:q.target,xp:q.displayXp,reward:q.reward,coins:Math.floor(q.displayXp/10),claimed:q.claimed,maxed:!!q.maxed}));}
function claimDailyQuest(s){
  const q=dailyQuestState(s,dateKey());
  if(s.profile.dailyQuestClaims.includes(q.day))throw Error("Daily quest already claimed");
  if(!q.complete)throw Error("Daily quest is not complete yet");
  s.profile.dailyQuestClaims.push(q.day);
  const r=awardOnce(s,`daily-quest:${q.day}`,200,"Daily Quest · System Protocol",undefined,activityStreakForDay(s,q.day));
  if(r.awarded) s.profile.coins=Math.max(0,Number(s.profile.coins)||0)+Number(r.coinAwarded||0);
  return r;
}
function claimQuest(s,id){
  const q=questProgress(s).find(x=>x.id===id);
  if(!q)throw Error("Quest not found");
  if(q.maxed)throw Error("Long-term Quest has reached the maximum Tier 50");
  if(q.claimed)throw Error("Quest already claimed");
  if(q.value<q.target)throw Error("Quest target not reached");
  const r=awardOnce(s,`quest:${id}`,q.reward,`Quest · ${q.title} · Tier ${q.tier}`,undefined,activityStreakForDay(s,dateKey()));
  if(r.awarded) s.profile.coins=Math.max(0,Number(s.profile.coins)||0)+Number(r.coinAwarded||0);
  s.profile.questChains[id]={claimed:true,claimedAt:Date.now(),target:q.target,reward:q.reward};
  s.profile.questProgress[q.kind]=0;
  return r;
}
function awardDailyConsistency(s,day){return {awarded:false,leveledUp:false,level:s.profile.level,levelPoints:0,coinAwarded:0};}
function normalizeWorkoutConfig(cfg){
  const c=cfg&&typeof cfg==="object"?cfg:{};const enabled=c.enabled===true;const mode=["reps","time","max","circuit"].includes(String(c.mode))?String(c.mode):"reps";
  const repsMin=Math.max(0,Math.floor(Number(c.repsMin)||8)),repsMax=Math.max(repsMin,Math.floor(Number(c.repsMax)||12));
  const base={enabled,mode,sets:Math.min(30,Math.max(1,Math.floor(Number(c.sets)||2))),repsMin,repsMax,durationSeconds:Math.min(7200,Math.max(1,Math.floor(Number(c.durationSeconds)||30))),restSeconds:Math.min(600,Math.max(0,Math.floor(Number(c.restSeconds)||60))),restBetweenRoundsSeconds:Math.min(600,Math.max(0,Math.floor(Number(c.restBetweenRoundsSeconds)||60))),circuitRounds:Math.min(30,Math.max(1,Math.floor(Number(c.circuitRounds)||2))),autoRest:c.autoRest!==false,countdown:c.countdown!==false,sound:c.sound!==false,circuit:[]};
  if(mode==="circuit")base.circuit=(Array.isArray(c.circuit)?c.circuit:[]).map((x,i)=>({id:String(x?.id||`cstep_${i}_${Date.now().toString(36)}`),title:String(x?.title||`Step ${i+1}`).trim()||`Step ${i+1}`,mode:["time","reps","max"].includes(String(x?.mode))?String(x.mode):"time",durationSeconds:Math.min(7200,Math.max(1,Math.floor(Number(x?.durationSeconds)||30))),repsMin:Math.max(0,Math.floor(Number(x?.repsMin)||0)),repsMax:Math.max(0,Math.floor(Number(x?.repsMax)||Number(x?.repsMin)||0)),restSeconds:Math.min(600,Math.max(0,Math.floor(Number(x?.restSeconds)||15))),sound:x?.sound!==false}));
  return enabled?base:{enabled:false};
}
function inferWorkoutConfigFromTask(t){
  const title=String(t?.title||""),text=`${title} ${String(t?.notes||"")}`,lower=text.toLowerCase();
  if(/cardio\s*circuit/i.test(text)){
    const noBurpee=/không\s*burpee|no\s*burpee/i.test(text),names=["Jumping Jacks","Masai Jump","High Kick","Butt Kick","High Knee"];
    const circuit=names.map((name,i)=>({id:`seed_${i}`,title:name,mode:"time",durationSeconds:30,repsMin:0,repsMax:0,restSeconds:15,sound:true}));
    if(!noBurpee)circuit.push({id:"seed_burpee",title:"Burpee",mode:"reps",durationSeconds:0,repsMin:5,repsMax:8,restSeconds:15,sound:true});
    return normalizeWorkoutConfig({enabled:true,mode:"circuit",circuitRounds:2,restBetweenRoundsSeconds:60,circuit});
  }
  const range=text.match(/(\d+)\s*[–-]\s*(\d+)\s*(?:rep|reps)/i)||text.match(/(\d+)\s*(?:rep|reps)/i),setM=text.match(/(\d+)\s*set/i),restM=text.match(/(?:Nghỉ|Rest)\s*(\d+)\s*s/i);
  if(/max\s*(?:thời gian|time)|\bmax\b/i.test(lower))return normalizeWorkoutConfig({enabled:true,mode:"max",sets:setM?Number(setM[1]):1,restSeconds:restM?Number(restM[1]):60});
  if(/khởi động|giãn cơ|đi bộ|walk|stretch/i.test(lower)){
    const mins=text.match(/(\d+)\s*(?:[–-]\s*(\d+)\s*)?(?:phút|min)/i);const minsNum=mins?Number(mins[1]):1;return normalizeWorkoutConfig({enabled:true,mode:"time",sets:1,durationSeconds:minsNum<=2?90:minsNum*60,restSeconds:0});
  }
  if(range||setM){const mn=range?Number(range[1]):Number((text.match(/(\d+)\s*rep/i)||[])[1]||8),mx=range&&range[2]?Number(range[2]):mn;return normalizeWorkoutConfig({enabled:true,mode:"reps",sets:setM?Number(setM[1]):1,repsMin:mn,repsMax:mx,restSeconds:restM?Number(restM[1]):60});}
  return {enabled:false};
}
function workoutEnsureTaskConfig(t){
  const has=!!t?.workoutConfig?.enabled;const looksWorkout=String(t?.id||"").startsWith("workout_")||/cardio\s*circuit|push-up|pull-up|chin-up|squat|lunge|plank|dead hang|calf raise|glute bridge|russian twist|crunch|chin tuck|khởi động|giãn cơ|đi bộ/i.test(String(t?.title||""));
  return {...t,workoutConfig:has?normalizeWorkoutConfig(t.workoutConfig):looksWorkout?inferWorkoutConfigFromTask(t):{enabled:false}};
}
function workoutEntryTemplate(t){return {taskId:String(t.id),title:String(t.title||"Task"),mode:String(t.workoutConfig?.mode||"reps"),sets:[],circuitRounds:[]};}
function currentWorkoutTask(s){const f=s.workoutEngine||{},id=(f.taskIds||[])[Number(f.taskIndex)||0];return s.tasks.find(t=>String(t.id)===String(id))||null;}
function currentWorkoutStep(s){const t=currentWorkoutTask(s),c=t?.workoutConfig||{},f=s.workoutEngine||{};if(!t)return null;if(c.mode==="circuit")return c.circuit?.[Number(f.circuitIndex)||0]||null;return {mode:c.mode||"reps",sets:c.sets,repsMin:c.repsMin,repsMax:c.repsMax,durationSeconds:c.durationSeconds,restSeconds:c.restSeconds};}
function workoutEntry(s,taskId){return s.workoutEngine?.session?.entries?.find(x=>String(x.taskId)===String(taskId))||null;}
function ensureWorkoutEntry(s,task){if(!s.workoutEngine?.session)return null;let e=workoutEntry(s,task.id);if(!e){e=workoutEntryTemplate(task);s.workoutEngine.session.entries.push(e);}return e;}
function setWorkoutPhase(s,phase,durationSeconds=0,timerKind="countdown"){const now=Date.now(),f=s.workoutEngine;f.phase=phase;f.active=true;f.paused=false;f.phaseStartedAt=now;f.endsAt=durationSeconds>0?now+durationSeconds*1000:0;f.remaining=Math.max(0,durationSeconds);f.timerKind=timerKind;}
function plannedForDate(s,day){const out=[],wd=weekday(day);for(const t of s.tasks){if(t.archived)continue;const r=t.repeat?.type||"none";if(r==="daily"||(r==="weekly"&&(t.repeat?.weekdays||[]).map(Number).includes(wd))||(r==="none"&&t.dueDate===day))out.push(t);}return out;}
function markTaskDone(s,t,day){
  t.completedDates=Array.isArray(t.completedDates)?t.completedDates:[];if(t.completedDates.includes(day))return {awarded:false,xpAwarded:0,leveledUp:false,level:s.profile.level,levelPoints:0,coinAwarded:0};
  t.completedDates.push(day);let r={awarded:false,xpAwarded:0,leveledUp:false,level:s.profile.level,levelPoints:0,coinAwarded:0};
  if(day===dateKey()){r=awardOnce(s,`task:${t.id}:${day}`,taskXP(t),`Task · ${t.title}`,()=>legacyAwarded(s,"task",t.title,day),activityStreakForDay(s,day));if(r.awarded)s.profile.coins=Math.max(0,Number(s.profile.coins)||0)+Number(r.coinAwarded||0);s.completions.push({id:t.id,kind:"task",date:day,xp:Number(r.xpAwarded||0),baseXp:taskXP(t),completedAt:Date.now()});if(r.awarded)s.profile.questProgress.task=Math.max(0,Number(s.profile.questProgress.task)||0)+1;}
  return r;
}
function workoutAdvanceAfterStep(s){
  const f=s.workoutEngine,t=currentWorkoutTask(s),c=t?.workoutConfig||{},step=currentWorkoutStep(s);if(!t||!f.taskIds?.length)return;
  let rest=c.mode==="circuit"?Math.max(0,Number(step?.restSeconds)||15):Math.max(0,Number(c.restSeconds)||60);
  if(c.mode==="circuit"){
    const entry=ensureWorkoutEntry(s,t),round=Number(f.circuitRound)||0,idx=Number(f.circuitIndex)||0;entry.circuitRounds[round]=entry.circuitRounds[round]||[];
    if(idx+1<(c.circuit||[]).length){f.circuitIndex=idx+1;if(rest>0&&c.autoRest!==false)setWorkoutPhase(s,"rest",rest);else{f.active=false;f.phase="exercise";f.endsAt=0;f.remaining=0;f.phaseStartedAt=0;f.elapsedBase=0;const next=currentWorkoutStep(s);if(next?.mode==="time")setWorkoutPhase(s,"exercise",Number(next.durationSeconds)||30,"countdown");}return;}
    if(round+1<(Number(c.circuitRounds)||2)){f.circuitRound=round+1;f.circuitIndex=0;rest=Math.max(0,Number(c.restBetweenRoundsSeconds)||60);if(rest>0&&c.autoRest!==false)setWorkoutPhase(s,"roundRest",rest);else{f.active=false;f.phase="exercise";f.endsAt=0;f.remaining=0;f.phaseStartedAt=0;f.elapsedBase=0;const next=currentWorkoutStep(s);if(next?.mode==="time")setWorkoutPhase(s,"exercise",Number(next.durationSeconds)||30);}return;}
  }else{
    const nextSet=(Number(f.setIndex)||0)+1;if(nextSet<Number(c.sets||1)){f.setIndex=nextSet;if(rest>0&&c.autoRest!==false)setWorkoutPhase(s,"rest",rest);else{f.active=false;f.phase="exercise";f.endsAt=0;f.remaining=0;f.phaseStartedAt=0;}return;}
  }
  const day=f.date||dateKey();t.completedDates=Array.isArray(t.completedDates)?t.completedDates:[];if(!t.completedDates.includes(day))t.completedDates.push(day);f.taskIndex=Number(f.taskIndex||0)+1;f.setIndex=0;f.circuitRound=0;f.circuitIndex=0;
  if(f.taskIndex>=f.taskIds.length){const session=f.session;if(session){session.endedAt=Date.now();session.completed=true;session.duration=Math.max(0,Math.round((session.endedAt-session.startedAt)/1000));s.workoutSessions.push({...session});}const allWorkoutTasks=plannedForDate(s,day).filter(x=>!x.archived&&x.workoutConfig?.enabled);if(day===dateKey()&&allWorkoutTasks.length&&allWorkoutTasks.every(x=>(x.completedDates||[]).includes(day))&&!s.completions.some(c=>c.kind==="task"&&c.id===`workout:${day}`&&c.date===day)){s.completions.push({id:`workout:${day}`,kind:"task",date:day,xp:0,baseXp:0,workout:true,exerciseCount:allWorkoutTasks.length,completedAt:Date.now()});}s.workoutEngine={active:false,phase:"idle",paused:false,date:"",startedAt:0,phaseStartedAt:0,endsAt:0,remaining:0,taskIds:[],taskIndex:0,setIndex:0,circuitRound:0,circuitIndex:0,session:null,timerKind:"countdown"};return;}
  f.active=false;f.paused=false;f.phase="exercise";f.endsAt=0;f.remaining=0;f.phaseStartedAt=0;f.elapsedBase=0;
  const nextTask=currentWorkoutTask(s),nextCfg=nextTask?.workoutConfig||{},nextStep=currentWorkoutStep(s);
  if(nextStep?.mode==="time")setWorkoutPhase(s,"exercise",Number(nextStep.durationSeconds)||30,"countdown");
}
function finishWorkoutTimedPhase(s){
  const f=s.workoutEngine||{};if(!f.active||!["exercise","rest","roundRest"].includes(f.phase)||!Number(f.endsAt)||Number(f.endsAt)>Date.now())return false;
  if(f.phase==="rest"||f.phase==="roundRest"){f.active=false;f.paused=false;f.phase="exercise";f.endsAt=0;f.remaining=0;f.phaseStartedAt=0;f.elapsedBase=0;const step=currentWorkoutStep(s);if(step?.mode==="time")setWorkoutPhase(s,"exercise",Number(step.durationSeconds)||30);return true;}
  const t=currentWorkoutTask(s),c=t?.workoutConfig||{},step=currentWorkoutStep(s),entry=ensureWorkoutEntry(s,t);if(!t||!step||!entry)return false;const actual=Math.max(0,Math.floor((Date.now()-Math.max(0,Number(f.phaseStartedAt)||Date.now()))/1000));
  if(c.mode==="circuit"){const round=Number(f.circuitRound)||0,idx=Number(f.circuitIndex)||0;entry.circuitRounds[round]=entry.circuitRounds[round]||[];entry.circuitRounds[round][idx]={actualSeconds:actual,targetSeconds:Number(step.durationSeconds)||0,completedAt:Date.now()};}
  else {entry.sets[Number(f.setIndex)||0]={actualSeconds:actual,targetSeconds:Number(step.durationSeconds)||0,completedAt:Date.now()};}
  workoutAdvanceAfterStep(s);return true;
}

function normalizeTaskInput(item){const t={...item};t.title=String(t.title||"").trim();if(!t.title)throw Error("Task name is required");t.listId=String(t.listId||"inbox");t.priority=["low","medium","high","urgent"].includes(t.priority)?t.priority:"medium";t.estimate=Math.max(5,Number(t.estimate)||25);const rt=["none","daily","weekly"].includes(t.repeat?.type)?t.repeat.type:"none";const days=[...new Set((t.repeat?.weekdays||[]).map(Number).filter(n=>n>=0&&n<=6))];const rawDate=String(t.dueDate||"").slice(0,10);const start=String(t.repeat?.startDate||rawDate||dateKey()).slice(0,10);t.repeat={type:rt,weekdays:days,startDate:rt==="none"?"":start};if(rt==="weekly"&&!days.length)t.repeat.weekdays=[weekday(start)];t.dueDate=rt==="none"?rawDate:start;t.notes=String(t.notes||"");t.pomodorosDone=Math.max(0,Math.floor(Number(t.pomodorosDone)||0));t.checklist=Array.isArray(t.checklist)?t.checklist.map(x=>({id:x.id||uid("sub"),text:String(x.text||x.title||"").trim(),done:!!x.done})).filter(x=>x.text):[];t.workoutConfig=workoutEnsureTaskConfig(t).workoutConfig;t.reminderEnabled=!!t.reminderEnabled;t.reminderAt=t.reminderAt||null;t.activatedAt=Number(t.activatedAt)||Date.now();return t;}
function nextOccurrence(t,from=Date.now()){if(!t.reminderEnabled)return null;const r=t.repeat?.type||"none";if(r==="none")return t.reminderAt&&Number(t.reminderAt)>from?Number(t.reminderAt):null;if(!t.dueTime)return null;const days=r==="daily"?[0,1,2,3,4,5,6]:(t.repeat.weekdays||[]).map(Number);for(let i=0;i<8;i++){const d=new Date(from);d.setSeconds(0,0);d.setDate(d.getDate()+i);const k=dateKey(d);if(t.repeat.startDate&&k<t.repeat.startDate)continue;if(!days.includes(d.getDay()))continue;const [hh,mm]=String(t.dueTime).split(":").map(Number);d.setHours(Number.isFinite(hh)?hh:9,Number.isFinite(mm)?mm:0,0,0);if(d.getTime()>from)return d.getTime();}return null;}
async function clearTaskAlarms(){
  for(const a of await chrome.alarms.getAll()) if(a.name.startsWith("task:")) await chrome.alarms.clear(a.name);
}
function nextAlarmAt(timeString){
  const [h,m]=String(timeString||"23:30").split(":").map(Number);
  const d=new Date();
  d.setHours(Number.isFinite(h)?h:23,Number.isFinite(m)?m:30,0,0);
  if(d.getTime()<=Date.now()) d.setDate(d.getDate()+1);
  return d.getTime();
}
function parseTaskDeadline(t, dateKeyValue){
  if(!t?.dueTime) return null;
  const date=String(dateKeyValue||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [hh,mm]=String(t.dueTime).split(":").map(Number);
  if(!Number.isFinite(hh)||!Number.isFinite(mm)||hh<0||hh>23||mm<0||mm>59) return null;
  const d=dateFromKey(date); d.setHours(hh,mm,0,0); return d.getTime();
}
function occurrenceDates(t, fromDay, count=8){
  const out=[]; if(!t||t.archived) return out;
  const r=t.repeat?.type||"none"; const start=String(t.repeat?.startDate||t.dueDate||fromDay).slice(0,10);
  if(r==="none"){ if(t.dueDate && t.dueDate>=fromDay) out.push(t.dueDate); return out; }
  for(let i=0;i<count;i++){ const k=shiftDate(fromDay,i); if(k<start) continue; const wd=weekday(k);
    if(r==="daily" || (r==="weekly" && (t.repeat?.weekdays||[]).map(Number).includes(wd))) out.push(k);
  }
  return out;
}
function focusStateSnapshot(s){
 const f=s.focusEngine||{},now=Date.now(),mode=normalizeFocusMinutes(f.mode),workSeconds=focusWorkSeconds(mode);
 let remaining=Math.max(0,Number(f.remaining)||0);
 if(!f.active&&!f.paused&&String(f.phase||"idle")==="idle"&&remaining<=0)remaining=workSeconds;
 if(f.active&&Number(f.endsAt)>0)remaining=Math.max(0,Math.ceil((Number(f.endsAt)-now)/1000));
 const elapsed=f.active&&Number(f.startedAt)>0?Math.max(0,Math.floor((now-Number(f.startedAt))/1000)):Math.max(0,workSeconds-remaining);
 const todayMinutes=Math.floor((s.focusSessions||[]).filter(x=>x.date===dateKey()).reduce((n,x)=>n+Number(x.minutes||0),0));
 return {active:Boolean(f.active),phase:String(f.phase||"idle"),mode,startedAt:Number(f.startedAt)||0,endsAt:Number(f.endsAt)||0,remaining,elapsed,paused:Boolean(f.paused),pomodorosCompleted:Math.max(0,Math.floor(Number(f.pomodorosCompleted)||0)),roundsTarget:Math.min(20,Math.max(1,Number(f.roundsTarget)||4)),taskId:String(f.taskId||""),taskTitle:(s.tasks||[]).find(t=>String(t.id)===String(f.taskId||""))?.title||"",breakKind:["short","long"].includes(String(f.breakKind))?String(f.breakKind):"short",countdown:true,free:false,sessionStartedAt:Number(f.sessionStartedAt)||0,dailyFocusGoalMin:Number(s.settings.dailyFocusGoalMin)||120,todayFocusMinutes:todayMinutes};
}
async function setFocusEngine(s,{active,phase="idle",mode=25,startedAt=0,endsAt=0,remaining=0,paused=false,pomodorosCompleted=0,roundsTarget=4,taskId="",breakKind="short",free=false,sessionStartedAt=0}){
 s.focusEngine={active:Boolean(active),phase:String(phase),mode:normalizeFocusMinutes(mode),startedAt:Number(startedAt)||0,endsAt:Number(endsAt)||0,remaining:Math.max(0,Math.floor(Number(remaining)||0)),paused:Boolean(paused),pomodorosCompleted:Math.max(0,Math.floor(Number(pomodorosCompleted)||0)),roundsTarget:Math.min(20,Math.max(1,Math.floor(Number(roundsTarget)||4))),taskId:String(taskId||""),breakKind:["short","long"].includes(String(breakKind))?String(breakKind):"short",free:false,sessionStartedAt:Number(sessionStartedAt)||0,countdown:true};
 s.focusPresence={active:Boolean(active&&phase==="focus"),lastHeartbeat:Date.now(),startedAt:Number(sessionStartedAt||startedAt)||0};
 if(active&&phase==="focus"&&(Number(sessionStartedAt)||Number(startedAt))>0){const startedDate=dateKey(new Date(Number(sessionStartedAt||startedAt)));await chrome.storage.local.set({aurestarFocusStartedDate:startedDate});await chrome.notifications.clear(FOCUS_SESSION_REMINDER_NOTIFICATION).catch(()=>{});}
 return focusStateSnapshot(s);
}
function focusWorkSeconds(mode){return normalizeFocusMinutes(mode)*60;}
function focusBreakSeconds(s,completedCount){
 const every=Math.max(1,Math.floor(Number(s.settings.focusLongBreakEvery)||4)),isLong=completedCount>0&&completedCount%every===0;
 const mins=isLong?Math.max(1,Number(s.settings.focusLongBreak)||15):Math.max(1,Number(s.settings.focusShortBreak)||5);
 return {seconds:Math.floor(mins*60),kind:isLong?"long":"short"};
}

function focusElapsedSeconds(f,now=Date.now()){
  if(!f) return 0;
  if(f.active&&f.startedAt) return Math.max(0,Math.floor((now-Number(f.startedAt))/1000)+Math.max(0,Number(f.remaining)||0));
  return Math.max(0,Number(f.remaining)||0);
}
async function recordFocusSegment(s,seconds,taskId,startedAt,mode){
  const mins=Math.floor(Math.max(0,Number(seconds)||0)/60);
  if(mins<1) return {recorded:false};
  const day=dateKey(),baseXp=focusXP(mins);
  s.profile.totalFocusMinutes+=mins;
  const rec={id:uid("focus"),date:day,minutes:mins,seconds:Math.floor(Number(seconds)||0),completedAt:Date.now(),startedAt:Number(startedAt)||Date.now(),mode:String(mode||"focus"),taskId:String(taskId||""),xp:0,baseXp,partial:mins<Math.max(1,Math.floor(Number(mode)||25))};
  s.focusSessions.push(rec);
  await chrome.storage.local.set({aurestarFocusSessionReferenceAt:rec.completedAt,aurestarFocusReminderLastSentAt:0});
  await chrome.notifications.clear(FOCUS_SESSION_REMINDER_NOTIFICATION).catch(()=>{});
  if(taskId && mins>=Math.max(1,Math.floor(Number(mode)||25))){const task=s.tasks.find(t=>String(t.id)===String(taskId));if(task)task.pomodorosDone=Math.max(0,Math.floor(Number(task.pomodorosDone)||0))+1;}
  const r=awardOnce(s,`focus:${rec.id}`,baseXp,`Focus · ${mins} minutes`,undefined,activityStreakForDay(s,day));
  rec.xp=Number(r.xpAwarded||0);
  if(r.awarded) s.profile.coins=Math.max(0,Number(s.profile.coins)||0)+Number(r.coinAwarded||0);
  s.completions.push({id:uid("focus"),kind:"focus",date:day,xp:rec.xp,baseXp,minutes:mins,completedAt:Date.now(),taskId:String(taskId||"")});
  s.profile.questProgress.focus=Math.max(0,Number(s.profile.questProgress.focus)||0)+1;
  return {recorded:true,levelUp:!!r.leveledUp,levelPoints:Number(r.levelPoints||0),coinAwarded:Number(r.coinAwarded||0),xpAwarded:Number(r.xpAwarded||0),minutes:mins};
}
async function completeFocusSession(s,minutes,mode="focus",taskId="",startedAt=0){ return recordFocusSegment(s,Math.floor(Number(minutes)||0)*60,taskId,startedAt,mode); }
async function finishFocusEngine(s){
 const f=s.focusEngine||{};if(!f.active||f.free||Date.now()<Number(f.endsAt||0))return {finished:false};
 const now=Date.now(),mode=normalizeFocusMinutes(f.mode),taskId=String(f.taskId||""),completed=Math.max(0,Number(f.pomodorosCompleted)||0),target=Math.min(20,Math.max(1,Number(f.roundsTarget)||4));
 if(f.phase==="focus"){
  const result=await completeFocusSession(s,mode,"focus",taskId,f.sessionStartedAt||f.startedAt),nextCompleted=completed+1,br=focusBreakSeconds(s,nextCompleted);
  await setFocusEngine(s,{active:true,phase:"break",mode,startedAt:now,endsAt:now+br.seconds*1000,remaining:br.seconds,paused:false,pomodorosCompleted:nextCompleted,roundsTarget:target,taskId,breakKind:br.kind,sessionStartedAt:0});
  return {finished:true,phase:"break",round:nextCompleted,target,breakKind:br.kind,result};
 }
 if(f.phase==="break"){
  if(completed>=target){
   await setFocusEngine(s,{active:false,phase:"idle",mode,startedAt:0,endsAt:0,remaining:focusWorkSeconds(mode),paused:false,pomodorosCompleted:completed,roundsTarget:target,taskId,breakKind:"short"});
   return {finished:true,phase:"idle",round:completed,target,result:{levelUp:false,levelPoints:0,coinAwarded:0}};
  }
  const work=focusWorkSeconds(mode);
  await setFocusEngine(s,{active:true,phase:"focus",mode,startedAt:now,endsAt:now+work*1000,remaining:work,paused:false,pomodorosCompleted:completed,roundsTarget:target,taskId,breakKind:"short",sessionStartedAt:now});
  await chrome.storage.local.set({aurestarFocusSessionReferenceAt:now,aurestarFocusReminderLastSentAt:0});
  return {finished:true,phase:"focus",round:completed+1,target,result:{levelUp:false,levelPoints:0,coinAwarded:0}};
 }
 return {finished:false};
}

async function scheduleAlarms(s){
  await chrome.alarms.clear("ascended:focus-end");
  await chrome.alarms.clear("ascended:workout-end");
  const f=s.focusEngine||{};
  if(f.active && !f.free && Number(f.endsAt)>Date.now()) await chrome.alarms.create("ascended:focus-end",{when:Number(f.endsAt)});
  const wf=s.workoutEngine||{};if(wf.active&&Number(wf.endsAt)>Date.now())await chrome.alarms.create("ascended:workout-end",{when:Number(wf.endsAt)});
  await chrome.alarms.clear("daily");await clearTaskAlarms();
  if(s.settings.notifications) await chrome.alarms.create("daily",{when:nextAlarmAt(s.settings.dailyReminder||"08:00")});
  if(s.settings.taskReminders) for(const t of s.tasks){const when=nextOccurrence(t);if(when)await chrome.alarms.create(`task:${t.id}`,{when});}
  await scheduleFocusSessionReminder(s);
}
async function scheduleUtilityAlarms(s){

  await chrome.alarms.clear("ascended:backup");
  if(s.settings.autoBackup) await chrome.alarms.create("ascended:backup",{when:nextAlarmAt(s.settings.backupTime||"23:30")});
  await syncFocusBlocking(s);
}
let offscreenCreating=null;
const FOCUS_BLOCK_RULE_IDS=Array.from({length:100},(_,i)=>91001+i);
function normalizeBlockedDomain(x){
  let d=String(x||"").trim().toLowerCase();
  if(!d)return "";
  d=d.replace(/^[a-z][a-z0-9+.-]*:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].replace(/:\d+$/,"").replace(/\.$/,"");
  if(d.length>253||!d.includes(".")||d.includes(".."))return "";
  const labels=d.split(".");
  if(labels.some(label=>!label||label.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))return "";
  if(!/^[a-z]{2,63}$/.test(labels[labels.length-1]))return "";
  return d;
}
function blockedDomainRegex(domain){const d=normalizeBlockedDomain(domain);if(!d||!/^[a-z0-9.-]+$/.test(d)||!d.includes("."))return null;return `^https?://([^/]*\.)?${d.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?::\\d+)?(/|$)`;}
async function syncFocusBlocking(s){
  if(!chrome.declarativeNetRequest?.updateDynamicRules)return;
  const active=Boolean(s?.focusEngine?.active&&s.focusEngine.phase==="focus");
  const domains=Array.isArray(s?.settings?.blockedWebsites)?[...new Set(s.settings.blockedWebsites.map(normalizeBlockedDomain).filter(Boolean))].slice(0,100):[];
  const addRules=active?domains.map((domain,i)=>{const regexFilter=blockedDomainRegex(domain);return regexFilter?{id:91001+i,priority:100,action:{type:"redirect",redirect:{extensionPath:"/blocked.html"}},condition:{regexFilter,resourceTypes:["main_frame"]}}:null}).filter(Boolean):[];
  try{await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:FOCUS_BLOCK_RULE_IDS,addRules});}catch(e){console.warn("focus blocking",e)}
}

async function ensureOffscreen(){if(!chrome.offscreen)return;const url=chrome.runtime.getURL("offscreen.html");const contexts=await chrome.runtime.getContexts({contextTypes:["OFFSCREEN_DOCUMENT"],documentUrls:[url]}).catch(()=>[]);if(contexts?.length)return;if(offscreenCreating)return offscreenCreating;offscreenCreating=chrome.offscreen.createDocument({url:"offscreen.html",reasons:["AUDIO_PLAYBACK"],justification:"Play the Aurestar alarm sound from the background process."}).finally(()=>offscreenCreating=null);return offscreenCreating;}
async function playAlarm(){const current=await getState();if(current.settings.privacyMode===true||current.settings.alarmSound===false||!chrome.offscreen)return;await ensureOffscreen();await new Promise(r=>setTimeout(r,60));await chrome.runtime.sendMessage({type:"playAlarmSound",volume:Number(await getAlarmVolume()),duration:Number(await getAlarmDuration())}).catch(()=>{});}
async function getAlarmVolume(){const s=await getState();return Math.min(1,Math.max(.1,Number(s.settings.alarmVolume)||1));}
async function getAlarmDuration(){const s=await getState();return Math.min(30,Math.max(4,Number(s.settings.alarmDuration)||12));}
async function notify(title,message){const current=await getState();if(current.settings.privacyMode===true||current.settings.notifications===false)return;await chrome.notifications.create(`d_${Date.now()}`,{type:"basic",iconUrl:"icons/icon128.png",title,message,priority:2,requireInteraction:true,silent:false});}
const LEGACY_FOCUS_START_REMINDER_ALARM="aurestar:focus-start-reminder";
const FOCUS_SESSION_REMINDER_ALARM="aurestar:periodic-study-reminder";
const FOCUS_SESSION_REMINDER_NOTIFICATION="aurestar-periodic-study-reminder";
const STUDY_REMINDER_START_MINUTE=6*60;
const STUDY_REMINDER_END_MINUTE=21*60+30;
function nextStudyReminderAt(nowMs=Date.now()){
  const now=new Date(nowMs);
  const start=new Date(now);
  start.setHours(6,0,0,0);
  const end=new Date(now);
  end.setHours(21,30,0,0);
  const nextDayStart=()=>{const d=new Date(now);d.setDate(d.getDate()+1);d.setHours(6,0,0,0);return d.getTime();};
  if(nowMs<start.getTime()) return start.getTime();
  if(nowMs>end.getTime()) return nextDayStart();
  const interval=30*60*1000;
  const elapsed=nowMs-start.getTime();
  // If Chrome starts on a slot boundary, deliver that slot shortly after startup
  // rather than silently skipping it. The next invocation is already beyond it.
  if(elapsed>=0 && elapsed<=end.getTime()-start.getTime() && elapsed%interval<1000) return nowMs+1000;
  const target=start.getTime()+Math.ceil(elapsed/interval)*interval;
  if(target>end.getTime()) return nextDayStart();
  return target;
}
async function scheduleFocusSessionReminder(s){
  try{
    await chrome.alarms.clear(LEGACY_FOCUS_START_REMINDER_ALARM);
    await chrome.alarms.clear("aurestar:focus-session-reminder");
    const settings=s?.settings||{};
    if(settings.privacyMode===true||settings.notifications===false){
      await chrome.alarms.clear(FOCUS_SESSION_REMINDER_ALARM);
      return;
    }
    const existing=await chrome.alarms.get(FOCUS_SESSION_REMINDER_ALARM);
    const now=Date.now();
    if(existing && Number(existing.scheduledTime)>now+500) return;
    await chrome.alarms.create(FOCUS_SESSION_REMINDER_ALARM,{when:nextStudyReminderAt(now)});
  }catch(e){console.warn('Periodic study reminder scheduling',e);}
}
async function maybeSendFocusSessionReminder(){
  const s=await getState(),settings=s.settings||{};
  if(settings.privacyMode===true||settings.notifications===false){
    await chrome.notifications.clear(FOCUS_SESSION_REMINDER_NOTIFICATION).catch(()=>{});
    await chrome.alarms.clear(FOCUS_SESSION_REMINDER_ALARM);
    return;
  }
  const now=new Date(),minute=now.getHours()*60+now.getMinutes();
  try{
    if(minute>=STUDY_REMINDER_START_MINUTE&&minute<=STUDY_REMINDER_END_MINUTE){
      const title=settings.itsukiCompanionNotifications!==false?'Itsuki · Đến giờ kiểm tra kế hoạch':'Aurestar · Study reminder';
      const message=settings.itsukiCompanionNotifications!==false
        ?'Đã đến giờ nghỉ một chút để kiểm tra kế hoạch. Chọn một nhiệm vụ tiếp theo và tiếp tục từng bước nhé.'
        :'Quick check-in: review your tasks, update habits, and choose the next study action.';
      await chrome.notifications.clear(FOCUS_SESSION_REMINDER_NOTIFICATION).catch(()=>{});
      await chrome.notifications.create(FOCUS_SESSION_REMINDER_NOTIFICATION,{type:'basic',iconUrl:'icons/icon128.png',title,message,priority:2,requireInteraction:false,silent:false});
    }
  }catch(e){
    // A notification API/OS failure must not permanently stop future reminders.
    console.warn('Study reminder notification failed; keeping schedule active',e);
  }finally{
    try{
      await chrome.alarms.clear(FOCUS_SESSION_REMINDER_ALARM);
      await chrome.alarms.create(FOCUS_SESSION_REMINDER_ALARM,{when:nextStudyReminderAt(Date.now()+1000)});
    }catch(e){console.warn('Study reminder rescheduling failed',e);}
  }
}
async function seed(){ensureRoutineReminderAlarms();const raw=await chrome.storage.local.get(null);if(raw.profile&&Number(raw.schemaVersion||0)<51){raw.settings={...(raw.settings||{}),privacyMode:false,itsukiCompanionEnabled:true,itsukiCompanionNotifications:false};}if(Number(raw.schemaVersion||0)<53){raw.settings={...(raw.settings||{}),notifications:true,taskReminders:true};}if(!raw.profile){const s=normalize(emptyStateSeed());await save(s,{increment:false,backup:true});try{await scheduleAlarms(s)}catch(e){console.warn(e)}return s;}const s=normalize(raw);await save(s,{increment:false,backup:false});try{await scheduleAlarms(s)}catch(e){console.warn(e)}return s;}


// Persist migrations and seed data immediately on service-worker startup.
bootstrapPromise=seed().catch(e=>{console.warn("Aurestar bootstrap",e);});



function listNameForState(s,id){return s.lists.find(x=>x.id===id)?.name||'Inbox';}
async function getCurrentPageContext(tabId){
  if(!tabId){try{const tabs=await chrome.tabs.query({active:true,currentWindow:true});tabId=tabs?.[0]?.id;}catch{}}
  if(!tabId)return {url:'',title:'',selection:'',text:''};
  try{
    const r=await chrome.tabs.sendMessage(tabId,{type:'getPageContext'});if(r?.ok)return r.page;
  }catch{}
  try{
    const exec=await chrome.scripting.executeScript({target:{tabId},func:()=>({url:location.href,title:document.title||location.hostname,selection:String(getSelection?.()?.toString()||''),text:(document.body?.innerText||'').slice(0,18000)})});
    return exec?.[0]?.result||{url:'',title:'',selection:'',text:''};
  }catch{return {url:'',title:'',selection:'',text:''};}
}
async function openApp(hash="today"){return chrome.windows.create({url:chrome.runtime.getURL(`app.html#${encodeURIComponent(hash)}`),type:"popup",width:1480,height:920,focused:true});}
chrome.commands?.onCommand?.addListener(async command=>{
  try{
    if(command==="open-dashboard"){await openApp("dashboard");return;}
    if(command==="quick-add-task"){await openApp("tasks");return;}
    if(command==="toggle-focus"){
      const s=await getState(),f=s.focusEngine||{};
      if(f.active){await chrome.runtime.sendMessage({type:"focusPause"}).catch(()=>{});return;}
      const mode=normalizeFocusMinutes(f.mode||s.settings.focusPreset||25);
      const now=Date.now(),remaining=f.paused&&Number(f.remaining)>0?Number(f.remaining):focusWorkSeconds(mode);
      await setFocusEngine(s,{active:true,phase:f.phase==="break"?"break":"focus",mode,startedAt:now,endsAt:now+remaining*1000,remaining,paused:false,pomodorosCompleted:Number(f.pomodorosCompleted)||0,taskId:String(f.taskId||""),breakKind:f.breakKind||"short",sessionStartedAt:f.sessionStartedAt||now});
      await save(s);await scheduleAlarms(s);
    }
  }catch(e){console.warn("command",e)}
});
async function ensureFocusWidgetAssetsOnTab(tabId){
  if(!chrome.scripting||!Number.isInteger(tabId))throw Error('Tab scripting is unavailable');
  const probe=await chrome.scripting.executeScript({
    target:{tabId},
    func:()=>({script:window.__itsukiFocusWidgetLoaded===true,css:window.__itsukiFocusWidgetCssLoaded===true})
  });
  const status=probe?.[0]?.result||{};
  if(status.script&&status.css)return false;
  // Insert CSS before JS, so the script can safely mark both resources present.
  if(!status.css){
    await chrome.scripting.insertCSS({target:{tabId},files:['focus-widget.css']});
    await chrome.scripting.executeScript({target:{tabId},func:()=>{window.__itsukiFocusWidgetCssLoaded=true;}});
  }
  if(!status.script)await chrome.scripting.executeScript({target:{tabId},files:['focus-widget.js']});
  return true;
}
async function syncFocusWidgetVisibility(enabled, companionSettings={}){
  const visible=enabled!==false;
  const privacyMode=companionSettings?.privacyMode===true;
  const companionEnabled=companionSettings?.itsukiCompanionEnabled!==false;
  try{
    const tabs=await chrome.tabs.query({});
    for(const tab of tabs){
      if(!tab?.id||!/^https?$/i.test(String(tab.url||'').split(':')[0]))continue;
      try{
        if(visible)await ensureFocusWidgetAssetsOnTab(tab.id);
        await chrome.tabs.sendMessage(tab.id,{type:'focusWidgetVisibility',enabled:visible,privacyMode,itsukiCompanionEnabled:companionEnabled,position:companionSettings?.focusWidgetPosition||{top:18,right:18}}).catch(()=>{});
      }catch{}
    }
  }catch{}
}
async function ensureFocusWidgetOnTabs(s){ await syncFocusWidgetVisibility(s?.settings?.focusWidgetEnabled!==false,s?.settings||{}); }
async function openRoutineReminder(kind, reason='schedule'){
  const url=chrome.runtime.getURL(`reminder.html?type=${encodeURIComponent(kind)}&reason=${encodeURIComponent(reason)}&ts=${Date.now()}`);
  try{
    // Reuse an already-open reminder of the same type to avoid piling up tabs.
    const tabs=await chrome.tabs.query({url:chrome.runtime.getURL('reminder.html')+'*'});
    const existing=tabs.find(t=>String(t.url||'').includes(`type=${encodeURIComponent(kind)}`));
    if(existing?.id){await chrome.tabs.update(existing.id,{url,active:true});try{await chrome.windows.update(existing.windowId,{focused:true});}catch{};return;}
  }catch{}
  try{await chrome.tabs.create({url,active:true});}catch(e){console.warn('Could not open routine reminder page',e);}
}
const ROUTINE_REMINDER_SCHEDULE=[
  {name:'aurestar:routine:wind-down-2045',hour:20,minute:45,type:'wind-down'},
  {name:'aurestar:routine:sleep-2100',hour:21,minute:0,type:'sleep'}
];
const IDLE_STUDY_REMINDER_ALARM='aurestar:routine:idle-study-every-1m';
async function ensureIdleStudyReminderAlarm(){
  try{
    // Remove the obsolete five-minute alarm, but preserve a healthy one-minute
    // recurring alarm so service-worker wakeups do not keep resetting its clock.
    await chrome.alarms.clear('aurestar:routine:idle-study-every-5m');
    const existing=await chrome.alarms.get(IDLE_STUDY_REMINDER_ALARM);
    if(!existing){
      await chrome.alarms.create(IDLE_STUDY_REMINDER_ALARM,{
        delayInMinutes:1,
        periodInMinutes:1
      });
    }
  }catch(e){console.warn('Idle study reminder scheduling failed',e);}
}
async function ensureRoutineReminderAlarms(){
  await ensureIdleStudyReminderAlarm();
  const now=Date.now();
  for(const item of ROUTINE_REMINDER_SCHEDULE){
    try{
      const existing=await chrome.alarms.get(item.name);
      if(existing)continue;
      const target=new Date();target.setHours(item.hour,item.minute,0,0);
      if(target.getTime()<=now)target.setDate(target.getDate()+1);
      await chrome.alarms.create(item.name,{when:target.getTime(),periodInMinutes:1440});
    }catch(e){console.warn('Routine reminder alarm scheduling failed',item.name,e);}
  }
}
chrome.alarms.onAlarm.addListener(async alarm=>{
  try{
    if(alarm.name===FOCUS_SESSION_REMINDER_ALARM){await maybeSendFocusSessionReminder();return;}
    if(alarm.name===IDLE_STUDY_REMINDER_ALARM){
      const now=new Date(),minutes=now.getHours()*60+now.getMinutes();
      try{
        if(minutes>=360&&minutes<1245){
          const s=await getState(),f=s.focusEngine||{};
          const inFocusOrBreak=!!f.active&&['focus','break'].includes(String(f.phase||''));
          const paused=!!f.paused;
          // Reminder pages are independent of the optional desktop widget/Itsuki dialogue toggles.
          if(!inFocusOrBreak&&!paused&&s.settings?.privacyMode!==true){
            await openRoutineReminder('study','idle-1-minute-checkin');
            if(s.settings?.itsukiCompanionEnabled!==false) await requestItsukiExpression('focus-reminder','Do not postpone your goals. Choose one task and begin now.').catch(()=>{});
          }
        }
      } finally {
        // The recurring alarm is maintained by Chrome; do not create a second
        // alarm on each tick. Reconciliation on startup/update repairs missing alarms.
      }
      return;
    }
    const routine=ROUTINE_REMINDER_SCHEDULE.find(item=>item.name===alarm.name);
    if(routine){
      const s=await getState();
      if(s.settings?.privacyMode!==true){
        await openRoutineReminder(routine.type,'schedule');
        await requestItsukiExpression(routine.type).catch(()=>{});
      }
      return;
    }
    if(alarm.name==="ascended:itsuki-expression-rotation"){
      const s=await getState(),now=Date.now();
      try{await chrome.alarms.clear('ascended:itsuki-expression-rotation');}catch{}
      const focus=s.focusEngine||{};
      const sessionInProgress=Boolean(focus.active&&['focus','break'].includes(String(focus.phase||'')));
      if(!sessionInProgress&&s.settings?.focusWidgetEnabled!==false&&s.settings?.itsukiCompanionEnabled!==false&&s.settings?.privacyMode!==true){
        let computerState='active';
        try{computerState=await new Promise(resolve=>chrome.idle.queryState(60,resolve));}catch{}
        if(computerState==='active'){
          await requestItsukiExpression('periodic');
        }
      }
      const delay=nextItsukiRotationDelay(now);
      try{chrome.alarms.create('ascended:itsuki-expression-rotation',{when:Date.now()+delay});}catch{}
      return;
    }
    if(alarm.name==="ascended:workout-end"){
      const s=await getState();
      if(s.workoutEngine?.active&&Number(s.workoutEngine.endsAt)>0&&Number(s.workoutEngine.endsAt)<=Date.now()){
        if(finishWorkoutTimedPhase(s)){await save(s);await scheduleAlarms(s);if(s.settings.notifications)await notify("Aurestar · Training Timer","Timed step or rest completed.").catch(()=>{});}
      } else await chrome.alarms.clear("ascended:workout-end");
      return;
    }
    if(alarm.name==="ascended:focus-end"){
      const s=await getState();
      if(s.focusEngine?.active && Number(s.focusEngine.endsAt)>0 && Number(s.focusEngine.endsAt)<=Date.now()){
        const endedPhase=String(s.focusEngine.phase||"focus");
        const r=await finishFocusEngine(s);
        if(r.finished){
          await syncFocusBlocking(s);await save(s);await scheduleAlarms(s);await ensureFocusWidgetOnTabs(s);await broadcastFocusWidget();
          if(endedPhase==='focus'&&r.phase==='break'&&s.settings?.privacyMode!==true&&s.settings?.itsukiCompanionEnabled!==false){
            await openRoutineReminder('water','focus-break');
            await requestItsukiExpression('water',"Focus session complete. Take a short break, drink some water, and stretch gently.").catch(()=>{});
          }
          if(s.settings.notifications) await notify(s.settings.itsukiCompanionNotifications!==false?"Itsuki · "+(endedPhase==='focus'?"Focus complete":"Break complete"):"Aurestar · "+(endedPhase==='focus'?"Focus complete":"Break complete"),s.settings.itsukiCompanionNotifications!==false?(endedPhase==='focus'?"Well done! Your Focus session is complete. Take your planned break.":"Your break is over. When you are ready, start the next Focus session."):(endedPhase==='focus'?"Focus session complete. Take a break.":"Break complete. Start the next Focus session when you are ready.")).catch(()=>{});
        }
      } else await chrome.alarms.clear("ascended:focus-end");
      return;
    }
    if(alarm.name==="ascended:backup"){ const s=await getState(); try{await downloadBackup(s)}catch(e){console.warn(e)} await scheduleUtilityAlarms(s); return; }
    if(alarm.name==="daily"){ const s=await getState(); if(s.settings.notifications) await notify(s.settings.itsukiCompanionNotifications!==false?"Itsuki · Time to study":"Aurestar · Daily reminder",s.settings.itsukiCompanionNotifications!==false?"Your study plan is ready. Choose one clear task and take the first step.":"Your plan for today is ready."); await scheduleAlarms(s); return; }
    if(alarm.name.startsWith("task:")){ const s=await getState(); const t=s.tasks.find(x=>String(x.id)===alarm.name.slice(5)); if(t&&s.settings.notifications&&s.settings.taskReminders) await notify("Aurestar · Task reminder",s.settings.itsukiCompanionNotifications!==false?`${t.title} — start with one small step.`:t.title); await scheduleAlarms(s); return; }
  }catch(e){ console.warn("alarm handler",e); }
});

async function broadcastFocusWidget(){
  try{const s=await loadState(); const tabs=await chrome.tabs.query({}); const f=focusStateSnapshot(s); for(const t of tabs){if(t.id) chrome.tabs.sendMessage(t.id,{type:"focusStateChanged",focus:f}).catch(()=>{});}}catch{}
}

chrome.runtime.onMessage.addListener((m,sender,sendResponse)=>{(async()=>{
  if(m?.type==='aurestarSetOverlayVisibility'&&typeof m.hidden==='boolean'){
    const hidden=m.hidden===true;
    // Persist once in the service worker and broadcast immediately to all open tabs.
    await chrome.storage.local.set({aurestarOverlaysHidden:hidden});
    const tabs=await chrome.tabs.query({});
    await Promise.all(tabs.filter(t=>Number.isInteger(t.id)&&/^https?$/i.test(String(t.url||'').split(':')[0])).map(t=>chrome.tabs.sendMessage(t.id,{type:'aurestarOverlayVisibility',hidden}).catch(()=>{})));
    sendResponse({ok:true,hidden});return;
  }
  if(m.type==="focusPresence"){
    await chrome.storage.local.set({focusPresence:{active:Boolean(m.active),lastHeartbeat:Date.now(),startedAt:Number(m.startedAt)||0}});
    sendResponse({ok:true});
    return;
  }
  if(m.type==="itsukiExpressionAction"){
    try{sendResponse(await requestItsukiExpression(String(m.event||"idle-reminder"),typeof m.message==="string"?m.message:""));}
    catch(e){sendResponse({ok:false,error:String(e?.message||e)});}
    return;
  }
  const s=await getState(),today=dateKey();let result={};switch(m.type){
  case"openFloatingWidget":{
    const tabs=await chrome.tabs.query({active:true,currentWindow:true});
    const tab=tabs?.[0];
    if(!tab?.id || !/^https?$/i.test(String(tab.url||'').split(':')[0])) throw Error('Open a normal http/https web page first');
    try{await ensureFocusWidgetAssetsOnTab(tab.id);}
    catch(e){throw Error(`Could not open the Focus Widget on this page. Reload the tab and check site access. ${String(e?.message||'')}`.trim());}
    s.settings.focusWidgetEnabled=true;
    await save(s);
    result.widget={enabled:true,position:s.settings.focusWidgetPosition||{top:18,right:18}};
    await syncFocusWidgetVisibility(true,s.settings);
    break;
  }
  case"getFocusWidgetSettings":{
    result.widget={enabled:s.settings.focusWidgetEnabled!==false,position:s.settings.focusWidgetPosition||{top:18,right:18}};
    break;
  }
  case"setFocusWidgetEnabled":{
    s.settings.focusWidgetEnabled=m.enabled!==false;
    result.widget={enabled:s.settings.focusWidgetEnabled,position:s.settings.focusWidgetPosition||{top:18,right:18}};
    await save(s);
    await syncFocusWidgetVisibility(s.settings.focusWidgetEnabled,s.settings);
    break;
  }
  case"setFocusWidgetPosition":{
    const rawTop=Number(m.top),rawRight=Number(m.right);
    const top=Math.min(80,Math.max(0,Number.isFinite(rawTop)?rawTop:18));
    const right=Math.min(80,Math.max(0,Number.isFinite(rawRight)?rawRight:18));
    s.settings.focusWidgetPosition={top,right};
    result.widget={enabled:s.settings.focusWidgetEnabled!==false,position:s.settings.focusWidgetPosition};
    await syncFocusWidgetVisibility(s.settings.focusWidgetEnabled!==false,s.settings);
    break;
  }

  case"startWorkout":{
    if(s.workoutEngine?.taskIds?.length)throw Error("A workout is already loaded");
    const date=String(m.date||dateKey());let ids=(Array.isArray(m.taskIds)?m.taskIds:[]).map(String).filter(id=>{const t=s.tasks.find(x=>String(x.id)===id);return t&&!t.archived&&t.workoutConfig?.enabled&&!(t.completedDates||[]).includes(date);});
    ids=[...new Set(ids)];if(!ids.length)ids=plannedForDate(s,date).filter(t=>!t.archived&&t.workoutConfig?.enabled&&!(t.completedDates||[]).includes(date)).map(t=>String(t.id));
    if(!ids.length)throw Error("No open workout Tasks");
    const now=Date.now(),session={id:uid("workout"),date,startedAt:now,endedAt:0,duration:0,completed:false,taskIds:ids,entries:ids.map(id=>workoutEntryTemplate(s.tasks.find(t=>String(t.id)===id)))};
    s.workoutEngine={active:false,phase:"exercise",paused:false,date,startedAt:now,phaseStartedAt:0,endsAt:0,remaining:0,elapsedBase:0,taskIds:ids,taskIndex:0,setIndex:0,circuitRound:0,circuitIndex:0,session,timerKind:"countdown"};
    const step=currentWorkoutStep(s),task=currentWorkoutTask(s);if(step?.mode==="time")setWorkoutPhase(s,"exercise",Number(step.durationSeconds)||30,"countdown");
    result.workout=s.workoutEngine;await save(s);await scheduleAlarms(s);break;
  }
  case"workoutStartStep":{
    const f=s.workoutEngine||{},task=currentWorkoutTask(s),step=currentWorkoutStep(s);if(!task||!step)throw Error("No current workout step");if(f.paused)throw Error("Workout is paused");if(f.active)throw Error("The current timer is already running");if(f.phase!=="exercise")throw Error("The current phase is not ready");
    if(step.mode==="time")setWorkoutPhase(s,"exercise",Number(step.durationSeconds)||30,"countdown");else if(step.mode==="max"){f.active=true;f.paused=false;f.phase="exercise";f.phaseStartedAt=Date.now();f.endsAt=0;f.remaining=0;f.elapsedBase=0;f.timerKind="countup";}else throw Error("Rep-based sets are confirmed with Complete Set");
    result.workout=s.workoutEngine;await save(s);await scheduleAlarms(s);break;
  }
  case"workoutCompleteStep":{
    const f=s.workoutEngine||{},task=currentWorkoutTask(s),cfg=task?.workoutConfig||{},step=currentWorkoutStep(s);if(!task||!step)throw Error("No current workout step");if(f.phase!=="exercise")throw Error("Workout is not on an exercise step");
    const entry=ensureWorkoutEntry(s,task);
    if(cfg.mode==="circuit"){
      const round=Number(f.circuitRound)||0,idx=Number(f.circuitIndex)||0;entry.circuitRounds[round]=entry.circuitRounds[round]||[];
      if(step.mode==="reps"){entry.circuitRounds[round][idx]={actualReps:Math.max(0,Math.floor(Number(m.actual)||0)),completedAt:Date.now(),targetMin:Number(step.repsMin)||0,targetMax:Number(step.repsMax)||0};}
      else if(step.mode==="max"){const actual=Math.max(0,Math.floor((Date.now()-Math.max(0,Number(f.phaseStartedAt)||Date.now()))/1000)+Math.max(0,Number(f.elapsedBase)||0));entry.circuitRounds[round][idx]={actualSeconds:actual,completedAt:Date.now(),target:"MAX"};}
      else {if(f.active&&Number(f.endsAt)>Date.now())throw Error("Timed interval is still running");const actual=Math.max(0,Math.floor((Date.now()-Math.max(0,Number(f.phaseStartedAt)||Date.now()))/1000));entry.circuitRounds[round][idx]={actualSeconds:actual,targetSeconds:Number(step.durationSeconds)||0,completedAt:Date.now()};}
    }else if(step.mode==="reps"){
      entry.sets=Array.isArray(entry.sets)?entry.sets:[];const actual=Math.max(0,Math.floor(Number(m.actual)||0));entry.sets[Number(f.setIndex)||0]={actualReps:actual,completedAt:Date.now(),targetMin:Number(step.repsMin)||0,targetMax:Number(step.repsMax)||0};
    }else if(step.mode==="max"){
      if(!f.active)throw Error("Start MAX first");const actual=Math.max(0,Math.floor((Date.now()-Math.max(0,Number(f.phaseStartedAt)||Date.now()))/1000)+Math.max(0,Number(f.elapsedBase)||0));entry.sets=Array.isArray(entry.sets)?entry.sets:[];entry.sets[Number(f.setIndex)||0]={actualSeconds:actual,completedAt:Date.now(),target:"MAX"};
    }else{
      if(f.active&&Number(f.endsAt)>Date.now())throw Error("Timed set is still running");const actual=Math.max(0,Math.floor((Date.now()-Math.max(0,Number(f.phaseStartedAt)||Date.now()))/1000));entry.sets=Array.isArray(entry.sets)?entry.sets:[];entry.sets[Number(f.setIndex)||0]={actualSeconds:actual,targetSeconds:Number(step.durationSeconds)||0,completedAt:Date.now()};
    }
    workoutAdvanceAfterStep(s);result.workout=s.workoutEngine;await save(s);await scheduleAlarms(s);break;
  }
  case"workoutPause":{
    const f=s.workoutEngine||{};if(!f.taskIds?.length)throw Error("No workout is loaded");
    if(f.active){const now=Date.now();if(f.timerKind==="countup"){f.elapsedBase=Math.max(0,Number(f.elapsedBase)||0)+Math.max(0,Math.floor((now-Math.max(0,Number(f.phaseStartedAt)||now))/1000));f.remaining=f.elapsedBase;f.endsAt=0;}else{f.remaining=Math.max(0,Number(f.endsAt)>0?Math.ceil((Number(f.endsAt)-now)/1000):Number(f.remaining)||0);f.endsAt=0;}f.active=false;f.paused=true;}
    else if(f.paused){const now=Date.now();f.paused=false;f.active=true;f.phaseStartedAt=now;if(f.timerKind==="countup"){f.endsAt=0;}else{const sec=Math.max(0,Number(f.remaining)||0);f.endsAt=sec?now+sec*1000:0;}}
    result.workout=s.workoutEngine;await save(s);await scheduleAlarms(s);break;
  }
  case"workoutAdjustRest":{
    const f=s.workoutEngine||{};if(f.phase!=="rest"&&f.phase!=="roundRest")throw Error("Rest timer is not active");const delta=Math.floor(Number(m.delta)||0),now=Date.now(),current=Math.max(0,Number(f.endsAt)>0?Math.ceil((Number(f.endsAt)-now)/1000):Number(f.remaining)||0),next=Math.min(600,Math.max(0,current+delta));f.remaining=next;f.endsAt=f.paused?0:now+next*1000;result.workout=s.workoutEngine;await save(s);await scheduleAlarms(s);break;
  }
  case"workoutSkipRest":{
    const f=s.workoutEngine||{};if(f.phase!=="rest"&&f.phase!=="roundRest")throw Error("Rest timer is not active");f.paused=false;f.active=false;f.endsAt=0;f.remaining=0;f.phaseStartedAt=0;f.elapsedBase=0;const step=currentWorkoutStep(s);f.phase="exercise";if(step?.mode==="time")setWorkoutPhase(s,"exercise",Number(step.durationSeconds)||30,"countdown");result.workout=s.workoutEngine;await save(s);await scheduleAlarms(s);break;
  }
  case"workoutStop":{
    const f=s.workoutEngine||{};if(!f.taskIds?.length){result.workout=f;break;}if(f.session){const session={...f.session,endedAt:Date.now(),completed:false};session.duration=Math.max(0,Math.round((session.endedAt-session.startedAt)/1000));s.workoutSessions.push(session);}s.workoutEngine={active:false,phase:"idle",paused:false,date:"",startedAt:0,phaseStartedAt:0,endsAt:0,remaining:0,elapsedBase:0,taskIds:[],taskIndex:0,setIndex:0,circuitRound:0,circuitIndex:0,session:null,timerKind:"countdown"};result.workout=s.workoutEngine;await save(s);await scheduleAlarms(s);break;}

  case"getState":sendResponse({ok:true,state:s,result});return;
  case"openApp":await openApp(m.hash||"today");break;
  case"focusSetRounds":{
   const f=s.focusEngine||{};if(f.active||f.paused||f.phase==="break")throw Error("Finish the current Focus plan before changing rounds");
   const rounds=Math.min(20,Math.max(1,Math.floor(Number(m.rounds)||4)));
   s.focusEngine={...f,roundsTarget:rounds,pomodorosCompleted:0};await save(s);result.focus=focusStateSnapshot(s);break;
  }
  case"focusSelectMode":{
   const f=s.focusEngine||{},mode=String(m.mode||"focus");if(!["focus","short","long"].includes(mode))throw Error("Choose Focus, Short Break, or Long Break");
   const workMode=normalizeFocusMinutes(s.settings.focusPreset||f.mode||25),phase=mode==="focus"?"focus":"break",breakKind=mode==="long"?"long":"short";
   const minutes=mode==="short"?Math.max(1,Number(s.settings.focusShortBreak)||5):mode==="long"?Math.max(1,Number(s.settings.focusLongBreak)||15):workMode;
   await setFocusEngine(s,{active:false,phase,mode:workMode,startedAt:0,endsAt:0,remaining:Math.floor(minutes*60),paused:false,pomodorosCompleted:Number(f.pomodorosCompleted)||0,roundsTarget:f.roundsTarget||4,taskId:String(f.taskId||""),breakKind,sessionStartedAt:0});
   await syncFocusBlocking(s);await save(s);await scheduleAlarms(s);await ensureFocusWidgetOnTabs(s);await broadcastFocusWidget();result.focus=focusStateSnapshot(s);break;
  }
  case"focusStart":{
   const mode=normalizeFocusMinutes(m.mode||s.settings.focusPreset||25),now=Date.now(),f=s.focusEngine||{},roundsTarget=Math.min(20,Math.max(1,Math.floor(Number(m.rounds??f.roundsTarget)||4))),taskId=String(m.taskId??f.taskId??"");
   if(f.active){result.focus=focusStateSnapshot(s);break;}
   if(f.paused){
    const duration=Math.max(1,Number(f.remaining)||0);
    await setFocusEngine(s,{active:true,phase:f.phase||"focus",mode:f.mode||mode,startedAt:now,endsAt:now+duration*1000,remaining:duration,paused:false,pomodorosCompleted:Number(f.pomodorosCompleted)||0,roundsTarget:f.roundsTarget||roundsTarget,taskId:f.taskId||taskId,breakKind:f.breakKind||"short",sessionStartedAt:f.phase==="focus"?(f.sessionStartedAt||now):0});
    result.focus=focusStateSnapshot(s);break;
   }
   if(f.phase==="break"&&Number(f.remaining)>0){
    const remaining=Math.max(1,Number(f.remaining)||focusBreakSeconds(s,Number(f.pomodorosCompleted)||0).seconds);
    await setFocusEngine(s,{active:true,phase:"break",mode:f.mode||mode,startedAt:now,endsAt:now+remaining*1000,remaining,paused:false,pomodorosCompleted:Number(f.pomodorosCompleted)||0,roundsTarget:f.roundsTarget||roundsTarget,taskId:f.taskId||taskId,breakKind:f.breakKind||"short"});
   }else{
    const work=focusWorkSeconds(mode);
    await setFocusEngine(s,{active:true,phase:"focus",mode,startedAt:now,endsAt:now+work*1000,remaining:work,paused:false,pomodorosCompleted:0,roundsTarget,taskId,breakKind:"short",sessionStartedAt:now});
   }
   await chrome.storage.local.set({aurestarFocusSessionReferenceAt:now,aurestarFocusReminderLastSentAt:0});
   await chrome.notifications.clear(FOCUS_SESSION_REMINDER_NOTIFICATION).catch(()=>{});
   await syncFocusBlocking(s);await save(s);await scheduleAlarms(s);await ensureFocusWidgetOnTabs(s);await broadcastFocusWidget();result.focus=focusStateSnapshot(s);break;
  }

  case"focusPause":{
    const f=s.focusEngine||{};
    if(f.active){
      const now=Date.now(),isCountdown=f.phase==="break"||s.settings.focusCountdown!==false;
      const left=isCountdown?Math.max(0,Math.ceil((Number(f.endsAt||0)-now)/1000)):0;
      const elapsed=isCountdown?left:focusElapsedSeconds(f,now);
      await setFocusEngine(s,{active:false,phase:f.phase,mode:f.mode,startedAt:0,endsAt:0,remaining:elapsed,paused:true,pomodorosCompleted:f.pomodorosCompleted,roundsTarget:f.roundsTarget||4,taskId:f.taskId,breakKind:f.breakKind,free:false,sessionStartedAt:f.sessionStartedAt||f.startedAt});
    }else if(f.paused){
      const now=Date.now(),seconds=Math.max(0,Number(f.remaining)||0);
      const countdown=f.phase==="break"||s.settings.focusCountdown!==false;
      await setFocusEngine(s,{active:true,phase:f.phase,mode:f.mode,startedAt:now,endsAt:countdown?now+seconds*1000:0,remaining:seconds,paused:false,pomodorosCompleted:f.pomodorosCompleted,roundsTarget:f.roundsTarget||4,taskId:f.taskId,breakKind:f.breakKind,free:false,sessionStartedAt:f.sessionStartedAt||now});
    }
    await syncFocusBlocking(s);await save(s);await scheduleAlarms(s);await ensureFocusWidgetOnTabs(s);await broadcastFocusWidget();result.focus=focusStateSnapshot(s);break;
  }
  case"focusStop":{
    const f=s.focusEngine||{};
    if(f.phase==="focus" && (f.active||f.paused)){
      const workSeconds=focusWorkSeconds(f.mode);
      const remaining=f.active?(Number(f.endsAt)>0?Math.max(0,Math.ceil((Number(f.endsAt)-Date.now())/1000)):Math.max(0,Number(f.remaining)||0)):Math.max(0,Number(f.remaining)||0);
      const elapsedWork=s.settings.focusCountdown!==false?Math.max(0,workSeconds-remaining):focusElapsedSeconds(f);
      if(elapsedWork>=60){
        const r=await recordFocusSegment(s,Math.min(elapsedWork,workSeconds),String(f.taskId||""),f.sessionStartedAt||f.startedAt,f.mode);
        result.levelUp=!!r.levelUp;result.levelPoints=Number(r.levelPoints||0);result.coinAwarded=Number(r.coinAwarded||0);
      }
    }
    await setFocusEngine(s,{active:false,phase:"idle",mode:normalizeFocusMinutes(f.mode||s.settings.focusPreset||25),startedAt:0,endsAt:0,remaining:focusWorkSeconds(f.mode||25),paused:false,pomodorosCompleted:0,roundsTarget:f.roundsTarget||4,taskId:String(f.taskId||""),breakKind:"short"});
    await syncFocusBlocking(s);await save(s);await scheduleAlarms(s);await ensureFocusWidgetOnTabs(s);await broadcastFocusWidget();result.focus=focusStateSnapshot(s);break;
  }
  case"focusReset":{
   const mode=normalizeFocusMinutes(m.mode||s.settings.focusPreset||25),f=s.focusEngine||{},roundsTarget=Math.min(20,Math.max(1,Math.floor(Number(m.rounds||f.roundsTarget)||4)));
   await setFocusEngine(s,{active:false,phase:"idle",mode,startedAt:0,endsAt:0,remaining:focusWorkSeconds(mode),paused:false,pomodorosCompleted:0,roundsTarget,taskId:String(m.taskId??f.taskId??""),breakKind:"short"});
   s.settings.focusPreset=mode;await syncFocusBlocking(s);await save(s);await scheduleAlarms(s);await ensureFocusWidgetOnTabs(s);await broadcastFocusWidget();result.focus=focusStateSnapshot(s);break;
  }

  case"focusStartBreak":{
    const f=s.focusEngine||{};
    if(f.active) throw Error("Pause or stop the current focus session before starting a break");
    const mode=normalizeFocusMinutes(f.mode||m.mode||s.settings.focusPreset||25);
    const kind=String(m.kind||"short")==="long"?"long":"short";
    const mins=kind==="long"?Math.max(1,Number(s.settings.focusLongBreak)||15):Math.max(1,Number(s.settings.focusShortBreak)||5);
    const seconds=Math.floor(mins*60),now=Date.now();
    await setFocusEngine(s,{active:true,phase:"break",mode,startedAt:now,endsAt:now+seconds*1000,remaining:seconds,paused:false,pomodorosCompleted:Number(f.pomodorosCompleted)||0,taskId:String(f.taskId||""),breakKind:kind,free:false,sessionStartedAt:0});
    await syncFocusBlocking(s);await save(s);await scheduleAlarms(s);await ensureFocusWidgetOnTabs(s);await broadcastFocusWidget();result.focus=focusStateSnapshot(s);break;
  }
  case"focusSkipBreak":{
    const f=s.focusEngine||{};
    if(f.phase!=="break"){result.focus=focusStateSnapshot(s);break;}
    const mode=normalizeFocusMinutes(f.mode),taskId=String(f.taskId||"");
    {
      await setFocusEngine(s,{active:false,phase:"idle",mode,startedAt:0,endsAt:0,remaining:focusWorkSeconds(mode),paused:false,pomodorosCompleted:Number(f.pomodorosCompleted)||0,taskId,breakKind:"short"});
    }
    await syncFocusBlocking(s);result.focus=focusStateSnapshot(s);break;
  }
  case"focusSetTask":{
    if(s.focusEngine?.active) throw Error("Pause the timer before changing the task");
    const taskId=String(m.taskId||""); if(taskId&&!s.tasks.some(t=>String(t.id)===taskId)) throw Error("Task not found");
    s.focusEngine={...(s.focusEngine||{}),taskId};await save(s);result.focus=focusStateSnapshot(s);break;
  }
  case"focusSetPreset":{
    const mode=normalizeFocusMinutes(m.mode||25);if(s.focusEngine?.active)throw Error("Pause the timer before changing the timer");s.settings.focusPreset=mode;result.focus=focusStateSnapshot(s);break;
  }
  case"getFocusState":{
    if(s.focusEngine?.active&&!s.focusEngine.free&&Number(s.focusEngine.endsAt)>0&&Number(s.focusEngine.endsAt)<=Date.now()){
      const endedPhase=String(s.focusEngine.phase||"focus");
      const r=await finishFocusEngine(s);
      if(r.finished){
        result.finished=r;
        await syncFocusBlocking(s);
        await save(s);
        try{await scheduleAlarms(s)}catch{}
        if(s.settings.notifications){
          const title=s.settings.itsukiCompanionNotifications!==false?(endedPhase==='focus'?"Itsuki · Focus complete":"Itsuki · Break complete"):(endedPhase==='focus'?"Aurestar · Focus complete":"Aurestar · Break complete");
          const message=s.settings.itsukiCompanionNotifications!==false?(endedPhase==='focus'?"Well done! Your Focus session is complete. Take your planned break.":"Your break is over. When you are ready, start the next Focus session."):(endedPhase==='focus'?"Focus session recorded. Take a break when you're ready.":"Break complete. Ready for the next focus session.");
          await notify(title,message).catch(()=>{});
        }
      }
    }
    result.focus=focusStateSnapshot(s);sendResponse({ok:true,state:s,result});return;
  }
  case"backupNow":{const id=await downloadBackup(s);result={backup:true,filename:typeof id==="string"?BACKUP_FILE_NAME:AUTO_BACKUP_FILENAME,direct:typeof id==="string"};break;}
  case"addList":{const name=String(m.name||"").trim();if(!name)throw Error("List name is required");if(s.lists.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error("That list already exists");s.lists.push({id:uid("list"),name,icon:String(m.icon||"○"),color:String(m.color||"red"),createdAt:Date.now(),system:false});break;}
  case"updateList":{const l=s.lists.find(x=>x.id===m.id);if(!l)throw Error("List not found");const name=String(m.name||l.name).trim();if(!name)throw Error("List name is required");if(s.lists.some(x=>x.id!==l.id&&x.name.toLowerCase()===name.toLowerCase()))throw Error("That list already exists");Object.assign(l,{name,icon:String(m.icon||l.icon),color:String(m.color||l.color)});break;}
  case"deleteList":{const l=s.lists.find(x=>x.id===m.id);if(!l)throw Error("List not found");if(l.id==="inbox"||l.system)throw Error("The default list cannot be deleted");s.lists=s.lists.filter(x=>x.id!==l.id);s.tasks=s.tasks.map(t=>t.listId===l.id?{...t,listId:"inbox"}:t);break;}
  case"addTask":{const t=normalizeTaskInput(m.item||{});t.id=uid("task");t.createdAt=Date.now();t.xp=taskXP(t);t.completedDates=[];t.archived=false;s.tasks.push(t);break;}
  case"updateTask":{const old=s.tasks.find(x=>x.id===m.item?.id);if(!old)throw Error("Task not found");const t=normalizeTaskInput({...old,...m.item});Object.assign(old,t,{id:old.id,createdAt:old.createdAt,xp:taskXP(t)});break;}
  case"toggleTask":{const t=s.tasks.find(x=>x.id===m.id);const day=String(m.date||today);if(!t)throw Error("Task not found");if(day>today)throw Error("Cannot complete a future date");t.completedDates=t.completedDates||[];const done=t.completedDates.includes(day);if(done){t.completedDates=t.completedDates.filter(d=>d!==day);s.completions=s.completions.filter(c=>!(c.kind==="task"&&c.id===t.id&&c.date===day));}else{const r=markTaskDone(s,t,day);result.levelUp=!!r.leveledUp;result.levelPoints=Number(r.levelPoints||0);result.xpAwarded=Number(r.xpAwarded||0);result.coinAwarded=Number(r.coinAwarded||0);}break;}
  case"toggleChecklist":{const t=s.tasks.find(x=>x.id===m.id);if(!t)throw Error("Task not found");const idx=Number(m.index);if(!t.checklist?.[idx])throw Error("Checklist item not found");t.checklist[idx].done=!t.checklist[idx].done;break;}
  case"deleteTask":s.tasks=s.tasks.filter(x=>x.id!==m.id);s.completions=s.completions.filter(c=>!(c.kind==="task"&&c.id===m.id));break;
  case"addHabit":{const h={...(m.item||{}),id:uid("habit"),createdAt:Date.now(),completions:[],streak:0,bestStreak:0};h.title=String(h.title||"").trim();if(!h.title)throw Error("Habit name is required");h.frequency=["daily","weekly"].includes(String(h.frequency))?String(h.frequency):"daily";h.xp=habitXP(h);s.habits.push(h);break;}
  case"updateHabit":{const h=s.habits.find(x=>String(x.id)===String(m.id));if(!h)throw Error("Habit not found");const title=String(m.item?.title??h.title).trim();if(!title)throw Error("Habit name is required");const frequency=String(m.item?.frequency??h.frequency??"daily");if(!["daily","weekly"].includes(frequency))throw Error("Habit frequency must be daily or weekly");Object.assign(h,{title,frequency,xp:habitXP({...h,title,frequency})});break;}
  case"toggleHabit":{const h=s.habits.find(x=>x.id===m.id);if(!h)throw Error("Habit not found");h.completions=h.completions||[];const done=h.completions.includes(today);if(done){h.completions=h.completions.filter(d=>d!==today);s.completions=s.completions.filter(c=>!(c.kind==="habit"&&c.id===h.id&&c.date===today));}else{h.completions.push(today);const r=awardOnce(s,`habit:${h.id}:${today}`,habitXP(h),`Habit · ${h.title}`,()=>legacyAwarded(s,"habit",h.title,today),activityStreakForDay(s,today));const d=awardDailyConsistency(s,today);result.levelUp=!!(r.leveledUp||d.leveledUp);result.levelPoints=Number(r.levelPoints||0)+Number(d.levelPoints||0);if(r.awarded){s.profile.coins+=Number(r.coinAwarded||0);result.coinAwarded=Number(r.coinAwarded||0);}else result.coinAwarded=0;s.completions.push({id:h.id,kind:"habit",date:today,xp:Number(r?.xpAwarded||0),baseXp:habitXP(h),completedAt:Date.now()});if(r?.awarded)s.profile.questProgress.habit=Math.max(0,Number(s.profile.questProgress.habit)||0)+1;result.xpAwarded=Number(r?.xpAwarded||0);}}break;
  case"deleteHabit":s.habits=s.habits.filter(x=>x.id!==m.id);s.completions=s.completions.filter(c=>!(c.kind==="habit"&&c.id===m.id));break;
  case"addGoal":{const g={...(m.item||{}),id:uid("goal"),createdAt:Date.now(),progress:0,currentStreak:0,progressPct:0};g.title=String(g.title||"").trim();if(!g.title)throw Error("Goal title is required");g.target=Math.max(1,Number(g.target)||30);s.goals.push(g);break;}
  case"deleteGoal":s.goals=s.goals.filter(x=>x.id!==m.id);break;
  case"claimDailyQuest":{const r=claimDailyQuest(s);result.xpAwarded=Number(r.xpAwarded||0);result.levelUp=!!r.leveledUp;result.levelPoints=Number(r.levelPoints||0);result.coinAwarded=Number(r.coinAwarded||0);break;}
  case"claimQuest":{const r=claimQuest(s,m.id);result.xpAwarded=Number(r.xpAwarded||0);result.levelUp=!!r.leveledUp;result.levelPoints=Number(r.levelPoints||0);result.coinAwarded=Number(r.coinAwarded||0);break;}
  case"completeFocus":{const minutes=Math.max(1,Number(m.minutes)||25);const r=await completeFocusSession(s,minutes,m.mode||"focus",m.taskId||"",Number(m.startedAt)||0);await setFocusEngine(s,{active:false,phase:"idle",mode:normalizeFocusMinutes(minutes),startedAt:0,endsAt:0,remaining:focusWorkSeconds(minutes),paused:false,pomodorosCompleted:0,taskId:String(m.taskId||"")});result.levelUp=!!r.levelUp;result.levelPoints=Number(r.levelPoints||0);result.coinAwarded=Number(r.coinAwarded||0);break;}
  case"exchangeCoins":{const amount=Math.max(1,Math.floor(Number(m.amount)||1));const cost=amount*COINS_PER_POINT;if((s.profile.coins||0)<cost)throw Error(`Need ${cost} Coins to exchange for ${amount} Points`);s.profile.coins-=cost;s.profile.points+=amount;s.profile.pointsHistory.push({id:uid("pointx"),type:"exchange",amount,cost,date:today,at:Date.now(),reason:`Exchange ${cost} Coins`});result.exchange={points:amount,cost};break;}
  case"upgradeAttribute":{const key=String(m.attribute||"");const valid=["discipline","ambition","physical","mental","intellect"];if(!valid.includes(key))throw Error("Invalid attribute");const amount=Math.max(1,Math.floor(Number(m.amount)||1));const current=Number(s.profile.attributes[key])||1;if((s.profile.points||0)<amount)throw Error(`Need ${amount} Points`);const actual=amount;s.profile.points-=actual;s.profile.attributes[key]=current+actual;s.profile.pointsHistory.push({id:uid("pointu"),type:"upgrade",attribute:key,amount:actual,cost:actual,date:today,at:Date.now(),reason:`Upgrade ${attributeLabel(key)}`});break;}
  case"importTasks":{const items=Array.isArray(m.items)?m.items:[];if(!items.length)throw Error("No tasks to import");let imported=0;const errors=[];for(let i=0;i<items.length;i++){try{const item=normalizeTaskInput(items[i]||{});item.id=uid("task");item.createdAt=Date.now();item.xp=taskXP(item);item.completedDates=[];item.archived=false;s.tasks.push(item);imported++;}catch(e){errors.push({index:i+1,error:String(e.message||e)})}}if(!imported)throw Error(errors[0]?.error||"Unable to import tasks");result.import={imported,failed:errors.length,errors};break;}
  case"saveReview":{const i=s.reviews.findIndex(x=>x.date===m.review.date);if(i>=0)s.reviews[i]=m.review;else s.reviews.push(m.review);break;}
  case"saveSettings":{
   s.settings={...s.settings,...m.settings};
   if(s.settings.privacyMode===true){s.settings.notifications=false;s.settings.taskReminders=false;s.settings.alarmSound=false;s.settings.itsukiCompanionEnabled=false;s.settings.itsukiCompanionNotifications=false;s.settings.itsukiCompanionDailyReminder=false;}
   s.settings.language="en";s.settings.backupTime=String(s.settings.backupTime||"23:30");s.settings.autoBackup=s.settings.autoBackup!==false;
   s.settings.focusAutoBreak=false;s.settings.focusAutoStart=false;s.settings.focusAutoCycle=false;s.settings.focusBanBreak=false;s.settings.focusCountdown=true;
   s.settings.focusShortBreak=Math.min(30,Math.max(1,Math.floor(Number(s.settings.focusShortBreak)||5)));
   s.settings.focusLongBreak=Math.min(60,Math.max(1,Math.floor(Number(s.settings.focusLongBreak)||15)));
   s.settings.focusLongBreakEvery=Math.min(12,Math.max(1,Math.floor(Number(s.settings.focusLongBreakEvery)||4)));
   s.settings.dailyFocusGoalMin=Math.min(600,Math.max(15,Math.floor(Number(s.settings.dailyFocusGoalMin)||120)));
   s.settings.focusPreset=normalizeFocusMinutes(s.settings.focusPreset||25);
   await syncFocusWidgetVisibility(s.settings.focusWidgetEnabled!==false,s.settings);break;
  }

  case"testAlarm":if(s.settings.alarmSound)await playAlarm();break;
  case"saveAll":if(!m.data?.profile||!Array.isArray(m.data.tasks))throw Error("Invalid backup file");{const restoreData={...m.data};delete restoreData.itsukiPasswordRecord;Object.assign(s,normalize(restoreData));}break;
  default:throw Error(`Unsupported action: ${m.type}`);
  }
  await save(s);try{await scheduleAlarms(s)}catch(e){console.warn("schedule",e)}
  if(m.type==="focusSkipBreak"){
    try{await ensureFocusWidgetOnTabs(s);await broadcastFocusWidget();}catch(e){console.warn("focus widget refresh after skipping break",e)}
  }
  sendResponse({ok:true,state:s,result});
  })().catch(e=>sendResponse({ok:false,error:String(e.message||e)}));return true;});
if(chrome.sidePanel?.setPanelBehavior)chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:false}).catch(()=>{});

function ensureItsukiExpressionAlarm(){
  try{chrome.alarms.create('ascended:itsuki-expression-rotation',{when:Date.now()+nextItsukiRotationDelay()});}catch{}
}
async function migrateItsukiDialogueState(){
  try{
    const stored=await chrome.storage.local.get('itsukiExpressionState');
    if(Number(stored?.itsukiExpressionState?.schemaVersion||0)<11){
      await requestItsukiExpression('periodic');
    }
  }catch(e){console.warn('Itsuki dialogue migration',e);}
}
chrome.runtime.onInstalled?.addListener(()=>{ensureRoutineReminderAlarms();ensureIdleStudyReminderAlarm();ensureItsukiExpressionAlarm();chrome.storage.local.get('itsukiComputerActiveSince').then(d=>{if(!Number(d.itsukiComputerActiveSince))return chrome.storage.local.set({itsukiComputerActiveSince:Date.now()});}).catch(()=>{});chrome.alarms.clear(LEGACY_FOCUS_START_REMINDER_ALARM).catch(()=>{});bootstrapPromise?.then(()=>getState()).then(s=>scheduleFocusSessionReminder(s)).catch(()=>{});migrateItsukiDialogueState();});
chrome.runtime.onStartup?.addListener(()=>{ensureRoutineReminderAlarms();ensureIdleStudyReminderAlarm();ensureItsukiExpressionAlarm();chrome.storage.local.set({itsukiComputerActiveSince:Date.now()}).catch(()=>{});chrome.alarms.clear(LEGACY_FOCUS_START_REMINDER_ALARM).catch(()=>{});bootstrapPromise?.then(()=>getState()).then(s=>scheduleFocusSessionReminder(s)).catch(()=>{});migrateItsukiDialogueState();});

// Manifest V3 service workers are intentionally event-driven, not permanent
// processes. Reconcile Chrome alarms whenever Chrome starts this worker, so
// reminder scheduling recovers after worker suspension/restart or alarm loss.
(async()=>{
  try{
    await ensureRoutineReminderAlarms();
    await ensureItsukiExpressionAlarm();
    await chrome.alarms.clear(LEGACY_FOCUS_START_REMINDER_ALARM);
    bootstrapPromise?.then(()=>getState()).then(s=>scheduleFocusSessionReminder(s)).catch(e=>console.warn('Focus reminder recovery failed',e));
  }catch(e){console.warn('Background reminder recovery failed',e);}
})();
