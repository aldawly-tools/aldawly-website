(function(){
 "use strict";
 var trigger=document.getElementById("openBarcodeScanner");
 if(!trigger||trigger.dataset.bound==="1")return;
 trigger.dataset.bound="1";
 var modal=null,stream=null,reader=null,controls=null,scanTimer=null,scanning=false;
 function ensureModal(){
  if(modal)return modal;
  modal=document.createElement("div");
  modal.id="barcodeScannerModal";
  modal.className="barcode-scanner-modal";
  modal.hidden=true;
  modal.innerHTML='<div class="barcode-scanner-panel" role="dialog" aria-modal="true" aria-labelledby="barcodeScannerTitle"><div class="barcode-scanner-head"><div><h2 id="barcodeScannerTitle">مسح باركود المنتج</h2><p>وجّه كاميرا الهاتف نحو الباركود</p></div><button type="button" class="barcode-scanner-close" aria-label="إغلاق">×</button></div><div class="barcode-video-wrap"><video id="barcodeScannerVideo" playsinline muted></video><span class="barcode-scan-frame" aria-hidden="true"></span></div><p class="barcode-scanner-status" id="barcodeScannerStatus" role="status" aria-live="polite">جاري تجهيز الكاميرا...</p><div class="barcode-scanner-actions"><button type="button" class="barcode-start-button" id="barcodeScannerRetry">تشغيل الكاميرا</button><button type="button" class="barcode-cancel-button" id="barcodeScannerCancel">إلغاء</button></div><p class="barcode-scanner-note">تأكد من وجود رقم الباركود في بيانات المنتج داخل لوحة الإدارة.</p></div>';
  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal||e.target.closest(".barcode-scanner-close")||e.target.closest("#barcodeScannerCancel"))closeScanner();});
  modal.querySelector("#barcodeScannerRetry").addEventListener("click",startScanner);
  return modal;
 }
 function status(message){var el=document.getElementById("barcodeScannerStatus");if(el)el.textContent=message;}
 function stopCamera(){
  scanning=false;
  if(scanTimer){clearTimeout(scanTimer);scanTimer=null;}
  if(controls&&typeof controls.stop==="function"){try{controls.stop();}catch(e){}controls=null;}
  if(reader&&typeof reader.reset==="function"){try{reader.reset();}catch(e){}reader=null;}
  if(stream){stream.getTracks().forEach(function(t){t.stop();});stream=null;}
  var video=document.getElementById("barcodeScannerVideo");
  if(video){try{video.pause();video.srcObject=null;}catch(e){}}
 }
 function closeScanner(){stopCamera();if(modal)modal.hidden=true;document.body.classList.remove("barcode-scanner-open");}
 function loadZXing(){
  return new Promise(function(resolve,reject){
   if(window.ZXing&&window.ZXing.BrowserMultiFormatReader){resolve(window.ZXing);return;}
   var existing=document.querySelector('script[data-barcode-zxing="1"]');
   if(existing){existing.addEventListener("load",function(){resolve(window.ZXing);},{once:true});existing.addEventListener("error",reject,{once:true});return;}
   var script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";script.async=true;script.dataset.barcodeZxing="1";script.onload=function(){if(window.ZXing)resolve(window.ZXing);else reject(new Error("تعذر تحميل قارئ الباركود"));};script.onerror=function(){reject(new Error("تعذر تحميل قارئ الباركود. تحقق من الاتصال بالإنترنت."));};document.head.appendChild(script);
  });
 }
 function found(code){
  if(!scanning)return;
  stopCamera();
  closeScanner();
  var input=document.getElementById("searchInput");
  if(!input)return;
  input.value=String(code||"").trim();
  input.dispatchEvent(new Event("input",{bubbles:true}));
  var form=document.getElementById("searchForm");
  if(form)form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
  setTimeout(function(){
   var grid=document.getElementById("productGrid");
   var empty=grid&&grid.querySelector(".empty-state, .no-products, [data-empty-state]");
   if(grid&&grid.children.length===0){window.alert("تمت قراءة الباركود ("+input.value+")، لكن لم نعثر على منتج بهذا الرقم. أضف الباركود أو رقم الصنف للمنتج من لوحة الإدارة.");}
  },450);
 }
 async function startNative(video){
  var formats=["ean_13","ean_8","upc_a","upc_e","code_128","code_39","itf","qr_code","data_matrix","codabar"];
  var detector=new window.BarcodeDetector({formats:formats});
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}});
  video.srcObject=stream;await video.play();scanning=true;status("الكاميرا تعمل — ضع الباركود داخل الإطار");
  async function tick(){
   if(!scanning)return;
   try{var results=await detector.detect(video);if(results&&results.length&&results[0].rawValue){found(results[0].rawValue);return;}}
   catch(e){}
   if(scanning)scanTimer=setTimeout(tick,180);
  }
  tick();
 }
 async function startZXing(video){
  status("جاري تجهيز قارئ الباركود...");
  var ZX=await loadZXing();
  if(!scanning&&modal.hidden)return;
  reader=new ZX.BrowserMultiFormatReader();
  scanning=true;
  controls=await reader.decodeFromVideoDevice(undefined,video,function(result,error){
   if(result){var value=result.getText?result.getText():result.text;if(value)found(value);}
  });
  status("الكاميرا تعمل — ضع الباركود داخل الإطار");
 }
 async function startScanner(){
  ensureModal();
  stopCamera();
  var video=document.getElementById("barcodeScannerVideo");
  var retry=document.getElementById("barcodeScannerRetry");
  retry.disabled=true;status("جاري تشغيل الكاميرا...");
  try{
   if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error("الكاميرا غير متاحة. افتح الموقع من متصفح حديث عبر اتصال آمن HTTPS.");
   if("BarcodeDetector" in window){
    try{await startNative(video);}catch(nativeError){stopCamera();await startZXing(video);}
   }else{await startZXing(video);}
  }catch(e){stopCamera();status(e&&e.name==="NotAllowedError"?"لم تسمح بالوصول للكاميرا. فعّل إذن الكاميرا للموقع من إعدادات المتصفح.":(e.message||"تعذر تشغيل الكاميرا. حاول مرة أخرى."));}
  finally{retry.disabled=false;}
 }
 trigger.addEventListener("click",function(){ensureModal();modal.hidden=false;document.body.classList.add("barcode-scanner-open");startScanner();});
 document.addEventListener("keydown",function(e){if(e.key==="Escape"&&modal&&!modal.hidden)closeScanner();});
})();
