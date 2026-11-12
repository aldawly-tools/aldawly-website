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
  let cart = [];
  let cloudImageObserver = null;

  function observeCloudImages() {
    if (typeof window.DAWLY_LOAD_PRODUCT_IMAGE !== "function") return;
    const images = grid.querySelectorAll("img[data-cloud-image]");
    if (!images.length) return;
    if ("IntersectionObserver" in window) {
      if (!cloudImageObserver) {
        cloudImageObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            const image = entry.target;
            cloudImageObserver.unobserve(image);
            window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cloudImage).then(function (url) {
              if (url && image.isConnected) image.src = url;
            }).catch(function () {});
          });
        }, {rootMargin:"240px"});
      }
      images.forEach(function (image) { cloudImageObserver.observe(image); });
      return;
    }
    images.forEach(function (image) {
      window.DAWLY_LOAD_PRODUCT_IMAGE(image.dataset.cloudImage).then(function (url) {
        if (url) image.src = url;
      }).catch(function () {});
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char];
    });
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
  function normalizeBrand(name) {
    return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s._-]/g, "").toLocaleLowerCase();
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
  function renderProducts() {
    const term = query.trim().toLocaleLowerCase();
    const shown = products.filter(function (item) {
      const categoryMatch = activeCategory === "الكل" || item.cat === activeCategory;
      const brandMatch = !activeBrand || normalizeBrand(item.brand) === normalizeBrand(activeBrand);
      const text = [item.name, item.brand, item.cat, item.desc].join(" ").toLocaleLowerCase();
      return categoryMatch && brandMatch && (!term || text.includes(term));
    });
    const emptyMessage = activeBrand
      ? 'لا توجد منتجات مسجلة لماركة ' + escapeHtml(activeBrand) + ' حاليًا.'
      : "لا توجد منتجات مطابقة.";
    grid.innerHTML = shown.map(function (item) {
      const visual = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '">'
        : item.imageId
          ? '<img src="" data-cloud-image="' + escapeHtml(item.imageId) + '" alt="' + escapeHtml(item.name) + '" loading="lazy">'
          : '<span class="product-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
      const detailUrl = "product.html?id=" + encodeURIComponent(String(item.id));
      return '<article class="product-card" id="product-' + encodeURIComponent(item.id) + '">' +
        '<a class="product-visual product-open-link" href="' + detailUrl + '" aria-label="تكبير صورة ' + escapeHtml(item.name) + '" title="اضغط لتكبير الصورة">' + visual + '</a>' +
        '<div class="product-info"><span class="product-category">' + (item.brand ? escapeHtml(item.brand) + ' · ' : '') + escapeHtml(item.cat || "منتجات") + '</span>' +
        '<h3 class="product-name"><a class="product-name-link" href="' + detailUrl + '">' + escapeHtml(item.name) + '</a></h3>' +
        '<p class="product-description">' + escapeHtml(item.desc || "") + '</p>' +
        '<a class="product-details-link" href="' + detailUrl + '">عرض الإعلان والتفاصيل ←</a>' +
        '<div class="product-meta"><span class="product-price">' + escapeHtml(item.price || "السعر عند الاستفسار") + '<small>السعر والتوفر عند التواصل</small></span>' +
        '<button class="button-primary" type="button" data-add="' + escapeHtml(item.id) + '">أضف إلى السلة</button></div></div></article>';
    }).join("") || '<p class="empty-cart">' + emptyMessage + '</p>';
    observeCloudImages();
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
    const count = cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
    cartCount.textContent = String(count);
    checkout.disabled = count === 0;
    cartItems.innerHTML = cart.length ? cart.map(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      if (!item) return "";
      const price = parsePrice(item.price);
      const lineTotal = price === null ? "" : '<small class="cart-line-total">مجموع هذا المنتج: ' + escapeHtml(money(price * line.qty)) + '</small>';
      return '<div class="cart-row"><div><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.price || "السعر عند الاستفسار") + '</small>' + lineTotal +
        '<div class="quantity"><button type="button" data-qty="' + escapeHtml(item.id) + '" data-delta="-1" aria-label="تقليل الكمية">−</button><span>' + line.qty + '</span><button type="button" data-qty="' + escapeHtml(item.id) + '" data-delta="1" aria-label="زيادة الكمية">+</button></div></div>' +
        '<button class="remove-item" type="button" data-remove="' + escapeHtml(item.id) + '">حذف</button></div>';
    }).join("") : '<div class="empty-cart">السلة فارغة حاليًا</div>';
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
    renderCart();
  });
  function addToCart(id) {
    const line = cart.find(function (entry) { return String(entry.id) === String(id); });
    if (line) line.qty += 1;
    else cart.push({id:id, qty:1});
    renderCart();
    setDrawer(true);
  }

  document.getElementById("searchForm").addEventListener("submit", function (event) {
    event.preventDefault();
    query = document.getElementById("searchInput").value;
    renderProducts();
    document.getElementById("products").scrollIntoView({behavior:"smooth"});
  });
  document.getElementById("searchInput").addEventListener("input", function (event) {
    query = event.target.value;
    renderProducts();
  });
  document.addEventListener("click", function (event) {
    const category = event.target.closest("[data-category]");
    if (category) {
      activeCategory = category.dataset.category;
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
        line.qty += Number(quantity.dataset.delta);
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
  checkout.addEventListener("click", function () {
    if (!cart.length) return;
    const pricing = cartPricing();
    const lines = cart.map(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      if (!item) return "";
      const productUrl = new URL("product.html?id=" + encodeURIComponent(item.id), window.location.href).toString();
      const price = parsePrice(item.price);
      const amount = price === null ? "السعر عند الاستفسار" : "مجموع المنتج: " + money(price * line.qty);
      return "• " + item.name + " × " + line.qty + "\n  " + amount + "\n  الإعلان والصورة: " + productUrl;
    }).filter(Boolean).join("\n");
    const totalText = pricing.pricedCount === pricing.itemCount
      ? "إجمالي الطلب: " + money(pricing.total)
      : pricing.pricedCount
        ? "المجموع الجزئي للمنتجات المسعّرة: " + money(pricing.total) + "\nباقي المنتجات سعرها عند الاستفسار."
        : "الإجمالي يتحدد بعد تأكيد الأسعار.";
    const message = "طلب جديد من متجر الدولي:\n" + lines + "\n" + totalText + "\nمن فضلكم أكدوا السعر والتوفر.";
    window.open("https://wa.me/201024787222?text=" + encodeURIComponent(message), "_blank", "noopener");
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setDrawer(false);
  });
  drawCategories();
  renderProducts();
  renderCart();
})();
