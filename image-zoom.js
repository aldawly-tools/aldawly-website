(function () {
  const overlay = document.createElement("div");
  overlay.className = "image-zoom-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = '<div class="image-zoom-dialog" role="dialog" aria-modal="true" aria-label="صورة المنتج مكبرة"><button class="image-zoom-close" type="button" aria-label="إغلاق الصورة المكبرة">×</button><img alt=""></div>';
  document.body.appendChild(overlay);

  const zoomImage = overlay.querySelector("img");
  const closeButton = overlay.querySelector(".image-zoom-close");
  let previousFocus = null;
  let previousOverflow = "";

  function displayImage(source, alt) {
    if (!source) return;
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    zoomImage.src = source;
    zoomImage.alt = alt || "صورة المنتج";
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeButton.focus();
  }

  function openImage(image) {
    const source = image.getAttribute("src");
    if (source) {
      displayImage(image.currentSrc || source, image.alt);
      return;
    }
    if (image.dataset.cloudImage && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cloudImage).then(function (url) {
        if (!url) return;
        image.src = url;
        displayImage(url, image.alt);
      }).catch(function () {});
    }
  }

  function closeImage() {
    if (!overlay.classList.contains("open")) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    zoomImage.removeAttribute("src");
    document.body.style.overflow = previousOverflow;
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }

  function activateImage(target, event) {
    const cardLink = target.closest(".product-visual");
    const detailImage = target.closest(".product-detail-image");
    const container = cardLink || detailImage;
    if (!container) return;
    const image = container.querySelector("img");
    if (!image) return;
    if (cardLink) event.preventDefault();
    openImage(image);
  }

  document.addEventListener("click", function (event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest(".image-zoom-close")) {
      closeImage();
      return;
    }
    if (target === overlay) {
      closeImage();
      return;
    }
    if (target.closest(".image-zoom-dialog")) return;
    activateImage(target, event);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeImage();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest(".product-detail-image")) return;
    event.preventDefault();
    activateImage(target, event);
  });
})();
