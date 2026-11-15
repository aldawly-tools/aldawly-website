(function () {
  const overlay = document.createElement("div");
  overlay.className = "image-zoom-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = '<div class="image-zoom-dialog" role="dialog" aria-modal="true" aria-label="معرض صور المنتج"><button class="image-zoom-close" type="button" aria-label="إغلاق الصورة المكبرة">×</button><button class="image-zoom-nav prev" type="button" aria-label="الصورة السابقة">‹</button><img alt=""><button class="image-zoom-nav next" type="button" aria-label="الصورة التالية">›</button><div class="image-zoom-count" aria-live="polite"></div></div>';
  document.body.appendChild(overlay);
  const hoverPreview = document.createElement("div");
  hoverPreview.className = "image-hover-preview";
  hoverPreview.setAttribute("aria-hidden", "true");
  hoverPreview.innerHTML = '<img alt="">';
  document.body.appendChild(hoverPreview);
  const hoverPreviewImage = hoverPreview.querySelector("img");

  const zoomImage = overlay.querySelector("img");
  const closeButton = overlay.querySelector(".image-zoom-close");
  const prevButton = overlay.querySelector(".image-zoom-nav.prev");
  const nextButton = overlay.querySelector(".image-zoom-nav.next");
  const countLabel = overlay.querySelector(".image-zoom-count");
  let zoomGallery = [];
  let zoomIndex = 0;
  let touchStartX = 0;
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

  function displayImage(source, alt, gallery, startIndex) {
    if (!source) return;
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    zoomGallery = Array.isArray(gallery) && gallery.length ? gallery : [{src:source,alt:alt || "صورة المنتج"}];
    zoomIndex = Math.max(0, Math.min(Number(startIndex) || 0, zoomGallery.length - 1));
    zoomImage.src = zoomGallery[zoomIndex].src || source;
    zoomImage.alt = zoomGallery[zoomIndex].alt || alt || "صورة المنتج";
    updateZoomGalleryControls();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeButton.focus();
  }

  function updateZoomGalleryControls() {
    const multiple = zoomGallery.length > 1;
    prevButton.hidden = !multiple;
    nextButton.hidden = !multiple;
    countLabel.hidden = !multiple;
    countLabel.textContent = multiple ? (zoomIndex + 1) + " / " + zoomGallery.length : "";
  }

  function stepZoomGallery(direction) {
    if (zoomGallery.length < 2) return;
    zoomIndex = (zoomIndex + direction + zoomGallery.length) % zoomGallery.length;
    const item = zoomGallery[zoomIndex];
    zoomImage.src = item.src;
    zoomImage.alt = item.alt || "صورة المنتج";
    updateZoomGalleryControls();
  }

  function getDetailGallery(image) {
    const container = image.closest(".product-detail-image");
    if (!container) return null;
    const thumbs = document.querySelectorAll("#detailImageThumbs .detail-image-thumb img");
    if (!thumbs.length) return null;
    const gallery = Array.from(thumbs).map(function (thumb) {
      return {src:thumb.currentSrc || thumb.getAttribute("src"),alt:image.alt || "صورة المنتج"};
    }).filter(function (item) { return !!item.src; });
    const active = document.querySelector("#detailImageThumbs .detail-image-thumb.active");
    const index = active ? Number(active.dataset.imageIndex) : 0;
    return gallery.length ? {gallery:gallery,index:index} : null;
  }

  function openImage(image) {
    const source = image.getAttribute("src");
    const detailGallery = getDetailGallery(image);
    if (source) {
      displayImage(image.currentSrc || source, image.alt, detailGallery && detailGallery.gallery, detailGallery && detailGallery.index);
      return;
    }
    if (image.dataset.cloudImage && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cloudImage).then(function (url) {
        if (!url) return;
        image.src = url;
        const detailGallery = getDetailGallery(image);
        displayImage(url, image.alt, detailGallery && detailGallery.gallery, detailGallery && detailGallery.index);
      }).catch(function () {});
    }
  }

  function closeImage() {
    if (!overlay.classList.contains("open")) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    zoomImage.removeAttribute("src");
    zoomGallery = [];
    zoomIndex = 0;
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
    hideHoverPreview();
    openImage(image);
  }

  // Disabled: hovering over a product image must not create a floating preview.
  // Product images remain clickable to open the full-screen gallery.

  window.addEventListener("scroll", hideHoverPreview, {passive:true});
  window.addEventListener("resize", hideHoverPreview);

  document.addEventListener("click", function (event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("[data-gallery-step]")) return;
    if (target.closest(".image-zoom-nav.prev")) { stepZoomGallery(-1); return; }
    if (target.closest(".image-zoom-nav.next")) { stepZoomGallery(1); return; }
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

  overlay.addEventListener("touchstart", function (event) {
    if (!overlay.classList.contains("open") || !event.touches || !event.touches.length) return;
    touchStartX = event.touches[0].clientX;
  }, {passive:true});
  overlay.addEventListener("touchend", function (event) {
    if (!overlay.classList.contains("open") || !event.changedTouches || !event.changedTouches.length) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 45) stepZoomGallery(delta > 0 ? -1 : 1);
  }, {passive:true});

  document.addEventListener("keydown", function (event) {
    if (overlay.classList.contains("open") && event.key === "ArrowLeft") { stepZoomGallery(1); return; }
    if (overlay.classList.contains("open") && event.key === "ArrowRight") { stepZoomGallery(-1); return; }
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
