(function () {
  document.addEventListener("click", async function (event) {
    const button = event.target.closest("[data-share-product]");
    if (!button) return;
    const id = button.dataset.shareProduct;
    const url = new URL("product.html?id=" + encodeURIComponent(id), window.location.href).toString();
    const title = document.querySelector(".product-detail-title")?.textContent ||
      button.closest(".product-card")?.querySelector(".product-name")?.textContent ||
      document.title || "منتج من متجر الدولي";
    const text = "شاهد المنتج من متجر الدولي للعدد الأصلية: " + title;
    const original = button.textContent;
    button.disabled = true;
    try {
      if (navigator.share) {
        await navigator.share({title:title, text:text, url:url});
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text + "\n" + url);
        button.textContent = "تم نسخ رابط المنتج ✓";
        setTimeout(function () { button.textContent = original; }, 2200);
      } else {
        window.prompt("انسخ رابط المنتج وشاركه:", url);
      }
    } catch (error) {
      if (error && error.name !== "AbortError") {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text + "\n" + url);
            button.textContent = "تم نسخ رابط المنتج ✓";
            setTimeout(function () { button.textContent = original; }, 2200);
          } else {
            window.prompt("انسخ رابط المنتج وشاركه:", url);
          }
        } catch (copyError) {
          window.prompt("انسخ رابط المنتج وشاركه:", url);
        }
      }
    } finally {
      button.disabled = false;
    }
  });
})();