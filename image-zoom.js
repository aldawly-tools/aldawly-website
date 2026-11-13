(function () {
  const overlay = document.createElement("div");
  overlay.className = "image-zoom-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = '<div class="image-zoom-dialog" role="dialog" aria-modal="true" aria-label="صورة المنتج مكبرة"><button class="image-zoom-close" type="button" aria-label="إغلاق الصورة المكبرة">×</button><img alt=""></div>';
  document.body.appendChild(overlay);
  const hoverPreview = document.createElement("div");
  hoverPreview.className = "image-hover-preview";
  hoverPreview.setAttribute("aria-hidden", "true");
  hoverPreview.innerHTML = '<img alt="">';
  document.body.appendChild(hoverPreview);
  const hoverPreviewImage = hoverPreview.querySelector("img");

  const zoomImage = overlay.querySelector("img");
  const closeButton = overlay.querySelector(".image-zoom-close");
  let previousFocus = null;
  let previousOverflow = "";
  let hoverContainer = null;
  let hoverToken = 0;

  function hideHoverPreview() {
    hoverToken++;
    hoverContainer = null;
    hoverPreview.classList.remove("open");
    hoverPreview.setAttribute("aria-hidden", "true");
    hoverPreviewImage.removeAttribute("src");
  }

  function positionHoverPreview(container) {
    const rect = container.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const height = Math.min(360, window.innerHeight - 24);
    const gap = 12;
    const roomRight = window.innerWidth - rect.right - gap;
    let left = roomRight >= width ? rect.right + gap : rect.left - width - gap;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    let top = rect.top + (rect.height - height) / 2;
    top = Math.max(12, Math.min(top, window.innerHeight - height - 12));
    hoverPreview.style.width = width + "px";
    hoverPreview.style.height = height + "px";
    hoverPreview.style.left = left + "px";
    hoverPreview.style.top = top + "px";
  }

  function showHoverPreview(container) {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const image = container.querySelector("img");
    if (!image) return;
    hideHoverPreview();
    const token = hoverToken;
    hoverContainer = container;

    function display(source) {
      if (token !== hoverToken || hoverContainer !== container || !source) return;
      hoverPreviewImage.src = source;
      hoverPreviewImage.alt = image.alt || "صورة المنتج";
      positionHoverPreview(container);
      hoverPreview.classList.add("open");
      hoverPreview.setAttribute("aria-hidden", "false");
    }

    const source = image.currentSrc || image.getAttribute("src");
    if (source) {
      display(source);
    } else if (image.dataset.cloudImage && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cloudImage).then(function (url) {
        if (url) {
          image.src = url;
          display(url);
        }
      }).catch(function () {});
    }
  }

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

  document.addEventListener("pointerover", function (event) {
    if (event.pointerType !== "mouse") return;
    const target = event.target instanceof Element ? event.target : null;
    const container = target && target.closest(".product-visual");
    if (container && container !== hoverContainer) showHoverPreview(container);
  });

  document.addEventListener("pointerout", function (event) {
    if (event.pointerType !== "mouse") return;
    const target = event.target instanceof Element ? event.target : null;
    const container = target && target.closest(".product-visual");
    const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (container && !container.contains(next)) hideHoverPreview();
  });

  window.addEventListener("scroll", hideHoverPreview, {passive:true});
  window.addEventListener("resize", hideHoverPreview);

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
