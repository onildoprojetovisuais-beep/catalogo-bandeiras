(()=>{"use strict";
const form=document.getElementById('protestForm'),msg=document.getElementById('protestMessage'),btn=document.getElementById('submitProtest');
const pix=window.CESB_PROTEST_PIX||'';
function drawQR(){if(!pix)return; const el=document.getElementById('pixQr'); try{if(typeof QRCode==='undefined')throw new Error('lib'); new QRCode(el,{text:pix,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});}catch(e){document.getElementById('qrFallback').hidden=false;}}
window.addEventListener('load',drawQR);
document.getElementById('copyPix')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pix); const b=document.getElementById('copyPix'); const old=b.textContent;b.textContent='COPIADO';setTimeout(()=>b.textContent=old,1500);}catch(e){document.getElementById('pixCode').select();document.execCommand('copy');}});
form?.addEventListener('submit',async e=>{e.preventDefault(); if(!form.reportValidity())return; msg.textContent='Enviando protesto e arquivos...';msg.className='cesb-message';btn.disabled=true;
try{const res=await fetch('./api/submit.php',{method:'POST',body:new FormData(form)});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||'Falha no envio.');msg.className='cesb-message ok';msg.innerHTML=`<b>Protesto recebido.</b><br>Protocolo: <b>${data.protest_id}</b><br>O comprovante de pagamento ficará pendente de conferência pela Organização.`;form.querySelectorAll('input,select,textarea,button').forEach(x=>x.disabled=true);}
catch(err){msg.className='cesb-message error';msg.textContent=err.message||String(err);btn.disabled=false;}});
})();
