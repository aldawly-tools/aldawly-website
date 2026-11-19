
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
(function(){
  const config = window.DAWLY_FIREBASE_CONFIG || {};
  const section = document.getElementById("brands");
  if (!section || !config.apiKey || !config.projectId) return;
  const tiles = section.querySelector(".brands-marquee-group");
  if (!tiles) return;
  let db;
  try { const app=getApps().length?getApps()[0]:initializeApp(config); db=getFirestore(app); }
  catch(error){console.warn("Brand logo library could not start:",error);return;}
  function key(value){
    return String(value||"").trim().toLocaleLowerCase("ar")
      .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
      .replace(/[ـ\u064B-\u065F\u0670]/g,"").replace(/\s+/g," ");
  }
  function existingTile(brand){
    const wanted=key(brand);
    return Array.from(tiles.querySelectorAll(".brand-word")).find(function(tile){
      return key(tile.querySelector(".brand-name-sr")?.textContent||"")===wanted;
    });
  }
  function makeTile(brand){
    const tile=document.createElement("a");tile.className="brand-word brand-tile brand-text-logo";
    tile.href="products.html?brand="+encodeURIComponent(brand)+"#productGrid";
    tile.dataset.brandTarget=tile.href;tile.setAttribute("aria-label","منتجات "+brand);
    const img=document.createElement("img");img.className="brand-logo";img.alt=brand+" logo";img.loading="lazy";img.decoding="async";
    const mark=document.createElement("span");mark.className="brand-text-mark";mark.textContent=brand;
    const name=document.createElement("span");name.className="brand-name-sr";name.textContent=brand;
    tile.append(mark,name);tiles.appendChild(tile);return tile;
  }
  async function loadLogo(tile,brand,imageId){
    if(!imageId||tile.dataset.logoLoaded===imageId)return;
    tile.dataset.logoLoaded=imageId;
    try{
      const snapshot=await getDoc(doc(db,"productImages",String(imageId)));
      if(!snapshot.exists())return;
      const data=String(snapshot.data().data||"");if(!data.startsWith("data:image/"))return;
      let img=tile.querySelector(".brand-logo");
      if(!img){img=document.createElement("img");img.className="brand-logo";img.alt=brand+" logo";img.loading="lazy";img.decoding="async";tile.insertBefore(img,tile.querySelector(".brand-name-sr"));}
      img.src=data;tile.classList.remove("brand-text-logo");
      const mark=tile.querySelector(".brand-text-mark");if(mark)mark.remove();
    }catch(error){tile.dataset.logoLoaded="";console.warn("Could not load saved brand logo:",brand,error);}
  }
  let lastSignature="";
  async function renderBrandLogos(products){
    const brands=new Map();
    (Array.isArray(products)?products:[]).forEach(function(product){
      const brand=String(product.brand||"").trim(),imageId=String(product.brandLogoImageId||"").trim();
      if(!brand)return;const k=key(brand);
      if(!brands.has(k))brands.set(k,{brand:brand,imageId:imageId});
    });
    const signature=Array.from(brands.values()).map(function(x){return key(x.brand)+":"+x.imageId;}).join("|");
    if(signature===lastSignature)return;lastSignature=signature;
    for(const entry of brands.values()){const tile=existingTile(entry.brand)||makeTile(entry.brand);if(entry.imageId)await loadLogo(tile,entry.brand,entry.imageId);}
  }
  function start(){if(Array.isArray(window.DAWLY_PRODUCTS))renderBrandLogos(window.DAWLY_PRODUCTS);}
  window.addEventListener("dawly-products-updated",function(event){renderBrandLogos(event.detail);});
  window.addEventListener("dawly-catalog-ready",start);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
