import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, deleteDoc, getCountFromServer, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

(function(){
  const config=window.DAWLY_FIREBASE_CONFIG||{};
  if(!config.apiKey||!config.projectId)return;
  const app=getApps().length?getApps()[0]:initializeApp(config);
  const db=getFirestore(app);
  const STYLE_ID="dawly-product-likes-style";
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement("style");style.id=STYLE_ID;
    style.textContent=`.dawly-like{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:6px 11px;border:1px solid #e4e7eb;border-radius:999px;background:#fff;color:#59616b;font:800 12px Cairo,Arial,sans-serif;cursor:pointer;transition:.18s}.dawly-like svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.dawly-like.is-liked{color:#d71920;border-color:#f1c5c8;background:#fff7f7}.dawly-like.is-liked svg{fill:#d71920;stroke:#d71920}.dawly-like:disabled{opacity:.6;cursor:wait}.dawly-like-wrap{display:flex;justify-content:flex-start;margin:8px 0 2px}.product-card .dawly-like-wrap{margin:7px 0}.dawly-detail-like{margin:12px 0 4px}`;
    document.head.appendChild(style);
  }
  let visitorId="";
  try{visitorId=localStorage.getItem("dawly_like_visitor_v1")||"";if(!visitorId){visitorId=crypto.randomUUID?crypto.randomUUID():"v"+Date.now().toString(36)+Math.random().toString(36).slice(2);localStorage.setItem("dawly_like_visitor_v1",visitorId);}}catch(_){visitorId="v"+Math.random().toString(36).slice(2)+Date.now().toString(36);}
  const pending=new Set();
  function safeId(v){return String(v||"").trim().replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,100);}
  async function mount(host,id,detail){
    id=safeId(id);const card=host.closest(".product-card");if(!id||host.querySelector(".dawly-like")||(card&&card.querySelector(".dawly-like")))return;
    const wrap=document.createElement("div");wrap.className="dawly-like-wrap"+(detail?" dawly-detail-like":"");
    const btn=document.createElement("button");btn.type="button";btn.className="dawly-like";btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg><span class="like-count">…</span>';
    btn.setAttribute("aria-label","إعجاب بالمنتج");wrap.appendChild(btn);host.appendChild(wrap);
    const voters=collection(db,"productLikes",id,"voters"), voterRef=doc(voters,visitorId);
    let liked=false,count=0;
    async function refresh(){
      try{const [mine,total]=await Promise.all([getDoc(voterRef),getCountFromServer(voters)]);liked=mine.exists();count=total.data().count||0;btn.classList.toggle("is-liked",liked);btn.setAttribute("aria-pressed",String(liked));btn.querySelector(".like-count").textContent=count.toLocaleString("ar-EG");btn.title=liked?"إلغاء الإعجاب":"أعجبني";}catch(e){console.warn("Product likes unavailable:",e);btn.querySelector(".like-count").textContent="—";}
    }
    btn.addEventListener("click",async()=>{
      if(pending.has(id))return;pending.add(id);btn.disabled=true;
      try{
        if(liked){await deleteDoc(voterRef);liked=false;count=Math.max(0,count-1);}
        else{await setDoc(voterRef,{visitorId:visitorId,productId:id,createdAt:serverTimestamp()});liked=true;count++;}
        btn.classList.toggle("is-liked",liked);btn.setAttribute("aria-pressed",String(liked));btn.querySelector(".like-count").textContent=count.toLocaleString("ar-EG");btn.title=liked?"إلغاء الإعجاب":"أعجبني";
      }catch(e){console.error(e);alert("تعذر تسجيل الإعجاب. تأكد من تحديث قواعد Firebase ثم حاول مرة أخرى.");}
      finally{btn.disabled=false;pending.delete(id);}
    });
    refresh();
  }
  function scan(){
    document.querySelectorAll("[data-like-product-id]").forEach(card=>{
      const id=card.getAttribute("data-like-product-id");
      if(id)mount(card.querySelector(".actions")||card,id,false);
    });
    document.querySelectorAll(".product-card").forEach(card=>{
      const link=card.querySelector('a[href*="product.html?id="],a[href*="/product/"]');
      if(!link)return;let id="";
      try{id=new URL(link.href,location.href).searchParams.get("id")||"";}catch(_){}
      if(!id){const add=card.querySelector("[data-add]");if(add)id=add.getAttribute("data-add")||"";}
      if(id)mount(card.querySelector(".product-info")||card,id,false);
    });
    const detail=document.getElementById("productDetail");
    if(detail&&detail.querySelector(".product-detail-title, h1")){
      const id=new URLSearchParams(location.search).get("id");
      if(id)mount(detail,id,true);
    }
  }
  const observer=new MutationObserver(scan);observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",scan);else scan();
  window.addEventListener("dawly-products-updated",scan);
})();