const $=id=>document.getElementById(id);
let displayedImage='';
const approvedMessages={
  focus:'Choose one clear task and take the first step.',
  'wind-down':'Wind down now. Close distractions and give yourself time to rest.',
  sleep:'Your day is complete. Put your devices away and get ready for sleep.'
};
function contextFor(record){
  const context=String(record?.context||record?.event||'').toLowerCase();
  if(context==='sleep'||context.includes('sleep'))return 'sleep';
  if(context==='wind-down'||context.includes('wind-down'))return 'wind-down';
  return 'focus';
}
async function sendItsukiEvent(event='periodic'){
  try{return await chrome.runtime.sendMessage({type:'itsukiExpressionAction',event});}
  catch(error){console.error('Companion update failed',error);return null;}
}
async function refreshItsuki(record){
  try{
    if(!record){const stored=await chrome.storage.local.get('itsukiExpressionState');record=stored?.itsukiExpressionState;}
    if(!record||typeof record!=='object')return false;
    const context=contextFor(record),line=String(record.message||'').trim().replace(/[\r\n\t]+/g,' ').slice(0,220);
    $('itsukiLine').textContent=line||approvedMessages[context];
    const status=$('itsukiStatus');status.textContent=context==='wind-down'?'WIND DOWN':context.toUpperCase();status.dataset.context=context;
    const src=String(record.imageSrc||''),fileName=src.split('/').pop()||'',dot=fileName.lastIndexOf('.');
    const imageNumber=dot>0?fileName.slice(0,dot):'',imageExt=dot>0?fileName.slice(dot+1).toLowerCase():'';
    if(src.startsWith('assets/itsuki/')&&!src.includes('..')&&/^[0-9]+$/.test(imageNumber)&&['jpg','png'].includes(imageExt)){
      const imageKey=String(record.imageId||imageNumber);
      if(displayedImage!==imageKey){displayedImage=imageKey;$('itsukiArt').src=await window.aurestarDesktop.getItsukiArtUrl(Number(imageNumber));}
    }
    return true;
  }catch(error){console.error('Could not display companion state',error);return false;}
}
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.itsukiExpressionState?.newValue)refreshItsuki(changes.itsukiExpressionState.newValue);
});
async function boot(){
  $('itsukiArt').src=await window.aurestarDesktop.getItsukiArtUrl(1);
  const stored=await chrome.storage.local.get('itsukiExpressionState');
  if(Number(stored?.itsukiExpressionState?.schemaVersion||0)<11)await sendItsukiEvent('periodic');
  if(!await refreshItsuki()){
    await sendItsukiEvent('periodic');
    await refreshItsuki();
  }
}
$('hideItsuki').addEventListener('click',()=>window.aurestarDesktop.hideItsuki());
boot();
