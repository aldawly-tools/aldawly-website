/* Anonymous visitor counter. Admin accounts are never written as visits. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, serverTimestamp, getCountFromServer, query, where } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

(async function initVisitorCounter() {
  const totalNode=document.getElementById("siteVisitsTotal");
  const todayNode=document.getElementById("siteVisitsToday");
  if(!totalNode||!todayNode||!window.DAWLY_FIREBASE_CONFIG)return;
  const format=value=>new Intl.NumberFormat("ar-EG").format(value);
  const cairoParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=type=>cairoParts.find(item=>item.type===type).value;
  const day=part("year")+"-"+part("month")+"-"+part("day");
  try{
    const app=getApps().length?getApps()[0]:initializeApp(window.DAWLY_FIREBASE_CONFIG);
    const auth=getAuth(app);
    const db=getFirestore(app);
    const ADMIN_EMAILS=new Set(["elgoharemahmoud@gmail.com","ahmedelgohare90@gmail.com"].map(v=>v.toLowerCase()));

    // A confirmed admin is excluded. If auth state cannot be confirmed, do not write a visit.
    const authState=await new Promise(resolve=>{
      let unsubscribe=()=>{};
      try{
        unsubscribe=onAuthStateChanged(auth,user=>{unsubscribe();resolve({ok:true,user});},()=>{unsubscribe();resolve({ok:false,user:null});});
      }catch(error){resolve({ok:false,user:null});}
    });
    const user=authState.user;
    const isAdmin=!!(authState.ok&&user&&ADMIN_EMAILS.has(String(user.email||"").trim().toLowerCase()));

    if(authState.ok&&!isAdmin){
      let visitorId="";
      try{visitorId=localStorage.getItem("aldawly_visitor_id")||"";}catch(e){}
      if(!visitorId){
        visitorId=crypto.randomUUID?crypto.randomUUID():"v-"+Math.random().toString(36).slice(2)+Date.now().toString(36);
        try{localStorage.setItem("aldawly_visitor_id",visitorId);}catch(e){}
      }
      const visitRef=doc(db,"siteVisits",visitorId+"_"+day);
      const existing=await getDoc(visitRef);
      if(!existing.exists())await setDoc(visitRef,{visitorId,day,createdAt:serverTimestamp()});
    }

    // Admins can still view totals. Auth failures also show totals but never create a visit.
    const visits=collection(db,"siteVisits");
    const [total,today]=await Promise.all([
      getCountFromServer(visits),
      getCountFromServer(query(visits,where("day","==",day)))
    ]);
    totalNode.textContent=format(total.data().count);
    todayNode.textContent=format(today.data().count);
  }catch(error){
    console.warn("Visitor counter unavailable:",error);
    totalNode.textContent="—";
    todayNode.textContent="—";
  }
})();