import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { collection, doc, getDoc, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const config = window.DAWLY_FIREBASE_CONFIG || {};
if (!config.apiKey || config.apiKey === "PASTE_FIREBASE_WEB_API_KEY" || !config.projectId || config.projectId === "YOUR_PROJECT_ID") {
  // The storefront continues using products.js until the one-time Firebase setup is complete.
} else {
  try {
    const app = initializeApp(config);
    const db = getFirestore(app);
    const imageCache = new Map();

    window.DAWLY_LOAD_PRODUCT_IMAGE = async function (id) {
      const key = String(id);
      if (imageCache.has(key)) return imageCache.get(key);
      const snapshot = await getDoc(doc(db, "productImages", key));
      const url = snapshot.exists() ? String(snapshot.data().data || "") : "";
      imageCache.set(key, url);
      return url;
    };

    // Subscribe directly to the live products collection. Do not gate updates
    // behind storeMeta: catalog edits/deletions must appear even if metadata is missing.
    onSnapshot(collection(db, "products"), function (snapshot) {
      const products = snapshot.docs.map(function (item) {
        const data = item.data();
        const productId = data.id !== undefined && data.id !== null && data.id !== ""
          ? data.id
          : item.id;
        return Object.assign({}, data, {id:productId});
      }).sort(function (a, b) {
        const aNumber = Number(a.id);
        const bNumber = Number(b.id);
        if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
        return String(a.id).localeCompare(String(b.id), "en");
      });
      window.DAWLY_PRODUCTS = products;
      window.dispatchEvent(new CustomEvent("dawly-products-updated", {detail:products}));
      window.dispatchEvent(new CustomEvent("dawly-catalog-sync-status", {
        detail:{ok:true, count:products.length, updatedAt:Date.now()}
      }));
    }, function (error) {
      console.error("Live product catalog subscription failed:", error);
      window.dispatchEvent(new CustomEvent("dawly-catalog-sync-status", {
        detail:{ok:false, error:error && (error.code || error.message) || "unknown"}
      }));
    });
  } catch (error) {
    console.warn("تعذر تحميل كتالوج المنتجات من قاعدة البيانات. سيتم عرض النسخة المنشورة.", error);
  }
}

window.dispatchEvent(new Event("dawly-catalog-ready"));
