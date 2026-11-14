(function () {
  function loadImage(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      const image = new Image();
      image.onload = function () { resolve(image); };
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
  window.DAWLY_CREATE_PRODUCT_SHARE_FILE = async function (item, productUrl, shareButton) {
    // Reuse the image already rendered in the product card/detail page first.
    const host = shareButton && (shareButton.closest(".product-card") || document.getElementById("productDetail"));
    const visibleImage = host && host.querySelector(".product-visual img, #detailMainImage, #detailCloudImage, .product-detail-image img");
    if (visibleImage && visibleImage.complete && visibleImage.naturalWidth > 0) {
      // Draw the already-loaded image; Firebase data URLs remain canvas-safe.
      var image = visibleImage;
    }
    // Otherwise load the Firebase-hosted image data (usually a data URL).
    let imageUrl = "";
    if (item.imageId && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      try { imageUrl = await window.DAWLY_LOAD_PRODUCT_IMAGE(item.imageId); } catch (e) {}
    }
    if (!imageUrl && Array.isArray(item.imageIds) && item.imageIds[0] && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
      try { imageUrl = await window.DAWLY_LOAD_PRODUCT_IMAGE(item.imageIds[0]); } catch (e) {}
    }
    if (!imageUrl) imageUrl = item.image || item.imageUrl || "";
    if (!image) image = await loadImage(imageUrl);
    if (!image) throw new Error("تعذر تحميل صورة المنتج لإنشاء بطاقة المشاركة");
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
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
    const scale = Math.min(950 / image.width, 610 / image.height);
    const iw = image.width * scale, ih = image.height * scale;
    ctx.drawImage(image, 540 - iw / 2, 535 - ih / 2, iw, ih);
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
    ctx.fillText(new URL(productUrl).host, 65, 1320);
    const blob = await new Promise(function (resolve, reject) {
      canvas.toBlob(function (value) { value ? resolve(value) : reject(new Error("تعذر تجهيز صورة المشاركة")); }, "image/jpeg", 0.92);
    });
    return new File([blob], "aldawly-product-" + String(item.id || "share") + ".jpg", {type:"image/jpeg"});
  };
})();