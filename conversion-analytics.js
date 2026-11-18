/* Anonymous conversion tracking. Admin accounts and uncertain auth states are excluded. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

(async function initConversionTracking(){
  try{
    if(!window.DAWLY_FIREBASE_CONFIG)return;
    const app=getApps().length?getApps()[0]:initializeApp(window.DAWLY_FIREBASE_CONFIG);
    const auth=getAuth(app);
    const db=getFirestore(app);
    const admins=new Set(["elgoharemahmoud@gmail.com","ahmedelgohare90@gmail.com"].map(v=>v.toLowerCase()));
    const authState=await new Promise(resolve=>{
      let unsubscribe=()=>{};
      try{
        unsubscribe=onAuthStateChanged(auth,user=>{unsubscribe();resolve({ok:true,user});},()=>{unsubscribe();resolve({ok:false,user:null});});
      }catch(error){resolve({ok:false,user:null});}
    });
    if(!authState.ok)return;
    if(authState.user&&admins.has(String(authState.user.email||"").trim().toLowerCase()))return;

    let visitorId="";
    try{visitorId=localStorage.getItem("aldawly_visitor_id")||"";}catch(e){}
    if(!visitorId){
      visitorId=crypto.randomUUID?crypto.randomUUID():"v-"+Math.random().toString(36).slice(2)+Date.now().toString(36);
      try{localStorage.setItem("aldawly_visitor_id",visitorId);}catch(e){}
    }
    const dayParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const part=type=>dayParts.find(item=>item.type===type).value;
    const day=part("year")+"-"+part("month")+"-"+part("day");
    window.DAWLY_TRACK_CONVERSION=function(eventType,payload){
      if(!["add_to_cart","whatsapp_order"].includes(eventType))return Promise.resolve(false);
      const safe=payload&&typeof payload==="object"?payload:{};
      const record={
        eventType,visitorId,day,
        productId:String(safe.productId||"").slice(0,80),
        productName:String(safe.productName||"").slice(0,180),
        brand:String(safe.brand||"").slice(0,80),
        itemCount:Math.max(0,Math.min(100,Number(safe.itemCount||0))),
        productNames:Array.isArray(safe.productNames)?safe.productNames.slice(0,30).map(v=>String(v).slice(0,180)):[],
        createdAt:serverTimestamp()
      };
      return addDoc(collection(db,"storeEvents"),record).then(()=>true).catch(error=>{console.warn("Conversion event was not saved:",error);return false;});
    };
  }catch(error){console.warn("Conversion tracker unavailable:",error);}
})();