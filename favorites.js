(function(){
"use strict";
var KEY="dawly_saved_products_v1";
function read(){try{var v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch(e){return[]}}
function write(v){localStorage.setItem(KEY,JSON.stringify(v));window.dispatchEvent(new Event("dawly-favorites-updated"))}
function clean(s){return String(s||"").trim()}
function snapshot(card){
 var link=card.querySelector('a[href*="product.html"],a[href*="product/"],a.product-card-link,a');
 var img=card.querySelector(".product-visual img, img");
 var name=card.querySelector(".product-name,h3,h2,strong");
 var desc=card.querySelector(".product-description");
 var price=card.querySelector(".product-price");
 var href=link?link.getAttribute("href"):"";
 var id=card.getAttribute("data-product-id")||card.dataset.id||card.getAttribute("data-id")||href;
 if(!id) id=clean(name&&name.textContent);
 return {id:String(id),name:clean(name&&name.textContent)||"منتج من الدولي",description:clean(desc&&desc.textContent),price:clean(price&&price.textContent),image:img?(img.currentSrc||img.src||""):"",url:href?new URL(href,location.href).href:location.href};
}
function mount(card){
 if(card.dataset.favoriteReady==="1")return;
 var item=snapshot(card);if(!item.id)return;
 card.dataset.favoriteReady="1";
 card.style.position=card.style.position||"relative";
 var btn=document.createElement("button");btn.type="button";btn.className="dawly-favorite-toggle";btn.setAttribute("aria-label","حفظ المنتج في المفضلة");btn.title="احفظ المنتج للرجوع إليه";
 function paint(){var saved=read().some(function(x){return x.id===item.id});btn.classList.toggle("is-saved",saved);btn.textContent=saved?"♥":"♡";btn.setAttribute("aria-pressed",saved?"true":"false");}
 btn.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var all=read(),i=all.findIndex(function(x){return x.id===item.id});if(i>=0)all.splice(i,1);else all.unshift(item);write(all);paint();});
 card.appendChild(btn);paint();
}
function scan(root){(root||document).querySelectorAll(".product-card").forEach(mount)}
function addStyles(){if(document.getElementById("dawly-favorites-style"))return;var s=document.createElement("style");s.id="dawly-favorites-style";s.textContent='.dawly-favorite-toggle{position:absolute;z-index:8;top:10px;inset-inline-start:10px;width:40px;height:40px;border:1px solid #e2e6eb;border-radius:50%;background:#fff;color:#737b85;font:28px/1 Arial;display:grid;place-items:center;box-shadow:0 3px 12px #17202b20;cursor:pointer}.dawly-favorite-toggle.is-saved{color:#d71920;border-color:#f1b8bc;background:#fff5f5}.dawly-favorite-toggle:active{transform:scale(.94)}.favorites-page{padding:24px 0}.favorites-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}.favorite-item{border:1px solid #e1e5e9;border-radius:14px;padding:12px;background:#fff;display:flex;flex-direction:column;gap:8px;min-width:0}.favorite-item img{width:100%;height:150px;object-fit:contain}.favorite-item h3{font-size:15px;margin:0}.favorite-item p{font-size:12px;color:#68717b;margin:0}.favorite-item a{color:#c8101e;font-weight:800}.favorite-remove{border:1px solid #e1e5e9;border-radius:8px;background:#fff;padding:8px;font-weight:800}.favorites-empty{text-align:center;padding:48px 15px;color:#68717b;background:#f7f8fa;border-radius:14px;line-height:2}@media(max-width:600px){.favorites-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.favorite-item{padding:8px}.favorite-item img{height:125px}}';document.head.appendChild(s)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){addStyles();scan();var grid=document.getElementById("productGrid");if(grid)new MutationObserver(function(){scan(grid)}).observe(grid,{childList:true,subtree:true});});else{addStyles();scan()}
window.DAWLY_FAVORITES={read:read,write:write};
})();