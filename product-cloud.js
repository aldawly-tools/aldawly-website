import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const config = window.DAWLY_FIREBASE_CONFIG || {};
const CACHE_KEY = "aldawly_catalog_cache_v1";

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

function writeCatalogCache(products, catalogVersion) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({savedAt:Date.now(), catalogVersion:Number(catalogVersion)||0, products:products}));
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
    let imageDbPromise = null;
    function openImageCache() {
      if (!("indexedDB" in window)) return Promise.resolve(null);
      if (!imageDbPromise) imageDbPromise = new Promise(function(resolve) {
        const request = indexedDB.open("dawly-product-images-v1", 1);
        request.onupgradeneeded = function() {
          const database = request.result;
          if (!database.objectStoreNames.contains("images")) database.createObjectStore("images", {keyPath:"id"});
        };
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = function() { resolve(null); };
      });
      return imageDbPromise;
    }
    async function readSavedImage(key) {
      const database = await openImageCache();
      if (!database) return "";
      return new Promise(function(resolve) {
        try {
          const request = database.transaction("images", "readonly").objectStore("images").get(key);
          request.onsuccess = function() {
            const row = request.result;
            resolve(row && Date.now() - Number(row.savedAt || 0) < 7 * 24 * 60 * 60 * 1000 ? String(row.url || "") : "");
          };
          request.onerror = function() { resolve(""); };
        } catch (_) { resolve(""); }
      });
    }
    async function saveImage(key, url) {
      if (!url) return;
      const database = await openImageCache();
      if (!database) return;
      try {
        database.transaction("images", "readwrite").objectStore("images").put({id:key, url:url, savedAt:Date.now()});
      } catch (_) {}
    }

    window.DAWLY_LOAD_PRODUCT_IMAGE = function (id) {
      const key = String(id);
      if (imageCache.has(key)) return imageCache.get(key);
      const pending = (async function() {
        const saved = await readSavedImage(key);
        if (saved) return saved;
        const snapshot = await getDoc(doc(db, "productImages", key));
        const url = snapshot.exists() ? String(snapshot.data().data || "") : "";
        if (url) saveImage(key, url).catch(function() {});
        // Show the downloaded image immediately; persist it in IndexedDB in the background.
        return url;
      })().catch(function(error) {
        imageCache.delete(key);
        throw error;
      });
      imageCache.set(key, pending);
      return pending;
    };
    window.DAWLY_LOAD_BRAND_LOGO_META = async function(id) {
      const snapshot = await getDoc(doc(db, "productImages", String(id)));
      if (!snapshot.exists()) return null;
      const data = snapshot.data() || {};
      return {url:String(data.data || ""),scale:Math.max(16,Math.min(100,Number(data.scale) || 34))};
    };
    // Notify product pages that the asynchronous image loader is now available.
    window.dispatchEvent(new Event("dawly-product-image-loader-ready"));

    // Reuse a recent catalog between page visits instead of opening a full
    // real-time listener (which rereads every product on every page load).
    const cached = readCatalogCache();
    if (cached && cached.products.length) publishProducts(cached.products);

    let catalogVersion = null;
    async function refreshCatalog(version) {
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
        writeCatalogCache(products, version == null ? catalogVersion : version);
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
    if (cached && cached.products.length) {
      publishProducts(cached.products);
      window.dispatchEvent(new Event("dawly-catalog-ready"));
    }

    // Listen to the lightweight catalog version document. Admin changes bump
    // this value, so every open storefront refreshes only when the catalog changes.
    let firstMetaSnapshot = true;
    onSnapshot(doc(db, "storeMeta", "catalog"), function (snapshot) {
      const nextVersion = snapshot.exists() ? Number(snapshot.data().version || 0) : 0;
      if (firstMetaSnapshot) {
        firstMetaSnapshot = false;
        catalogVersion = nextVersion;
        if (!cached || !cached.products.length || Number(cached.catalogVersion) !== nextVersion) {
          refreshCatalog(nextVersion);
        }
        return;
      }
      if (nextVersion !== catalogVersion) {
        catalogVersion = nextVersion;
        refreshCatalog(nextVersion);
      }
    }, function (error) {
      console.warn("Catalog version listener failed:", error);
      // Keep the cached catalog available if live synchronization is unavailable.
      if (!cached || !cached.products.length) refreshCatalog(catalogVersion);
    });

    // Same-browser admin tabs can still publish their cache immediately.
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
