/* Anonymous traffic and product-view analytics. Admin accounts are excluded before any write. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

(async function trackStoreTraffic(){
 try {
  if(!window.DAWLY_FIREBASE_CONFIG)return;
  const app=getApps().length?getApps()[0]:initializeApp(window.DAWLY_FIREBASE_CONFIG);
  const auth=getAuth(app);
  const db=getFirestore(app);
  const ADMIN_EMAILS=new Set(["elgoharemahmoud@gmail.com","ahmedelgohare90@gmail.com"].map(v=>v.toLowerCase()));

  // Wait for Firebase to restore the session. If auth cannot be checked, fail closed:
  // do not record a visit or product view because this could be an admin session.
  const authState=await new Promise(resolve=>{
   let unsubscribe=()=>{};
   try {
    unsubscribe=onAuthStateChanged(auth,user=>{unsubscribe();resolve({ok:true,user});},()=>{unsubscribe();resolve({ok:false,user:null});});
   } catch(error) { resolve({ok:false,user:null}); }
  });
  if(!authState.ok)return;
  const user=authState.user;
  if(user && ADMIN_EMAILS.has(String(user.email||"").trim().toLowerCase()))return;

  const params=new URLSearchParams(location.search);
  const cairoParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=type=>cairoParts.find(item=>item.type===type).value;
  const day=part("year")+"-"+part("month")+"-"+part("day");
  let visitorId="";
  try{visitorId=localStorage.getItem("aldawly_visitor_id")||"";}catch(e){}
  if(!visitorId){
   visitorId=crypto.randomUUID?crypto.randomUUID():"v-"+Math.random().toString(36).slice(2)+Date.now().toString(36);
   try{localStorage.setItem("aldawly_visitor_id",visitorId);}catch(e){}
  }

  await setDoc(doc(db,"siteVisits",visitorId+"_"+day),{visitorId,day,createdAt:serverTimestamp()});

  const rawSource=String(params.get("utm_source")||document.referrer||"direct").toLowerCase();
  let source="direct";
  if(params.get("utm_source")){
   const tag=String(params.get("utm_source")).trim().toLowerCase();
   source=/chatgpt|openai/.test(tag)?"chatgpt":/facebook|fb|messenger/.test(tag)?"facebook":/google/.test(tag)?"google":/whatsapp|wa/.test(tag)?"whatsapp":/instagram/.test(tag)?"instagram":/tiktok/.test(tag)?"tiktok":tag.slice(0,40)||"other";
  }else if(rawSource!=="direct"){
   try{
    const host=new URL(rawSource).hostname.toLowerCase();
    source=/chatgpt\.com$|openai\.com$/.test(host)?"chatgpt":/facebook|fb\./.test(host)?"facebook":/google\./.test(host)?"google":/whatsapp|wa\.me/.test(host)?"whatsapp":/instagram/.test(host)?"instagram":/tiktok/.test(host)?"tiktok":/messenger/.test(host)?"facebook":"other";
   }catch(e){source="direct";}
  }
  const sourceFlag="aldawly_source_logged_"+day;
  let sourceAlreadyLogged=false;
  try{sourceAlreadyLogged=localStorage.getItem(sourceFlag)==="1";}catch(e){}
  if(!sourceAlreadyLogged){
   setDoc(doc(db,"trafficSources",visitorId+"_"+day),{visitorId,day,source,createdAt:serverTimestamp()})
    .then(()=>{try{localStorage.setItem(sourceFlag,"1");}catch(e){}})
    .catch(error=>console.warn("Traffic source tracking:",error));
  }

  const isProductPage=/(?:^|\/)product(?:\.html)?\/?$/i.test(location.pathname);
  const productId=isProductPage?params.get("id"):"";
  const id=String(productId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  if(id){
   const viewFlag="aldawly_product_view_"+day+"_"+id;
   let alreadyViewed=false;
   try{alreadyViewed=localStorage.getItem(viewFlag)==="1";}catch(e){}
   if(!alreadyViewed){
    setDoc(doc(db,"productViews",visitorId+"_"+day+"_"+id),{visitorId,day,productId:id,createdAt:serverTimestamp()})
     .then(()=>{try{localStorage.setItem(viewFlag,"1");}catch(e){}})
     .catch(error=>console.warn("Product view tracking:",error));
   }
  }
 }catch(error){console.warn("Analytics tracker unavailable:",error);}
})();