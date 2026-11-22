/* Visitor counter backed by Cloudflare D1. Authenticated store admins are excluded. */
(async function initVisitorCounter() {
  const totalNode = document.getElementById("siteVisitsTotal");
  const todayNode = document.getElementById("siteVisitsToday");
  if (!totalNode && !todayNode) return;

  const format = value => new Intl.NumberFormat("ar-EG").format(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type).value;
  const day = part("year") + "-" + part("month") + "-" + part("day");
  const adminEmails = new Set(["elgoharemahmoud@gmail.com", "ahmedelgohare90@gmail.com"]);

  // Check the persisted Firebase login before recording the page view.
  let isAdmin = false;
  try {
    const [{ initializeApp, getApps }, { getAuth, onAuthStateChanged }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js")
    ]);
    const config = window.DAWLY_FIREBASE_CONFIG;
    if (config) {
      const app = getApps().length ? getApps()[0] : initializeApp(config);
      const auth = getAuth(app);
      const user = await new Promise(resolve => {
        let unsubscribe = () => {};
        unsubscribe = onAuthStateChanged(auth, currentUser => {
          unsubscribe();
          resolve(currentUser);
        }, () => resolve(null));
      });
      isAdmin = !!(user && user.emailVerified === true &&
        adminEmails.has(String(user.email || "").toLowerCase()));
    }
  } catch (error) {
    console.warn("Could not verify admin session for visitor counter:", error);
  }

  try {
    if (!isAdmin) {
      let visitorId = "";
      try { visitorId = localStorage.getItem("aldawly_visitor_id") || ""; } catch (error) {}
      if (!/^[A-Za-z0-9-]{16,80}$/.test(visitorId)) {
        visitorId = crypto.randomUUID ? crypto.randomUUID() :
          "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        try { localStorage.setItem("aldawly_visitor_id", visitorId); } catch (error) {}
      }

      const visitFlag = "aldawly_visit_logged_" + day;
      let alreadyLogged = false;
      try { alreadyLogged = localStorage.getItem(visitFlag) === "1"; } catch (error) {}
      if (!alreadyLogged) {
        const record = await fetch("/api/visit-counts", {
          method: "POST",
          headers: { "content-type": "application/json", "accept": "application/json" },
          body: JSON.stringify({ visitorId, day }),
          cache: "no-store"
        });
        if (!record.ok) throw new Error("Visit record endpoint returned " + record.status);
        try { localStorage.setItem(visitFlag, "1"); } catch (error) {}
      }
    }

    const response = await fetch("/api/visit-counts?day=" + encodeURIComponent(day), {
      method: "GET", cache: "no-store", headers: { "accept": "application/json" }
    });
    if (!response.ok) throw new Error("Visit count endpoint returned " + response.status);
    const counts = await response.json();
    if (totalNode) totalNode.textContent = format(Number(counts.total) || 0);
    if (todayNode) todayNode.textContent = format(Number(counts.today) || 0);
  } catch (error) {
    console.warn("Visitor counter unavailable:", error);
    if (totalNode) totalNode.textContent = "—";
    if (todayNode) todayNode.textContent = "—";
  }
})();