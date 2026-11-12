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
    const image = item.image
      ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '">'
      : item.imageId
        ? '<img id="detailCloudImage" data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '" loading="lazy">'
        : '<span class="product-detail-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
    const brand = item.brand ? escapeHtml(displayBrand(item.brand)) + ' · ' : "";
    const price = escapeHtml(formatPrice(item.price));
    const productUrl = new URL("product.html?id=" + encodeURIComponent(item.id), window.location.href).toString();
    const message = "السلام عليكم، أريد الاستفسار عن الإعلان: " + name + "\nرابط الإعلان والصورة للتوضيح: " + productUrl;
    const whatsapp = "https://wa.me/201024787222?text=" + encodeURIComponent(message);

    document.title = name + " | الدولي";
    document.getElementById("detailBreadcrumb").textContent = name;
    root.innerHTML = '<article class="product-detail-layout">' +
      '<div class="product-detail-image" id="detailImage" tabindex="0" role="button" aria-label="تكبير صورة ' + escapeHtml(name) + '" title="اضغط لتكبير الصورة">' + image + '</div>' +
      '<div class="product-detail-info"><span class="product-detail-category">' + brand + escapeHtml(item.cat || "منتجات") + '</span>' +
      '<h1 class="product-detail-title">' + escapeHtml(name) + '</h1>' +
      '<p class="product-detail-description">' + escapeHtml(cleanProductCopy(item.desc || "للاستفسار عن مواصفات المنتج وتفاصيله، تواصل معنا مباشرة.")) + '</p>' +
      '<div class="product-detail-price">' + price + '<small>' + (formatPrice(item.price).includes("ج.م") ? 'السعر بالجنيه المصري · التوفر عند التواصل' : 'السعر والتوفر عند التواصل') + '</small></div>' +
      '<div class="product-detail-actions"><a class="button-primary" href="' + whatsapp + '" target="_blank" rel="noopener">استفسر عن المنتج عبر واتساب</a>' +
      '<a class="button-outline" href="products.html">العودة إلى المنتجات</a></div></div></article>';

    const cloudImage = document.getElementById("detailCloudImage");
    if (cloudImage && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      window.DAWLY_LOAD_PRODUCT_IMAGE(cloudImage.dataset.cloudImage).then(function (url) {
        if (url && cloudImage.isConnected) cloudImage.src = url;
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
