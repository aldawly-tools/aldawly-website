(() => {
  let products = Array.isArray(window.DAWLY_PRODUCTS) ? window.DAWLY_PRODUCTS : [];
  const grid = document.getElementById("productGrid");
  const tiles = document.getElementById("categoryTiles");
  const filterBar = document.getElementById("filterBar");
  const brandFilterList = document.getElementById("brandFilterList");
  const brandFilterSearch = document.getElementById("brandFilterSearch");
  const brandFilterSummary = document.getElementById("brandFilterSummary");
  const cartCount = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  const cartDrawer = document.getElementById("cartDrawer");
  const cartOverlay = document.getElementById("cartOverlay");
  const checkout = document.getElementById("checkout");
  const mobileMenu = document.getElementById("mobileMenuDrawer");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenuCategories = document.getElementById("mobileMenuCategories");
  const openMobileMenuButton = document.getElementById("openMobileMenu");
  const closeMobileMenuButton = document.getElementById("closeMobileMenu");
  const floatingContactToggle = document.getElementById("floatingContactToggle");
  const floatingContactPanel = document.getElementById("floatingContactPanel");
  function setFloatingContact(open) {
    if (!floatingContactToggle || !floatingContactPanel) return;
    floatingContactPanel.hidden = !open;
    floatingContactToggle.setAttribute("aria-expanded", open ? "true" : "false");
    floatingContactToggle.setAttribute("aria-label", open ? "إغلاق أرقام التواصل" : "عرض أرقام الاتصال والواتساب");
    floatingContactToggle.classList.toggle("is-open", open);
  }
  function setMobileMenu(open) {
    if (!mobileMenu || !mobileMenuOverlay) return;
    mobileMenu.classList.toggle("open", open);
    mobileMenuOverlay.classList.toggle("open", open);
    mobileMenu.setAttribute("aria-hidden", open ? "false" : "true");
    if (openMobileMenuButton) openMobileMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
    document.body.classList.toggle("mobile-category-menu-open", open);
    if (open && closeMobileMenuButton) closeMobileMenuButton.focus();
    if (!open && openMobileMenuButton) openMobileMenuButton.focus();
  }
  let activeCategory = "الكل";
  let activeBrand = (new URLSearchParams(window.location.search).get("brand") || "").trim();
  let query = "";
  const pageSize = 12;
  let visibleProductCount = pageSize;
  // سلة جديدة مستقلة؛ لا تستورد أي بيانات قديمة أو تنتقل عبر روابط المنتجات.
  let cart = [];
  let cartStorageKey = "dawly_cart_v3_default";
  function normalizeCart(value) {
    if (!Array.isArray(value)) return [];
    const clean = [];
    value.forEach(function(line) {
      if (!line || line.id == null) return;
      const qty = Number(line.qty);
      if (!Number.isInteger(qty) || qty < 1) return;
      const id = String(line.id);
      const existing = clean.find(function(entry) { return String(entry.id) === id; });
      if (existing) existing.qty = Math.min(99, existing.qty + qty);
      else clean.push({id:line.id, qty:Math.min(99,qty)});
    });
    return clean;
  }
  try {
    let deviceId = localStorage.getItem("dawly_cart_device_v1");
    if (!deviceId) {
      deviceId = (window.crypto && typeof window.crypto.randomUUID === "function")
        ? window.crypto.randomUUID()
        : "d" + Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem("dawly_cart_device_v1", deviceId);
    }
    cartStorageKey = "dawly_cart_v3_" + deviceId;
    const currentCart = localStorage.getItem(cartStorageKey);
    if (currentCart !== null) {
      cart = normalizeCart(JSON.parse(currentCart));
    }
  } catch (error) { cart = []; }
  function persistCart() {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart));
      localStorage.setItem("dawly_cart_last_updated_v1", String(Date.now()));
    } catch (error) {}
  }
  let cloudImageObserver = null;

  function showProductImageFallback(image) {
    if (!image || !image.parentNode) return;
    const placeholder = document.createElement("span");
    placeholder.className = "product-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = "🔧";
    image.parentNode.replaceChild(placeholder, image);
  }

  document.addEventListener("error", function (event) {
    const image = event.target;
    if (image && image.tagName === "IMG" && (image.closest(".product-grid") || image.closest(".quick-view-image"))) showProductImageFallback(image);
  }, true);

  function observeCloudImages() {
    const images = document.querySelectorAll("#productGrid img[data-cloud-image], #featuredProductsGrid img[data-cloud-image], #newArrivalsGrid img[data-cloud-image], #quickViewModal img[data-cloud-image]");
    if (!images.length) return;
    function loadImage(image) {
      if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE !== "function") {
        showProductImageFallback(image);
        return;
      }
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cloudImage).then(function (url) {
        if (url && image.isConnected) image.src = url;
        else if (image.isConnected) showProductImageFallback(image);
      }).catch(function () {
        if (image.isConnected) showProductImageFallback(image);
      });
    }
    if ("IntersectionObserver" in window) {
      if (!cloudImageObserver) {
        cloudImageObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            const image = entry.target;
            cloudImageObserver.unobserve(image);
            loadImage(image);
          });
        }, {rootMargin:"240px"});
      }
      images.forEach(function (image) { cloudImageObserver.observe(image); });
      return;
    }
    images.forEach(loadImage);
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char];
    });
  }
  function cleanProductCopy(value) {
    return String(value == null ? "" : value).replace(/\uFFFD/g, "").replace(/[\u200B-\u200F\u2060\uFEFF]/g, " ").replace(/\r\n?/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  }
  function cleanProductName(value) {
    let text = cleanProductCopy(value).replace(/[\uFE0E\uFE0F\u200D]/g, "").replace(/[\u{1F1E6}-\u{1F1FF}]/gu, " ").replace(/\p{Extended_Pictographic}/gu, " ");
    text = text.replace(/\s+(?:لو بتدور(?:ي)?|لو عايز|لو محتاج|لو محتاجة|سرعة في الأداء|دقة في التحكم|جودة للمحترفين|شغل أنضف|اطلب الآن).*/iu, "").replace(/\s+/g, " ").trim();
    if (text.length > 72) {
      let shortText = text.slice(0, 69);
      const lastSpace = shortText.lastIndexOf(" ");
      if (lastSpace > 42) shortText = shortText.slice(0, lastSpace);
      text = shortText + "…";
    }
    return text || "منتج من الدولي";
  }
  function cleanOrderProductName(value) {
    let text = cleanProductCopy(value)
      .replace(/[\uFE0E\uFE0F\u200D]/g, "")
      .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, " ")
      .replace(/\p{Extended_Pictographic}/gu, " ")
      .replace(/^\s*(?:حافظ على سلامة عينيك|حافظ على عينيك|احمِ عينيك)\s+مع\s+/iu, "")
      .replace(/\s+(?:لو شغلك|لو بتدور(?:ي)?|لو عايز|لو محتاج|لو محتاجة|سرعة في الأداء|دقة في التحكم|جودة للمحترفين|شغل أنضف|اطلب الآن)[\s\S]*$/iu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 80) {
      let shortText = text.slice(0, 77);
      const lastSpace = shortText.lastIndexOf(" ");
      if (lastSpace > 45) shortText = shortText.slice(0, lastSpace);
      text = shortText + "…";
    }
    return text || cleanProductName(value);
  }
  function parsePrice(value) {
    if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
    let text = String(value == null ? "" : value).trim();
    if (!text || /استفسار|حسب الطلب/i.test(text)) return null;
    text = text
      .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); });
    text = text.replace(/(?:جنيه(?:\s*مصري)?|ج\.?م\.?|ج\.?|EGP|LE)/gi, "").replace(/[\s,،٬]/g, "");
    if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
    const amount = Number(text);
    return Number.isFinite(amount) ? amount : null;
  }
  function money(amount) {
    return new Intl.NumberFormat("ar-EG", {maximumFractionDigits:2}).format(amount) + " ج.م";
  }
  function formatPrice(value) {
    const amount = parsePrice(value);
    return amount === null ? cleanProductCopy(value || "السعر عند الاستفسار") : money(amount);
  }
  function cartPricing() {
    let total = 0;
    let pricedCount = 0;
    cart.forEach(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id) || (entry._docId !== undefined && String(entry._docId) === String(line.id)); });
      if (!item) return;
      const price = parsePrice(item.price);
      if (price === null) return;
      total += price * line.qty;
      pricedCount += 1;
    });
    return {total:total, pricedCount:pricedCount, itemCount:cart.filter(function (line) {
      return products.some(function (item) { return String(item.id) === String(line.id); });
    }).length};
  }
  function categoryIcon(name) {
    const value = normalizeSearchText(name);
    let paths = '<path d="M14.5 6.5 17.5 3.5a5 5 0 0 1 3 6l-5 5-3-3 5-5"/><path d="m13 11-8 8a2.1 2.1 0 0 1-3-3l8-8"/><path d="m5 7 4-4 4 4-4 4z"/>';
    if (/كهرب|power|شنيور|صاروخ/.test(value)) paths = '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>';
    else if (/قياس|measurement|اختبار|كهرباء/.test(value)) paths = '<path d="M3 21h18M5 17l4-4 3 3 7-9"/><path d="M5 4v5M9 4v3M13 4v5M17 4v3M21 4v5"/>';
    else if (/مفك|ربط|بت|لقم/.test(value)) paths = '<path d="m14 3 7 7-3 3-7-7z"/><path d="m11 6-8 8 7 7 8-8"/><path d="m3 14 7 7"/>';
    else if (/كماش|زراديه|قط|قص/.test(value)) paths = '<path d="m8 3 4 7 4-7 3 2-4 8 3 8-4 1-3-7-3 7-4-1 3-8-4-8z"/>';
    else if (/تخزين|شنط|صندوق|حفظ|ورش/.test(value)) paths = '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/>';
    else if (/قطع|منشار|تخريم|ثقب/.test(value)) paths = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M21 12h-3M12 21v-3M3 12h3"/>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths + '</svg>';
  }
  function categoryImage(name) {
    const value = normalizeSearchText(name);
    if (/كهرب|power|شنيور|صاروخ|منشار/.test(value)) return 'https://i5.walmartimages.com/asr/b846b5a5-0ff3-4b10-9017-d234aa05dc2a.abbc77afaed3fa74c2519f1151a3e0fb.jpeg';
    if (/قياس|measurement|اختبار|كهرباء/.test(value)) return 'https://media.licdn.com/dms/image/v2/D4D22AQEVwdnRkVs5TA/feedshare-shrink_800/B4DZzPZOS0KAAc-/0/1773006022130?e=2147483647&t=6GAGG3-7C6ftLgrbesyazuqtOaSiedpjWMWAuGtq2NY&v=beta';
    if (/تخزين|شنط|صندوق|حفظ|ورش/.test(value)) return 'https://interbosch.nl/cdn/shop/collections/Impressie_foto_Gereedschapskarren_kopie.webp?v=1766153113&width=1296';
    if (/مفك|ربط|بت|لقم|كماش|زراديه|قط|قص|يدوي/.test(value)) return 'https://cdn.askul.co.jp/img/product/3L1/EP86599_3L1.jpg';
    return 'https://www.homebase.co.uk/assets/bWFzdGVyfGltYWdlc3wyMzM1MDF8aW1hZ2UvanBlZ3xoYzEvaGZiLzkzNDA4MDM2NzgyMzgvMDU0MTY2Nl8yLmpwZ3xhOTE3ZjhjZGNiYzYzNWY2NTgzYWU3YjIxODYzM2M5ZjhiOWMzNTBiOTI3ZTQ2YzY1ZDdkNDBmMTI3NzM2OWVh/0541666-2.jpg';
  }
  function normalizeSearchText(value) {
    return String(value == null ? "" : value)
      .toLocaleLowerCase("ar")
      .normalize("NFD")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }
  function normalizeBrand(name) {
    return normalizeSearchText(name).replace(/\s/g, "");
  }
  function displayBrand(name) {
    const labels = {wurth:"WÜRTH",bosch:"BOSCH",wera:"WERA",knipex:"KNIPEX",beta:"Beta",dewalt:"DEWALT"};
    return labels[normalizeBrand(name)] || cleanProductCopy(name);
  }
  function productBrand(item) {
    const explicit = item.brand || item.brandName || item.manufacturer;
    if (explicit && String(explicit).trim()) return displayBrand(explicit);
    const searchable = normalizeBrand([
      item.name, item.desc, item.specs, item.sku, item.code, item.model, item.partNumber
    ].filter(Boolean).join(" "));
    const known = [
      ["wurth","WÜRTH"],["bosch","BOSCH"],["dewalt","DEWALT"],
      ["milwaukee","Milwaukee"],["makita","Makita"],["knipex","KNIPEX"],
      ["wera","WERA"],["beta","Beta"]
    ];
    const match = known.find(function (entry) { return searchable.includes(entry[0]); });
    return match ? match[1] : "";
  }
  function renderBrandAvailability() {
    // Brand cards must always open the filtered products page. Do not turn a
    // valid brand link into an in-page #brands jump while cloud products load
    // or when a product's brand label uses a different spelling.
    document.querySelectorAll(".brand-word").forEach(function (link) {
      if (!link.dataset.brandTarget) {
        link.dataset.brandTarget = link.getAttribute("href") || "#brands";
      }
      link.href = link.dataset.brandTarget;
      link.classList.remove("brand-unavailable");
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
      link.removeAttribute("title");
    });
  }
  function setDrawer(open) {
    cartDrawer.classList.toggle("open", open);
    cartOverlay.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) document.getElementById("closeCart").focus();
  }
  function renderHomeShelves() {
    function card(item) {
      const name = cleanProductName(item.name);
      const url = "product.html?id=" + encodeURIComponent(String(item.id));
      const image = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '" loading="lazy">'
        : item.imageId
          ? '<img data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '" loading="lazy">'
          : '<span class="product-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
      const soldOut = Number.isInteger(item.stock) && item.stock === 0;
      return '<article class="product-card home-shelf-card"><a class="product-visual product-open-link" href="' + url + '">' + image + '</a><div class="product-info"><span class="product-category">' + escapeHtml(displayBrand(productBrand(item)) || item.cat || "منتجات") + '</span><h3 class="product-name"><a href="' + url + '">' + escapeHtml(name) + '</a></h3><span class="product-price">' + escapeHtml(formatPrice(item.price)) + '<small>' + (item.price === null || item.price === undefined || item.price === "" ? 'السعر عند التواصل' : 'التوفر عند التواصل') + '</small></span><a class="product-details-link" href="' + url + '">التفاصيل والسعر والتوفر ←</a><button class="quick-view-trigger" type="button" data-quick-view="' + escapeHtml(item.id) + '">معاينة سريعة</button><button class="button-primary home-shelf-add" type="button" data-add="' + escapeHtml(item.id) + '"' + (soldOut ? ' disabled aria-disabled="true"' : '') + '>' + (soldOut ? 'غير متاح حاليًا' : 'أضف إلى السلة') + '</button></div></article>';
    }
    const featuredGrid = document.getElementById("featuredProductsGrid");
    if (featuredGrid) {
      const featured = products.filter(function(item){ return item.featured === true || item.isFeatured === true || item.weeklyPick === true; }).slice(0,4);
      featuredGrid.innerHTML = featured.length ? featured.map(card).join("") : '<div class="catalog-empty-note">لا توجد منتجات مميزة مضافة حاليًا. يمكنك اختيار المنتجات المميزة من بيانات المنتج في لوحة الإدارة.</div>';
    }
    const arrivalsGrid = document.getElementById("newArrivalsGrid");
    if (arrivalsGrid) {
      const latest = products.slice().sort(function(a,b){
        const da = a.createdAt && (a.createdAt.seconds || Date.parse(a.createdAt) / 1000) || 0;
        const db = b.createdAt && (b.createdAt.seconds || Date.parse(b.createdAt) / 1000) || 0;
        return db-da || Number(b.id||0)-Number(a.id||0);
      }).slice(0,4);
      arrivalsGrid.innerHTML = latest.length ? latest.map(card).join("") : '<div class="catalog-empty-note">الكتالوج فارغ حاليًا. أضف منتجاتك الأصلية من لوحة الإدارة لتظهر هنا تلقائيًا.</div>';
    }
    // Load Firebase-hosted images in the featured and latest-product shelves too.
    observeCloudImages();
  }

  function syncCategorySelection() {
    document.querySelectorAll("#filterBar .filter-chip, #categoryTiles .category-tile").forEach(function (button) {
      const selected = button.dataset.category === activeCategory;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function drawCategories() {
    const categories = Array.from(new Set(products.map(function (item) { return item.cat; }).filter(Boolean)));
    tiles.innerHTML = '<button class="category-tile all" type="button" data-category="الكل"><span class="category-photo"><img src="' + categoryImage("ورش") + '" alt="" loading="lazy"><span class="category-photo-shade"></span><span class="category-icon">' + categoryIcon("ورش") + '</span></span><span class="category-copy"><strong>جميع الأقسام</strong><small>تصفح كل المنتجات</small><b>' + products.length + ' منتج</b></span></button>' +
      categories.map(function (name) {
        const count = products.filter(function (item) { return item.cat === name; }).length;
        return '<button class="category-tile" type="button" data-category="' + escapeHtml(name) + '"><span class="category-photo"><img src="' + categoryImage(name) + '" alt="" loading="lazy"><span class="category-photo-shade"></span><span class="category-icon">' + categoryIcon(name) + '</span></span><span class="category-copy"><strong>' + escapeHtml(name) + '</strong><small>اكتشف الأدوات المتاحة</small><b>' + count + ' منتج</b></span></button>';
      }).join("");
    filterBar.innerHTML = '<button class="filter-chip active" type="button" data-category="الكل">كل المنتجات <span class="filter-count">' + products.length + '</span></button>' +
      categories.map(function (name) {
        const count = products.filter(function (item) { return item.cat === name; }).length;
        return '<button class="filter-chip" type="button" data-category="' + escapeHtml(name) + '">' + escapeHtml(name) + ' <span class="filter-count">' + count + '</span></button>';
      }).join("");
    drawBrandFilters();
    if (mobileMenuCategories) {
      mobileMenuCategories.innerHTML = categories.map(function(name) {
        return '<button type="button" data-category="' + escapeHtml(name) + '">' + escapeHtml(name) + '</button>';
      }).join("");
    }
    syncCategorySelection();
  }
  function drawBrandFilters() {
    if (!brandFilterList) return;
    const counts = new Map();
    products.forEach(function (item) {
      const brand = productBrand(item);
      if (!brand) return;
      const key = normalizeBrand(brand);
      if (!key) return;
      const entry = counts.get(key) || {label:brand, count:0};
      entry.count += 1;
      counts.set(key, entry);
    });
    const brands = Array.from(counts.entries()).sort(function (a,b) { return a[1].label.localeCompare(b[1].label, "ar"); });
    const selectedLabel = activeBrand ? displayBrand(activeBrand) : "كل الماركات";
    if (brandFilterSummary) brandFilterSummary.textContent = selectedLabel;
    const search = normalizeSearchText(brandFilterSearch ? brandFilterSearch.value : "");
    const visibleBrands = brands.filter(function (entry) { return !search || normalizeSearchText(entry[1].label).includes(search); });
    brandFilterList.innerHTML = '<button class="brand-filter-option' + (!activeBrand ? ' active' : '') + '" type="button" data-brand-filter="الكل" aria-pressed="' + (!activeBrand) + '"><span>كل الماركات</span><span class="brand-filter-count">' + products.length + '</span></button>' +
      visibleBrands.map(function (entry) {
        const key = entry[0], label = entry[1].label, count = entry[1].count, selected = normalizeBrand(activeBrand) === key;
        return '<button class="brand-filter-option' + (selected ? ' active' : '') + '" type="button" data-brand-filter="' + escapeHtml(label) + '" aria-pressed="' + selected + '"><span>' + escapeHtml(label) + '</span><span class="brand-filter-count">' + count + '</span></button>';
      }).join("") || '<p class="brand-filter-empty">لا توجد ماركات بهذا الاسم.</p>';
  }

  const listingControls = document.createElement("div");
  listingControls.className = "product-listing-controls";
  listingControls.innerHTML = '<p class="product-results-count" aria-live="polite"></p><button class="button-primary" type="button" data-load-more hidden>عرض 12 منتج إضافي</button>';
  grid.insertAdjacentElement("afterend", listingControls);
  const resultsCount = listingControls.querySelector(".product-results-count");
  const loadMoreButton = listingControls.querySelector("[data-load-more]");
  loadMoreButton.addEventListener("click", function () {
    visibleProductCount += pageSize;
    renderProducts();
  });

  function renderProducts() {
    const terms = normalizeSearchText(query).split(" ").filter(Boolean);
    const filtered = products.filter(function (item) {
      const categoryMatch = activeCategory === "الكل" || item.cat === activeCategory;
      const brand = productBrand(item);
      const brandMatch = !activeBrand || normalizeBrand(brand) === normalizeBrand(activeBrand);
      const searchable = normalizeSearchText([
        item.name, brand, item.brand, item.cat, item.desc, item.specs,
        item.sku, item.code, item.model, item.partNumber, item.id
      ].join(" "));
      const searchMatch = !terms.length || terms.every(function (term) { return searchable.includes(term); });
      return categoryMatch && brandMatch && searchMatch;
    });
    if (terms.length) {
      function relevance(item) {
        const name = normalizeSearchText(item.name);
        const brand = normalizeSearchText(productBrand(item));
        const code = normalizeSearchText([item.sku, item.code, item.model, item.partNumber, item.id].filter(Boolean).join(" "));
        const description = normalizeSearchText([item.desc, item.specs, item.cat].filter(Boolean).join(" "));
        let score = 0;
        terms.forEach(function(term) {
          if (code === term) score += 120;
          else if (code.split(" ").some(function(part){ return part === term; })) score += 90;
          else if (code.includes(term)) score += 65;
          if (name === term) score += 55;
          else if (name.startsWith(term)) score += 35;
          else if (name.includes(term)) score += 25;
          if (brand.includes(term)) score += 18;
          if (description.includes(term)) score += 5;
        });
        return score;
      }
      filtered.sort(function(a,b) { return relevance(b) - relevance(a); });
    }
    const emptyMessage = activeBrand
      ? 'لا توجد منتجات مسجلة لماركة ' + escapeHtml(activeBrand) + ' حاليًا.'
      : "لا توجد منتجات مطابقة.";
    const shown = filtered.slice(0, visibleProductCount);
    grid.innerHTML = shown.map(function (item) {
      const name = cleanProductName(item.name);
      const description = cleanProductCopy(item.desc || "");
      const visual = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '">'
        : item.imageId
          ? '<img data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '" loading="lazy">'
          : '<span class="product-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
      const detailUrl = "product.html?id=" + encodeURIComponent(String(item.id));
      const currentPrice = parsePrice(item.price);
      const compareAtPrice = parsePrice(item.oldPrice ?? item.compareAtPrice ?? item.originalPrice);
      const discountPercent = currentPrice !== null && compareAtPrice !== null && compareAtPrice > currentPrice
        ? Math.round((compareAtPrice - currentPrice) / compareAtPrice * 100) : 0;
      const stockKnown = Number.isInteger(item.stock) && item.stock >= 0;
      const stockOut = stockKnown && item.stock === 0;
      const stockLabel = stockOut ? '<span class="stock-status out">نفد المخزون</span>' : stockKnown ? '<span class="stock-status">المتاح: ' + item.stock + ' قطعة</span>' : '';
      return '<article class="product-card" id="product-' + encodeURIComponent(item.id) + '">' +
        '<a class="product-visual product-open-link" href="' + detailUrl + '" aria-label="تكبير صورة ' + escapeHtml(name) + '" title="اضغط لتكبير الصورة">' + visual + '</a>' +
        '<div class="product-info"><span class="product-category">' + (productBrand(item) ? escapeHtml(displayBrand(productBrand(item))) + ' · ' : '') + escapeHtml(item.cat || "منتجات") + '</span>' +
        '<h3 class="product-name"><a class="product-name-link" href="' + detailUrl + '">' + escapeHtml(name) + '</a></h3>' +
        '<p class="product-description">' + escapeHtml(description) + '</p>' + stockLabel +
        '<a class="product-details-link" href="' + detailUrl + '">عرض الإعلان والتفاصيل ←</a>' +
        '<button class="quick-view-trigger" type="button" data-quick-view="' + escapeHtml(item.id) + '">معاينة سريعة</button>' +
        '<div class="product-share-row"><button class="button-outline share-product-button" type="button" data-share-product="' + escapeHtml(item.id) + '">مشاركة المنتج ↗</button></div>' +
        '<div class="product-meta"><span class="product-price">' + escapeHtml(formatPrice(item.price)) + (discountPercent ? '<del>' + escapeHtml(money(compareAtPrice)) + '</del><em class="product-discount">خصم ' + discountPercent + '%</em>' : '') + '<small>' + (currentPrice === null ? 'السعر والتوفر عند التواصل' : 'التوفر عند التواصل') + '</small></span>' +
        '<button class="button-primary" type="button" data-add="' + escapeHtml(item.id) + '"' + (stockOut ? ' disabled aria-disabled="true"' : '') + '>' + (stockOut ? 'غير متاح حاليًا' : 'أضف إلى السلة') + '</button></div></div></article>';
    }).join("") || '<p class="empty-cart">' + emptyMessage + '</p>';
    observeCloudImages();
    resultsCount.textContent = filtered.length ? "عرض " + shown.length + " من " + filtered.length + " منتج" : "";
    loadMoreButton.hidden = shown.length >= filtered.length;
    loadMoreButton.textContent = "عرض " + Math.min(pageSize, filtered.length - shown.length) + " منتج إضافي";
    drawBrandFilters();
    filterBar.querySelectorAll("[data-category]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.category === activeCategory);
    });
  }
  if (activeBrand) {
    const title = document.querySelector("#products .section-title");
    const subtitle = document.querySelector("#products .section-subtitle");
    if (title) title.textContent = "منتجات " + activeBrand;
    if (subtitle) subtitle.textContent = "المنتجات المسجلة لماركة " + activeBrand;
  }
  function renderCart(skipPersist) {
    // إزالة أي معرّفات قديمة/روابط منتجات لم تعد موجودة من السلة بعد تحميل الكتالوج.
    // لا ننظف السلة عندما تكون قائمة المنتجات فارغة مؤقتًا أثناء بدء تحميل الصفحة.
    if (products.length) {
      const validIds = new Set();
      products.forEach(function (item) {
        validIds.add(String(item.id));
        if (item._docId !== undefined && item._docId !== null) validIds.add(String(item._docId));
      });
      const before = cart.length;
      cart = cart.filter(function (line) { return validIds.has(String(line.id)); });
      if (cart.length !== before) skipPersist = false;
    }
    if (!skipPersist) persistCart();
    const count = cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
    cartCount.textContent = String(count);
    checkout.disabled = count === 0;
    cartItems.innerHTML = cart.length ? cart.map(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      if (!item) {
        return '<div class="cart-row"><div><strong>منتج محفوظ في السلة</strong><small>تعذر تحميل بيانات المنتج. حدّث صفحة المنتجات ثم أعد فتح السلة.</small><div class="quantity"><span>الكمية: ' + line.qty + '</span></div></div><button class="remove-item" type="button" data-remove="' + escapeHtml(line.id) + '">حذف</button></div>';
      }
      const price = parsePrice(item.price);
      const lineTotal = price === null ? "" : '<small class="cart-line-total">مجموع هذا المنتج: ' + escapeHtml(money(price * line.qty)) + '</small>';
      const cartImage = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="" loading="lazy">'
        : item.imageId
          ? '<img data-cart-image="' + escapeHtml(item.imageId) + '" alt="" loading="lazy">'
          : '<span aria-hidden="true">🔧</span>';
      return '<div class="cart-row"><div class="cart-product-main"><div class="cart-product-thumb">' + cartImage + '</div><div class="cart-product-copy"><strong>' + escapeHtml(cleanProductName(item.name)) + '</strong><small>' + escapeHtml(formatPrice(item.price)) + '</small>' + lineTotal +
        '<div class="quantity"><button type="button" data-qty="' + escapeHtml(item.id) + '" data-delta="-1" aria-label="تقليل الكمية">−</button><span>' + line.qty + '</span><button type="button" data-qty="' + escapeHtml(item.id) + '" data-delta="1" aria-label="زيادة الكمية">+</button></div></div></div>' +
        '<button class="remove-item" type="button" data-remove="' + escapeHtml(item.id) + '">حذف</button></div>';
    }).join("") : '<div class="empty-cart">السلة فارغة حاليًا</div>';
    cartItems.querySelectorAll("img[data-cart-image]").forEach(function (image) {
      if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE !== "function") return;
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cartImage).then(function (url) {
        if (url && image.isConnected) image.src = url;
        else if (image.isConnected) image.closest(".cart-product-thumb").classList.add("no-image");
      }).catch(function () {
        if (image.isConnected) image.closest(".cart-product-thumb").classList.add("no-image");
      });
    });
    const totalBox = document.getElementById("cartTotal");
    const pricing = cartPricing();
    const summary = '<div class="cart-summary-count"><span>عدد المنتجات: <strong>' + pricing.itemCount + '</strong></span><span>إجمالي القطع: <strong>' + count + '</strong></span></div>';
    const deliveryNote = '<small class="cart-delivery-note">تكلفة الشحن تُحدد عند تأكيد العنوان مع المتجر.</small>';
    if (!count) {
      totalBox.innerHTML = "";
    } else if (pricing.pricedCount === pricing.itemCount) {
      totalBox.innerHTML = summary + '<div class="cart-total-row"><span>إجمالي المنتجات</span><strong>' + escapeHtml(money(pricing.total)) + '</strong></div>' + deliveryNote;
    } else if (pricing.pricedCount) {
      totalBox.innerHTML = summary + '<div class="cart-total-row"><span>مجموع المنتجات المسعّرة</span><strong>' + escapeHtml(money(pricing.total)) + '</strong></div><small>يوجد منتج سعره عند الاستفسار؛ يتحدد الإجمالي بعد تأكيد سعره.</small>' + deliveryNote;
    } else {
      totalBox.innerHTML = summary + '<div class="cart-total-row"><span>الإجمالي</span><strong>بعد تأكيد الأسعار</strong></div>' + deliveryNote;
    }
  }

  // مزامنة التغييرات بين تبويبات الموقع المفتوحة على نفس المتصفح فقط.
  window.addEventListener("storage", function(event) {
    if (event.key !== cartStorageKey || event.newValue == null) return;
    try {
      cart = normalizeCart(JSON.parse(event.newValue));
      renderCart(true);
    } catch (error) {}
  });

  function clearCartAfterWhatsApp() {
    cart = [];
    renderCart();
  }

  // تفريغ السلة عند ضغط العميل على رابط إرسال تفاصيل الطلب إلى واتساب.
  // لا نفرغها بمجرد إنشاء الطلب في Firestore؛ ننتظر فعل العميل بفتح واتساب.
  document.addEventListener("click", function (event) {
    const whatsappLink = event.target.closest("#orderWhatsappLink");
    if (whatsappLink && whatsappLink.href && !whatsappLink.hidden) {
      clearCartAfterWhatsApp();
    }
  });

  window.addEventListener("dawly-catalog-ready", function () {
    observeCloudImages();
  });

  window.addEventListener("dawly-products-updated", function (event) {
    if (!Array.isArray(event.detail)) return;
    products = event.detail;
    drawCategories();
    renderProducts();
    renderBrandAvailability();
    renderCart();
    renderHomeShelves();
  });
  // Direct mobile category-menu handler: keep taps reliable on touch browsers.
  if (mobileMenuCategories) {
    mobileMenuCategories.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-category]");
      if (!button || !mobileMenuCategories.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      activeCategory = button.dataset.category || "الكل";
      visibleProductCount = pageSize;
      syncCategorySelection();
      renderProducts();
      setMobileMenu(false);
      requestAnimationFrame(function () {
        const productsSection = document.getElementById("products");
        if (productsSection) {
          const targetTop = productsSection.getBoundingClientRect().top + window.pageYOffset + 150;
          window.scrollTo({top: targetTop, behavior: "smooth"});
        }
      });
    });
  }

  function addToCart(id) {
    const item = products.find(function (entry) { return String(entry.id) === String(id); });
    if (!item) return;
    if (Number.isInteger(item.stock) && item.stock >= 0 && item.stock === 0) {
      alert("هذا المنتج غير متاح حاليًا لأنه نفد من المخزون.");
      return;
    }
    const line = cart.find(function (entry) { return String(entry.id) === String(id); });
    if (line) {
      if (Number.isInteger(item.stock) && item.stock >= 0 && line.qty >= item.stock) {
        alert("لا يمكن طلب كمية أكبر من المتاح بالمخزون.");
        return;
      }
      line.qty += 1;
    } else cart.push({id:id, qty:1});
    renderCart();
    setDrawer(true);
  }

  if (brandFilterSearch) brandFilterSearch.addEventListener("input", drawBrandFilters);

  document.getElementById("searchForm").addEventListener("submit", function (event) {
    event.preventDefault();
    query = document.getElementById("searchInput").value;
    visibleProductCount = pageSize;
    renderProducts();
    document.getElementById("products").scrollIntoView({behavior:"smooth"});
  });
  document.getElementById("searchInput").addEventListener("input", function (event) {
    query = event.target.value;
    visibleProductCount = pageSize;
    renderProducts();
  });

  document.addEventListener("click", function (event) {
    const quickViewButton = event.target.closest("[data-quick-view]");
    if (quickViewButton) {
      const item = products.find(function (entry) { return String(entry.id) === String(quickViewButton.dataset.quickView); });
      if (!item) { alert("تعذر تحميل بيانات المنتج."); return; }
      let modal = document.getElementById("quickViewModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "quickViewModal";
        modal.className = "quick-view-modal";
        modal.innerHTML = '<div class="quick-view-backdrop" data-quick-close></div><section class="quick-view-dialog" role="dialog" aria-modal="true" aria-labelledby="quickViewTitle"><button class="quick-view-close" type="button" aria-label="إغلاق" data-quick-close>×</button><div class="quick-view-content"></div></section>';
        document.body.appendChild(modal);
      }
      const name = cleanProductName(item.name);
      const description = cleanProductCopy(item.desc || item.specs || "للاستفسار عن المواصفات والتوفر تواصل معنا.");
      const image = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '">'
        : item.imageId
          ? '<img data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '">'
          : '<div class="quick-view-placeholder">🔧</div>';
      const brand = displayBrand(productBrand(item) || item.brand || "");
      const specs = cleanProductCopy(item.specs || "");
      const soldOut = Number.isInteger(item.stock) && item.stock === 0;
      modal.querySelector(".quick-view-content").innerHTML =
        '<div class="quick-view-image">' + image + '</div><div class="quick-view-info">' +
        (brand ? '<span class="quick-view-brand">' + escapeHtml(brand) + '</span>' : '') +
        '<h2 id="quickViewTitle">' + escapeHtml(name) + '</h2>' +
        '<p class="quick-view-description">' + escapeHtml(description) + '</p>' +
        (specs ? '<div class="quick-view-specs">' + escapeHtml(specs) + '</div>' : '') +
        '<div class="quick-view-price">' + escapeHtml(formatPrice(item.price)) + '</div>' +
        '<div class="quick-view-actions"><a class="quick-view-details" href="product.html?id=' + encodeURIComponent(String(item.id)) + '">عرض التفاصيل الكاملة</a>' +
        '<button class="button-primary" type="button" data-add="' + escapeHtml(item.id) + '"' + (soldOut ? ' disabled' : '') + '>' + (soldOut ? 'غير متاح حاليًا' : 'أضف إلى السلة') + '</button></div></div>';
      modal.classList.add("is-open");
      document.body.classList.add("quick-view-open");
      observeCloudImages();
      modal.querySelector("[data-quick-close]").focus();
      return;
    }
    if (event.target.closest("[data-quick-close]")) {
      const modal = document.getElementById("quickViewModal");
      if (modal) modal.classList.remove("is-open");
      document.body.classList.remove("quick-view-open");
      return;
    }
    const shareButton = event.target.closest("[data-share-product]");

    if (shareButton) {
      const id = String(shareButton.dataset.shareProduct);
      const item = products.find(function (entry) { return String(entry.id) === id; });
      if (!item) { alert("تعذر تحميل بيانات المنتج للمشاركة."); return; }
      const productUrl = new URL("product.html?id=" + encodeURIComponent(id), window.location.href).toString();
      const name = cleanProductName(item.name);
      const description = cleanProductCopy(item.desc || item.specs || "للاستفسار عن المواصفات والتوفر تواصل مع متجر الدولي.");
      const caption = [
        "🧰 " + name,
        item.brand ? "🏷️ الماركة: " + displayBrand(item.brand) : "",
        "💰 السعر: " + formatPrice(item.price),
        item.cat ? "📂 القسم: " + item.cat : "",
        "📝 التفاصيل: " + description.slice(0, 700),
        "🔗 رابط المنتج: " + productUrl,
        "الدولي للعدد الأصلية والمستوردة"
      ].filter(Boolean).join("\n");
      (async function () {
        shareButton.disabled = true;
        const oldLabel = shareButton.textContent;
        try {
          const file = await window.DAWLY_CREATE_PRODUCT_SHARE_FILE(item, productUrl, shareButton);
          if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
            await navigator.share({files:[file], title:name, text:caption});
          } else if (navigator.share) {
            await navigator.share({title:name, text:caption});
          } else {
            await navigator.clipboard?.writeText(caption);
            alert("المتصفح لا يدعم مشاركة الصور. تم تجهيز تفاصيل المنتج؛ يمكنك نسخ النص ومشاركة الصورة يدويًا.");
          }
        } catch (error) {
          if (!error || error.name !== "AbortError") {
            console.error("Product share failed:", error);
            alert("تعذر تجهيز صورة المشاركة. تأكد من تحميل صورة المنتج ثم حاول مرة أخرى.");
          }
        } finally {
          shareButton.disabled = false;
          shareButton.textContent = oldLabel;
        }
      })();
      return;
    }
    if (event.target.closest("#floatingContactToggle")) { setFloatingContact(floatingContactPanel && floatingContactPanel.hidden); return; }
    if (floatingContactPanel && !floatingContactPanel.hidden && !event.target.closest("#floatingContactWidget")) setFloatingContact(false);
    const brandFilter = event.target.closest("[data-brand-filter]");
    if (brandFilter) {
      activeBrand = brandFilter.dataset.brandFilter === "الكل" ? "" : brandFilter.dataset.brandFilter;
      visibleProductCount = pageSize;
      drawBrandFilters();
      renderProducts();
      return;
    }
    const category = event.target.closest("[data-category]");
    if (category) {
      activeCategory = category.dataset.category;
      syncCategorySelection();
      visibleProductCount = pageSize;
      renderProducts();
      if (category.classList.contains("category-tile") || category.closest("#mobileMenuCategories")) document.getElementById("products").scrollIntoView({behavior:"smooth"});
      if (category.closest("#mobileMenuCategories")) setMobileMenu(false);
      return;
    }
    const add = event.target.closest("[data-add]");
    if (add) {
      const quickModal = document.getElementById("quickViewModal");
      if (quickModal && quickModal.classList.contains("is-open")) { quickModal.classList.remove("is-open"); document.body.classList.remove("quick-view-open"); }
      addToCart(add.dataset.add); return;
    }
    const quantity = event.target.closest("[data-qty]");
    if (quantity) {
      const line = cart.find(function (entry) { return String(entry.id) === String(quantity.dataset.qty); });
      if (line) {
        const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
        const nextQty = line.qty + Number(quantity.dataset.delta);
        if (item && Number.isInteger(item.stock) && item.stock >= 0 && nextQty > item.stock) {
          alert("الكمية المطلوبة أكبر من المتاح بالمخزون.");
          return;
        }
        line.qty = nextQty;
        if (line.qty <= 0) cart = cart.filter(function (entry) { return String(entry.id) !== String(line.id); });
        renderCart();
      }
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      cart = cart.filter(function (entry) { return String(entry.id) !== String(remove.dataset.remove); });
      renderCart();
      return;
    }
    if (event.target.closest("#openCart")) { setDrawer(true); return; }
    if (event.target.closest("#closeCart") || event.target === cartOverlay) setDrawer(false);
    if (event.target.closest("#openMobileMenu")) { setMobileMenu(true); return; }
    if (event.target.closest("#closeMobileMenu") || event.target === mobileMenuOverlay) { setMobileMenu(false); return; }
    if (event.target.closest("#mobileMenuDrawer a")) { setMobileMenu(false); return; }
  });
  function showPaymentFollowup(orderNumber, saved, orderWhatsappUrl) {
    const followup = document.getElementById("paymentFollowup");
    const status = document.getElementById("paymentFollowupStatus");
    const orderLink = document.getElementById("orderWhatsappLink");
    if (!followup || !status) return;
    status.textContent = saved
      ? "تم تسجيل طلبك رقم " + orderNumber + ". اضغط فتح رسالة الطلب لإرسال التفاصيل عبر واتساب، ويمكنك استخدام زر الطلب لإرسال صورة المنتجات."
      : "تعذر حفظ الطلب " + orderNumber + " في لوحة المتجر. تواصل مع المتجر للتأكد من استلامه.";
    if (orderLink) {
      if (saved && orderWhatsappUrl) {
        orderLink.href = orderWhatsappUrl;
        orderLink.hidden = false;
        orderLink.setAttribute("aria-label", "فتح رسالة الطلب رقم " + orderNumber + " عبر واتساب");
      } else {
        orderLink.hidden = true;
        orderLink.removeAttribute("href");
      }
    }
    followup.hidden = false;
    followup.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  async function createWhatsAppOrderImage(orderNumber, customerName, customerPhone, customerAddress, orderItems, orderSummary) {
    const width = 1080, rowHeight = 250, headerHeight = 430, footerHeight = 310;
    const height = headerHeight + orderItems.length * rowHeight + footerHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3f4f6"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fff"; ctx.fillRect(32, 32, width - 64, height - 64);
    ctx.fillStyle = "#c8101e"; ctx.fillRect(32, 32, width - 64, 18);
    ctx.direction = "rtl"; ctx.textAlign = "right";
    function write(text, x, y, size, color, weight, maxWidth) {
      ctx.font = (weight || "600") + " " + size + "px Tahoma, Arial, sans-serif";
      ctx.fillStyle = color || "#20242a";
      ctx.fillText(String(text == null ? "" : text), x, y, maxWidth || 850);
    }
    function wrapText(text, x, y, maxWidth, lineHeight, size, color, weight, maxLines) {
      ctx.font = (weight || "600") + " " + size + "px Tahoma, Arial, sans-serif";
      ctx.fillStyle = color || "#20242a";
      const words = String(text == null ? "" : text).split(/\s+/);
      const lines = [];
      let line = "";
      words.forEach(function(word) {
        const candidate = line ? line + " " + word : word;
        if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
        else line = candidate;
      });
      if (line) lines.push(line);
      const visible = lines.slice(0, maxLines || 3);
      visible.forEach(function(value, index) { ctx.fillText(value, x, y + index * lineHeight); });
      return visible.length;
    }
    function loadImage(src) {
      return new Promise(function(resolve) {
        if (!src) return resolve(null);
        const img = new Image();
        img.onload = function(){ resolve(img); };
        img.onerror = function(){ resolve(null); };
        if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
        img.src = src;
      });
    }
    // Draw the store emblem directly on canvas so it never disappears if an image URL fails.
    ctx.save();
    ctx.translate(142, 128);
    ctx.fillStyle = "#d71920";
    ctx.beginPath(); ctx.arc(0, 0, 57, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#171b20";
    ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#171b20"; ctx.lineWidth = 17; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(4, 18); ctx.lineTo(48, 60); ctx.stroke();
    ctx.restore();
    write("الدولي للعدد الأصلية والمستوردة", width - 86, 130, 46, "#c8101e", "bold", 760);
    write("تفاصيل طلب جديد", width - 86, 195, 32, "#252b33", "bold");
    write("رقم الطلب: " + orderNumber, width - 86, 255, 27, "#20242a", "bold");
    write("العميل: " + customerName, width - 86, 310, 24, "#343d47", "600", 900);
    write("الهاتف: " + customerPhone, width - 86, 355, 24, "#343d47", "600", 900);
    wrapText("العنوان: " + customerAddress, width - 86, 400, 900, 28, 21, "#343d47", "600", 2);
    let y = headerHeight;
    for (let i = 0; i < orderItems.length; i++) {
      const item = orderItems[i];
      ctx.fillStyle = i % 2 ? "#fafafa" : "#f1f3f5";
      ctx.fillRect(68, y, width - 136, rowHeight - 12);
      ctx.fillStyle = "#fff"; ctx.fillRect(86, y + 42, 136, 136);
      let src = item.image || "";
      if (!src && item.imageId && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
        try { src = await window.DAWLY_LOAD_PRODUCT_IMAGE(item.imageId); } catch (e) { src = ""; }
      }
      const img = await loadImage(src);
      if (img) {
        const scale = Math.min(120 / img.width, 120 / img.height);
        const iw = img.width * scale, ih = img.height * scale;
        ctx.drawImage(img, 94 + (120 - iw) / 2, y + 50 + (120 - ih) / 2, iw, ih);
      } else {
        ctx.textAlign = "center"; ctx.font = "58px Tahoma"; ctx.fillStyle = "#9aa1a9";
        ctx.fillText("🔧", 154, y + 130); ctx.textAlign = "right";
      }
      const textX = width - 258, textWidth = 560;
      const nameLines = wrapText((i + 1) + ". " + item.name, textX, y + 58, textWidth, 31, 23, "#20242a", "bold", 3);
      const detailY = y + 68 + Math.max(1, nameLines) * 31;
      write("الكمية: " + item.qty + "   |   سعر الوحدة: " + (item.unitPrice || "عند الاستفسار"), textX, detailY, 19, "#4b5560", "600", textWidth);
      const hasUnitPrice = typeof item.unitPriceAmount === "number" && Number.isFinite(item.unitPriceAmount);
      const lineTotal = hasUnitPrice ? money(item.unitPriceAmount * Number(item.qty || 0)) : "يحدد بعد تأكيد السعر";
      write("إجمالي المنتج: " + lineTotal, textX, detailY + 42, 20, "#a71926", "bold", textWidth);
      y += rowHeight;
    }
    const allItemsPriced = orderItems.length > 0 && orderItems.every(function(item) {
      return typeof item.unitPriceAmount === "number" && Number.isFinite(item.unitPriceAmount);
    });
    const orderTotal = orderItems.reduce(function(sum, item) {
      return sum + (typeof item.unitPriceAmount === "number" && Number.isFinite(item.unitPriceAmount)
        ? item.unitPriceAmount * Number(item.qty || 0) : 0);
    }, 0);
    const summaryY = y + 22;
    ctx.fillStyle = "#fff1f1"; ctx.fillRect(68, summaryY, width - 136, 118);
    ctx.strokeStyle = "#efc9cc"; ctx.lineWidth = 2; ctx.strokeRect(68, summaryY, width - 136, 118);
    ctx.textAlign = "center"; ctx.font = "bold 27px Tahoma, Arial, sans-serif"; ctx.fillStyle = "#a71926";
    const summaryText = allItemsPriced
      ? "إجمالي الطلب: " + money(orderTotal)
      : "إجمالي المنتجات المسعّرة: " + money(orderTotal) + " — توجد منتجات تحتاج تأكيد السعر";
    const summaryWords = summaryText.split(/\s+/), summaryLines = [];
    let summaryLine = "";
    summaryWords.forEach(function(word) {
      const candidate = summaryLine ? summaryLine + " " + word : word;
      if (summaryLine && ctx.measureText(candidate).width > 900) { summaryLines.push(summaryLine); summaryLine = word; }
      else summaryLine = candidate;
    });
    if (summaryLine) summaryLines.push(summaryLine);
    summaryLines.slice(0, 2).forEach(function(line, index) { ctx.fillText(line, width / 2, summaryY + 47 + index * 36); });
    ctx.font = "bold 22px Tahoma, Arial, sans-serif"; ctx.fillStyle = "#444";
    ctx.fillText("شكرًا لثقتكم في الدولي للعدد الأصلية والمستوردة ❤️", width / 2, summaryY + 168);

    // Repeat the store name diagonally as a faint watermark across the entire image.
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = "#c8101e";
    ctx.font = "bold 42px Tahoma, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.direction = "rtl";
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6);
    const watermarkText = "الدولي للعدد الأصلية والمستوردة";
    for (let wy = -height; wy <= height; wy += 230) {
      for (let wx = -width; wx <= width; wx += 620) {
        ctx.fillText(watermarkText, wx, wy, 590);
      }
    }
    ctx.restore();
    return await new Promise(function(resolve, reject) {
      canvas.toBlob(function(blob) { if (blob) resolve(blob); else reject(new Error("تعذر تجهيز صورة المنتجات")); }, "image/png");
    });
  }
  let readyOrderShareFile = null;
  let readyOrderShareMessage = "";
  async function prepareWhatsAppOrderImage(orderNumber, customerName, customerPhone, customerAddress, orderItems, message, orderSummary) {
    const blob = await createWhatsAppOrderImage(orderNumber, customerName, customerPhone, customerAddress, orderItems, orderSummary);
    readyOrderShareFile = new File([blob], "dawly-order-" + orderNumber + ".png", {type:"image/png"});
    readyOrderShareMessage = message;
    checkout.disabled = false;
    checkout.textContent = "إرسال الطلب والصورة عبر واتساب";
    checkout.dataset.shareReady = "true";
  }

  checkout.addEventListener("click", async function () {
    if (checkout.disabled) return;
    if (checkout.dataset.shareReady === "true" && readyOrderShareFile) {
      checkout.disabled = true;
      try {
        if (!navigator.share) throw new Error("المتصفح لا يدعم مشاركة الملفات");
        await navigator.share({files:[readyOrderShareFile], title:"طلب من متجر الدولي", text:readyOrderShareMessage});
        clearCartAfterWhatsApp();
        checkout.textContent = "تم إرسال الطلب";
        checkout.dataset.shareReady = "false";
      } catch (shareError) {
        if (shareError && shareError.name === "AbortError") { checkout.disabled = false; return; }
        console.warn("تعذرت مشاركة الطلب:", shareError);
        checkout.disabled = false;
        alert("تعذر فتح مشاركة الصورة. جرّب الضغط مرة أخرى أو افتح الموقع من Chrome.");
      }
      return;
    }
    if (!cart.length) return;
    const customerName = document.getElementById("customerName").value.trim();
    const customerPhoneRaw = document.getElementById("customerPhone").value.trim();
    const customerAddress = document.getElementById("customerAddress").value.trim();
    const customerPhone = customerPhoneRaw
      .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
      .replace(/[\s()+-]/g, "");
    if (!customerName || !customerPhoneRaw || !customerAddress) {
      alert("من فضلك اكتب الاسم ورقم الهاتف والعنوان قبل إرسال الطلب.");
      return;
    }
    if (!/^\d{8,15}$/.test(customerPhone)) {
      alert("رقم الهاتف غير صحيح. راجع الرقم وحاول مرة أخرى.");
      document.getElementById("customerPhone").focus();
      return;
    }
    checkout.disabled = true;
    const orderNumber = "DW-" + Date.now().toString().slice(-8);
    const pricing = cartPricing();
    let itemNumber = 0;
    const lines = cart.map(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      if (!item) return "";
      itemNumber += 1;
      const productUrl = new URL("product.html?id=" + encodeURIComponent(item.id), window.location.href).toString();
      const price = parsePrice(item.price);
      const priceLines = price === null
        ? "   السعر: عند الاستفسار"
        : "   سعر الوحدة: " + money(price) + "\n   إجمالي المنتج: " + money(price * line.qty);
      return itemNumber + ") " + cleanOrderProductName(item.name) + "\n   الكمية: " + line.qty + "\n" + priceLines + "\n   صورة المنتج والتفاصيل: " + productUrl;
    }).filter(Boolean).join("\n\n");
    const totalText = pricing.pricedCount === pricing.itemCount
      ? "إجمالي المنتجات: " + money(pricing.total)
      : pricing.pricedCount
        ? "مجموع المنتجات المسعّرة: " + money(pricing.total) + "\nبعض المنتجات: السعر عند الاستفسار"
        : "إجمالي المنتجات: يتحدد بعد تأكيد الأسعار";
    const customerDetails = [
      "الاسم: " + customerName,
      "الهاتف: " + customerPhone,
      "العنوان: " + customerAddress
    ];
    const message = [
      "🛒 *طلب جديد من متجر الدولي*",
      "رقم الطلب: *" + orderNumber + "*",
      "",
      "👤 *بيانات العميل*",
      customerDetails.join("\n"),
      "",
      "📦 *المنتجات (" + pricing.itemCount + ")*",
      lines,
      "",
      "💰 *ملخص الطلب*",
      totalText,
      "",
      "برجاء تأكيد توفر المنتجات."
    ].join("\n");
    const orderItems = cart.map(function(line) {
      const item = products.find(function(entry){return String(entry.id)===String(line.id);});
      if (!item) return null;
      const unitPrice = parsePrice(item.price);
      return {
        id:String(item.id), name:cleanOrderProductName(item.name), brand:String(item.brand||""),
        qty:line.qty, unitPrice:String(item.price||"السعر عند الاستفسار"),
        unitPriceAmount:unitPrice, lineTotal:unitPrice===null?null:unitPrice*line.qty,
        image:item.image||item.imageUrl||"",
        imageId:(Array.isArray(item.imageIds)&&item.imageIds[0])||item.imageId||null
      };
    }).filter(Boolean);
    if (!orderItems.length || orderItems.length !== cart.length) {
      checkout.disabled = false;
      alert("تعذر تحميل بيانات أحد المنتجات. حدّث الصفحة ثم راجع سلتك قبل إعادة الطلب.");
      return;
    }
    const totalIsComplete = pricing.itemCount > 0 && pricing.pricedCount === pricing.itemCount;
    const record = {
      orderNumber, customerName, customerPhone, customerAddress, notes:"", items:orderItems,
      productSubtotal:pricing.total, totalAmount:totalIsComplete?pricing.total:null, totalIsComplete,
      totalText, status:"new",
      whatsappStatus:"awaiting_customer_send", source:"website"
    };
    const orderImageItems = orderItems.map(function(item) {
      return {name:item.name,qty:item.qty,unitPrice:item.unitPrice,unitPriceAmount:item.unitPriceAmount,lineTotal:item.lineTotal,image:item.image,imageId:item.imageId};
    });
    const whatsappUrl = "https://wa.me/201024787222?text=" + encodeURIComponent(message);
    // Start saving in the background, then immediately prepare the native share from this single button action.
    try {
      const appMod = await import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js");
      const fsMod = await import("https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js");
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(window.DAWLY_FIREBASE_CONFIG);
      await fsMod.setDoc(fsMod.doc(fsMod.getFirestore(app), "orders", orderNumber),
        Object.assign({}, record, {createdAt:fsMod.serverTimestamp()}));
      showPaymentFollowup(orderNumber, true, whatsappUrl);
    } catch (err) {
      console.warn("تعذر تسجيل الطلب في لوحة الإدارة.", err);
      showPaymentFollowup(orderNumber, false);
      checkout.disabled = false;
      alert("تعذر تسجيل الطلب في لوحة المتجر. احتفظ برقم الطلب " + orderNumber + " وتواصل مع المتجر.");
      return;
    }
    try {
      await prepareWhatsAppOrderImage(orderNumber, customerName, customerPhone, customerAddress, orderImageItems, message, {totalAmount:record.totalAmount,totalIsComplete:record.totalIsComplete,totalText:record.totalText});
    } catch (shareError) {
      console.warn("تعذر تجهيز صورة الطلب:", shareError);
      checkout.disabled = false;
      checkout.textContent = "إعادة تجهيز صورة الطلب";
      alert("تم تسجيل الطلب، لكن تعذر تجهيز الصورة. حاول مرة أخرى.");
    }
  });
  // Keep the active checkout field visible when the mobile keyboard opens.
  function keepCheckoutFieldVisible(field) {
    if (!field || !cartDrawer || !cartDrawer.classList.contains("open")) return;
    window.setTimeout(function () {
      if (!field.isConnected || document.activeElement !== field) return;
      field.scrollIntoView({behavior:"smooth", block:"center", inline:"nearest"});
    }, 180);
  }
  cartDrawer.addEventListener("focusin", function (event) {
    if (event.target && event.target.matches(".checkout-fields input, .checkout-fields textarea")) {
      keepCheckoutFieldVisible(event.target);
    }
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      const active = document.activeElement;
      if (active && active.matches && active.matches(".checkout-fields input, .checkout-fields textarea")) {
        keepCheckoutFieldVisible(active);
      }
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { setDrawer(false); setMobileMenu(false); setFloatingContact(false); }
  });
  drawCategories();
  renderProducts();
  renderHomeShelves();
  renderBrandAvailability();
  renderCart();
  if (new URLSearchParams(window.location.search).get("cart") === "1") {
    setDrawer(true);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("cart");
    window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
})();
