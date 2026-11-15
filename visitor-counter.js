/* Anonymous, privacy-friendly visitor counter for Aldawly Tools.
   Counts each browser once per day; no names, emails, IP addresses or device fingerprints. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, serverTimestamp,
  getCountFromServer, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(async function initVisitorCounter() {
  const totalNode = document.getElementById("siteVisitsTotal");
  const todayNode = document.getElementById("siteVisitsToday");
  if (!totalNode || !todayNode || !window.DAWLY_FIREBASE_CONFIG) return;

  const format = value => new Intl.NumberFormat("ar-EG").format(value);
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(window.DAWLY_FIREBASE_CONFIG);
    const db = getFirestore(app);
    let visitorId = localStorage.getItem("aldawly_visitor_id");
    if (!visitorId) {
      visitorId = (crypto.randomUUID ? crypto.randomUUID() : "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem("aldawly_visitor_id", visitorId);
    }

    const visitRef = doc(db, "siteVisits", visitorId + "_" + day);
    const existing = await getDoc(visitRef);
    if (!existing.exists()) {
      await setDoc(visitRef, {
        visitorId,
        day,
        createdAt: serverTimestamp()
      });
    }

    const visits = collection(db, "siteVisits");
    const [total, today] = await Promise.all([
      getCountFromServer(visits),
      getCountFromServer(query(visits, where("day", "==", day)))
    ]);
    totalNode.textContent = format(total.data().count);
    todayNode.textContent = format(today.data().count);
  } catch (error) {
    console.warn("Visitor counter unavailable:", error);
    totalNode.textContent = "—";
    todayNode.textContent = "—";
  }
})();
