(function () {
  const root = document.getElementById("productDetail");
  const productId = new URLSearchParams(window.location.search).get("id");
  const fallbackProducts = Array.isArray(window.DAWLY_PRODUCTS) ? window.DAWLY_PRODUCTS.slice() : [];
  let cloudProducts = null;
  let catalogReady = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char];
    });
  }
  function cleanProductCopy(value) {
    return String(value == null ? "" : value).replace(/\uFFFD/g, "").replace(/[\u200B-\u200F\u2060\uFEFF]/g, " ").replace(/\r\n?/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  }
  function formatSpecValue(value) {
    const match = String(value == null ? "" : value).match(/https?:\/\/[^\s<>"']+/i);
    if (!match) return escapeHtml(value);
    const href = match[0].replace(/[),.;]+$/, "");
    return '<a class="product-spec-source-link" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">عرض المصدر الأصلي ↗</a>';
  }
  function updateMeta(attribute, key, value) {
    let tag = document.head.querySelector('meta[' + attribute + '="' + key + '"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attribute, key);
      document.head.appendChild(tag);
    }
    tag.content = value;
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
  function formatPrice(value) {
    let text = String(value == null ? "" : value).trim();
    if (!text || /استفسار|حسب الطلب/i.test(text)) return cleanProductCopy(text || "السعر عند الاستفسار");
    text = text.replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
      .replace(/(?:جنيه(?:\s*مصري)?|ج\.?م\.?|ج\.?|EGP|LE)/gi, "").replace(/[\s,،٬]/g, "");
    if (!/^\d+(?:\.\d+)?$/.test(text)) return cleanProductCopy(value);
    return "EGP " + new Intl.NumberFormat("en-US", {maximumFractionDigits:2}).format(Number(text));
  }
  function displayBrand(value) {
    const raw = cleanProductCopy(value);
    const key = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s._-]/g, "").toLocaleLowerCase();
    const labels = {wurth:"WÜRTH",bosch:"BOSCH",wera:"WERA",knipex:"KNIPEX",beta:"Beta",dewalt:"DEWALT"};
    return labels[key] || raw;
  }
  function productBannerTheme(item) {
    const source = [item && item.name, item && item.cat, item && item.brand, item && item.desc, item && item.specs].join(" ").toLowerCase();
    if (/سيار|عرب|automotive|car|bmw|mercedes|volkswagen|audi|opel|ford|fiat|renault/.test(source)) return "automotive";
    if (/كهرب|elect|فولت|multimeter|لحام|weld|battery/.test(source)) return "electrical";
    if (/خشب|نجار|wood|carpentry|منشار/.test(source)) return "wood";
    if (/حدائق|زراع|garden|قص عشب/.test(source)) return "garden";
    if (/قياس|measure|ميزان|متر|caliper/.test(source)) return "measure";
    if (/هواء|pneumatic|كمبروسر|ضغط/.test(source)) return "pneumatic";
    return "workshop";
  }
  function showMissing() {
    document.title = "المنتج غير موجود | الدولي";
    root.innerHTML = '<div class="product-detail-missing"><h1>المنتج غير موجود</h1><p>قد يكون الإعلان حُذف أو أن الرابط غير صحيح.</p><a class="button-primary" href="products.html">العودة إلى المنتجات</a></div>';
  }
  function render() {
    const matchesId = function (product) { return String(product.id) === String(productId); };
    const item = (cloudProducts || []).find(matchesId) || fallbackProducts.find(matchesId);
    if (!item) {
      if (!catalogReady) {
        root.innerHTML = '<div class="product-detail-loading">جارٍ تحميل المنتج…</div>';
        return;
      }
      showMissing();
      return;
    }

    if (typeof window.DAWLY_RECORD_VIEWED_PRODUCT === "function") window.DAWLY_RECORD_VIEWED_PRODUCT(item);
    const name = cleanProductName(item.name || "منتج من الدولي");
    const seoDescription = cleanProductCopy(item.desc || item.specs || "تفاصيل المنتج من متجر الدولي للعدد الأصلية والمستوردة.").replace(/\s+/g, " ").slice(0, 160);
    document.title = name + " | الدولي";
    updateMeta("name", "description", seoDescription);
    updateMeta("property", "og:type", "product");
    updateMeta("property", "og:title", name + " | الدولي");
    updateMeta("property", "og:description", seoDescription);
    if (/^https:\/\//i.test(String(item.image || ""))) updateMeta("property", "og:image", String(item.image));
    const canonicalUrl = new URL(window.location.pathname, window.location.origin);
    canonicalUrl.searchParams.set("id", String(item.id));
    updateMeta("property", "og:url", canonicalUrl.href);
    let canonicalTag = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement("link");
      canonicalTag.rel = "canonical";
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = canonicalUrl.href;
    const imageIds = Array.isArray(item.imageIds) && item.imageIds.length ? item.imageIds : (item.imageId ? [item.imageId] : []);
    const extraImages = Array.isArray(item.images) ? item.images : [];
    const gallerySources = [];
    if (item.image) gallerySources.push({url:String(item.image)});
    imageIds.forEach(function (id) { if (id != null && String(id).trim()) gallerySources.push({id:String(id)}); });
    extraImages.forEach(function (entry) {
      if (typeof entry === "string" && (entry.indexOf("https://") === 0 || entry.indexOf("http://") === 0)) gallerySources.push({url:entry});
      else if (entry && typeof entry === "object") {
        if (entry.url || entry.src || entry.image) gallerySources.push({url:String(entry.url || entry.src || entry.image)});
        else if (entry.id || entry.imageId) gallerySources.push({id:String(entry.id || entry.imageId)});
      }
    });
    const uniqueGallery = gallerySources.filter(function (source, index, all) {
      const key = source.url || "cloud:" + source.id;
      return all.findIndex(function (candidate) { return (candidate.url || "cloud:" + candidate.id) === key; }) === index;
    }).slice(0,8);
    const firstGallery = uniqueGallery[0] || null;
    const image = firstGallery
      ? (firstGallery.url
        ? '<img id="detailMainImage" src="' + escapeHtml(firstGallery.url) + '" alt="' + escapeHtml(name) + '" loading="eager" fetchpriority="high" decoding="async">'
        : '<img id="detailMainImage" data-cloud-image="' + escapeHtml(firstGallery.id) + '" alt="' + escapeHtml(name) + '" loading="eager" fetchpriority="high" decoding="async">')
      : '<span class="product-detail-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
    const galleryHtml = uniqueGallery.length > 1 ? '<div class="detail-image-thumbs" id="detailImageThumbs" aria-label="صور المنتج"></div>' : '';
    const galleryControls = uniqueGallery.length > 1 ? '<button class="detail-gallery-nav prev" type="button" data-gallery-step="-1" hidden aria-label="الصورة السابقة">‹</button><button class="detail-gallery-nav next" type="button" data-gallery-step="1" hidden aria-label="الصورة التالية">›</button>' : '';
    const brand = item.brand ? escapeHtml(displayBrand(item.brand)) + ' · ' : "";
    const price = escapeHtml(formatPrice(item.price));
    const stockKnown = Number.isInteger(item.stock) && item.stock >= 0;
    const stockHtml = stockKnown
      ? (item.stock === 0
        ? '<div class="detail-stock-status out">غير متوفر حاليًا — تواصل معنا لمعرفة موعد التوفر</div>'
        : item.stock <= 5
          ? '<div class="detail-stock-status low">متبقي ' + item.stock + ' قطع فقط — سارع بالاستفسار</div>'
          : '<div class="detail-stock-status">متوفر — الكمية: ' + item.stock + ' قطعة</div>')
      : "";
    const specsText = cleanProductCopy(item.specs || "");
    const specsRows = specsText.split("\n").map(function (line) {
      const parts = line.split(/[:：]/);
      if (parts.length < 2) return null;
      const label = parts.shift().trim();
      const value = parts.join(":").trim();
      return label && value ? {label:label,value:value} : null;
    }).filter(Boolean);
    const specsHtml = specsRows.length
      ? '<section class="product-specs"><h2>المواصفات الفنية</h2><div class="product-specs-table">' +
        specsRows.map(function (spec) { return '<div class="product-spec-row"><strong>' + escapeHtml(spec.label) + '</strong><span>' + formatSpecValue(spec.value) + '</span></div>'; }).join("") +
        '</div></section>'
      : "";
    const productUrl = new URL("product?id=" + encodeURIComponent(item.id), window.location.href).toString();
    const message = "السلام عليكم، أريد الاستفسار عن الإعلان: " + name + "\nرابط الإعلان والصورة للتوضيح: " + productUrl;

    document.title = name + " | الدولي";
    document.getElementById("detailBreadcrumb").textContent = name;
    root.innerHTML = '<article class="product-detail-layout" data-theme="' + productBannerTheme(item) + '">' +
      '<div><div class="product-detail-image" id="detailImage" tabindex="0" role="button" aria-label="تكبير صورة ' + escapeHtml(name) + '" title="اضغط لتكبير الصورة">' + image + galleryControls + '</div>' + galleryHtml + '</div>' +
      '<div class="product-detail-info"><span class="product-detail-category">' + brand + escapeHtml(item.cat || "منتجات") + '</span>' +
      '<h1 class="product-detail-title">' + escapeHtml(name) + '</h1>' +
      '<p class="product-detail-description">' + escapeHtml(cleanProductCopy(item.desc || "للاستفسار عن مواصفات المنتج وتفاصيله، تواصل معنا مباشرة.")) + '</p>' +
      '<div class="product-detail-price"><span class="detail-price-value">' + price + '</span><small>' + (formatPrice(item.price).startsWith("EGP ") ? 'السعر بالجنيه المصري' : 'يُرجى تأكيد السعر عند التواصل') + '</small></div>' + stockHtml +
      '<div class="product-detail-actions product-detail-actions-compact">' +
      '<button class="button-primary detail-order-now" type="button" data-detail-order-now="' + escapeHtml(item.id) + '"' + (stockKnown && item.stock === 0 ? ' disabled aria-disabled="true"' : '') + '><span class="detail-action-icon" aria-hidden="true">🛒</span><span>' + (stockKnown && item.stock === 0 ? 'غير متاح حاليًا' : 'أكمل طلبك الآن') + '</span></button>' +
      '<button class="detail-whatsapp-button" type="button" data-whatsapp-share="' + escapeHtml(item.id) + '"><span class="detail-action-icon" aria-hidden="true">💬</span><span>استفسر بالصورة عبر واتساب</span></button>' +
      '<button class="button-outline detail-add-cart detail-add-cart-icon" type="button" data-detail-add="' + escapeHtml(item.id) + '" aria-label="أضف المنتج إلى السلة" title="أضف إلى السلة"' + (stockKnown && item.stock === 0 ? ' disabled aria-disabled="true"' : '') + '><svg width="21" height="21" style="display:block!important;width:21px!important;height:21px!important;max-width:21px!important;max-height:21px!important;flex:none!important;overflow:visible" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="20" r="1.4" fill="currentColor"/><circle cx="18" cy="20" r="1.4" fill="currentColor"/></svg></button>' +
      '<button class="button-outline share-product-button detail-share-icon" type="button" data-share-product="' + escapeHtml(item.id) + '" aria-label="مشاركة المنتج" title="مشاركة المنتج"><svg width="21" height="21" style="display:block!important;width:21px!important;height:21px!important;max-width:21px!important;max-height:21px!important;flex:none!important;overflow:visible" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 16V3m0 0L7 8m5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<a class="detail-back-link" href="products.html">← العودة إلى المنتجات</a></div>' + '<div class="product-trust-strip" aria-label="مميزات الخدمة"><div><b>🚚</b><span>شحن لجميع المحافظات</span></div><div><b>✓</b><span>تأكيد الطلب عبر واتساب</span></div><div><b>🛠</b><span>مساعدة في اختيار العدد</span></div></div>' + specsHtml + '</div></article>';


    const allProducts = cloudProducts || fallbackProducts;
    const relatedProducts = allProducts.filter(function (product) {
      if (String(product.id) === String(item.id)) return false;
      return (item.cat && product.cat === item.cat) ||
        (item.brand && product.brand && displayBrand(item.brand) === displayBrand(product.brand));
    }).sort(function (a,b) {
      const score = function (product) {
        return (item.brand && product.brand && displayBrand(item.brand) === displayBrand(product.brand) ? 2 : 0) +
          (item.cat && product.cat === item.cat ? 1 : 0);
      };
      return score(b)-score(a);
    }).slice(0,4);
    const relatedHtml = relatedProducts.length
      ? '<section class="related-products"><div class="related-heading"><div><h2>منتجات قد تهمك</h2><p>منتجات أخرى من نفس القسم أو الماركة</p></div><a href="products.html">عرض كل المنتجات ←</a></div><div class="related-grid">' +
        relatedProducts.map(function (product) {
          const relatedName = cleanProductName(product.name || "منتج من الدولي");
          const relatedImage = product.image
            ? '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(relatedName) + '" loading="lazy">'
            : product.imageId
              ? '<img data-related-image="' + escapeHtml(product.imageId) + '" alt="' + escapeHtml(relatedName) + '" loading="lazy">'
              : '<span>' + escapeHtml(product.icon || "🔧") + '</span>';
          return '<a class="related-card" href="product?id=' + encodeURIComponent(product.id) + '"><div class="related-visual">' + relatedImage + '</div><div class="related-info"><small>' + escapeHtml(product.brand ? displayBrand(product.brand) : product.cat || "منتجات") + '</small><strong>' + escapeHtml(relatedName) + '</strong><span>' + escapeHtml(formatPrice(product.price)) + '</span></div></a>';
        }).join("") + '</div></section>'
      : "";
    root.insertAdjacentHTML("beforeend", relatedHtml);
    if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      root.querySelectorAll("[data-related-image]").forEach(function (image) {
        window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.relatedImage).then(function (url) {
          if (url && image.isConnected) image.src = url;
        }).catch(function () {});
      });
    }

    const mainImage = document.getElementById("detailMainImage");
    const thumbBox = document.getElementById("detailImageThumbs");
    const imageHolder = document.getElementById("detailImage");
    function fitDetailImageToItsOwnRatio() {
      if (!mainImage || !imageHolder || !mainImage.naturalWidth || !mainImage.naturalHeight) return;
      const naturalRatio = mainImage.naturalWidth / mainImage.naturalHeight;
      // Preserve each image's proportions while preventing extremely wide/tall frames.
      const displayRatio = Math.max(0.72, Math.min(1.9, naturalRatio));
      imageHolder.style.setProperty("aspect-ratio", displayRatio.toFixed(4), "important");
      imageHolder.style.setProperty("height", "auto", "important");
    }
    if (mainImage) {
      mainImage.addEventListener("load", fitDetailImageToItsOwnRatio);
      if (mainImage.complete) fitDetailImageToItsOwnRatio();
    }
    const resolvedGalleryUrls = new Array(uniqueGallery.length).fill("");
    const galleryLoadPromises = new Array(uniqueGallery.length).fill(null);
    function loadGalleryUrl(index) {
      if (resolvedGalleryUrls[index]) return Promise.resolve(resolvedGalleryUrls[index]);
      if (galleryLoadPromises[index]) return galleryLoadPromises[index];
      const source = uniqueGallery[index];
      galleryLoadPromises[index] = (async function () {
        if (source.url) return source.url;
        if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE !== "function") return "";
        try { return await window.DAWLY_LOAD_PRODUCT_IMAGE(source.id); } catch (error) { return ""; }
      })().then(function (url) {
        resolvedGalleryUrls[index] = url || "";
        const thumb = thumbBox && thumbBox.querySelector('[data-gallery-thumb="' + index + '"]');
        if (thumb && url) thumb.src = url;
        return resolvedGalleryUrls[index];
      });
      return galleryLoadPromises[index];
    }
    function updateGallerySelection(index) {
      if (!thumbBox) return;
      thumbBox.querySelectorAll(".detail-image-thumb").forEach(function (thumb, thumbIndex) {
        const active = thumbIndex === index;
        thumb.classList.toggle("active", active);
        if (active) thumb.setAttribute("aria-current", "true");
        else thumb.removeAttribute("aria-current");
      });
    }
    async function showGalleryImage(index) {
      if (!mainImage || !uniqueGallery.length) return;
      const activeIndex = (index + uniqueGallery.length) % uniqueGallery.length;
      updateGallerySelection(activeIndex);
      const url = await loadGalleryUrl(activeIndex);
      if (!url || !mainImage.isConnected) return;
      mainImage.src = url;
      if (thumbBox) {
        const activeThumb = thumbBox.querySelectorAll(".detail-image-thumb")[activeIndex];
        if (activeThumb && activeThumb.scrollIntoView) activeThumb.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"});
      }
      const previous = root.querySelector('[data-gallery-step="-1"]');
      const next = root.querySelector('[data-gallery-step="1"]');
      if (previous) previous.dataset.galleryIndex = String(activeIndex);
      if (next) next.dataset.galleryIndex = String(activeIndex);
    }
    if (thumbBox && uniqueGallery.length > 1) {
      thumbBox.innerHTML = uniqueGallery.map(function (source, index) {
        const thumbUrl = source.url ? ' src="' + escapeHtml(source.url) + '"' : "";
        return '<button type="button" class="detail-image-thumb' + (index === 0 ? ' active' : '') + '" data-image-index="' + index + '" aria-current="' + (index === 0 ? 'true' : 'false') + '" aria-label="عرض الصورة ' + (index + 1) + '"><img data-gallery-thumb="' + index + '"' + thumbUrl + ' alt="" loading="lazy" decoding="async"></button>';
      }).join("");
      thumbBox.addEventListener("click", function (event) {
        const button = event.target.closest("[data-image-index]");
        if (button) showGalleryImage(Number(button.dataset.imageIndex));
      });
      if ("IntersectionObserver" in window) {
        const thumbObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            const image = entry.target;
            thumbObserver.unobserve(image);
            loadGalleryUrl(Number(image.dataset.galleryThumb));
          });
        }, {root:thumbBox,rootMargin:"80px"});
        thumbBox.querySelectorAll("img[data-gallery-thumb]:not([src])").forEach(function (image) { thumbObserver.observe(image); });
      } else {
        thumbBox.querySelectorAll("img[data-gallery-thumb]:not([src])").forEach(function (image) { loadGalleryUrl(Number(image.dataset.galleryThumb)); });
      }
    }
    if (uniqueGallery.length > 1) {
      const stepButtons = root.querySelectorAll("[data-gallery-step]");
      stepButtons.forEach(function (button) {
        button.hidden = false;
        button.addEventListener("click", function () {
          const current = Number((root.querySelector('[data-gallery-step="1"]') || {}).dataset.galleryIndex || 0);
          showGalleryImage(current + Number(button.dataset.galleryStep));
        });
      });
    }
    if (mainImage && uniqueGallery.length) {
      loadGalleryUrl(0).then(function (url) {
        if (url && mainImage.isConnected) {
          if (!mainImage.getAttribute("src") || mainImage.dataset.cloudImage) mainImage.src = url;
          resolvedGalleryUrls[0] = url;
          fitDetailImageToItsOwnRatio();
        }
      });
    }
    if (imageHolder && uniqueGallery.length > 1) {
      let touchStartX = 0;
      imageHolder.addEventListener("touchstart", function (event) {
        if (event.touches && event.touches.length === 1) touchStartX = event.touches[0].clientX;
      }, {passive:true});
      imageHolder.addEventListener("touchend", function (event) {
        if (!event.changedTouches || !touchStartX) return;
        const delta = event.changedTouches[0].clientX - touchStartX;
        touchStartX = 0;
        if (Math.abs(delta) < 45) return;
        const current = Number((root.querySelector('[data-gallery-step="1"]') || {}).dataset.galleryIndex || 0);
        showGalleryImage(current + (delta < 0 ? 1 : -1));
      }, {passive:true});
      imageHolder.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const current = Number((root.querySelector('[data-gallery-step="1"]') || {}).dataset.galleryIndex || 0);
        showGalleryImage(current + (event.key === "ArrowLeft" ? 1 : -1));
      });
    }
    if (mainImage) mainImage.addEventListener("error", function () {
      const holder = document.getElementById("detailImage");
      if (holder) holder.innerHTML = '<span class="product-detail-placeholder" aria-hidden="true">🔧</span>';
    }, {once:true});
  }


  async function copyShareCaption(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try { await navigator.clipboard.writeText(text); return true; } catch (error) {}
    }
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch (error) {}
    field.remove();
    return copied;
  }

  root.addEventListener("click", async function (event) {
    const whatsappButton = event.target.closest("[data-whatsapp-share]");
    if (!whatsappButton) return;
    const item = (cloudProducts || fallbackProducts).find(function (p) { return String(p.id) === String(whatsappButton.dataset.whatsappShare); });
    if (!item) { alert("تعذر تحميل بيانات المنتج."); return; }
    const name = cleanProductName(item.name || "منتج من متجر الدولي");
    const productUrl = new URL("product?id=" + encodeURIComponent(item.id), window.location.href).toString();
    const caption = [
      "السلام عليكم، أريد الاستفسار عن المنتج:",
      "🧰 " + name,
      item.brand ? "🏷️ الماركة: " + displayBrand(item.brand) : "",
      "💰 السعر: " + formatPrice(item.price),
      item.cat ? "📂 القسم: " + item.cat : "",
      "🔗 رابط المنتج: " + productUrl,
      "الدولي للعدد الأصلية والمستوردة"
    ].filter(Boolean).join("\n");
    whatsappButton.disabled = true;
    const originalLabel = whatsappButton.textContent;
    try {
      if (!window.DAWLY_CREATE_PRODUCT_SHARE_FILE) throw new Error("مشاركة الصورة غير متاحة");
      const file = await window.DAWLY_CREATE_PRODUCT_SHARE_FILE(item, productUrl, whatsappButton);
      if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
        await navigator.share({files:[file], title:name, text:caption});
      } else {
        await copyShareCaption(caption);
        window.open("https://wa.me/201024787222?text=" + encodeURIComponent(caption), "_blank", "noopener");
        alert("المتصفح لا يدعم إرفاق الصور مباشرة. تم فتح واتساب بالتفاصيل والرابط؛ يمكنك إرفاق الصورة يدويًا.");
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
      console.error("WhatsApp product image share failed:", error);
      await copyShareCaption(caption);
      window.open("https://wa.me/201024787222?text=" + encodeURIComponent(caption), "_blank", "noopener");
      alert("تعذر تجهيز الصورة تلقائيًا. تم فتح واتساب بالتفاصيل والرابط.");
    } finally {
      whatsappButton.disabled = false;
      whatsappButton.textContent = originalLabel;
    }
  });

  root.addEventListener("click", async function (event) {
    const shareButton = event.target.closest("[data-share-product]");
    if (!shareButton) return;
    const item = (cloudProducts || fallbackProducts).find(function (p) { return String(p.id) === String(shareButton.dataset.shareProduct); });
    if (!item) { alert("تعذر تحميل بيانات المنتج للمشاركة."); return; }
    const name = cleanProductName(item.name || "منتج من متجر الدولي");
    const productUrl = new URL("product?id=" + encodeURIComponent(item.id), window.location.href).toString();
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
    const originalLabel = shareButton.textContent;
    try {
      const copiedCaption = await copyShareCaption(caption);
      shareButton.textContent = copiedCaption ? "تم نسخ التفاصيل — الصقها في فيسبوك" : "مشاركة المنتج";
      const file = await window.DAWLY_CREATE_PRODUCT_SHARE_FILE(item, productUrl, shareButton);
      if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
        await navigator.share({files:[file], title:name, text:caption});
      } else if (navigator.share) {
        await navigator.share({title:name, text:caption});
      } else {
        if (navigator.clipboard) await navigator.clipboard.writeText(caption);
        alert("المتصفح لا يدعم مشاركة الصور. تم تجهيز تفاصيل المنتج؛ يمكنك نسخ النص ومشاركة الصورة يدويًا.");
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
      console.error("Product image share failed; trying text/link share:", error);
      let sharedWithoutImage = false;
      try {
        if (navigator.share) {
          await navigator.share({title:name, text:caption, url:productUrl});
          sharedWithoutImage = true;
        }
      } catch (fallbackError) {
        if (fallbackError && fallbackError.name === "AbortError") return;
        console.warn("Native text share unavailable:", fallbackError);
      }
      if (!sharedWithoutImage) {
        const copied = await copyShareCaption(caption);
        if (!copied) {
          window.open("https://wa.me/?text=" + encodeURIComponent(caption), "_blank", "noopener");
          alert("تعذر تجهيز صورة المنتج، لكن تم فتح واتساب بنص الإعلان ورابط المنتج.");
        } else {
          alert("تعذر تجهيز صورة المنتج، لكن تم نسخ اسم المنتج والسعر والتفاصيل والرابط. يمكنك لصقها في أي منصة.");
        }
      }
    } finally {
      shareButton.disabled = false;
      shareButton.textContent = originalLabel;
    }
  });

  let miniCartKey = null;
  function getMiniCartKey() {
    if (miniCartKey) return miniCartKey;
    let deviceId = localStorage.getItem("dawly_cart_device_v1");
    if (!deviceId) {
      deviceId = (window.crypto && typeof window.crypto.randomUUID === "function")
        ? window.crypto.randomUUID()
        : "d" + Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem("dawly_cart_device_v1", deviceId);
    }
    miniCartKey = "dawly_cart_v3_" + deviceId;
    return miniCartKey;
  }
  function miniCartProducts() { return cloudProducts || fallbackProducts || []; }
  function miniCartPrice(value) {
    const raw = String(value == null ? "" : value).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^0-9.]/g, "");
    const n = Number(raw);
    return raw && Number.isFinite(n) ? n : null;
  }
  function ensureMiniCart() {
    let shell = document.getElementById("dawlyMiniCart");
    if (shell) return shell;
    shell = document.createElement("div");
    shell.id = "dawlyMiniCart";
    shell.innerHTML = '<button class="dawly-mini-cart-overlay" type="button" data-mini-close aria-label="إغلاق السلة"></button><aside class="dawly-mini-cart-panel" role="dialog" aria-modal="true" aria-labelledby="dawlyMiniCartTitle"><header class="dawly-mini-cart-head"><div><strong id="dawlyMiniCartTitle">سلة مشترياتك</strong><small>منتجات اخترتها من الدولي</small></div><button type="button" data-mini-close aria-label="إغلاق">×</button></header><div class="dawly-mini-cart-body" id="dawlyMiniCartBody"></div><footer class="dawly-mini-cart-foot"><div class="dawly-mini-cart-total"><span>الإجمالي</span><strong id="dawlyMiniCartTotal">—</strong></div><small>الشحن يُحدد عند تأكيد العنوان</small><a class="dawly-mini-cart-checkout" href="products.html?cart=1">إتمام الطلب ←</a><button class="dawly-mini-cart-continue" type="button" data-mini-close>متابعة التسوق</button></footer></aside>';
    document.body.appendChild(shell);
    shell.addEventListener("click", function(event) {
      const close = event.target.closest("[data-mini-close]");
      if (close) { closeMiniCart(); return; }
      const control = event.target.closest("[data-mini-qty], [data-mini-remove]");
      if (!control) return;
      const key = getMiniCartKey();
      let lines = [];
      try { lines = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) {}
      if (!Array.isArray(lines)) lines = [];
      const id = String(control.dataset.miniQty || control.dataset.miniRemove || "");
      if (control.hasAttribute("data-mini-remove")) {
        lines = lines.filter(line => String(line.id) !== id);
      } else {
        const line = lines.find(entry => String(entry.id) === id);
        const delta = Number(control.dataset.delta || 0);
        if (line) {
          const product = miniCartProducts().find(p => String(p.id) === id);
          const next = Math.max(0, Math.min(99, Number(line.qty || 1) + delta));
          if (product && Number.isInteger(product.stock) && product.stock >= 0 && next > product.stock) {
            alert("الكمية المطلوبة أكبر من المتاح بالمخزون."); return;
          }
          line.qty = next;
          if (!line.qty) lines = lines.filter(entry => String(entry.id) !== id);
        }
      }
      localStorage.setItem(key, JSON.stringify(lines));
      localStorage.setItem("dawly_cart_last_updated_v1", String(Date.now()));
      window.dispatchEvent(new CustomEvent("dawly-cart-updated", {detail:{cart:lines}}));
      renderMiniCart();
    });
    shell.addEventListener("keydown", function(event) { if (event.key === "Escape") closeMiniCart(); });
    return shell;
  }
  function renderMiniCart() {
    const shell = ensureMiniCart();
    const body = shell.querySelector("#dawlyMiniCartBody");
    let lines = [];
    try { lines = JSON.parse(localStorage.getItem(getMiniCartKey()) || "[]"); } catch (_) {}
    if (!Array.isArray(lines)) lines = [];
    let total = 0, priced = 0, count = 0;
    body.innerHTML = lines.map(function(line) {
      const item = miniCartProducts().find(p => String(p.id) === String(line.id));
      if (!item) return "";
      const qty = Math.max(1, Number(line.qty) || 1);
      const price = miniCartPrice(item.price);
      if (price !== null) { total += price * qty; priced++; }
      count += qty;
      const imageId = (Array.isArray(item.imageIds) && item.imageIds[0]) || item.imageId || "";
      const imageUrl = item.image || (Array.isArray(item.images) && typeof item.images[0] === "string" ? item.images[0] : "");
      const image = imageUrl
        ? '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(cleanProductName(item.name)) + '" loading="lazy">'
        : imageId
          ? '<img data-mini-image="' + escapeHtml(imageId) + '" alt="' + escapeHtml(cleanProductName(item.name)) + '" loading="lazy">'
          : '<span aria-hidden="true">🔧</span>';
      return '<article class="dawly-mini-cart-item"><div class="dawly-mini-cart-image">' + image + '</div><div class="dawly-mini-cart-info"><strong>' + escapeHtml(cleanProductName(item.name)) + '</strong><small>' + escapeHtml(displayBrand(item.brand || "")) + '</small><b>' + escapeHtml(formatPrice(item.price)) + '</b><div class="dawly-mini-cart-controls"><button type="button" data-mini-qty="' + escapeHtml(item.id) + '" data-delta="-1" aria-label="تقليل الكمية">−</button><span>' + qty + '</span><button type="button" data-mini-qty="' + escapeHtml(item.id) + '" data-delta="1" aria-label="زيادة الكمية">+</button><button type="button" data-mini-remove="' + escapeHtml(item.id) + '">حذف</button></div></div></article>';
    }).join("");
    if (!body.innerHTML) body.innerHTML = '<div class="dawly-mini-cart-empty">سلتك فارغة حاليًا</div>';
    const totalNode = shell.querySelector("#dawlyMiniCartTotal");
    totalNode.textContent = priced === lines.length && priced ? "EGP " + new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(total) : (count ? "يُحدد عند الاستفسار" : "EGP 0");
    const title = shell.querySelector("#dawlyMiniCartTitle");
    title.textContent = "سلة مشترياتك (" + count + ")";
    body.querySelectorAll("img[data-mini-image]").forEach(function(img) {
      if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
        window.DAWLY_LOAD_PRODUCT_IMAGE(img.dataset.miniImage).then(url => { if(url && img.isConnected) img.src=url; }).catch(()=>{});
      }
    });
  }
  function openMiniCart() {
    const shell = ensureMiniCart();
    renderMiniCart();
    shell.classList.add("is-open");
    document.body.classList.add("dawly-mini-cart-open");
    const close = shell.querySelector("[data-mini-close]");
    if (close) close.focus();
  }
  function closeMiniCart() {
    const shell = document.getElementById("dawlyMiniCart");
    if (!shell) return;
    shell.classList.remove("is-open");
    document.body.classList.remove("dawly-mini-cart-open");
  }

  root.addEventListener("click", function (event) {
    const button = event.target.closest("[data-detail-add], [data-detail-order-now]");
    if (!button || button.disabled) return;
    const directOrder = button.hasAttribute("data-detail-order-now");
    const id = directOrder ? button.dataset.detailOrderNow : button.dataset.detailAdd;
    const item = (cloudProducts || fallbackProducts).find(function (product) { return String(product.id) === String(id); });
    if (!item) { alert("تعذر تحميل بيانات المنتج. حدّث الصفحة وحاول مرة أخرى."); return; }
    if (Number.isInteger(item.stock) && item.stock >= 0 && item.stock === 0) {
      alert("هذا المنتج غير متاح حاليًا.");
      return;
    }
    let cart = [];
    let cartKey = "dawly_cart_v3_default";
    try {
      let deviceId = localStorage.getItem("dawly_cart_device_v1");
      if (!deviceId) {
        deviceId = (window.crypto && typeof window.crypto.randomUUID === "function")
          ? window.crypto.randomUUID()
          : "d" + Date.now().toString(36) + Math.random().toString(36).slice(2);
        localStorage.setItem("dawly_cart_device_v1", deviceId);
      }
      cartKey = "dawly_cart_v3_" + deviceId;
      const saved = JSON.parse(localStorage.getItem(cartKey) || "[]");
      if (Array.isArray(saved)) cart = saved.filter(function (line) {
        return line && line.id != null && Number.isInteger(Number(line.qty)) && Number(line.qty) > 0;
      }).map(function (line) { return {id:line.id,qty:Math.min(99,Number(line.qty))}; });
    } catch (error) {
      alert("تعذر قراءة السلة المحفوظة. حدّث الصفحة وحاول مرة أخرى.");
      return;
    }
    const line = cart.find(function (entry) { return String(entry.id) === String(id); });
    if (line) {
      if (Number.isInteger(item.stock) && item.stock >= 0 && line.qty >= item.stock) {
        alert("الكمية المطلوبة أكبر من المتاح بالمخزون.");
        return;
      }
      line.qty = Math.min(99, line.qty + 1);
    } else {
      cart.push({id:item.id,qty:1});
    }
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
      localStorage.setItem("dawly_cart_last_updated_v1", String(Date.now()));
    } catch (error) {
      alert("تعذر حفظ السلة على هذا الجهاز. تأكد من إعدادات المتصفح وحاول مرة أخرى.");
      return;
    }
    // Keep the product page open and show the Amazon-style mini cart.
    window.dispatchEvent(new CustomEvent("dawly-cart-updated", {detail:{productId:item.id, cart:cart}}));
    openMiniCart();
    if (directOrder) {
      const label = button.querySelector("span:last-child");
      if (label) label.textContent = "تمت الإضافة للسلة ✓";
      button.classList.add("is-added");
      button.setAttribute("aria-live", "polite");
      button.disabled = true;
      window.setTimeout(function () {
        if (!button.isConnected) return;
        if (label) label.textContent = "أكمل طلبك الآن";
        button.classList.remove("is-added");
        button.disabled = false;
      }, 1800);
      return;
    }
    // The compact cart icon also opens the side cart without leaving this page.
    return;
  });

  window.addEventListener("dawly-products-updated", function (event) {
    if (!Array.isArray(event.detail)) return;
    cloudProducts = event.detail;
    catalogReady = true;
    render();
  });
  window.addEventListener("dawly-catalog-ready", function () {
    catalogReady = true;
    render();
  });
  render();
})();
