(() => {
  let products = Array.isArray(window.DAWLY_PRODUCTS) ? window.DAWLY_PRODUCTS : [];
  const isHomePage = document.querySelector('main[data-page="home"]') !== null;
  const grid = document.getElementById("productGrid");
  const offersSection = document.getElementById("homeOffers");
  const offersGrid = document.getElementById("homeOffersGrid");
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

  // Hide the floating contact button in either scroll direction; reveal only after scrolling stops.
  const floatingContactWidget = document.getElementById("floatingContactWidget");
  if (floatingContactWidget) {
    let contactScrollIdleTimer = null;
    function revealFloatingContact() {
      floatingContactWidget.classList.remove("is-scroll-hidden");
    }
    function hideFloatingContact() {
      if (floatingContactPanel && !floatingContactPanel.hidden) return;
      floatingContactWidget.classList.add("is-scroll-hidden");
    }
    window.addEventListener("scroll", function () {
      hideFloatingContact();
      if (contactScrollIdleTimer) window.clearTimeout(contactScrollIdleTimer);
      contactScrollIdleTimer = window.setTimeout(revealFloatingContact, 850);
    }, { passive: true });
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
  let scannedBarcode = "";
  const pageSize = 12;
  let visibleProductCount = isHomePage ? 6 : pageSize;
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
    if (!image || image.tagName !== "IMG") return;
    if (image.closest("#newArrivalsGrid, #featuredProductsGrid") && image.dataset.cloudImage &&
        image.dataset.cloudRetried !== "1" && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      image.dataset.cloudRetried = "1";
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cloudImage).then(function(url){
        if (url && image.isConnected) image.src = url;
        else if (image.isConnected) showProductImageFallback(image);
      }).catch(function(){ if(image.isConnected) showProductImageFallback(image); });
      return;
    }
    if (image.closest(".product-grid, .home-products-shelf, .quick-view-image")) showProductImageFallback(image);
  }, true);

  function observeCloudImages() {
    const images = document.querySelectorAll("#productGrid img[data-cloud-image], #homeOffersGrid img[data-cloud-image], #featuredProductsGrid img[data-cloud-image], #newArrivalsGrid img[data-cloud-image], #quickViewModal img[data-cloud-image]");
    if (!images.length || typeof window.DAWLY_LOAD_PRODUCT_IMAGE !== "function") return;
    function loadImage(image) {
      // The storage loader may finish initializing after the catalog markup.
      // Leave the image pending; dawly-catalog-ready will retry the observer.
      if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE !== "function") return;
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cloudImage).then(function (url) {
        if (url && image.isConnected) {
          image.src = url;
          document.querySelectorAll('img[data-cloud-image]').forEach(function(peer){
            if(peer !== image && peer.dataset.cloudImage === image.dataset.cloudImage && peer.isConnected) peer.src = url;
          });
        } else if (image.isConnected) showProductImageFallback(image);
      }).catch(function () {
        if (image.isConnected) showProductImageFallback(image);
      });
    }
    // Use the shared observer so off-screen shelf images do not download yet.
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
      images.forEach(function (image) {
        if (image.dataset.cloudObserved === "1") return;
        image.dataset.cloudObserved = "1";
        cloudImageObserver.observe(image);
      });
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
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    let text = String(value == null ? "" : value).trim();
    if (!text || /استفسار|حسب الطلب/i.test(text)) return null;
    text = text
      .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); });
    text = text.replace(/(?:جنيه(?:\s*مصري)?|ج\.?م\.?|ج\.?|EGP|LE)/gi, "").replace(/[\s,،٬]/g, "");
    if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
    const amount = Number(text);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }
  function money(amount) {
    return "EGP " + new Intl.NumberFormat("en-US", {maximumFractionDigits:2}).format(amount);
  }
  function formatPrice(value) {
    const amount = parsePrice(value);
    return amount === null ? cleanProductCopy(value || "السعر عند الاستفسار") : money(amount);
  }
  function productPricing(item) {
    const base=parsePrice(item && item.price);
    const timerEnabled=item && item.offerTimerEnabled===true;
    const endsAt=timerEnabled?Date.parse(item.offerEndsAt||""):NaN;
    const expired=timerEnabled && (!Number.isFinite(endsAt) || endsAt<=Date.now());
    const percent=expired?0:Math.max(0,Math.min(90,Number(item && item.discountPercent)||0));
    return {base:base,current:base===null?null:(percent?Math.round(base*(1-percent/100)*100)/100:base),percent:percent,endsAt:Number.isFinite(endsAt)&&!expired?endsAt:0};
  }
  function productCurrentPrice(item){return productPricing(item).current;}
  function isItemInCart(item) {
    if (!item) return false;
    return cart.some(function (line) {
      return String(line.id) === String(item.id) || (item._docId !== undefined && item._docId !== null && String(line.id) === String(item._docId));
    });
  }
  function cartPricing() {
    let total = 0;
    let pricedCount = 0;
    cart.forEach(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id) || (entry._docId !== undefined && String(entry._docId) === String(line.id)); });
      if (!item) return;
      const price = productCurrentPrice(item);
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
    if (/قياس|measurement|اختبار|كهرباء/.test(value)) return 'https://raw.githubusercontent.com/aldawly-tools/aldawly-website/main/assets/categories/measurement.svg';
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
    const labels = {
      wurth:"WÜRTH",bosch:"BOSCH",wera:"WERA",knipex:"KNIPEX",beta:"Beta",
      dewalt:"DEWALT",gesipa:"GESIPA",bahco:"BAHCO",hazet:"HAZET",
      koken:"KOKEN",modeco:"MODECO",luxtools:"LUX-TOOLS",riss:"RISS",elora:"ELORA"
    };
    return labels[normalizeBrand(name)] || cleanProductCopy(name);
  }
  function productBrand(item) {
    const explicit = item.brand || item.brandName || item.manufacturer;
    if (explicit && String(explicit).trim()) return displayBrand(explicit);
    const searchable = normalizeBrand([
      item.name, item.desc, item.specs, item.sku, item.code, item.model, item.partNumber
    ].filter(Boolean).join(" "));
    // Include every brand already represented by the storefront's brand logos,
    // not only the original small set. Longer identifiers are checked first.
    const known = [
      ["luxtools","LUX-TOOLS"],["milwaukee","Milwaukee"],["gesipa","GESIPA"],
      ["normex","Normex"],["modeco","MODECO"],["bahco","BAHCO"],
      ["hazet","HAZET"],["knipex","KNIPEX"],["bosch","BOSCH"],
      ["dewalt","DEWALT"],["makita","Makita"],["koken","KOKEN"],
      ["wurth","WÜRTH"],["wera","WERA"],["beta","Beta"],["riss","RISS"],["elora","ELORA"]
    ];
    const match = known.find(function (entry) { return searchable.includes(entry[0]); });
    return match ? match[1] : "";
  }
  function renderBrandAvailability() {
    const track = document.querySelector(".brands-marquee-section .brands-marquee-track");
    const group = track && track.querySelector(".brands-marquee-group");
    if (!track || !group) return;
    const templates = new Map();
    group.querySelectorAll(".brand-word").forEach(function (link) {
      const name = link.querySelector(".brand-name-sr")?.textContent || "";
      const key = normalizeBrand(name);
      if (key && !templates.has(key)) templates.set(key, link.cloneNode(true));
    });
    const available = new Map();
    products.forEach(function (item) {
      const label = productBrand(item);
      const key = normalizeBrand(label);
      if (key && !available.has(key)) available.set(key, label);
    });
    const brands = Array.from(available.entries()).sort(function(a,b) {
      return a[1].localeCompare(b[1], "ar");
    });
    group.innerHTML = "";
    brands.forEach(function(entry) {
      const key=entry[0], label=entry[1];
      const link=templates.has(key)?templates.get(key):document.createElement("a");
      link.className="brand-word brand-tile";
      link.href="products.html?brand="+encodeURIComponent(label)+"#productGrid";
      link.dataset.brandTarget=link.href;
      link.setAttribute("aria-label","منتجات "+label);
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
      const sr=document.createElement("span");
      sr.className="brand-name-sr";
      sr.textContent=label;
      const logo=brandLogoForFilter(label);
      if(logo){
        const img=document.createElement("img");
        img.className="brand-logo";
        img.src=logo;
        img.alt=label+" logo";
        img.loading="lazy";
        img.decoding="async";
        link.replaceChildren(img,sr);
      }else{
        const mark=document.createElement("span");
        mark.className="brand-text-mark";
        mark.textContent=label;
        link.replaceChildren(mark,sr);
      }
      group.appendChild(link);
    });
    track.querySelectorAll(".brands-marquee-group[aria-hidden='true']").forEach(function(node){node.remove();});
    track.dataset.loopReady="";
    if(brands.length){
      const clone=group.cloneNode(true);
      clone.setAttribute("aria-hidden","true");
      clone.querySelectorAll("a").forEach(function(link){link.setAttribute("tabindex","-1");});
      track.appendChild(clone);
      track.dataset.loopReady="1";
    }
  }
  function setCheckoutStep(step) {
    const steps = {
      review: document.getElementById("cartReviewStep"),
      details: document.getElementById("checkoutDetailsStep"),
      whatsapp: document.getElementById("checkoutWhatsappStep")
    };
    if (step === "whatsapp" && steps.whatsapp) {
      const link = document.getElementById("orderWhatsappLink");
      if (!link || !link.getAttribute("href") || link.getAttribute("href") === "#") step = "details";
    }
    Object.keys(steps).forEach(function(key) { if (steps[key]) steps[key].hidden = key !== step; });
    const progress = cartDrawer && cartDrawer.querySelector(".order-progress");
    const activeIndex = ({review:0,details:1,whatsapp:2}[step]);
    if (progress) progress.querySelectorAll("[data-checkout-step]").forEach(function(node, index) {
      node.classList.toggle("is-active", index === activeIndex);
      node.classList.toggle("is-complete", index < activeIndex);
      if (index === activeIndex) node.setAttribute("aria-current", "step");
      else node.removeAttribute("aria-current");
      const available = index !== 2 || !!(steps.whatsapp && document.getElementById("orderWhatsappLink") && document.getElementById("orderWhatsappLink").getAttribute("href") && document.getElementById("orderWhatsappLink").getAttribute("href") !== "#");
      node.disabled = !available;
      node.setAttribute("aria-disabled", String(!available));
    });
    const totalBox = document.querySelector(".cart-sticky-footer");
    if (totalBox) totalBox.hidden = step === "whatsapp";
    if (checkout) checkout.hidden = step !== "details";
    const scrollArea = cartDrawer && cartDrawer.querySelector(".cart-scroll-area");
    if (scrollArea) scrollArea.scrollTop = 0;
  }
  function setDrawer(open) {
    cartDrawer.classList.toggle("open", open);
    cartOverlay.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) document.getElementById("closeCart").focus();
  }
  function renderHomeShelves() {
    function card(item, index) {
      const imagePriority = isHomePage && index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
      const name = cleanProductName(item.name);
      const url = "product.html?id=" + encodeURIComponent(String(item.id));
      const rissFallback = normalizeBrand(productBrand(item)) === "riss" ? "assets/brands/riss.webp" : "";
      const image = item.image
        ? '<img src="' + escapeHtml(item.image) + '"' + (item.imageId ? ' data-cloud-image="' + escapeHtml(item.imageId) + '"' : '') + ' alt="' + escapeHtml(name) + '" width="300" height="300" '+imagePriority+' decoding="async" draggable="false">'
        : item.imageId
          ? '<img data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '" width="300" height="300" loading="lazy" decoding="async" draggable="false">'
          : rissFallback
            ? '<img src="' + rissFallback + '" alt="RISS German Technology" width="300" height="300" '+imagePriority+' decoding="async" draggable="false" class="brand-product-fallback">'
            : '<span class="product-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
      const soldOut = item.availability === "unavailable" || (item.availability !== "available" && Number.isInteger(item.stock) && item.stock === 0);
      const alreadyInCart = isItemInCart(item);
      const availabilityLabel = item.availability === "ask" ? '<span class="stock-status">استفسر عن التوفر</span>' : soldOut ? '<span class="stock-status out">غير متوفر حاليًا</span>' : '<span class="stock-status">متوفر — يُرجى التأكيد عند الطلب</span>';
      const pricing=productPricing(item);
      const shelfPrice=pricing.current===null?escapeHtml(formatPrice(item.price)):(pricing.percent?'<strong>'+escapeHtml(money(pricing.current))+'</strong><del>'+escapeHtml(money(pricing.base))+'</del><em class="product-discount">خصم '+pricing.percent+'%</em>':escapeHtml(formatPrice(item.price)));
      const offerTimer=pricing.endsAt?'<div  class="product-offer-countdown" data-offer-end="'+pricing.endsAt+'"><div class="offer-countdown-heading"><span>⏳ ينتهي العرض خلال</span><b>عرض محدود</b></div><div class="offer-countdown-units"><span><strong data-time-unit="days">00</strong><small>يوم</small></span><span><strong data-time-unit="hours">00</strong><small>ساعة</small></span><span><strong data-time-unit="minutes">00</strong><small>دقيقة</small></span><span><strong data-time-unit="seconds">00</strong><small>ثانية</small></span></div></div>':"";
      return '<article class="product-card home-shelf-card"><a class="product-visual product-open-link" href="' + url + '">' + image + '</a><div class="product-info"><span class="product-category">' + escapeHtml(displayBrand(productBrand(item)) || item.cat || "منتجات") + '</span><h3 class="product-name"><a href="' + url + '">' + escapeHtml(name) + '</a></h3><div class="product-card-status">' + availabilityLabel + '</div>'+offerTimer+'<span class="product-price' + ((item.price === null || item.price === undefined || item.price === "") ? ' price-on-request' : '') + '">' + shelfPrice + '<small>' + (item.price === null || item.price === undefined || item.price === "" ? 'السعر عند التواصل' : '') + '</small></span><button class="button-primary home-shelf-add product-add-cart-prominent' + (alreadyInCart ? ' is-in-cart' : '') + '" type="button" data-add="' + escapeHtml(item.id) + '"' + (soldOut || alreadyInCart ? ' disabled aria-disabled="true"' : '') + '>' + (soldOut ? 'غير متاح حاليًا' : alreadyInCart ? '<span>مضافة بالفعل</span>' : '<span class="add-cart-icon" aria-hidden="true">🛒</span><span>أضف إلى السلة</span>') + '</button><button class="quick-view-trigger" type="button" data-quick-view="' + escapeHtml(item.id) + '">معاينة سريعة</button></div></article>';
    }
    const featuredGrid = document.getElementById("featuredProductsGrid");
    if (featuredGrid) {
      const featured = products.filter(function(item){ return item.hiddenFromStore !== true && (item.featured === true || item.isFeatured === true || item.weeklyPick === true); }).sort(function(a,b){ return (Number(a.featuredOrder)||0)-(Number(b.featuredOrder)||0) || Number(b.id||0)-Number(a.id||0); });
      featuredGrid.innerHTML = featured.length ? featured.map(card).join("") : '<div class="catalog-empty-note">لا توجد منتجات مميزة مضافة حاليًا. يمكنك اختيار المنتجات المميزة من بيانات المنتج في لوحة الإدارة.</div>';
    }
    const arrivalsGrid = document.getElementById("newArrivalsGrid");
    if (arrivalsGrid) {
      const latest = products.filter(function(item){return item.hiddenFromStore !== true;}).slice().sort(function(a,b){
        const da = a.createdAt && (a.createdAt.seconds || Date.parse(a.createdAt) / 1000) || 0;
        const db = b.createdAt && (b.createdAt.seconds || Date.parse(b.createdAt) / 1000) || 0;
        return db-da || Number(b.id||0)-Number(a.id||0);
      }).slice(0,12);
      arrivalsGrid.innerHTML = latest.length ? latest.map(card).join("") : '<div class="catalog-empty-note">الكتالوج فارغ حاليًا. أضف منتجاتك الأصلية من لوحة الإدارة لتظهر هنا تلقائيًا.</div>';
    }
    // Load Firebase-hosted images in the featured and latest-product shelves too.
    observeCloudImages();
    updateOfferCountdowns();
  }

  function updateOfferCountdowns(){
    document.querySelectorAll("[data-offer-end]").forEach(function(node){
      const remaining=Number(node.dataset.offerEnd)-Date.now();
      if(remaining<=0){node.textContent="انتهى العرض";return;}
      const total=Math.floor(remaining/1000),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
      const values={days:days,hours:hours,minutes:minutes,seconds:seconds};
      Object.keys(values).forEach(function(unit){const part=node.querySelector('[data-time-unit="'+unit+'"]');if(part)part.textContent=String(values[unit]).padStart(2,"0");});
    });
  }
  if(!window.__dawlyOfferCountdownTimer){window.__dawlyOfferCountdownTimer=setInterval(updateOfferCountdowns,1000);}

  function syncCategorySelection() {
    document.querySelectorAll("#filterBar .filter-chip, #categoryTiles .category-tile").forEach(function (button) {
      const selected = button.dataset.category === activeCategory;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function drawCategories() {
    const categoryCounts = new Map();
    products.forEach(function (item) {
      if (item.cat) categoryCounts.set(item.cat, (categoryCounts.get(item.cat) || 0) + 1);
    });
    const categories = Array.from(categoryCounts.keys());
    const categoryCards = isHomePage
      ? categories.slice().sort(function(a,b){ return (categoryCounts.get(b)||0) - (categoryCounts.get(a)||0); }).slice(0,4)
      : categories;
    tiles.innerHTML = '<button class="category-tile category-row-card all" type="button" data-category="الكل"><span class="category-photo"><img src="' + categoryImage("ورش") + '" alt="" width="104" height="94" loading="lazy" decoding="async"><span class="category-photo-shade"></span><span class="category-icon">' + categoryIcon("ورش") + '</span></span><span class="category-copy"><strong>جميع الأقسام</strong><small class="category-availability">● متاح للتصفح</small><b>' + products.length + ' منتج</b><span class="category-browse">تصفح القسم ←</span></span></button>' +
      categoryCards.map(function (name) {
        const count = categoryCounts.get(name) || 0;
        const availability = count > 0 ? '● متاح للتصفح' : '● لا توجد منتجات';
        return '<button class="category-tile category-row-card" type="button" data-category="' + escapeHtml(name) + '"><span class="category-photo"><img src="' + categoryImage(name) + '" alt="" width="104" height="94" loading="lazy" decoding="async"><span class="category-photo-shade"></span><span class="category-icon">' + categoryIcon(name) + '</span></span><span class="category-copy"><strong>' + escapeHtml(name) + '</strong><small class="category-availability' + (count > 0 ? ' is-available' : ' is-empty') + '">' + availability + '</small><b>' + count + ' منتج</b><span class="category-browse">تصفح القسم ←</span></span></button>';
      }).join("");
    filterBar.innerHTML = '<button class="filter-chip active" type="button" data-category="الكل">كل المنتجات <span class="filter-count">' + products.length + '</span></button>' +
      categories.map(function (name) {
        const count = categoryCounts.get(name) || 0;
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
  function brandLogoForFilter(label) {
    const logos = {
      "gesipa":"assets/brands/gesipa.webp",
    "lux-tools":"assets/brands/lux-tools.webp",
      "bahco":"assets/brands/bahco.webp",
      "koken":"assets/brands/koken.webp",
      "modeco":"assets/brands/modeco.webp",
      "normex":"assets/brands/normex.webp",
      "riss":"assets/brands/riss.webp",
      "bosch":"https://upload.wikimedia.org/wikipedia/commons/1/16/Bosch-logo.svg",
      "knipex":"https://upload.wikimedia.org/wikipedia/commons/e/e3/Knipex_logo.svg",
      "wera":"https://upload.wikimedia.org/wikipedia/commons/e/ec/Wera_schwarz_Logo_ohne_Effekt_4C.svg",
      "wurth":"https://upload.wikimedia.org/wikipedia/commons/c/c3/Wuerth_Logo_2024.svg",
      "dewalt":"https://upload.wikimedia.org/wikipedia/commons/8/89/DeWalt_Logo.svg",
      "milwaukee":"https://upload.wikimedia.org/wikipedia/commons/d/de/Milwaukee_Logo.svg",
      "makita":"https://upload.wikimedia.org/wikipedia/commons/7/71/Makita_Logo.svg",
      "beta":"https://static.cdnlogo.com/logos/b/13/beta-tools.svg",
      "elora":"https://www.elora.de/wp-content/uploads/2021/02/elora-logo.png"
    };
    const key = normalizeBrand(label);
    return logos[key] || "";
  }
  function brandMonogram(label) {
    const key = normalizeBrand(label);
    const known = {
      "gesipa":"G","bahco":"B","koken":"K","modeco":"M","normex":"N","riss":"R"
    };
    return known[key] || String(label || "?").trim().slice(0,2).toUpperCase();
  }
  function syncActiveBrandHeading() {
    const banner = document.getElementById("activeBrandBanner");
    const title = document.getElementById("activeBrandBannerTitle");
    const logo = document.getElementById("activeBrandBannerLogo");
    const sectionTitle = document.querySelector("#products .section-title");
    const subtitle = document.querySelector("#products .section-subtitle");
    const label = activeBrand ? displayBrand(activeBrand) : "";
    const defaultTitle = query ? "نتائج البحث" : activeCategory !== "الكل" ? "منتجات " + activeCategory : isHomePage ? "منتجات مختارة" : "كل المنتجات";
    const defaultSubtitle = query
      ? "نتائج البحث عن " + query
      : activeCategory !== "الكل"
        ? "تصفّح منتجات هذا القسم واسألنا عن السعر والتوافر."
        : isHomePage
          ? "مجموعة من منتجات الدولي. افتح الكتالوج الكامل لمشاهدة باقي المنتجات."
          : "اكتشف كتالوج الدولي للعدد الأصلية، وتعرّف على منتجاتنا واسألنا عن السعر والتوافر مباشرة.";
    if (sectionTitle) sectionTitle.textContent = label ? "منتجات " + label : defaultTitle;
    if (subtitle) subtitle.textContent = label ? "المنتجات المسجلة لماركة " + label : defaultSubtitle;
    if (banner && title && logo) {
      banner.classList.toggle("is-visible", !!label);
      title.textContent = label ? "منتجات " + label : "";
      const src = label ? brandLogoForFilter(label) : "";
      if (src) { logo.src = src; logo.alt = label; logo.hidden = false; }
      else { logo.removeAttribute("src"); logo.alt = ""; logo.hidden = true; }
    }
  }
  function drawBrandFilters() {
    if (!brandFilterList) return;
    // Count only products actually visible in the public catalog.
    const publicProducts = products.filter(function (item) { return item.hiddenFromStore !== true; });
    const counts = new Map();
    publicProducts.forEach(function (item) {
      const brand = productBrand(item) || "بدون ماركة";
      const key = normalizeBrand(brand);
      if (!key) return;
      const entry = counts.get(key) || {label:brand, count:0};
      entry.count += 1;
      counts.set(key, entry);
    });
    const brands = Array.from(counts.entries()).sort(function (a,b) {
      if (a[0] === normalizeBrand("بدون ماركة")) return 1;
      if (b[0] === normalizeBrand("بدون ماركة")) return -1;
      return a[1].label.localeCompare(b[1].label, "ar");
    });
    const selectedLabel = activeBrand ? displayBrand(activeBrand) : "كل الماركات";
    if (brandFilterSummary) brandFilterSummary.textContent = selectedLabel;
    const search = normalizeSearchText(brandFilterSearch ? brandFilterSearch.value : "");
    const visibleBrands = brands.filter(function (entry) { return !search || normalizeSearchText(entry[1].label).includes(search); });
    brandFilterList.innerHTML = '<button class="brand-filter-option' + (!activeBrand ? ' active' : '') + '" type="button" data-brand-filter="الكل" aria-pressed="' + (!activeBrand) + '"><span>كل الماركات</span><span class="brand-filter-count">' + publicProducts.length + '</span></button>' +
      visibleBrands.map(function (entry) {
        const key = entry[0], label = entry[1].label, count = entry[1].count, selected = normalizeBrand(activeBrand) === key;
        const logo = brandLogoForFilter(label);
        const logoMarkup = logo
          ? '<img class="brand-filter-logo" src="' + escapeHtml(logo) + '" alt="" width="180" height="72" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'brand-filter-monogram\',textContent:\'' + escapeHtml(brandMonogram(label)) + '\'}))">'
          : '<span class="brand-filter-monogram" aria-hidden="true">' + escapeHtml(brandMonogram(label)) + '</span>';
        return '<button class="brand-filter-option' + (selected ? ' active' : '') + '" type="button" data-brand-filter="' + escapeHtml(label) + '" aria-pressed="' + selected + '"><span class="brand-filter-option-name">' + logoMarkup + '<span>' + escapeHtml(label) + '</span></span><span class="brand-filter-count">' + count + '</span></button>';
      }).join("") || '<p class="brand-filter-empty">لا توجد ماركات بهذا الاسم.</p>';
  }

  const listingControls = document.createElement("div");
  listingControls.className = "product-listing-controls";
  listingControls.innerHTML = '<p class="product-results-count" aria-live="polite"></p><button class="button-primary" type="button" data-load-more hidden>عرض 12 منتج إضافي</button>';
  grid.insertAdjacentElement("afterend", listingControls);
  const resultsCount = listingControls.querySelector(".product-results-count");
  const loadMoreButton = listingControls.querySelector("[data-load-more]");
  const productSort = document.getElementById("productSort");
  let productSortMode = "newest";
  if (productSort) productSort.addEventListener("change", function () {
    productSortMode = productSort.value;
    visibleProductCount = pageSize;
    renderProducts();
  });
  if (loadMoreButton) loadMoreButton.addEventListener("click", function () {
    visibleProductCount += pageSize;
    renderProducts();
  });

  let productSearchCache = new WeakMap();
  function renderProducts() {
    const terms = normalizeSearchText(query).split(" ").filter(Boolean);
    const filtered = products.filter(function (item) {
      if (item.hiddenFromStore === true) return false;
      const categoryMatch = activeCategory === "الكل" || item.cat === activeCategory;
      const brand = productBrand(item) || "بدون ماركة";
      const brandMatch = !activeBrand || normalizeBrand(brand) === normalizeBrand(activeBrand);
      let searchable = productSearchCache.get(item);
      if (searchable === undefined) {
        // Keep ordinary text search tightly scoped to the product name.
        // Brand, description and specifications must not pull unrelated products into results.
        searchable = normalizeSearchText(item.name || "");
        productSearchCache.set(item, searchable);
      }
      const exactCodes = [item.barcode, item.barCode, item.ean, item.ean13, item.gtin, item.upc, item.sku, item.code, item.partNumber]
        .filter(function(value){ return value != null && String(value).trim() !== ""; })
        .map(function(value){ return normalizeSearchText(value).replace(/\s/g, ""); });
      const nameWords = searchable.split(" ").filter(Boolean);
      const searchMatch = scannedBarcode
        ? exactCodes.includes(normalizeSearchText(scannedBarcode).replace(/\s/g, ""))
        : (!terms.length || terms.every(function (term) {
            return nameWords.some(function (word) {
              return word.startsWith(term) || term.startsWith(word);
            });
          }));
      return categoryMatch && brandMatch && searchMatch;
    });
    if (terms.length) {
      function relevance(item) {
        const name = normalizeSearchText(item.name);
        const brand = normalizeSearchText(productBrand(item));
        const code = normalizeSearchText([item.sku, item.code, item.barcode, item.barCode, item.ean, item.ean13, item.gtin, item.upc, item.model, item.partNumber, item.id].filter(Boolean).join(" "));
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
    if (terms.length) {
      // Keep relevance as the primary order for search results.
      // Explicit price sorting can still be applied when the customer chooses it.
      if (productSortMode !== "newest") {
        filtered.sort(function(a,b) {
          const pa = productPricing(a).current, pb = productPricing(b).current;
          if (pa === null && pb !== null) return 1;
          if (pb === null && pa !== null) return -1;
          return productSortMode === "price-asc" ? (pa||0)-(pb||0) : (pb||0)-(pa||0);
        });
      }
    } else {
      filtered.sort(function(a,b) {
        if (productSortMode === "price-asc" || productSortMode === "price-desc") {
          const pa = productPricing(a).current, pb = productPricing(b).current;
          if (pa === null && pb !== null) return 1;
          if (pb === null && pa !== null) return -1;
          return productSortMode === "price-asc" ? (pa||0)-(pb||0) : (pb||0)-(pa||0);
        }
        function stamp(item) {
          const value = item && item.createdAt;
          if (value && typeof value === "object" && Number.isFinite(Number(value.seconds))) return Number(value.seconds);
          if (typeof value === "number" && Number.isFinite(value)) return value > 1e12 ? value/1000 : value;
          const parsed = value ? Date.parse(value) : NaN;
          return Number.isFinite(parsed) ? parsed/1000 : 0;
        }
        return stamp(b)-stamp(a) || Number(b.id||0)-Number(a.id||0);
      });
    }
    const emptyMessage = activeBrand
      ? 'لا توجد منتجات مسجلة لماركة ' + escapeHtml(activeBrand) + ' حاليًا.'
      : "لا توجد منتجات مطابقة.";
    const shown = filtered.slice(0, visibleProductCount);
    grid.innerHTML = shown.map(function (item) {
      const name = cleanProductName(item.name);
      const description = cleanProductCopy(item.desc || "");
      const descriptionMarkup = isHomePage ? "" : '<p class="product-description">' + escapeHtml(description) + '</p>';
      const rissFallback = normalizeBrand(productBrand(item)) === "riss" ? "assets/brands/riss.webp" : "";
      const visual = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '" width="300" height="300" loading="lazy" decoding="async" draggable="false">'
        : item.imageId
          ? '<img data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '" width="300" height="300" loading="lazy">'
          : rissFallback
            ? '<img src="' + rissFallback + '" alt="RISS German Technology" width="300" height="300" loading="lazy" decoding="async" draggable="false" class="brand-product-fallback">'
            : '<span class="product-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
      const detailUrl = "product.html?id=" + encodeURIComponent(String(item.id));
      const pricing = productPricing(item);
      const legacyCompare = parsePrice(item.oldPrice ?? item.compareAtPrice ?? item.originalPrice);
      const currentPrice = pricing.current;
      const compareAtPrice = pricing.percent ? pricing.base : legacyCompare;
      const discountPercent = pricing.percent || (currentPrice !== null && compareAtPrice !== null && compareAtPrice > currentPrice ? Math.round((compareAtPrice-currentPrice)/compareAtPrice*100) : 0);
      const stockKnown = Number.isInteger(item.stock) && item.stock >= 0;
      const stockOut = item.availability === "unavailable" || (item.availability !== "available" && stockKnown && item.stock === 0);
      const alreadyInCart = isItemInCart(item);
      const availabilityLabel = item.availability === "ask" ? '<span class="stock-status">استفسر عن التوفر</span>' : stockOut ? '<span class="stock-status out">غير متوفر حاليًا</span>' : '<span class="stock-status">متوفر — يُرجى التأكيد عند الطلب</span>';
      const stockLabel = availabilityLabel;
      return '<article class="product-card home-shelf-card catalog-card" id="product-' + encodeURIComponent(item.id) + '">' +
        '<a class="product-visual product-open-link" href="' + detailUrl + '" aria-label="عرض تفاصيل المنتج: ' + escapeHtml(name) + '">' + visual + '</a>' +
        '<div class="product-info"><span class="product-category">' + (productBrand(item) ? escapeHtml(displayBrand(productBrand(item))) + ' · ' : '') + escapeHtml(item.cat || "منتجات") + '</span>' +
        '<h3 class="product-name"><a class="product-name-link" href="' + detailUrl + '">' + escapeHtml(name) + '</a></h3>' +
        (item.model || item.sku || item.partNumber || item.code ? '<span class="product-sku">رقم الموديل: ' + escapeHtml(item.model || item.sku || item.partNumber || item.code) + '</span>' : '') +
        '<div class="product-card-status">' + stockLabel + '</div>' +
        descriptionMarkup +
        '<span class="product-price' + (currentPrice === null ? ' price-on-request' : '') + '">' + (pricing.percent ? '<strong>'+escapeHtml(money(currentPrice))+'</strong><del>'+escapeHtml(money(compareAtPrice))+'</del><em class="product-discount">خصم '+discountPercent+'%</em>' : (discountPercent ? escapeHtml(money(currentPrice))+'<del>'+escapeHtml(money(compareAtPrice))+'</del><em class="product-discount">خصم '+discountPercent+'%</em>' : escapeHtml(formatPrice(item.price)))) + '<small>' + (currentPrice === null ? 'السعر عند التواصل' : '') + '</small></span>' +
        '<div class="card-cart-actions"><button class="button-primary home-shelf-add product-add-cart-prominent' + (alreadyInCart ? ' is-in-cart' : '') + '" type="button" data-add="' + escapeHtml(item.id) + '"' + (stockOut || alreadyInCart ? ' disabled aria-disabled="true"' : '') + '>' + (alreadyInCart ? '<span>مضافة بالفعل</span>' : '<span class="add-cart-icon" aria-hidden="true">🛒</span><span>أضف إلى السلة</span>') + '</button></div>' +
        '<div class="product-card-tools" aria-label="إجراءات المنتج"><button class="quick-view-trigger" type="button" data-quick-view="' + escapeHtml(item.id) + '" aria-label="معاينة سريعة" title="معاينة سريعة">◉</button><button class="share-product-button" type="button" data-share-product="' + escapeHtml(item.id) + '" aria-label="مشاركة المنتج" title="مشاركة المنتج">↗</button></div>' +
        '</div></article>';
    }).join("") || '<p class="empty-cart">' + emptyMessage + '</p>';
    observeCloudImages();
    if (offersSection && offersGrid) {
      const activeOffers = products.filter(function(item) {
        if (!item || item.hiddenFromStore === true || item.availability === "unavailable") return false;
        return productPricing(item).percent > 0;
      }).sort(function(a,b) {
        return productPricing(b).percent - productPricing(a).percent;
      }).slice(0,4);
      offersSection.hidden = activeOffers.length === 0;
      offersGrid.innerHTML = activeOffers.map(function(item) {
        const name = cleanProductName(item.name);
        const pricing = productPricing(item);
        const detailUrl = "product.html?id=" + encodeURIComponent(String(item.id));
        const visual = item.image
          ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '" width="300" height="300" loading="lazy" decoding="async">'
          : item.imageId
            ? '<img data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '" width="300" height="300" loading="lazy">'
            : '<span class="product-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
        const timer = pricing.endsAt ? '<div class="product-offer-countdown home-offer-countdown" data-offer-end="' + pricing.endsAt + '"><div class="offer-countdown-heading"><span>⏳ ينتهي العرض خلال</span><b>عرض محدود</b></div><div class="offer-countdown-units"><span><strong data-time-unit="days">00</strong><small>يوم</small></span><span><strong data-time-unit="hours">00</strong><small>ساعة</small></span><span><strong data-time-unit="minutes">00</strong><small>دقيقة</small></span><span><strong data-time-unit="seconds">00</strong><small>ثانية</small></span></div></div>' : '';
        return '<article class="product-card home-offer-card"><a class="product-visual product-open-link" href="' + detailUrl + '">' + visual + '<em class="product-discount">خصم ' + pricing.percent + '%</em></a><div class="product-info"><span class="product-category">' + escapeHtml(displayBrand(productBrand(item)) || item.cat || "منتجات") + '</span><h3 class="product-name"><a class="product-name-link" href="' + detailUrl + '">' + escapeHtml(name) + '</a></h3><span class="product-price"><strong>' + escapeHtml(money(pricing.current)) + '</strong><del>' + escapeHtml(money(pricing.base)) + '</del></span>' + timer + '<a class="button-primary home-offer-cta" href="' + detailUrl + '">اكتشف العرض الآن ←</a></div></article>';
      }).join("");
      observeCloudImages();
    }
    resultsCount.textContent = filtered.length ? "عرض " + shown.length + " من " + filtered.length + " منتج" : "";
    loadMoreButton.hidden = shown.length >= filtered.length;
    loadMoreButton.textContent = "عرض " + Math.min(pageSize, filtered.length - shown.length) + " منتج إضافي";
    filterBar.querySelectorAll("[data-category]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.category === activeCategory);
    });
  }
  syncActiveBrandHeading();
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
    if (cartCount) cartCount.textContent = String(count);
    const floatingHomeCartCount = document.getElementById("floatingHomeCartCount");
    if (floatingHomeCartCount) floatingHomeCartCount.textContent = String(count);
    checkout.disabled = count === 0;
    const quickbar = document.getElementById("cartQuickbar");
    const quickbarSummary = document.getElementById("cartQuickbarSummary");
    if (quickbar) quickbar.hidden = count === 0;
    if (quickbarSummary) quickbarSummary.textContent = count + " قطعة · " + (cart.length) + " منتجات";
    const continueButton = document.getElementById("continueCheckout");
    if (continueButton) continueButton.disabled = count === 0;
    cartItems.innerHTML = cart.length ? cart.map(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      if (!item) {
        return '<div class="cart-row"><div><strong>منتج محفوظ في السلة</strong><small>تعذر تحميل بيانات المنتج. حدّث صفحة المنتجات ثم أعد فتح السلة.</small><div class="quantity"><span>الكمية: ' + line.qty + '</span></div></div><button class="remove-item" type="button" data-remove="' + escapeHtml(line.id) + '">حذف</button></div>';
      }
      const price = productCurrentPrice(item);
      const lineTotal = price === null ? "" : '<small class="cart-line-total">مجموع هذا المنتج: ' + escapeHtml(money(price * line.qty)) + '</small>';
      const cartDescription = cleanProductCopy(item.desc || item.description || item.details || item.specs || item.title || "");
      const cartDetails = cartDescription ? '<button class="cart-details-toggle" type="button" data-cart-details aria-expanded="false">عرض التفاصيل الفنية <span aria-hidden="true">＋</span></button><small class="cart-product-description" hidden><b>التفاصيل: </b>' + escapeHtml(cartDescription.length > 260 ? cartDescription.slice(0,257) + "…" : cartDescription) + '</small>' : '';
      const cartImage = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="" width="80" height="80" loading="lazy" decoding="async">'
        : item.imageId
          ? '<img data-cart-image="' + escapeHtml(item.imageId) + '" alt="" width="80" height="80" loading="lazy" decoding="async">'
          : '<span aria-hidden="true">🔧</span>';
      return '<div class="cart-row"><div class="cart-product-main"><div class="cart-product-thumb">' + cartImage + '</div><div class="cart-product-copy"><strong>' + escapeHtml(cleanProductName(item.name)) + '</strong>' + cartDetails + '<small>' + escapeHtml(formatPrice(item.price)) + '</small>' + lineTotal +
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

  function renderCartAndProductCards(skipPersist) {
    renderCart(skipPersist);
    renderProducts();
    renderHomeShelves();
  }

  // مزامنة التغييرات بين تبويبات الموقع المفتوحة على نفس المتصفح فقط.
  window.addEventListener("storage", function(event) {
    if (event.key !== cartStorageKey || event.newValue == null) return;
    try {
      cart = normalizeCart(JSON.parse(event.newValue));
      renderCartAndProductCards(true);
    } catch (error) {}
  });

  window.addEventListener("dawly-catalog-ready", function () {
    observeCloudImages();
  });

  window.addEventListener("dawly-products-updated", function (event) {
    if (!Array.isArray(event.detail)) return;
    products = event.detail;
    productSearchCache = new WeakMap();
    drawCategories();
    renderBrandAvailability();
    renderCartAndProductCards();
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
        // Go directly to the filtered product cards, not just the catalog section heading.
        const productGrid = document.getElementById("productGrid");
        if (productGrid) {
          const targetTop = productGrid.getBoundingClientRect().top + window.pageYOffset - 12;
          window.scrollTo({top: Math.max(0, targetTop), behavior: "smooth"});
        }
      });
    });
  }

  function addToCart(id) {
    pendingOrder = null;
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
    renderCartAndProductCards();
    if (typeof window.DAWLY_TRACK_CONVERSION === "function") {
      window.DAWLY_TRACK_CONVERSION("add_to_cart", {productId:String(item.id),productName:item.name,brand:productBrand(item),itemCount:1});
    }
    // Keep the catalog visible after adding; the cart opens only when the shopper taps its button.
    setDrawer(false);
  }

  if (brandFilterSearch) brandFilterSearch.addEventListener("input", drawBrandFilters);

  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  if (searchForm && searchInput) searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    query = document.getElementById("searchInput").value;
    visibleProductCount = pageSize;
    renderProducts();
    document.getElementById("products").scrollIntoView({behavior:"smooth"});
  });
  if (searchInput) searchInput.addEventListener("input", function (event) {
    scannedBarcode = "";
    query = event.target.value;
    visibleProductCount = pageSize;
    renderProducts();
  });

  // Barcode scans must match a stored product identifier exactly, never fuzzy text.
  document.addEventListener("dawly:barcode-scanned", function(event) {
    const code = String(event.detail && event.detail.code || "").trim();
    if (!code) return;
    scannedBarcode = code;
    query = code;
    activeCategory = "الكل";
    activeBrand = "";
    if (searchInput) searchInput.value = code;
    visibleProductCount = pageSize;
    renderProducts();
    const normalizedCode = normalizeSearchText(code).replace(/\s/g, "");
    const exactCount = products.filter(function(item) {
      if (item.hiddenFromStore === true) return false;
      return [item.barcode,item.barCode,item.ean,item.ean13,item.gtin,item.upc,item.sku,item.code,item.partNumber]
        .filter(function(value){return value != null && String(value).trim() !== "";})
        .some(function(value){return normalizeSearchText(value).replace(/\s/g,"") === normalizedCode;});
    }).length;
    if (exactCount === 0) window.alert("تمت قراءة الكود: " + code + "\nلكن لا يوجد منتج مسجل بنفس رقم الباركود في الكتالوج. راجع بيانات الباركود في لوحة الإدارة.");
    else if (exactCount > 1) window.alert("تم العثور على " + exactCount + " منتجات بنفس الباركود. راجع بيانات الأصناف لتجنب التكرار.");
    const productsSection = document.getElementById("products");
    if (productsSection) productsSection.scrollIntoView({behavior:"smooth"});
  });

  // Handle cart removal in capture phase so other page widgets cannot swallow the click.
  if (cartItems) {
    cartItems.addEventListener("click", function(event) {
      const button = event.target.closest("button[data-remove]");
      if (!button || !cartItems.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const id = String(button.getAttribute("data-remove") || "");
      const before = cart.length;
      cart = cart.filter(function(line) { return String(line.id) !== id; });
      if (cart.length !== before) {
        pendingOrder = null;
        renderCartAndProductCards();
      }
    }, true);
  }

  // Prepare share image on touch-down, before the native share sheet opens.
  document.addEventListener("pointerdown", function (event) {
    const button = event.target.closest("[data-share-product]");
    if (!button || typeof window.DAWLY_PREPARE_PRODUCT_SHARE !== "function") return;
    const id = String(button.dataset.shareProduct || "");
    const item = products.find(function (entry) { return String(entry.id) === id; });
    if (!item) return;
    const url = new URL("product.html?id=" + encodeURIComponent(id), window.location.href).toString();
    window.DAWLY_PREPARE_PRODUCT_SHARE(item, url, button);
  }, {passive:true});

  document.addEventListener("click", function (event) {
    const detailAddButton = event.target.closest("[data-detail-order-now]");
    if (detailAddButton && !detailAddButton.disabled) {
      addToCart(detailAddButton.dataset.detailOrderNow);
      setCheckoutStep("review");
      setDrawer(true);
      return;
    }
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
        ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '" width="300" height="300">'
        : item.imageId
          ? '<img data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '" width="300" height="300">'
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
        '<div class="quick-view-price">' + (productPricing(item).percent ? '<strong>'+escapeHtml(money(productPricing(item).current))+'</strong><del>'+escapeHtml(money(productPricing(item).base))+'</del><em class="product-discount">خصم '+productPricing(item).percent+'%</em>' : escapeHtml(formatPrice(item.price))) + '</div>' +
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
      const id = String(shareButton.dataset.shareProduct || "");
      const item = products.find(function (entry) { return String(entry.id) === id; });
      if (!item) { alert("تعذر تحميل بيانات المنتج للمشاركة. حدّث الصفحة وحاول مرة أخرى."); return; }
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
      shareButton.disabled = true;
      const oldLabel = shareButton.textContent;
      try {
        const preparedTask = typeof window.DAWLY_GET_PREPARED_PRODUCT_SHARE === "function"
          ? window.DAWLY_GET_PREPARED_PRODUCT_SHARE(id) : null;
        if (preparedTask && typeof navigator.share === "function" && navigator.canShare) {
          // Use a ready file only; never await before calling navigator.share.
          const readyFile = preparedTask;
          if (readyFile && navigator.canShare({files:[readyFile]})) {
            navigator.share({title:name, text:caption, files:[readyFile]}).catch(function (error) {
              if (!error || error.name !== "AbortError") {
                console.error("Product image share failed:", error);
                alert("تعذرت مشاركة الصورة. جرّب مرة أخرى.");
              }
            }).finally(function () { shareButton.disabled = false; shareButton.textContent = oldLabel; });
            return;
          }
        }
        if (typeof navigator.share === "function") {
          navigator.share({title:name, text:caption, url:productUrl}).catch(function (error) {
            if (!error || error.name !== "AbortError") {
              console.error("Product share failed:", error);
              alert("تعذرت المشاركة. جرّب مرة أخرى أو انسخ رابط المنتج.");
            }
          }).finally(function () { shareButton.disabled = false; shareButton.textContent = oldLabel; });
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(caption).then(function () {
            alert("تم نسخ تفاصيل المنتج والرابط. يمكنك لصقها في واتساب أو فيسبوك.");
          }).catch(function () { alert("تعذر النسخ تلقائيًا. انسخ رابط المنتج من شريط العنوان."); })
            .finally(function () { shareButton.disabled = false; shareButton.textContent = oldLabel; });
          return;
        }
        const field = document.createElement("textarea");
        field.value = caption;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        alert(copied ? "تم نسخ تفاصيل المنتج والرابط. يمكنك لصقها في واتساب أو فيسبوك." : "تعذر النسخ تلقائيًا. انسخ رابط المنتج من شريط العنوان.");
      } catch (error) {
        console.error("Product share failed:", error);
        alert("تعذرت المشاركة. جرّب مرة أخرى.");
      } finally {
        shareButton.disabled = false;
        shareButton.textContent = oldLabel;
      }
      return;
    }
    if (event.target.closest("#floatingContactToggle")) { setFloatingContact(floatingContactPanel && floatingContactPanel.hidden); return; }
    if (floatingContactPanel && !floatingContactPanel.hidden && !event.target.closest("#floatingContactWidget")) setFloatingContact(false);
    const brandFilter = event.target.closest("[data-brand-filter]");
    if (brandFilter) {
      activeBrand = brandFilter.dataset.brandFilter === "الكل" ? "" : brandFilter.dataset.brandFilter;
      const nextUrl = new URL(window.location.href);
      if (activeBrand) nextUrl.searchParams.set("brand", activeBrand);
      else nextUrl.searchParams.delete("brand");
      window.history.replaceState({}, "", nextUrl.pathname + nextUrl.search + nextUrl.hash);
      visibleProductCount = pageSize;
      syncActiveBrandHeading();
      if (brandFilterSummary) brandFilterSummary.textContent = activeBrand ? displayBrand(activeBrand) : "كل الماركات";
      drawBrandFilters();
      renderProducts();
      // Keep the selected brand visible beside the brand heading and in the active banner.\n      // After choosing any brand, move directly to the filtered product cards.
      requestAnimationFrame(function () {
        const productGrid = document.getElementById("productGrid");
        if (!productGrid) return;
        const targetTop = productGrid.getBoundingClientRect().top + window.pageYOffset - 14;
        window.scrollTo({top: Math.max(0, targetTop), behavior:"smooth"});
      });
      return;
    }
    const category = event.target.closest("[data-category]");
    if (category) {
      activeCategory = category.dataset.category;
      syncCategorySelection();
      visibleProductCount = pageSize;
      renderProducts();
      if (category.closest("#mobileMenuCategories")) setMobileMenu(false);
      // Every category control (including the horizontal filter chips) jumps
      // straight to the filtered product cards, skipping the recently-viewed panel.
      requestAnimationFrame(function () {
        const productGrid = document.getElementById("productGrid");
        if (!productGrid) return;
        const targetTop = productGrid.getBoundingClientRect().top + window.pageYOffset - 14;
        window.scrollTo({top: Math.max(0, targetTop), behavior:"smooth"});
      });
      return;
    }
    const cardQty = event.target.closest("[data-card-qty]");
    if (cardQty) {
      const id = String(cardQty.dataset.cardQty || "");
      const line = cart.find(function(entry){ return String(entry.id) === id; });
      if (cardQty.dataset.delta === "-1") {
        if (line) {
          line.qty = Math.max(0, Number(line.qty || 0) - 1);
          if (!line.qty) cart = cart.filter(function(entry){ return String(entry.id) !== id; });
          pendingOrder = null;
          renderCartAndProductCards();
        }
      } else {
        addToCart(id);
      }
      return;
    }
    const add = event.target.closest("[data-add]");
    if (add) {
      const quickModal = document.getElementById("quickViewModal");
      if (quickModal && quickModal.classList.contains("is-open")) { quickModal.classList.remove("is-open"); document.body.classList.remove("quick-view-open"); }
      addToCart(add.dataset.add); return;
    }
    const detailsToggle = event.target.closest("[data-cart-details]");
    if (detailsToggle) {
      const description = detailsToggle.parentElement.querySelector(".cart-product-description");
      if (description) {
        const expanded = !description.hidden;
        description.hidden = expanded;
        detailsToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
        detailsToggle.innerHTML = expanded ? 'عرض التفاصيل الفنية <span aria-hidden="true">＋</span>' : 'إخفاء التفاصيل <span aria-hidden="true">−</span>';
      }
      return;
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
        pendingOrder = null;
        line.qty = nextQty;
        if (line.qty <= 0) cart = cart.filter(function (entry) { return String(entry.id) !== String(line.id); });
        renderCartAndProductCards();
      }
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      pendingOrder = null;
      cart = cart.filter(function (entry) { return String(entry.id) !== String(remove.dataset.remove); });
      renderCartAndProductCards();
      return;
    }
    if (event.target.closest("#openCart") || event.target.closest("#floatingHomeCart") || event.target.closest("[data-open-cart]") || event.target.closest("#cartQuickbarOpen")) { setCheckoutStep("review"); setDrawer(true); return; }
    if (event.target.closest("#continueCheckout")) {
      if (!cart.length) return;
      setCheckoutStep("details");
      return;
    }
    const progressStep = event.target.closest("[data-checkout-step]");
    if (progressStep && !progressStep.disabled) {
      const requestedStep = progressStep.dataset.checkoutStep;
      if (requestedStep === "details" && !cart.length) return;
      setCheckoutStep(requestedStep);
      return;
    }
    if (event.target.closest("#backToCartReview")) { setCheckoutStep("review"); return; }
    if (event.target.closest("#closeCart") || event.target === cartOverlay) setDrawer(false);
    if (event.target.closest("#openMobileMenu")) { setMobileMenu(true); return; }
    if (event.target.closest("#closeMobileMenu") || event.target === mobileMenuOverlay) { setMobileMenu(false); return; }
    if (event.target.closest("#mobileMenuDrawer a")) { setMobileMenu(false); return; }
  });
  function showPaymentFollowup(orderNumber, saved, orderWhatsappUrl) {
    const followup = document.getElementById("paymentFollowup");
    const status = document.getElementById("paymentFollowupStatus");
    const orderLink = document.getElementById("orderWhatsappLink");
    const secondOrderLink = document.getElementById("orderWhatsappLinkSecond");
    const paymentProofLink = document.getElementById("paymentProofLink");
    if (!followup || !status) return;
    status.textContent = saved
      ? "تم تجهيز طلبك رقم " + orderNumber + ". افتح رسالة واتساب واضغط إرسال لإتمام الطلب. لم يتم تأكيد الإرسال بعد."
      : "تعذر تجهيز الطلب. حاول مرة أخرى أو تواصل مع المتجر عبر واتساب.";
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
    if (secondOrderLink) {
      secondOrderLink.hidden = true;
      secondOrderLink.removeAttribute("href");
    }
    if (paymentProofLink) {
      if (saved && orderWhatsappUrl) {
        const proofMessage = "مرحباً، هذا إيصال الدفع الخاص بالطلب رقم " + orderNumber + ".";
        paymentProofLink.href = "https://wa.me/201002878301?text=" + encodeURIComponent(proofMessage);
        paymentProofLink.hidden = false;
      } else {
        paymentProofLink.hidden = true;
        paymentProofLink.removeAttribute("href");
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
        let settled = false;
        const finish = function(value) {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(value);
        };
        const timeoutId = setTimeout(function(){ finish(null); }, 6000);
        img.onload = function(){ finish(img); };
        img.onerror = function(){ finish(null); };
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
        try {
          src = await Promise.race([
            window.DAWLY_LOAD_PRODUCT_IMAGE(item.imageId),
            new Promise(function(resolve){ setTimeout(function(){ resolve(""); }, 6000); })
          ]);
        } catch (e) { src = ""; }
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
  async function loadJsPdfLibrary() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (window.__dawlyJsPdfLoading) return window.__dawlyJsPdfLoading;
    window.__dawlyJsPdfLoading = new Promise(function(resolve, reject) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
      script.async = true;
      script.onload = function() {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error("تعذر تحميل أداة إنشاء PDF"));
      };
      script.onerror = function() { reject(new Error("تعذر تحميل أداة إنشاء PDF")); };
      document.head.appendChild(script);
    });
    return window.__dawlyJsPdfLoading;
  }

  async function createOrderA4Pdf(order) {
    const imageBlob = await createWhatsAppOrderImage(
      order.number, order.customerName, order.customerPhone,
      order.customerAddress, order.orderItems, null
    );
    const imageUrl = URL.createObjectURL(imageBlob);
    try {
      const image = await new Promise(function(resolve, reject) {
        const img = new Image();
        img.onload = function() { resolve(img); };
        img.onerror = reject;
        img.src = imageUrl;
      });
      const JsPDF = await loadJsPdfLibrary();
      const pdf = new JsPDF({orientation:"portrait", unit:"mm", format:"a4", compress:true});
      const pageWidth = 210, pageHeight = 297;
      const sourcePageHeight = Math.floor(image.width * pageHeight / pageWidth);
      const pageCount = Math.ceil(image.height / sourcePageHeight);
      for (let page = 0; page < pageCount; page++) {
        if (page > 0) pdf.addPage("a4", "portrait");
        const sourceY = page * sourcePageHeight;
        const sliceHeight = Math.min(sourcePageHeight, image.height - sourceY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = image.width;
        pageCanvas.height = sliceHeight;
        const pageContext = pageCanvas.getContext("2d");
        pageContext.fillStyle = "#ffffff";
        pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageContext.drawImage(image, 0, sourceY, image.width, sliceHeight, 0, 0, image.width, sliceHeight);
        const pageImage = pageCanvas.toDataURL("image/jpeg", 0.88);
        pdf.addImage(pageImage, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
      }
      pdf.setProperties({
        title: "أوردر " + order.number + " - الدولي للعدد الأصلية والمستوردة",
        subject: "فاتورة أوردر عميل",
        author: "الدولي للعدد الأصلية والمستوردة"
      });
      return pdf.output("blob");
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }


  // Create an A5 packing slip with product names and quantities only (no prices).
  async function createPackingSlipPdf(order) {
    const canvas = document.createElement("canvas");
    canvas.width = 1240; canvas.height = 1754;
    const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c8101e"; ctx.fillRect(0, 0, w, 24);
    ctx.direction = "rtl"; ctx.textAlign = "right";
    function write(value, x, y, size, color, weight) {
      ctx.font = (weight || "600") + " " + size + "px Tahoma, Arial, sans-serif";
      ctx.fillStyle = color || "#20242a"; ctx.fillText(String(value == null ? "" : value), x, y, w - 150);
    }
    ctx.fillStyle = "#c8101e"; ctx.beginPath(); ctx.arc(155, 145, 66, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(155, 145, 47, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#20242a"; ctx.beginPath(); ctx.arc(155, 145, 32, 0, Math.PI * 2); ctx.fill();
    write("الدولي للعدد الأصلية والمستوردة", w - 90, 135, 48, "#c8101e", "bold");
    write("ورقة تجهيز وتأكيد الطلب", w - 90, 205, 32, "#333", "bold");
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(75, 255); ctx.lineTo(w - 75, 255); ctx.stroke();
    write("رقم الطلب: " + order.number, w - 90, 325, 30, "#20242a", "bold");
    write("اسم العميل: " + order.customerName, w - 90, 390, 27, "#343d47");
    write("رقم الهاتف: " + order.customerPhone, w - 90, 445, 25, "#343d47");
    let y = 535;
    write("المنتجات المطلوبة", w - 90, y, 31, "#c8101e", "bold"); y += 38;
    ctx.fillStyle = "#f3f4f6"; ctx.fillRect(75, y, w - 150, 66);
    write("اسم المنتج", w - 115, y + 44, 23, "#20242a", "bold");
    ctx.textAlign = "left"; ctx.font = "bold 23px Tahoma, Arial, sans-serif"; ctx.fillStyle = "#20242a"; ctx.fillText("الكمية", 125, y + 44); ctx.textAlign = "right";
    y += 66;
    order.orderItems.forEach(function(item, index) {
      const rowH = 92;
      ctx.fillStyle = index % 2 ? "#fff" : "#fafafa"; ctx.fillRect(75, y, w - 150, rowH);
      ctx.strokeStyle = "#eee"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(75, y + rowH); ctx.lineTo(w - 75, y + rowH); ctx.stroke();
      write((index + 1) + ". " + item.name, w - 115, y + 55, 24, "#20242a");
      ctx.textAlign = "left"; ctx.font = "bold 25px Tahoma, Arial, sans-serif"; ctx.fillStyle = "#20242a"; ctx.fillText(String(item.qty), 145, y + 55); ctx.textAlign = "right";
      y += rowH;
    });
    y += 85;
    ctx.strokeStyle = "#e5e7eb"; ctx.beginPath(); ctx.moveTo(75, y); ctx.lineTo(w - 75, y); ctx.stroke();
    write("شكرًا لثقتكم في الدولي للعدد الأصلية ❤️", w - 90, y + 70, 28, "#c8101e", "bold");
    write("نسعد بخدمتكم دائمًا", w - 90, y + 120, 23, "#555");
    write("aldawly-website.pages.dev", w - 90, h - 95, 20, "#777");
    const JsPDF = await loadJsPdfLibrary();
    const pdf = new JsPDF({orientation:"portrait", unit:"mm", format:"a5", compress:true});
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 148, 210, undefined, "FAST");
    pdf.setProperties({title:"ورقة تجهيز الطلب " + order.number, author:"الدولي للعدد الأصلية والمستوردة"});
    return pdf;
  }
  async function downloadPackingSlip(order) {
    const pdf = await createPackingSlipPdf(order);
    pdf.save("طلب-" + order.number + "-الدولي.pdf");
  }

  // One stable order draft per checkout attempt. Reopening WhatsApp reuses the same ID.
  let pendingOrder = null;
  function createUniqueOrderNumber() {
    const bytes = new Uint8Array(8);
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const token = Array.from(bytes).map(function(value) {
      return value.toString(16).padStart(2, "0");
    }).join("").toUpperCase();
    return "DW-" + Date.now().toString(36).toUpperCase() + "-" + token;
  }

  function buildOrderDraft() {
    const adminChoice = document.getElementById("orderAdminChoice");
    const selectedAdmin = adminChoice ? adminChoice.value : "";
    if (!selectedAdmin) {
      alert("من فضلك اختار المسؤول الذي تريد إرسال الطلب إليه أولاً.");
      if (adminChoice) adminChoice.focus();
      return null;
    }
    const customerName = document.getElementById("customerName").value.trim();
    const customerPhoneRaw = document.getElementById("customerPhone").value.trim();
    const customerAddress = document.getElementById("customerAddress").value.trim();
    const customerPhone = customerPhoneRaw
      .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
      .replace(/[\s()+-]/g, "");
    if (!cart.length) return null;
    if (!customerName || !customerPhoneRaw || !customerAddress) {
      alert("من فضلك اكتب الاسم ورقم الهاتف والعنوان قبل إرسال الطلب.");
      return null;
    }
    if (!/^(?:01[0125]\d{8}|201[0125]\d{8})$/.test(customerPhone)) {
      alert("رقم الموبايل المصري غير مكتمل أو غير صحيح. اكتب 11 رقمًا مثل 01012345678.");
      document.getElementById("customerPhone").focus();
      return null;
    }

    const orderNumber = createUniqueOrderNumber();
    const pricing = cartPricing();
    let itemNumber = 0;
    const lines = cart.map(function(line) {
      const item = products.find(function(entry) {
        return String(entry.id) === String(line.id) ||
          (entry._docId !== undefined && String(entry._docId) === String(line.id));
      });
      if (!item) return "";
      itemNumber += 1;
      const productUrl = new URL("product.html?id=" + encodeURIComponent(item.id), window.location.href).toString();
      const rawImageUrl = item.image || item.imageUrl || item.photo || item.imageURL || "";
      const productImageUrl = rawImageUrl && /^https?:\/\//i.test(String(rawImageUrl))
        ? String(rawImageUrl)
        : rawImageUrl
          ? new URL(String(rawImageUrl), window.location.href).toString()
          : productUrl;
      const price = parsePrice(item.price);
      const priceLines = price === null
        ? "السعر: عند الاستفسار"
        : "سعر الوحدة: " + money(price) + " | إجمالي المنتج: " + money(price * line.qty);
      const brand = productBrand(item);
      const code = item.sku || item.code || item.model || item.partNumber || "";
      const details = cleanProductCopy(item.desc || item.description || item.details || item.specs || "");
      return itemNumber + ") " + cleanOrderProductName(item.name) +
        (brand ? "\nالماركة: " + brand : "") +
        (code ? "\nالكود / الموديل: " + code : "") +
        "\nالكمية: " + line.qty + "\n" + priceLines +
        (details ? "\nالتفاصيل: " + details.slice(0, 240) : "") +
        "\n🖼️ صورة المنتج: " + productImageUrl +
        "\nرابط المنتج: " + productUrl;
    }).filter(Boolean);
    if (!lines.length || lines.length !== cart.length) {
      alert("تعذر تحميل بيانات أحد المنتجات. حدّث الصفحة ثم راجع طلبك.");
      return null;
    }

    const totalText = pricing.pricedCount === pricing.itemCount
      ? "إجمالي المنتجات: " + money(pricing.total)
      : pricing.pricedCount
        ? "مجموع المنتجات المسعّرة: " + money(pricing.total) + "\nبعض المنتجات سعرها عند الاستفسار"
        : "الإجمالي النهائي بعد تأكيد الأسعار";
    const message = [
      "🛒 *طلب جديد من متجر الدولي*",
      "رقم الطلب: *" + orderNumber + "*",
      "",
      "👤 *بيانات العميل*",
      "الاسم: " + customerName,
      "الهاتف: " + customerPhone,
      "العنوان: " + customerAddress,
      "",
      "📦 *المنتجات (" + pricing.itemCount + ")*",
      lines.join("\n\n"),
      "",
      "💰 *ملخص الطلب*",
      totalText,
      "",
      "برجاء تأكيد توفر المنتج."
    ].join("\n");

    const orderItems = cart.map(function(line) {
      const item = products.find(function(entry) {
        return String(entry.id) === String(line.id) ||
          (entry._docId !== undefined && String(entry._docId) === String(line.id));
      });
      if (!item) return null;
      const parsedPrice = productCurrentPrice(item);
      return {
        name: cleanOrderProductName(item.name),
        qty: Number(line.qty || 0),
        unitPrice: parsedPrice === null ? "عند الاستفسار" : money(parsedPrice),
        unitPriceAmount: parsedPrice,
        image: item.image || item.imageUrl || item.photo || "",
        imageId: item.imageId || "",
        code: item.sku || item.code || item.model || item.partNumber || "",
        brand: productBrand(item) || ""
      };
    }).filter(Boolean);

    return {
      number:orderNumber,
      message:message,
      url:"https://wa.me/" + selectedAdmin + "?text=" + encodeURIComponent(message),
      customerName:customerName,
      customerPhone:customerPhone,
      customerAddress:customerAddress,
      selectedAdmin:selectedAdmin,
      orderItems:orderItems
    };
  }

  ["orderAdminChoice", "customerName", "customerPhone", "customerAddress"].forEach(function(id) {
    const field = document.getElementById(id);
    if (!field) return;
    field.addEventListener("input", function() {
      if (!pendingOrder) return;
      pendingOrder = null;
      checkout.textContent = "تجهيز الطلب وفتحه على واتساب";
      checkout.dataset.orderPrepared = "false";
      const followup = document.getElementById("paymentFollowup");
      if (followup) followup.hidden = true;
    });
  });

  checkout.addEventListener("click", function() {
    if (checkout.disabled || !cart.length) return;
    pendingOrder = buildOrderDraft();
    if (!pendingOrder) return;
    const order = pendingOrder;
    if (typeof window.DAWLY_TRACK_CONVERSION === "function") {
      window.DAWLY_TRACK_CONVERSION("whatsapp_order", {itemCount:order.orderItems.length,productNames:order.orderItems.map(function(item){return item.name;})});
    }
    const link = document.getElementById("orderWhatsappLink");
    const summary = document.getElementById("checkoutWhatsappSummary");
    if (link) {
      link.href = order.url;
      link.textContent = "فتح واتساب وإرسال الطلب رقم " + order.number;
    }
    if (summary) summary.textContent = "تم تجهيز الطلب رقم " + order.number + " ويشمل " + order.orderItems.length + " منتجات. ستجد رسالة مفصلة تحتوي على بياناتك والكميات والأسعار وروابط المنتجات.";
    setCheckoutStep("whatsapp");
    // Open WhatsApp immediately so the existing customer-send flow is not blocked.
    const whatsappWindow = window.open(order.url, "_blank");
    if (whatsappWindow) { try { whatsappWindow.opener = null; } catch (error) {} }
    else if (link) link.focus();
    // Download the A5 packing slip separately; it contains no prices.
    downloadPackingSlip(order).catch(function(error) {
      console.error("Packing slip generation failed:", error);
      alert("تم فتح واتساب، لكن تعذر تنزيل ورقة تجهيز الطلب. حاول تحديث الصفحة وإعادة الطلب.");
    });
    // The order snapshot is already prepared and WhatsApp has been opened.
    // Clear only the shopping cart; keep the prepared order and PDF data intact.
    cart = [];
    renderCartAndProductCards();
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
  renderBrandAvailability();
  renderCartAndProductCards();
  const initialParams = new URLSearchParams(window.location.search);
  if (initialParams.get("cart") === "1") {
    const directOrder = initialParams.get("direct") === "1";
    // Both flows open at the top; direct order simply opens the cart for checkout.
    setCheckoutStep(directOrder ? "details" : "review");
    setDrawer(true);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("cart");
    cleanUrl.searchParams.delete("direct");
    window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
})();
