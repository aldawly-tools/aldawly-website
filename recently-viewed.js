(function(){
"use strict";
const KEY="dawly_recently_viewed_v1",MAX=8;
function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch(e){return[]}}
function save(v){try{localStorage.setItem(KEY,JSON.stringify(v.slice(0,MAX)))}catch(e){}}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){
 const section=document.getElementById("recentlyViewedSection"),host=document.getElementById("recentlyViewedProducts");
 if(!section||!host)return;
 const list=read().filter(x=>x&&x.id);
 if(!list.length){section.hidden=true;return}
 section.hidden=false;
 host.innerHTML=list.map(x=>{
  const url="product.html?id="+encodeURIComponent(x.id);
  const img=x.image?'<img src="'+esc(x.image)+'" alt="'+esc(x.name)+'" loading="lazy">':x.imageId?'<img data-recent-cloud-image="'+esc(x.imageId)+'" alt="'+esc(x.name)+'" loading="lazy">':'<span class="recent-view-placeholder">🧰</span>';
  return '<a class="recent-view-card" href="'+url+'"><span class="recent-view-image">'+img+'</span><span class="recent-view-info"><small>'+esc(x.brand||x.cat||"منتجات")+'</small><strong>'+esc(x.name)+'</strong><b>'+esc(x.price||"للاستفسار عن السعر")+'</b></span></a>';
 }).join("");
 if(typeof window.DAWLY_LOAD_PRODUCT_IMAGE==="function")host.querySelectorAll("[data-recent-cloud-image]").forEach(img=>window.DAWLY_LOAD_PRODUCT_IMAGE(img.dataset.recentCloudImage).then(url=>{if(url&&img.isConnected)img.src=url}).catch(()=>{}));
}
function record(item){
 if(!item||item.id==null)return;
 const x={id:String(item.id),name:String(item.name||"منتج من الدولي"),brand:String(item.brand||""),cat:String(item.cat||""),price:String(item.price||""),image:String(item.image||""),imageId:String(item.imageId||"")};
 const list=read().filter(v=>String(v.id)!==x.id);list.unshift(x);save(list);render();
}
window.DAWLY_RECORD_VIEWED_PRODUCT=record;
document.addEventListener("click",function(e){if(e.target.closest("#clearRecentlyViewed")){try{localStorage.removeItem(KEY)}catch(err){}render()}});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render);else render();
})();