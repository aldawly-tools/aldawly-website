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
    return new Intl.NumberFormat("ar-EG", {maximumFractionDigits:2}).format(Number(text)) + " ج.م";
  }
  function displayBrand(value) {
    const raw = cleanProductCopy(value);
    const key = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s._-]/g, "").toLocaleLowerCase();
    const labels = {wurth:"WÜRTH",bosch:"BOSCH",wera:"WERA",knipex:"KNIPEX",beta:"Beta",dewalt:"DEWALT"};
    return labels[key] || raw;
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
    const image = item.image
      ? '<img id="detailMainImage" src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '">'
      : imageIds.length
        ? '<img id="detailCloudImage" data-cloud-image="' + escapeHtml(imageIds[0]) + '" alt="' + escapeHtml(name) + '" loading="lazy">'
        : '<span class="product-detail-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
    const galleryHtml = imageIds.length > 1 ? '<div class="detail-image-thumbs" id="detailImageThumbs"></div>' : '';
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
        specsRows.map(function (spec) { return '<div class="product-spec-row"><strong>' + escapeHtml(spec.label) + '</strong><span>' + escapeHtml(spec.value) + '</span></div>'; }).join("") +
        '</div></section>'
      : "";
    const productUrl = new URL("product.html?id=" + encodeURIComponent(item.id), window.location.href).toString();
    const message = "السلام عليكم، أريد الاستفسار عن الإعلان: " + name + "\nرابط الإعلان والصورة للتوضيح: " + productUrl;
    const whatsapp = "https://wa.me/201024787222?text=" + encodeURIComponent(message);

    document.title = name + " | الدولي";
    document.getElementById("detailBreadcrumb").textContent = name;
    root.innerHTML = '<article class="product-detail-layout">' +
      '<div><div class="product-detail-image" id="detailImage" tabindex="0" role="button" aria-label="تكبير صورة ' + escapeHtml(name) + '" title="اضغط لتكبير الصورة">' + image + '</div>' + galleryHtml + '</div>' +
      '<div class="product-detail-info"><span class="product-detail-category">' + brand + escapeHtml(item.cat || "منتجات") + '</span>' +
      '<h1 class="product-detail-title">' + escapeHtml(name) + '</h1>' +
      '<p class="product-detail-description">' + escapeHtml(cleanProductCopy(item.desc || "للاستفسار عن مواصفات المنتج وتفاصيله، تواصل معنا مباشرة.")) + '</p>' +
      '<div class="product-detail-price">' + price + '<small>' + (formatPrice(item.price).includes("ج.م") ? 'السعر بالجنيه المصري · التوفر عند التواصل' : 'السعر والتوفر عند التواصل') + '</small></div>' + stockHtml +
      '<div class="product-detail-actions"><a class="button-primary" href="' + whatsapp + '" target="_blank" rel="noopener">استفسر عن المنتج عبر واتساب</a>' +
      '<a class="button-outline" href="products.html">العودة إلى المنتجات</a></div>' + specsHtml + '</div></article>';


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
          return '<a class="related-card" href="product.html?id=' + encodeURIComponent(product.id) + '"><div class="related-visual">' + relatedImage + '</div><div class="related-info"><small>' + escapeHtml(product.brand ? displayBrand(product.brand) : product.cat || "منتجات") + '</small><strong>' + escapeHtml(relatedName) + '</strong><span>' + escapeHtml(formatPrice(product.price)) + '</span></div></a>';
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

    const cloudImage = document.getElementById("detailCloudImage");
    const mainImage = document.getElementById("detailMainImage") || cloudImage;
    const thumbBox = document.getElementById("detailImageThumbs");
    if (imageIds.length && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      Promise.all(imageIds.slice(0, 5).map(function (imageId) {
        return window.DAWLY_LOAD_PRODUCT_IMAGE(imageId);
      })).then(function (urls) {
        const valid = urls.filter(Boolean);
        if (!valid.length) return;
        if (mainImage && mainImage.isConnected && !mainImage.src) mainImage.src = valid[0];
        if (thumbBox && thumbBox.isConnected) {
          thumbBox.innerHTML = valid.map(function (url, index) {
            return '<button type="button" class="detail-image-thumb" data-image-url="' + escapeHtml(url) + '" aria-label="عرض الصورة ' + (index + 1) + '"><img src="' + escapeHtml(url) + '" alt=""></button>';
          }).join("");
          thumbBox.addEventListener("click", function (event) {
            const button = event.target.closest("[data-image-url]");
            if (button && mainImage) mainImage.src = button.dataset.imageUrl;
          });
        }
      }).catch(function () {});
    }
  }

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
