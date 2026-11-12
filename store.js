(() => {
  const products = Array.isArray(window.DAWLY_PRODUCTS) ? window.DAWLY_PRODUCTS : [];
  const grid = document.getElementById("productGrid");
  const tiles = document.getElementById("categoryTiles");
  const filterBar = document.getElementById("filterBar");
  const cartCount = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  const cartDrawer = document.getElementById("cartDrawer");
  const cartOverlay = document.getElementById("cartOverlay");
  const checkout = document.getElementById("checkout");
  let activeCategory = "الكل";
  let query = "";
  let cart = [];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char];
    });
  }
  function categoryIcon(name) {
    if (name.includes("كهرب")) return "⚡";
    if (name.includes("يدوي")) return "🔧";
    if (name.includes("قياس")) return "📏";
    if (name.includes("ورش")) return "🧰";
    return "🛠️";
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
      const text = [item.name, item.brand, item.cat, item.desc].join(" ").toLocaleLowerCase();
      return categoryMatch && (!term || text.includes(term));
    });
    grid.innerHTML = shown.map(function (item) {
      const visual = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '">'
        : '<span class="product-placeholder" aria-hidden="true">' + escapeHtml(item.icon || "🔧") + '</span>';
      return '<article class="product-card" id="product-' + encodeURIComponent(item.id) + '">' +
        '<div class="product-visual">' + visual + '</div>' +
        '<div class="product-info"><span class="product-category">' + escapeHtml(item.cat || "منتجات") + '</span>' +
        '<h3 class="product-name">' + escapeHtml(item.name) + '</h3>' +
        '<p class="product-description">' + escapeHtml(item.desc || "") + '</p>' +
        '<div class="product-meta"><span class="product-price">' + escapeHtml(item.price || "السعر عند الاستفسار") + '<small>السعر والتوفر عند التواصل</small></span>' +
        '<button class="button-primary" type="button" data-add="' + escapeHtml(item.id) + '">أضف إلى السلة</button></div></div></article>';
    }).join("") || '<p class="empty-cart">لا توجد منتجات مطابقة.</p>';
    filterBar.querySelectorAll("[data-category]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.category === activeCategory);
    });
  }
  function renderCart() {
    const count = cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
    cartCount.textContent = String(count);
    checkout.disabled = count === 0;
    cartItems.innerHTML = cart.length ? cart.map(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      if (!item) return "";
      return '<div class="cart-row"><div><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.price || "السعر عند الاستفسار") + '</small>' +
        '<div class="quantity"><button type="button" data-qty="' + escapeHtml(item.id) + '" data-delta="-1" aria-label="تقليل الكمية">−</button><span>' + line.qty + '</span><button type="button" data-qty="' + escapeHtml(item.id) + '" data-delta="1" aria-label="زيادة الكمية">+</button></div></div>' +
        '<button class="remove-item" type="button" data-remove="' + escapeHtml(item.id) + '">حذف</button></div>';
    }).join("") : '<div class="empty-cart">السلة فارغة حاليًا</div>';
  }
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
    const lines = cart.map(function (line) {
      const item = products.find(function (entry) { return String(entry.id) === String(line.id); });
      return item ? "• " + item.name + " × " + line.qty : "";
    }).filter(Boolean).join("\n");
    const message = "طلب جديد من متجر الدولي:\n" + lines + "\nمن فضلكم أكدوا السعر والتوفر.";
    window.open("https://wa.me/201024787222?text=" + encodeURIComponent(message), "_blank", "noopener");
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setDrawer(false);
  });
  drawCategories();
  renderProducts();
  renderCart();
})();
