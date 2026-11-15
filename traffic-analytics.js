/* Anonymous traffic and product-view analytics. No IP, names or contact details are collected. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
(function(){
 try {
  if(!window.DAWLY_FIREBASE_CONFIG)return;
  const params=new URLSearchParams(location.search);
  const app=getApps().length?getApps()[0]:initializeApp(window.DAWLY_FIREBASE_CONFIG);
  const db=getFirestore(app);
  let visitorId=localStorage.getItem("aldawly_visitor_id");
  if(!visitorId){visitorId=crypto.randomUUID?crypto.randomUUID():"v-"+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem("aldawly_visitor_id",visitorId);}
  const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const sourceRaw=params.get("utm_source")||document.referrer||"direct";
  let source="direct";
  if(params.get("utm_source"))source=String(params.get("utm_source")).toLowerCase().slice(0,40);
  else if(sourceRaw!=="direct"){try{const host=new URL(sourceRaw).hostname.toLowerCase();source=/facebook|fb\./.test(host)?"facebook":/google/.test(host)?"google":/whatsapp|wa\.me/.test(host)?"whatsapp":/instagram/.test(host)?"instagram":/tiktok/.test(host)?"tiktok":"other";}catch(e){}}
  const sourceId=visitorId+"_"+day;
  const sourceFlag="aldawly_source_logged_"+day;
  if(!localStorage.getItem(sourceFlag)){
   setDoc(doc(db,"trafficSources",sourceId),{visitorId,day,source,createdAt:serverTimestamp()}).then(()=>localStorage.setItem(sourceFlag,"1")).catch(e=>console.warn("Traffic analytics:",e));
  }
  const match=location.pathname.match(/product\.html$/i);
  const productId=match?params.get("id"):"";
  if(productId){
   const id=String(productId).replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
   const viewFlag="aldawly_product_view_"+day+"_"+id;
   if(id&&!localStorage.getItem(viewFlag)){
    setDoc(doc(db,"productViews",visitorId+"_"+day+"_"+id),{visitorId,day,productId:id,createdAt:serverTimestamp()}).then(()=>localStorage.setItem(viewFlag,"1")).catch(e=>console.warn("Product view analytics:",e));
   }
  }
 }catch(error){console.warn("Analytics tracker unavailable:",error);}
})();
