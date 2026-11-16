import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { collection, doc, getDoc, getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const config = window.DAWLY_FIREBASE_CONFIG || {};
const CACHE_KEY = "aldawly_catalog_cache_v1";
const CACHE_TTL = 5 * 60 * 1000;

function publishProducts(products) {
  window.DAWLY_PRODUCTS = products;
  window.dispatchEvent(new CustomEvent("dawly-products-updated", {detail:products}));
  window.dispatchEvent(new CustomEvent("dawly-catalog-sync-status", {
    detail:{ok:true, count:products.length, updatedAt:Date.now(), cached:true}
  }));
}

function readCatalogCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!saved || !Array.isArray(saved.products) || !Number.isFinite(Number(saved.savedAt))) return null;
    return saved;
  } catch (_) { return null; }
}

function writeCatalogCache(products) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({savedAt:Date.now(), products:products}));
  } catch (error) {
    console.warn("Catalog cache could not be saved:", error);
  }
}

if (!config.apiKey || !config.projectId) {
  window.dispatchEvent(new Event("dawly-catalog-ready"));
} else {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(config);
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

    // Reuse a recent catalog between page visits instead of opening a full
    // real-time listener (which rereads every product on every page load).
    const cached = readCatalogCache();
    if (cached && cached.products.length) publishProducts(cached.products);

    async function refreshCatalog() {
      try {
        const snapshot = await getDocs(collection(db, "products"));
        const products = snapshot.docs.map(function (item) {
          const data = item.data();
          const productId = data.id !== undefined && data.id !== null && data.id !== ""
            ? data.id : item.id;
          return Object.assign({}, data, {id:productId, _docId:item.id});
        }).sort(function (a, b) {
          const aNumber = Number(a.id), bNumber = Number(b.id);
          if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
          return String(a.id).localeCompare(String(b.id), "en");
        });
        writeCatalogCache(products);
        publishProducts(products);
        window.dispatchEvent(new Event("dawly-catalog-ready"));
      } catch (error) {
        console.error("Catalog refresh failed:", error);
        window.dispatchEvent(new CustomEvent("dawly-catalog-sync-status", {
          detail:{ok:false, error:error && (error.code || error.message) || "unknown"}
        }));
        window.dispatchEvent(new Event("dawly-catalog-ready"));
      }
    }

    window.DAWLY_REFRESH_CATALOG = refreshCatalog;
    if (!cached || !cached.products.length || Date.now() - Number(cached.savedAt) > CACHE_TTL) {
      refreshCatalog();
    } else {
      window.dispatchEvent(new Event("dawly-catalog-ready"));
    }

    // An admin tab on the same device can update the shared cache. Reflect it
    // immediately without another Firestore read.
    window.addEventListener("storage", function (event) {
      if (event.key !== CACHE_KEY || !event.newValue) return;
      try {
        const updated = JSON.parse(event.newValue);
        if (Array.isArray(updated.products)) publishProducts(updated.products);
      } catch (_) {}
    });
  } catch (error) {
    console.warn("تعذر تهيئة كتالوج المنتجات. سيتم عرض النسخة المنشورة.", error);
    window.dispatchEvent(new Event("dawly-catalog-ready"));
  }
}
