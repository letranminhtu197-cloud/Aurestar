const $=id=>document.getElementById(id);
let displayedImage='';
const statusLabels={focus:'Focus',break:'Break',pause:'Break',stop:'Session stopped',care:'Take care',warning:'Back to focus',done:'Completed',encouragement:'Study companion'};
async function sendItsukiEvent(event='periodic',message=''){
  try{return await chrome.runtime.sendMessage({type:'itsukiExpressionAction',event,message:String(message||'').slice(0,240)});}
  catch(error){console.error('Itsuki update failed',error);return null;}
}
async function refreshItsuki(record){
  try{
    if(!record){
      const stored=await chrome.storage.local.get('itsukiExpressionState');
      record=stored?.itsukiExpressionState;
    }
    if(!record||typeof record!=='object')return false;
    if(typeof record.message==='string'&&record.message.trim())$('itsukiLine').textContent=record.message;
    $('itsukiStatus').textContent=statusLabels[record.kind]||'Study companion';
    const src=String(record.imageSrc||'');
    const fileName=src.split('/').pop()||'';
    const dot=fileName.lastIndexOf('.');
    const imageNumber=dot>0?fileName.slice(0,dot):'';
    const imageExt=dot>0?fileName.slice(dot+1).toLowerCase():'';
    if(src.startsWith('assets/itsuki/')&&!src.includes('..')&&/^[0-9]+$/.test(imageNumber)&&['jpg','png'].includes(imageExt)){
      const imageKey=String(record.imageId||imageNumber);
      if(displayedImage!==imageKey){
        displayedImage=imageKey;
        $('itsukiArt').src=await window.aurestarDesktop.getItsukiArtUrl(Number(imageNumber));
      }
    }
    return true;
  }catch(error){console.error('Could not display Itsuki state',error);return false;}
}
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.itsukiExpressionState?.newValue)refreshItsuki(changes.itsukiExpressionState.newValue);
});
async function boot(){
  $('itsukiArt').src=await window.aurestarDesktop.getItsukiArtUrl(1);
  const shown=await refreshItsuki();
  if(!shown){
    await sendItsukiEvent('periodic');
    await refreshItsuki();
  }
}
$('hideItsuki').addEventListener('click',()=>window.aurestarDesktop.hideItsuki());
$('itsukiPet').addEventListener('click',async()=>{await sendItsukiEvent('click');await refreshItsuki();});
$('openWorkspace').addEventListener('click',()=>window.aurestarDesktop.openWorkspace());
boot();
