const $=id=>document.getElementById(id);
let displayedImage='';
const approvedMessages={
  focus:'Chọn một việc quan trọng và bắt đầu từ bước nhỏ đầu tiên nhé.',
  'wind-down':'Đến lúc thư giãn rồi. Tạm gác công việc và chuẩn bị nghỉ ngơi nhé.',
  sleep:'Hôm nay cậu đã hoàn thành đủ rồi. Cất thiết bị và chuẩn bị đi ngủ nhé.'
};
const statusNotes={focus:'Từng bước một thôi','wind-down':'Dành thời gian thư giãn','sleep':'Nghỉ ngơi và nạp lại năng lượng'};
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
    $('itsukiStatusNote').textContent=statusNotes[context];
    const src=String(record.imageSrc||''),fileName=src.split('/').pop()||'',dot=fileName.lastIndexOf('.');
    const imageNumber=dot>0?fileName.slice(0,dot):'',imageExt=dot>0?fileName.slice(dot+1).toLowerCase():'';
    if(src.startsWith('assets/itsuki/')&&!src.includes('..')&&/^[0-9]+$/.test(imageNumber)&&['jpg','png'].includes(imageExt)){
      const imageKey=String(record.imageId||imageNumber);
      if(displayedImage!==imageKey){
        const imageUrl=await window.aurestarDesktop.getItsukiArtUrl(Number(imageNumber));
        if(imageUrl){$('itsukiArt').src=imageUrl;displayedImage=imageKey;}
      }
    }
    return true;
  }catch(error){console.error('Could not display companion state',error);return false;}
}
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.itsukiExpressionState?.newValue)refreshItsuki(changes.itsukiExpressionState.newValue);
});
async function boot(){
  try{
    const firstImage=await window.aurestarDesktop.getItsukiArtUrl(1);
    if(firstImage){$('itsukiArt').src=firstImage;displayedImage='1';}
    const stored=await chrome.storage.local.get('itsukiExpressionState');
    if(Number(stored?.itsukiExpressionState?.schemaVersion||0)<11)await sendItsukiEvent('periodic');
    if(!await refreshItsuki()){
      await sendItsukiEvent('periodic');
      await refreshItsuki();
    }
  }catch(error){console.error('Itsuki widget startup failed',error);}
}
$('hideItsuki').addEventListener('click',()=>window.aurestarDesktop.hideItsuki());
boot();
