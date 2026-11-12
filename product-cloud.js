import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { collection, doc, getDoc, getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

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

    const meta = await getDoc(doc(db, "storeMeta", "catalog"));
    if (meta.exists() && meta.data().initialized === true) {
      const snapshot = await getDocs(collection(db, "products"));
      const products = snapshot.docs.map(function (item) {
        const data = item.data();
        return Object.assign({}, data, {id:Number(data.id || item.id)});
      }).sort(function (a, b) { return a.id - b.id; });
      window.DAWLY_PRODUCTS = products;
      window.dispatchEvent(new CustomEvent("dawly-products-updated", {detail:products}));
    }
  } catch (error) {
    console.warn("تعذر تحميل كتالوج المنتجات من قاعدة البيانات. سيتم عرض النسخة المنشورة.", error);
  }
}

window.dispatchEvent(new Event("dawly-catalog-ready"));
