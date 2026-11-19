/* Anonymous visitor counter. Raw visit records are never publicly readable. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

(async function initVisitorCounter() {
  const totalNode = document.getElementById("siteVisitsTotal");
  const todayNode = document.getElementById("siteVisitsToday");
  if (!window.DAWLY_FIREBASE_CONFIG) return;
  const format = value => new Intl.NumberFormat("ar-EG").format(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type).value;
  const day = part("year") + "-" + part("month") + "-" + part("day");

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(window.DAWLY_FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const adminEmails = new Set(["elgoharemahmoud@gmail.com", "ahmedelgohare90@gmail.com"]);

    const authState = await new Promise(resolve => {
      let unsubscribe = () => {};
      try {
        unsubscribe = onAuthStateChanged(auth, user => {
          unsubscribe();
          resolve({ ok: true, user });
        }, () => {
          unsubscribe();
          resolve({ ok: false, user: null });
        });
      } catch (error) {
        resolve({ ok: false, user: null });
      }
    });
    const user = authState.user;
    const isAdmin = !!(authState.ok && user && user.emailVerified === true &&
      adminEmails.has(String(user.email || "").trim().toLowerCase()));

    // Client-side daily flag prevents repeat writes without exposing visit records.
    if (authState.ok && !isAdmin) {
      let visitorId = "";
      try { visitorId = localStorage.getItem("aldawly_visitor_id") || ""; } catch (error) {}
      if (!visitorId) {
        visitorId = crypto.randomUUID ? crypto.randomUUID() :
          "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        try { localStorage.setItem("aldawly_visitor_id", visitorId); } catch (error) {}
      }
      const visitFlag = "aldawly_visit_logged_" + day;
      let alreadyLogged = false;
      try { alreadyLogged = localStorage.getItem(visitFlag) === "1"; } catch (error) {}
      if (!alreadyLogged) {
        try {
          await setDoc(doc(db, "siteVisits", visitorId + "_" + day), {
            visitorId, day, createdAt: serverTimestamp()
          });
          try { localStorage.setItem(visitFlag, "1"); } catch (error) {}
        } catch (writeError) {
          // A pre-existing daily record is expected for returning visitors after this update.
          if (writeError && writeError.code === "permission-denied") {
            try { localStorage.setItem(visitFlag, "1"); } catch (error) {}
          }
          console.warn("Visitor record was not created:", writeError);
        }
      }
    }

    // Return aggregate numbers only; raw visitor records stay admin-only.
    if (totalNode || todayNode) {
      const response = await fetch("/api/visit-counts?day=" + encodeURIComponent(day), {
        method: "GET", cache: "no-store", headers: { "accept": "application/json" }
      });
      if (!response.ok) throw new Error("Visit count endpoint returned " + response.status);
      const counts = await response.json();
      if (totalNode) totalNode.textContent = format(Number(counts.total) || 0);
      if (todayNode) todayNode.textContent = format(Number(counts.today) || 0);
    }
  } catch (error) {
    console.warn("Visitor counter unavailable:", error);
    if (totalNode) totalNode.textContent = "—";
    if (todayNode) todayNode.textContent = "—";
  }
})();
