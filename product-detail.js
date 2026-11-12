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
  function showMissing() {
    document.title = "المنتج غير موجود | الدولي للعدد";
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

    const name = String(item.name || "منتج من الدولي");
    const image = item.image
      ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '">'
      : item.imageId
        ? '<img id="detailCloudImage" data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '" loading="lazy">'
        : '<span class="product-detail-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
    const brand = item.brand ? escapeHtml(item.brand) + ' · ' : "";
    const price = escapeHtml(item.price || "السعر عند الاستفسار");
    const productUrl = new URL("product.html?id=" + encodeURIComponent(item.id), window.location.href).toString();
    const message = "السلام عليكم، أريد الاستفسار عن الإعلان: " + name + "\nرابط الإعلان والصورة للتوضيح: " + productUrl;
    const whatsapp = "https://wa.me/201024787222?text=" + encodeURIComponent(message);

    document.title = name + " | الدولي للعدد الأصلية والمستوردة";
    document.getElementById("detailBreadcrumb").textContent = name;
    root.innerHTML = '<article class="product-detail-layout">' +
      '<div class="product-detail-image" id="detailImage">' + image + '</div>' +
      '<div class="product-detail-info"><span class="product-detail-category">' + brand + escapeHtml(item.cat || "منتجات") + '</span>' +
      '<h1 class="product-detail-title">' + escapeHtml(name) + '</h1>' +
      '<p class="product-detail-description">' + escapeHtml(item.desc || "للاستفسار عن مواصفات المنتج وتفاصيله، تواصل معنا مباشرة.") + '</p>' +
      '<div class="product-detail-price">' + price + '<small>السعر والتوفر عند التواصل</small></div>' +
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
