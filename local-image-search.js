(function () {
"use strict";
if (window.__DAWLY_LOCAL_IMAGE_SEARCH__) return;
window.__DAWLY_LOCAL_IMAGE_SEARCH__ = true;
var products = Array.isArray(window.DAWLY_PRODUCTS) ? window.DAWLY_PRODUCTS : [];
var cache = new Map(), selected = "", busy = false, modal;
function node(tag, attrs, html) {
  var n=document.createElement(tag);
  Object.keys(attrs||{}).forEach(function(k){if(k==="class")n.className=attrs[k];else if(k==="text")n.textContent=attrs[k];else n.setAttribute(k,attrs[k]);});
  if(html!=null)n.innerHTML=html; return n;
}
function status(s){var n=modal&&modal.querySelector("#dawlyImageSearchStatus");if(n)n.textContent=s;}
function styles(){
 if(document.getElementById("dawlyLocalImageSearchStyles"))return;
 var css=[
 "#dawlyImageSearchOpen{border:1px solid #d71920;background:#fff;color:#bd1720;border-radius:12px;padding:10px 15px;font:800 14px Cairo,Arial;cursor:pointer;min-height:44px}",
 "#dawlyImageSearchOverlay{position:fixed;inset:0;z-index:10050;background:rgba(13,20,29,.68);display:none;align-items:center;justify-content:center;padding:18px}",
 "#dawlyImageSearchOverlay.is-open{display:flex}",
 "#dawlyImageSearchModal{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:22px;box-shadow:0 22px 80px #0005;direction:rtl;color:#202832;font-family:Cairo,Arial}",
 "#dawlyImageSearchModal *{box-sizing:border-box}",
 ".dawly-is-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:10px}",
 ".dawly-is-head h2{font-size:23px;margin:0;font-weight:900}",
 "#dawlyImageSearchClose{border:0;background:#f1f3f5;border-radius:50%;width:38px;height:38px;font-size:25px;cursor:pointer}",
 ".dawly-is-drop{border:2px dashed #cbd2d9;border-radius:17px;padding:22px;text-align:center;background:#fafbfc;min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}",
 ".dawly-is-drop p{margin:0;color:#6b7480;font-size:14px}",
 "#dawlyImageSearchFile{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}",
 "#dawlyImageSearchChoose{background:#26384a;color:white;border:0;border-radius:13px;padding:12px 24px;font:900 16px Cairo,Arial;cursor:pointer}",
 "#dawlyImageSearchPreview{display:none;max-width:100%;max-height:250px;object-fit:contain;border-radius:12px}",
 ".dawly-is-actions{display:flex;gap:10px;margin-top:15px}",
 "#dawlyImageSearchRun{flex:1;min-height:51px;border:0;border-radius:13px;background:#d71920;color:white;font:900 16px Cairo,Arial;cursor:pointer}",
 "#dawlyImageSearchRun:disabled{opacity:.45;cursor:not-allowed}",
 "#dawlyImageSearchClear{border:1px solid #d8dde3;border-radius:12px;background:white;padding:0 15px;font:800 14px Cairo,Arial;cursor:pointer}",
 "#dawlyImageSearchStatus{margin:12px 0;color:#68727e;font-size:13px;min-height:23px}",
 "#dawlyImageSearchResults{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:14px}",
 ".dawly-is-result{display:flex;gap:10px;align-items:center;border:1px solid #e5e8ec;border-radius:13px;padding:9px;text-decoration:none;color:#202832;min-width:0}",
 ".dawly-is-result img{width:78px;height:78px;object-fit:contain;flex:0 0 78px;background:#f7f8f9;border-radius:8px}",
 ".dawly-is-result strong{display:block;font-size:13px;line-height:1.5}.dawly-is-result small{display:block;color:#737d88;margin-top:4px;font-size:11px}.dawly-is-result b{display:block;color:#bd1720;font-size:12px;margin-top:4px}",
 "@media(max-width:560px){#dawlyImageSearchModal{padding:16px}.dawly-is-head h2{font-size:20px}.dawly-is-drop{padding:16px}#dawlyImageSearchResults{grid-template-columns:1fr}.dawly-is-result img{width:70px;height:70px;flex-basis:70px}}"
 ].join("\n");
 document.head.appendChild(node("style",{id:"dawlyLocalImageSearchStyles"},css));
}
function build(){
 styles();
 var overlay=node("div",{id:"dawlyImageSearchOverlay"});
 overlay.innerHTML='<section id="dawlyImageSearchModal" role="dialog" aria-modal="true" aria-labelledby="dawlyImageSearchTitle"><div class="dawly-is-head"><h2 id="dawlyImageSearchTitle">البحث بصورة المنتج</h2><button id="dawlyImageSearchClose" type="button" aria-label="إغلاق">×</button></div><div class="dawly-is-drop"><strong>اختر صورة الأداة من جهازك</strong><p>البحث يتم محليًا داخل صور منتجات كتالوج الدولي فقط، دون إرسال الصورة إلى أي خدمة خارجية.</p><img id="dawlyImageSearchPreview" alt="معاينة الصورة المختارة"><input id="dawlyImageSearchFile" type="file" accept="image/jpeg,image/png,image/webp"><button id="dawlyImageSearchChoose" type="button">اختر صورة المنتج　＋</button></div><div class="dawly-is-actions"><button id="dawlyImageSearchRun" type="button" disabled>ابحث عن منتجات مشابهة</button><button id="dawlyImageSearchClear" type="button">مسح الصورة</button></div><p id="dawlyImageSearchStatus" role="status" aria-live="polite">النتائج تقريبية حسب التشابه البصري مع صور المنتجات المتاحة.</p><div id="dawlyImageSearchResults"></div></section>';
 document.body.appendChild(overlay);modal=overlay;
 var file=overlay.querySelector("#dawlyImageSearchFile");
 overlay.querySelector("#dawlyImageSearchChoose").onclick=function(){file.click();};
 file.onchange=function(){
  var f=file.files&&file.files[0];if(!f)return;
  if(!/^image\/(jpeg|png|webp)$/.test(f.type)){status("اختر صورة JPG أو PNG أو WEBP.");file.value="";return;}
  if(f.size>8*1024*1024){status("اختر صورة أقل من 8 ميجابايت.");file.value="";return;}
  var reader=new FileReader();
  reader.onload=function(){selected=String(reader.result||"");var im=overlay.querySelector("#dawlyImageSearchPreview");im.src=selected;im.style.display="block";overlay.querySelector("#dawlyImageSearchRun").disabled=false;overlay.querySelector("#dawlyImageSearchResults").innerHTML="";status("تم تحميل الصورة. اضغط ابحث عن منتجات مشابهة.");};
  reader.onerror=function(){status("تعذر قراءة الصورة، حاول مرة أخرى.");};reader.readAsDataURL(f);
 };
 overlay.querySelector("#dawlyImageSearchRun").onclick=search;
 overlay.querySelector("#dawlyImageSearchClear").onclick=clear;
 overlay.querySelector("#dawlyImageSearchClose").onclick=close;
 overlay.onclick=function(e){if(e.target===overlay)close();};
 document.addEventListener("keydown",function(e){if(e.key==="Escape"&&modal.classList.contains("is-open"))close();});
}
function open(){if(!modal)build();modal.classList.add("is-open");document.body.style.overflow="hidden";}
function close(){if(modal)modal.classList.remove("is-open");document.body.style.overflow="";}
function clear(){selected="";var f=modal.querySelector("#dawlyImageSearchFile");f.value="";var p=modal.querySelector("#dawlyImageSearchPreview");p.removeAttribute("src");p.style.display="none";modal.querySelector("#dawlyImageSearchRun").disabled=true;modal.querySelector("#dawlyImageSearchResults").innerHTML="";status("اختر صورة لبدء البحث المحلي.");}
function loadImage(src){return new Promise(function(resolve,reject){var im=new Image();if(src.indexOf("data:")!==0)im.crossOrigin="anonymous";im.onload=function(){resolve(im);};im.onerror=reject;im.src=src;});}
function describe(im){
 var c=document.createElement("canvas");c.width=c.height=64;var x=c.getContext("2d",{willReadFrequently:true});x.drawImage(im,0,0,64,64);
 var d=x.getImageData(0,0,64,64).data,g=new Float32Array(4096),h=new Array(48).fill(0),sp=new Array(192).fill(0),ed=new Array(128).fill(0);
 for(var y=0;y<64;y++)for(var xx=0;xx<64;xx++){var k=(y*64+xx)*4,r=d[k],gg=d[k+1],b=d[k+2];g[y*64+xx]=.299*r+.587*gg+.114*b;if(d[k+3]<20)continue;h[Math.min(3,r>>6)*12+Math.min(3,gg>>6)*3+Math.min(2,Math.floor(b/86))]++;var z=(Math.floor(y/16)*4+Math.floor(xx/16))*12;sp[z+Math.min(3,r>>6)]++;sp[z+4+Math.min(3,gg>>6)]++;sp[z+8+Math.min(3,b>>6)]++;}
 for(var yy=1;yy<63;yy++)for(var xxx=1;xxx<63;xxx++){var gx=g[yy*64+xxx+1]-g[yy*64+xxx-1],gy=g[(yy+1)*64+xxx]-g[(yy-1)*64+xxx],m=Math.hypot(gx,gy);if(m<18)continue;var a=Math.atan2(gy,gx)+Math.PI,bin=Math.min(7,Math.floor(a/(2*Math.PI)*8)),z=(Math.floor(yy/16)*4+Math.floor(xxx/16))*8;ed[z+bin]+=m;}
 function n(a){var sum=a.reduce(function(v,q){return v+q;},0)||1;return a.map(function(v){return v/sum;});}
 return {h:n(h),sp:n(sp),ed:n(ed)};
}
function sim(a,b){function dist(x,y){var s=0;for(var i=0;i<x.length;i++)s+=Math.abs(x[i]-y[i]);return s/2;}return Math.max(0,Math.min(100,Math.round(100*(1-(dist(a.h,b.h)*.25+dist(a.sp,b.sp)*.42+dist(a.ed,b.ed)*.33)))));}
async function source(p){
 var direct=p.image||p.imageUrl||p.imageURL||p.photo||p.img||"";
 if(direct&&/^data:image\//i.test(String(direct)))return String(direct);
 var id=p.imageId||p.image_id||p._imageId||"";
 if(id&&typeof window.DAWLY_LOAD_PRODUCT_IMAGE==="function"){try{var u=await window.DAWLY_LOAD_PRODUCT_IMAGE(id);if(u)return u;}catch(e){}}
 return direct?String(direct):"";
}
async function productDescriptor(p){var key=String(p.id||p._docId||p.name||"");if(cache.has(key))return cache.get(key);var src=await source(p);if(!src)return null;var d=describe(await loadImage(src));cache.set(key,d);return d;}
async function catalog(){
 if(Array.isArray(window.DAWLY_PRODUCTS)&&window.DAWLY_PRODUCTS.length){products=window.DAWLY_PRODUCTS;return true;}
 return new Promise(function(resolve){var done=false;function finish(ok){if(done)return;done=true;window.removeEventListener("dawly-products-updated",updated);window.removeEventListener("dawly-catalog-ready",ready);resolve(ok);}function updated(e){if(Array.isArray(e.detail)&&e.detail.length){products=e.detail;finish(true);}}function ready(){products=Array.isArray(window.DAWLY_PRODUCTS)?window.DAWLY_PRODUCTS:[];finish(products.length>0);}window.addEventListener("dawly-products-updated",updated);window.addEventListener("dawly-catalog-ready",ready);setTimeout(function(){products=Array.isArray(window.DAWLY_PRODUCTS)?window.DAWLY_PRODUCTS:[];finish(products.length>0);},15000);});
}
async function search(){
 if(busy||!selected)return;busy=true;var btn=modal.querySelector("#dawlyImageSearchRun"),out=modal.querySelector("#dawlyImageSearchResults");btn.disabled=true;out.innerHTML="";
 try{
  status("جاري تجهيز الصورة والكتالوج المحلي...");var target=describe(await loadImage(selected));if(!(await catalog()))throw Error("catalog");
  var list=products.filter(function(p){return p&&p.hiddenFromStore!==true;}).slice(0,500);if(!list.length)throw Error("catalog");
  var scored=[],done=0,failed=0,next=0;
  async function worker(){while(next<list.length){var i=next++,p=list[i];try{var d=await productDescriptor(p);if(d)scored.push({p:p,s:sim(target,d)});else failed++;}catch(e){failed++;}done++;if(done%5===0||done===list.length)status("مقارنة صور الكتالوج محليًا: "+done+" / "+list.length);}}
  await Promise.all([worker(),worker(),worker(),worker()]);scored.sort(function(a,b){return b.s-a.s;});var top=scored.filter(function(x){return x.s>=18;}).slice(0,12);if(!top.length)top=scored.slice(0,6);
  if(!top.length){status("لا توجد صور منتجات متاحة للمقارنة في الكتالوج.");return;}
  out.innerHTML=top.map(function(x){var p=x.p,n=String(p.name||"منتج من الدولي").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}),brand=String(p.brand||p.brandName||p.cat||"").replace(/</g,"&lt;"),price=String(p.price||"السعر عند التواصل").replace(/</g,"&lt;"),img=p.image||p.imageUrl||p.imageURL||p.photo||"",href="product.html?id="+encodeURIComponent(String(p.id));return '<a class="dawly-is-result" href="'+href+'">'+(img?'<img src="'+img.replace(/"/g,"%22")+'" alt="'+n+'" loading="lazy">':'<span>🔧</span>')+'<span><strong>'+n+'</strong><small>'+brand+' · تشابه بصري '+x.s+'%</small><b>'+price+'</b></span></a>';}).join("");
  status("اكتمل البحث داخل الموقع فقط. تمت مقارنة "+done+" منتجًا؛ تعذر تحميل "+failed+" صورة.");
 }catch(e){status(e.message==="catalog"?"الكتالوج لم يكتمل تحميله بعد. انتظر قليلًا ثم أعد المحاولة.":"تعذر إتمام البحث المحلي. جرّب صورة أوضح.");console.warn("Local image search:",e);}
 finally{busy=false;if(selected)btn.disabled=false;}
}
function mount(){
 if(document.getElementById("dawlyImageSearchOpen"))return;
 var toolbar=document.querySelector(".product-toolbar");if(!toolbar)return;
 var b=node("button",{id:"dawlyImageSearchOpen",type:"button",text:"⌕ البحث بصورة المنتج"});b.onclick=open;toolbar.insertBefore(b,toolbar.firstChild);
}
function init(){mount();var n=0;var retry=function(){if(!document.getElementById("dawlyImageSearchOpen")&&n++<20){mount();setTimeout(retry,250);}};retry();window.addEventListener("dawly-products-updated",function(e){if(Array.isArray(e.detail))products=e.detail;});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();