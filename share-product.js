(function () {
  function loadImage(url) {
    return new Promise(function (resolve) {
      if (!url || typeof url !== "string") return resolve(null);
      const image = new Image();
      // Cross-origin images must explicitly request CORS before assigning src,
      // otherwise drawing them can taint the canvas and prevent sharing.
      try {
        const parsed = new URL(url, window.location.href);
        if (/^https?:$/.test(parsed.protocol) && parsed.origin !== window.location.origin) {
          image.crossOrigin = "anonymous";
        }
      } catch (e) { return resolve(null); }
      image.onload = function () {
        resolve(image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null);
      };
      image.onerror = function () { resolve(null); };
      image.src = url;
    });
  }
  function wrapText(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach(function (word) {
      const test = line ? line + " " + word : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }
  async function getProductImage(item, shareButton) {
    const host = shareButton && (shareButton.closest(".product-card") || document.getElementById("productDetail"));
    const visible = host && host.querySelector(".product-visual img, #detailMainImage, #detailCloudImage, .product-detail-image img");
    const candidates = [];
    if (visible) {
      const visibleUrl = visible.currentSrc || visible.src || visible.getAttribute("src");
      if (visibleUrl) candidates.push(visibleUrl);
    }
    // Firebase image documents are preferred over arbitrary external URLs.
    const ids = [];
    if (item.imageId) ids.push(item.imageId);
    if (Array.isArray(item.imageIds)) item.imageIds.forEach(function (id) { if (id) ids.push(id); });
    if (Array.isArray(item.images)) item.images.forEach(function (entry) {
      if (entry && typeof entry === "object" && (entry.id || entry.imageId)) ids.push(entry.id || entry.imageId);
    });
    if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      for (const id of ids) {
        try {
          const url = await window.DAWLY_LOAD_PRODUCT_IMAGE(id);
          if (url) candidates.push(url);
        } catch (e) {}
      }
    }
    if (item.image) candidates.push(item.image);
    if (item.imageUrl) candidates.push(item.imageUrl);
    if (Array.isArray(item.images)) item.images.forEach(function (entry) {
      if (typeof entry === "string") candidates.push(entry);
      else if (entry && typeof entry === "object") candidates.push(entry.url || entry.src || entry.image || "");
    });
    const seen = new Set();
    for (const url of candidates) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const image = await loadImage(url);
      if (image) return image;
    }
    return null;
  }
  window.DAWLY_CREATE_PRODUCT_SHARE_FILE = async function (item, productUrl, shareButton) {
    const image = await getProductImage(item, shareButton);
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذر إنشاء بطاقة المشاركة على هذا المتصفح");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = "#c8101e";
    ctx.fillRect(0, 0, 1080, 180);
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 58px Tahoma, Arial";
    ctx.fillText("الدولي للعدد الأصلية", 1010, 85);
    ctx.font = "bold 28px Tahoma, Arial";
    ctx.fillText("العدد الأصلية والمستوردة", 1010, 132);
    ctx.fillStyle = "#f5f6f7";
    ctx.fillRect(35, 205, 1010, 665);
    if (image) {
      const scale = Math.min(950 / image.naturalWidth, 610 / image.naturalHeight);
      const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
      ctx.drawImage(image, 540 - iw / 2, 535 - ih / 2, iw, ih);
    } else {
      // Still create a shareable branded card if an external image blocks CORS.
      ctx.fillStyle = "#6b7280";
      ctx.textAlign = "center";
      ctx.font = "bold 46px Tahoma, Arial";
      ctx.fillText("صورة المنتج", 540, 500);
      ctx.font = "28px Tahoma, Arial";
      ctx.fillText("يمكنك مشاهدة الصورة من رابط المنتج", 540, 555);
      ctx.textAlign = "right";
    }
    ctx.fillStyle = "#20242a";
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    const name = String(item.name || "منتج من الدولي").replace(/\s+/g, " ").trim();
    ctx.font = "bold 43px Tahoma, Arial";
    const nameLines = wrapText(ctx, name, 990).slice(0, 2);
    let y = 940;
    nameLines.forEach(function (line) { ctx.fillText(line, 1015, y); y += 54; });
    ctx.fillStyle = "#c8101e";
    ctx.font = "bold 39px Tahoma, Arial";
    const price = String(item.price == null || item.price === "" ? "السعر عند الاستفسار" : item.price + " ج.م");
    ctx.fillText("السعر: " + price, 1015, y + 12);
    y += 75;
    ctx.fillStyle = "#4b5560";
    ctx.font = "bold 27px Tahoma, Arial";
    const brand = item.brand ? "الماركة: " + String(item.brand) : "";
    if (brand) { ctx.fillText(brand, 1015, y); y += 43; }
    const desc = String(item.desc || item.specs || "للاستفسار عن المواصفات والتوفر تواصل معنا").replace(/\s+/g, " ").trim();
    ctx.font = "25px Tahoma, Arial";
    wrapText(ctx, desc, 990).slice(0, 2).forEach(function (line) { ctx.fillText(line, 1015, y); y += 38; });
    ctx.fillStyle = "#c8101e";
    ctx.fillRect(35, 1230, 1010, 3);
    ctx.fillStyle = "#343a40";
    ctx.font = "bold 22px Tahoma, Arial";
    ctx.fillText("شاهد المنتج واطلبه من متجرنا", 1015, 1280);
    ctx.font = "18px Arial";
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    ctx.fillText(new URL(productUrl, window.location.href).host, 65, 1320);
    const blob = await new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(function (value) {
          if (value) resolve(value);
          else reject(new Error("تعذر تحويل بطاقة المشاركة إلى صورة"));
        }, "image/jpeg", 0.92);
      } catch (error) { reject(error); }
    });
    return new File([blob], "aldawly-product-" + String(item.id || "share") + ".jpg", {type:"image/jpeg"});
  };
})();