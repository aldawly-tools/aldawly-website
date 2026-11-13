(() => {
  let products = Array.isArray(window.DAWLY_PRODUCTS) ? window.DAWLY_PRODUCTS : [];
  const grid = document.getElementById("productGrid");
  const tiles = document.getElementById("categoryTiles");
  const filterBar = document.getElementById("filterBar");
  const cartCount = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  const cartDrawer = document.getElementById("cartDrawer");
  const cartOverlay = document.getElementById("cartOverlay");
  const checkout = document.getElementById("checkout");
  let activeCategory = "الكل";
  let activeBrand = (new URLSearchParams(window.location.search).get("brand") || "").trim();
  let query = "";
  const pageSize = 12;
  let visibleProductCount = pageSize;
  let cart = [];
  try {
    const savedCart = JSON.parse(localStorage.getItem('dawly_cart_v1') || '[]');
    if (Array.isArray(savedCart)) cart = savedCart.filter(function (line) { return line && line.id != null && Number.isInteger(Number(line.qty)) && Number(line.qty) > 0; }).map(function (line) { return {id:line.id, qty:Math.min(99,Number(line.qty))}; });
  } catch (error) { cart = []; }
  function persistCart() { try { localStorage.setItem('dawly_cart_v1', JSON.stringify(cart)); } catch (error) {} }
  let cloudImageObserver = null;

  function showProductImageFallback(image) {
    if (!image || !image.parentNode) return;
    const placeholder = document.createElement("span");
    placeholder.className = "product-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = "🔧";
    image.parentNode.replaceChild(placeholder, image);
  }

  grid.addEventListener("error", function (event) {
    if (event.target && event.target.tagName === "IMG") showProductImageFallback(event.target);
  }, true);

  function observeCloudImages() {
    const images = grid.querySelectorAll("img[data-cloud-image]");
    if (!images.length) return;
    function loadImage(image) {
      if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE !== "function") {
        showProductImageFallback(image);
        return;
      }
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cloudImage).then(function (url) {
        if (url && image.isConnected) image.src = url;
        else if (image.isConnected) showProductImageFallback(image);
      }).catch(function () {
        if (image.isConnected) showProductImageFallback(image);
      });
    }
    if ("IntersectionObserver" in window) {
      if (!cloudImageObserver) {
        cloudImageObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            const image = entry.target;
            cloudImageObserver.unobserve(image);
            loadImage(image);
          });
        }, {rootMargin:"240px"});
      }
      images.forEach(function (image) { cloudImageObserver.observe(image); });
      return;
    }
    images.forEach(loadImage);
  }
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
  function cleanOrderProductName(value) {
    let text = cleanProductCopy(value)
      .replace(/[\uFE0E\uFE0F\u200D]/g, "")
      .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, " ")
      .replace(/\p{Extended_Pictographic}/gu, " ")
      .replace(/^\s*(?:حافظ على سلامة عينيك|حافظ على عينيك|احمِ عينيك)\s+مع\s+/iu, "")
      .replace(/\s+(?:لو شغلك|لو بتدور(?:ي)?|لو عايز|لو محتاج|لو محتاجة|سرعة في الأداء|دقة في التحكم|جودة للمحترفين|شغل أنضف|اطلب الآن)[\s\S]*$/iu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 80) {
      let shortText = text.slice(0, 77);
      const lastSpace = shortText.lastIndexOf(" ");
      if (lastSpace > 45) shortText = shortText.slice(0, lastSpace);
      text = shortText + "…";
    }
    return text || cleanProductName(value);
  }
  function parsePrice(value) {
    if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
    let text = String(value == null ? "" : value).trim();
    if (!text || /استفسار|حسب الطلب/i.test(text)) return null;
    text = text
      .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); });
    text = text.replace(/(?:جنيه(?:\s*مصري)?|ج\.?م\.?|ج\.?|EGP|LE)/gi, "").replace(/[\s,،٬]/g, "");
    if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
    const amount = Number(text);
    return Number.isFinite(amount) ? amount : null;
  }
  function money(amount) {
    return new Intl.NumberFormat("ar-EG", {maximumFractionDigits:2}).format(amount) + " ج.م";
  }
  function formatPrice(value) {
    const amount = parsePrice(value);
    return amount === null ? cleanProductCopy(value || "السعر عند الاستفسار") : money(amount);
  }
  function cartPricing() {
    let total = 0;
    let pricedCount = 0;
    cart.forEach(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      if (!item) return;
      const price = parsePrice(item.price);
      if (price === null) return;
      total += price * line.qty;
      pricedCount += 1;
    });
    return {total:total, pricedCount:pricedCount, itemCount:cart.filter(function (line) {
      return products.some(function (item) { return String(item.id) === String(line.id); });
    }).length};
  }
  function categoryIcon(name) {
    if (name.includes("كهرب")) return "⚡";
    if (name.includes("يدوي")) return "🔧";
    if (name.includes("قياس")) return "📏";
    if (name.includes("ورش")) return "🧰";
    return "🛠️";
  }
  function normalizeSearchText(value) {
    return String(value == null ? "" : value)
      .toLocaleLowerCase("ar")
      .normalize("NFD")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }
  function normalizeBrand(name) {
    return normalizeSearchText(name).replace(/\s/g, "");
  }
  function displayBrand(name) {
    const labels = {wurth:"WÜRTH",bosch:"BOSCH",wera:"WERA",knipex:"KNIPEX",beta:"Beta",dewalt:"DEWALT"};
    return labels[normalizeBrand(name)] || cleanProductCopy(name);
  }
  function renderBrandAvailability() {
    document.querySelectorAll(".brand-word").forEach(function (link) {
      if (!link.dataset.brandTarget) link.dataset.brandTarget = link.getAttribute("href") || "#brands";
      let target = "";
      try { target = new URL(link.dataset.brandTarget, window.location.href).searchParams.get("brand") || link.textContent; } catch (error) { target = link.textContent; }
      const available = products.some(function (item) { return item.brand && normalizeBrand(item.brand) === normalizeBrand(target); });
      if (available) {
        link.href = link.dataset.brandTarget;
        link.classList.remove("brand-unavailable");
        link.removeAttribute("aria-disabled");
        link.removeAttribute("tabindex");
        link.removeAttribute("title");
      } else {
        link.href = "#brands";
        link.classList.add("brand-unavailable");
        link.setAttribute("aria-disabled", "true");
        link.setAttribute("tabindex", "-1");
        link.setAttribute("title", "قريبًا، لم تُضف منتجات لهذه الماركة بعد");
      }
    });
  }
  function setDrawer(open) {
    cartDrawer.classList.toggle("open", open);
    cartOverlay.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) document.getElementById("closeCart").focus();
  }
  function drawCategories() {
    const categories = Array.from(new Set(products.map(function (item) { return item.cat; }).filter(Boolean)));
    tiles.innerHTML = '<button class="category-tile all" type="button" data-category="الكل"><span class="category-icon">▦</span><span><strong>جميع الأقسام</strong><small>تصفح كل المنتجات</small></span></button>' +
      categories.map(function (name) {
        const count = products.filter(function (item) { return item.cat === name; }).length;
        return '<button class="category-tile" type="button" data-category="' + escapeHtml(name) + '"><span class="category-icon">' + categoryIcon(name) + '</span><span><strong>' + escapeHtml(name) + '</strong><small>' + count + ' منتجات</small></span></button>';
      }).join("");
    filterBar.innerHTML = '<button class="filter-chip active" type="button" data-category="الكل">كل المنتجات</button>' +
      categories.map(function (name) { return '<button class="filter-chip" type="button" data-category="' + escapeHtml(name) + '">' + escapeHtml(name) + '</button>'; }).join("");
  }
  const listingControls = document.createElement("div");
  listingControls.className = "product-listing-controls";
  listingControls.innerHTML = '<p class="product-results-count" aria-live="polite"></p><button class="button-primary" type="button" data-load-more hidden>عرض 12 منتج إضافي</button>';
  grid.insertAdjacentElement("afterend", listingControls);
  const resultsCount = listingControls.querySelector(".product-results-count");
  const loadMoreButton = listingControls.querySelector("[data-load-more]");
  loadMoreButton.addEventListener("click", function () {
    visibleProductCount += pageSize;
    renderProducts();
  });

  function renderProducts() {
    const terms = normalizeSearchText(query).split(" ").filter(Boolean);
    const filtered = products.filter(function (item) {
      const categoryMatch = activeCategory === "الكل" || item.cat === activeCategory;
      const brandMatch = !activeBrand || normalizeBrand(item.brand) === normalizeBrand(activeBrand);
      const searchable = normalizeSearchText([
        item.name, item.brand, item.cat, item.desc, item.specs,
        item.sku, item.code, item.model, item.partNumber, item.id
      ].join(" "));
      const searchMatch = !terms.length || terms.every(function (term) { return searchable.includes(term); });
      return categoryMatch && brandMatch && searchMatch;
    });
    const emptyMessage = activeBrand
      ? 'لا توجد منتجات مسجلة لماركة ' + escapeHtml(activeBrand) + ' حاليًا.'
      : "لا توجد منتجات مطابقة.";
    const shown = filtered.slice(0, visibleProductCount);
    grid.innerHTML = shown.map(function (item) {
      const name = cleanProductName(item.name);
      const description = cleanProductCopy(item.desc || "");
      const visual = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(name) + '">'
        : item.imageId
          ? '<img data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(name) + '" loading="lazy">'
          : '<span class="product-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
      const detailUrl = "product.html?id=" + encodeURIComponent(String(item.id));
      const stockKnown = Number.isInteger(item.stock) && item.stock >= 0;
      const stockOut = stockKnown && item.stock === 0;
      const stockLabel = stockOut ? '<span class="stock-status out">نفد المخزون</span>' : stockKnown ? '<span class="stock-status">المتاح: ' + item.stock + ' قطعة</span>' : '';
      return '<article class="product-card" id="product-' + encodeURIComponent(item.id) + '">' +
        '<a class="product-visual product-open-link" href="' + detailUrl + '" aria-label="تكبير صورة ' + escapeHtml(name) + '" title="اضغط لتكبير الصورة">' + visual + '</a>' +
        '<div class="product-info"><span class="product-category">' + (item.brand ? escapeHtml(displayBrand(item.brand)) + ' · ' : '') + escapeHtml(item.cat || "منتجات") + '</span>' +
        '<h3 class="product-name"><a class="product-name-link" href="' + detailUrl + '">' + escapeHtml(name) + '</a></h3>' +
        '<p class="product-description">' + escapeHtml(description) + '</p>' + stockLabel +
        '<a class="product-details-link" href="' + detailUrl + '">عرض الإعلان والتفاصيل ←</a>' +
        '<div class="product-meta"><span class="product-price">' + escapeHtml(formatPrice(item.price)) + '<small>' + (parsePrice(item.price) === null ? 'السعر والتوفر عند التواصل' : 'التوفر عند التواصل') + '</small></span>' +
        '<button class="button-primary" type="button" data-add="' + escapeHtml(item.id) + '"' + (stockOut ? ' disabled aria-disabled="true"' : '') + '>' + (stockOut ? 'غير متاح حاليًا' : 'أضف إلى السلة') + '</button></div></div></article>';
    }).join("") || '<p class="empty-cart">' + emptyMessage + '</p>';
    observeCloudImages();
    resultsCount.textContent = filtered.length ? "عرض " + shown.length + " من " + filtered.length + " منتج" : "";
    loadMoreButton.hidden = shown.length >= filtered.length;
    loadMoreButton.textContent = "عرض " + Math.min(pageSize, filtered.length - shown.length) + " منتج إضافي";
    filterBar.querySelectorAll("[data-category]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.category === activeCategory);
    });
  }
  if (activeBrand) {
    const title = document.querySelector("#products .section-title");
    const subtitle = document.querySelector("#products .section-subtitle");
    if (title) title.textContent = "منتجات " + activeBrand;
    if (subtitle) subtitle.textContent = "المنتجات المسجلة لماركة " + activeBrand;
  }
  function renderCart() {
    persistCart();
    const count = cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
    cartCount.textContent = String(count);
    checkout.disabled = count === 0;
    cartItems.innerHTML = cart.length ? cart.map(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      if (!item) {
        return '<div class="cart-row"><div><strong>منتج محفوظ في السلة</strong><small>تعذر تحميل بيانات المنتج. حدّث صفحة المنتجات ثم أعد فتح السلة.</small><div class="quantity"><span>الكمية: ' + line.qty + '</span></div></div><button class="remove-item" type="button" data-remove="' + escapeHtml(line.id) + '">حذف</button></div>';
      }
      const price = parsePrice(item.price);
      const lineTotal = price === null ? "" : '<small class="cart-line-total">مجموع هذا المنتج: ' + escapeHtml(money(price * line.qty)) + '</small>';
      const cartImage = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="" loading="lazy">'
        : item.imageId
          ? '<img data-cart-image="' + escapeHtml(item.imageId) + '" alt="" loading="lazy">'
          : '<span aria-hidden="true">🔧</span>';
      return '<div class="cart-row"><div class="cart-product-main"><div class="cart-product-thumb">' + cartImage + '</div><div class="cart-product-copy"><strong>' + escapeHtml(cleanProductName(item.name)) + '</strong><small>' + escapeHtml(formatPrice(item.price)) + '</small>' + lineTotal +
        '<div class="quantity"><button type="button" data-qty="' + escapeHtml(item.id) + '" data-delta="-1" aria-label="تقليل الكمية">−</button><span>' + line.qty + '</span><button type="button" data-qty="' + escapeHtml(item.id) + '" data-delta="1" aria-label="زيادة الكمية">+</button></div></div></div>' +
        '<button class="remove-item" type="button" data-remove="' + escapeHtml(item.id) + '">حذف</button></div>';
    }).join("") : '<div class="empty-cart">السلة فارغة حاليًا</div>';
    cartItems.querySelectorAll("img[data-cart-image]").forEach(function (image) {
      if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE !== "function") return;
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cartImage).then(function (url) {
        if (url && image.isConnected) image.src = url;
        else if (image.isConnected) image.closest(".cart-product-thumb").classList.add("no-image");
      }).catch(function () {
        if (image.isConnected) image.closest(".cart-product-thumb").classList.add("no-image");
      });
    });
    const totalBox = document.getElementById("cartTotal");
    const pricing = cartPricing();
    if (!count) {
      totalBox.innerHTML = "";
    } else if (pricing.pricedCount === pricing.itemCount) {
      totalBox.innerHTML = '<div class="cart-total-row"><span>إجمالي الطلب</span><strong>' + escapeHtml(money(pricing.total)) + '</strong></div>';
    } else if (pricing.pricedCount) {
      totalBox.innerHTML = '<div class="cart-total-row"><span>مجموع المنتجات المسعّرة</span><strong>' + escapeHtml(money(pricing.total)) + '</strong></div><small>يوجد منتج سعره عند الاستفسار؛ يتحدد الإجمالي بعد تأكيد سعره.</small>';
    } else {
      totalBox.innerHTML = '<div class="cart-total-row"><span>الإجمالي</span><strong>بعد تأكيد الأسعار</strong></div>';
    }
  }

  window.addEventListener("dawly-products-updated", function (event) {
    if (!Array.isArray(event.detail)) return;
    products = event.detail;
    drawCategories();
    renderProducts();
    renderBrandAvailability();
    renderCart();
  });
  function addToCart(id) {
    const item = products.find(function (entry) { return String(entry.id) === String(id); });
    if (!item) return;
    if (Number.isInteger(item.stock) && item.stock >= 0 && item.stock === 0) {
      alert("هذا المنتج غير متاح حاليًا لأنه نفد من المخزون.");
      return;
    }
    const line = cart.find(function (entry) { return String(entry.id) === String(id); });
    if (line) {
      if (Number.isInteger(item.stock) && item.stock >= 0 && line.qty >= item.stock) {
        alert("لا يمكن طلب كمية أكبر من المتاح بالمخزون.");
        return;
      }
      line.qty += 1;
    } else cart.push({id:id, qty:1});
    renderCart();
    setDrawer(true);
  }

  document.getElementById("searchForm").addEventListener("submit", function (event) {
    event.preventDefault();
    query = document.getElementById("searchInput").value;
    visibleProductCount = pageSize;
    renderProducts();
    document.getElementById("products").scrollIntoView({behavior:"smooth"});
  });
  document.getElementById("searchInput").addEventListener("input", function (event) {
    query = event.target.value;
    visibleProductCount = pageSize;
    renderProducts();
  });
  document.addEventListener("click", function (event) {
    const category = event.target.closest("[data-category]");
    if (category) {
      activeCategory = category.dataset.category;
      visibleProductCount = pageSize;
      renderProducts();
      if (category.classList.contains("category-tile")) document.getElementById("products").scrollIntoView({behavior:"smooth"});
      return;
    }
    const add = event.target.closest("[data-add]");
    if (add) { addToCart(add.dataset.add); return; }
    const quantity = event.target.closest("[data-qty]");
    if (quantity) {
      const line = cart.find(function (entry) { return String(entry.id) === String(quantity.dataset.qty); });
      if (line) {
        const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
        const nextQty = line.qty + Number(quantity.dataset.delta);
        if (item && Number.isInteger(item.stock) && item.stock >= 0 && nextQty > item.stock) {
          alert("الكمية المطلوبة أكبر من المتاح بالمخزون.");
          return;
        }
        line.qty = nextQty;
        if (line.qty <= 0) cart = cart.filter(function (entry) { return String(entry.id) !== String(line.id); });
        renderCart();
      }
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      cart = cart.filter(function (entry) { return String(entry.id) !== String(remove.dataset.remove); });
      renderCart();
      return;
    }
    if (event.target.closest("#openCart")) { setDrawer(true); return; }
    if (event.target.closest("#closeCart") || event.target === cartOverlay) setDrawer(false);
  });
  const paymentConfirmed = document.getElementById("paymentConfirmed");
  const paymentLinks = Array.from(document.querySelectorAll("[data-payment-link]"));
  function updatePaymentLinks() {
    const enabled = Boolean(paymentConfirmed && paymentConfirmed.checked);
    paymentLinks.forEach(function (link) {
      link.setAttribute("aria-disabled", enabled ? "false" : "true");
      link.tabIndex = enabled ? 0 : -1;
    });
  }
  if (paymentConfirmed) paymentConfirmed.addEventListener("change", updatePaymentLinks);
  paymentLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (!paymentConfirmed || !paymentConfirmed.checked) {
        event.preventDefault();
        if (paymentConfirmed) paymentConfirmed.focus();
      }
    });
  });
  updatePaymentLinks();
  function showPaymentFollowup(orderNumber, saved) {
    const followup = document.getElementById("paymentFollowup");
    const status = document.getElementById("paymentFollowupStatus");
    const proofLink = document.getElementById("paymentProofLink");
    if (!followup || !status || !proofLink) return;
    if (paymentConfirmed) paymentConfirmed.checked = false;
    updatePaymentLinks();
    status.textContent = saved
      ? "تم تسجيل طلبك برقم " + orderNumber + ". أرسل الطلب في واتساب وانتظر تأكيد المتجر قبل الدفع."
      : "رقم طلبك " + orderNumber + ". أرسل الرسالة التي فُتحت في واتساب؛ تعذر تسجيل الطلب في لوحة المتجر.";
    proofLink.href = "https://wa.me/201024787222?text=" + encodeURIComponent("السلام عليكم، أرسل إيصال الدفع للطلب رقم " + orderNumber + ".");
    followup.hidden = false;
    followup.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  async function createWhatsAppOrderImage(orderNumber, customerName, customerPhone, customerAddress, orderItems, totalText) {
    const width = 1080, rowHeight = 178, headerHeight = 420, footerHeight = 190;
    const height = headerHeight + orderItems.length * rowHeight + footerHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3f4f6"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fff"; ctx.fillRect(32, 32, width - 64, height - 64);
    ctx.fillStyle = "#c8101e"; ctx.fillRect(32, 32, width - 64, 18);
    ctx.direction = "rtl"; ctx.textAlign = "right";
    function write(text, x, y, size, color, weight, maxWidth) {
      ctx.font = (weight || "600") + " " + size + "px Tahoma, Arial, sans-serif";
      ctx.fillStyle = color || "#20242a";
      ctx.fillText(String(text || ""), x, y, maxWidth || 850);
    }
    function loadImage(src) {
      return new Promise(function(resolve) {
        if (!src) return resolve(null);
        const img = new Image();
        img.onload = function(){ resolve(img); };
        img.onerror = function(){ resolve(null); };
        if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
        img.src = src;
      });
    }
    write("الدولي للعدد الأصلية", width - 86, 130, 48, "#c8101e", "bold");
    write("تفاصيل طلب جديد", width - 86, 195, 32, "#252b33", "bold");
    write("رقم الطلب: " + orderNumber, width - 86, 255, 27, "#20242a", "bold");
    write("العميل: " + customerName, width - 86, 310, 24, "#343d47", "600");
    write("الهاتف: " + customerPhone, width - 86, 355, 24, "#343d47", "600");
    write("العنوان: " + customerAddress, width - 86, 400, 22, "#343d47", "600", 850);
    let y = headerHeight;
    for (let i = 0; i < orderItems.length; i++) {
      const item = orderItems[i];
      ctx.fillStyle = i % 2 ? "#fafafa" : "#f1f3f5";
      ctx.fillRect(68, y, width - 136, rowHeight - 12);
      ctx.fillStyle = "#fff"; ctx.fillRect(86, y + 18, 136, 136);
      let src = item.image || "";
      if (!src && item.imageId && typeof window.DAWLY_LOAD_PRODUCT_IMAGE === "function") {
        try { src = await window.DAWLY_LOAD_PRODUCT_IMAGE(item.imageId); } catch (e) { src = ""; }
      }
      const img = await loadImage(src);
      if (img) {
        const scale = Math.min(120 / img.width, 120 / img.height);
        const iw = img.width * scale, ih = img.height * scale;
        ctx.drawImage(img, 94 + (120 - iw) / 2, y + 26 + (120 - ih) / 2, iw, ih);
      } else {
        ctx.textAlign = "center"; ctx.font = "58px Tahoma"; ctx.fillStyle = "#9aa1a9";
        ctx.fillText("🔧", 154, y + 105); ctx.textAlign = "right";
      }
      write((i + 1) + ". " + item.name, width - 258, y + 62, 25, "#20242a", "bold", 720);
      write("الكمية: " + item.qty + "    |    " + (item.unitPrice || "السعر عند الاستفسار"), width - 258, y + 108, 21, "#4b5560", "600", 720);
      y += rowHeight;
    }
    y += 28;
    ctx.fillStyle = "#fff1f1"; ctx.fillRect(68, y, width - 136, 110);
    ctx.strokeStyle = "#f0c9cc"; ctx.lineWidth = 2; ctx.strokeRect(68, y, width - 136, 110);
    write("ملخص الطلب", width - 98, y + 40, 22, "#8f1821", "bold");
    write(totalText, width - 98, y + 78, 24, "#b20f19", "bold", 850);
    write("شكرًا لثقتكم في الدولي للعدد الأصلية ❤️", width / 2, height - 78, 25, "#444", "bold", 900);
    return await new Promise(function(resolve, reject) {
      canvas.toBlob(function(blob) { if (blob) resolve(blob); else reject(new Error("تعذر تجهيز صورة المنتجات")); }, "image/png");
    });
  }

  async function shareWhatsAppOrderImage(orderNumber, customerName, customerPhone, customerAddress, orderItems, totalText, message) {
    try {
      const blob = await createWhatsAppOrderImage(orderNumber, customerName, customerPhone, customerAddress, orderItems, totalText);
      const file = new File([blob], "dawly-order-" + orderNumber + ".png", {type:"image/png"});
      if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
        await navigator.share({files:[file], title:"طلب من متجر الدولي", text:"تفاصيل الطلب " + orderNumber + " — أرسل الصورة إلى متجر الدولي."});
        return true;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = file.name; link.click();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
      window.open("https://wa.me/201024787222?text=" + encodeURIComponent(message + "\\n\\nتم تنزيل صورة مجمعة للمنتجات؛ أرفقها في المحادثة قبل الإرسال."), "_blank", "noopener");
      alert("تم تنزيل صورة الطلب. أرفق الصورة في واتساب ثم اضغط إرسال.");
      return true;
    } catch (error) {
      if (error && error.name === "AbortError") return false;
      console.warn("تعذرت مشاركة صورة الطلب:", error);
      const orderImageItems = cart.map(function(line) {
      const item = products.find(function(entry){ return String(entry.id) === String(line.id); });
      if (!item) return null;
      return {
        name: cleanOrderProductName(item.name),
        qty: line.qty,
        unitPrice: String(item.price || "السعر عند الاستفسار"),
        image: item.image || item.imageUrl || "",
        imageId: (Array.isArray(item.imageIds) && item.imageIds[0]) || item.imageId || null
      };
    }).filter(Boolean);
    shareWhatsAppOrderImage(orderNumber, customerName, customerPhone, customerAddress, orderImageItems, totalText, message);
      alert("تعذر إرفاق الصورة تلقائيًا؛ تم فتح رسالة الطلب وبها روابط صور المنتجات.");
      return false;
    }
  }

  checkout.addEventListener("click", async function () {
    if (!cart.length) return;
    const customerName = document.getElementById("customerName").value.trim();
    const customerPhoneRaw = document.getElementById("customerPhone").value.trim();
    const customerAddress = document.getElementById("customerAddress").value.trim();
    const orderNotes = document.getElementById("orderNotes").value.trim();
    const customerPhone = customerPhoneRaw
      .replace(/[٠-٩]/g, function (digit) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)); })
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
      .replace(/[\s()+-]/g, "");
    if (!customerName || !customerPhoneRaw || !customerAddress) {
      alert("من فضلك اكتب الاسم ورقم الهاتف والعنوان قبل إرسال الطلب.");
      return;
    }
    if (!/^\d{8,15}$/.test(customerPhone)) {
      alert("رقم الهاتف غير صحيح. راجع الرقم وحاول مرة أخرى.");
      document.getElementById("customerPhone").focus();
      return;
    }
    const orderNumber = "DW-" + Date.now().toString().slice(-8);
    const pricing = cartPricing();
    let itemNumber = 0;
    const lines = cart.map(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      if (!item) return "";
      itemNumber += 1;
      const productUrl = new URL("product.html?id=" + encodeURIComponent(item.id), window.location.href).toString();
      const price = parsePrice(item.price);
      const priceLines = price === null
        ? "   السعر: عند الاستفسار"
        : "   سعر الوحدة: " + money(price) + "\n   إجمالي المنتج: " + money(price * line.qty);
      return itemNumber + ") " + cleanOrderProductName(item.name) + "\n   الكمية: " + line.qty + "\n" + priceLines + "\n   صورة المنتج والتفاصيل: " + productUrl;
    }).filter(Boolean).join("\n\n");
    const totalText = pricing.pricedCount === pricing.itemCount
      ? "إجمالي المنتجات: " + money(pricing.total) + "\nرسوم التوصيل: تُحدد بعد تأكيد العنوان\nالإجمالي النهائي: بعد تأكيد التوصيل"
      : pricing.pricedCount
        ? "مجموع المنتجات المسعّرة: " + money(pricing.total) + "\nبعض المنتجات: السعر عند الاستفسار\nرسوم التوصيل: تُحدد بعد تأكيد العنوان\nالإجمالي النهائي: بعد تأكيد الأسعار والتوصيل"
        : "إجمالي المنتجات: يتحدد بعد تأكيد الأسعار\nرسوم التوصيل: تُحدد بعد تأكيد العنوان\nالإجمالي النهائي: بعد تأكيد الأسعار والتوصيل";
    const customerDetails = [
      "الاسم: " + customerName,
      "الهاتف: " + customerPhone,
      "العنوان: " + customerAddress
    ];
    if (orderNotes) customerDetails.push("ملاحظات: " + orderNotes);
    const message = [
      "🛒 *طلب جديد من متجر الدولي*",
      "رقم الطلب: *" + orderNumber + "*",
      "",
      "👤 *بيانات العميل*",
      customerDetails.join("\n"),
      "",
      "📦 *المنتجات (" + pricing.itemCount + ")*",
      lines,
      "",
      "💰 *ملخص الطلب*",
      totalText,
      "",
      "برجاء تأكيد توفر المنتجات والسعر النهائي ورسوم التوصيل."
    ].join("\n");
    const record={orderNumber,customerName,customerPhone,customerAddress,notes:orderNotes,items:cart.map(function(line){const item=products.find(function(entry){return String(entry.id)===String(line.id);});return item?{id:String(item.id),name:cleanOrderProductName(item.name),brand:String(item.brand||""),qty:line.qty,unitPrice:String(item.price||"السعر عند الاستفسار"),image:item.image||item.imageUrl||"",imageId:(Array.isArray(item.imageIds)&&item.imageIds[0])||item.imageId||null}:null;}).filter(Boolean),totalText,status:"new",source:"website"};
    window.open("https://wa.me/201024787222?text=" + encodeURIComponent(message), "_blank", "noopener");
    try{
      const appMod=await import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js");
      const fsMod=await import("https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js");
      const app=appMod.getApps().length?appMod.getApp():appMod.initializeApp(window.DAWLY_FIREBASE_CONFIG);
      await fsMod.addDoc(fsMod.collection(fsMod.getFirestore(app),"orders"),Object.assign({},record,{createdAt:fsMod.serverTimestamp()}));
      showPaymentFollowup(orderNumber,true);
    }catch(err){console.warn("تعذر تسجيل الطلب في لوحة الإدارة.",err);showPaymentFollowup(orderNumber,false);alert("تم فتح واتساب لإرسال طلبك، لكن لم يتم تسجيله في لوحة الإدارة. يرجى إرسال الرسالة هناك.");}
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setDrawer(false);
  });
  drawCategories();
  renderProducts();
  renderBrandAvailability();
  renderCart();
  if (new URLSearchParams(window.location.search).get("cart") === "1") {
    setDrawer(true);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("cart");
    window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
})();
