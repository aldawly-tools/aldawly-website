/* Canonical storefront routing + one-time cart migration.
   Primary site: https://aldawly-website.pages.dev/
   GitHub Pages remains a code-preview URL and forwards visitors here. */
(function () {
  "use strict";
  var PRIMARY = "aldawly-website.pages.dev";
  var LEGACY = "aldawly-tools.github.io";
  var host = window.location.hostname.toLowerCase();

  function readLegacyCart() {
    try {
      var deviceId = localStorage.getItem("dawly_cart_device_v1");
      var raw = deviceId ? localStorage.getItem("dawly_cart_v2_" + deviceId) : null;
      if (!raw) raw = localStorage.getItem("dawly_cart_v1");
      if (!raw && deviceId) {
        var keys = Object.keys(localStorage);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i].indexOf("dawly_cart_v2_") === 0) {
            raw = localStorage.getItem(keys[i]);
            if (raw) break;
          }
        }
      }
      var cart = JSON.parse(raw || "[]");
      if (!Array.isArray(cart)) return [];
      return cart.filter(function (item) {
        return item && item.id != null && Number.isInteger(Number(item.qty)) && Number(item.qty) > 0;
      }).map(function (item) {
        return { id: item.id, qty: Math.min(99, Number(item.qty)) };
      });
    } catch (e) { return []; }
  }

  if (host === LEGACY) {
    var path = window.location.pathname.replace(/^\/aldawly-website(?=\/|$)/, "") || "/";
    var query = new URLSearchParams(window.location.search);
    var oldCart = readLegacyCart();
    if (oldCart.length) {
      query.set("__dawly_cart", encodeURIComponent(JSON.stringify(oldCart)));
      // One-time migration: clear the legacy-domain copies immediately so
      // opening another legacy product link cannot add the same cart again.
      try {
        Object.keys(localStorage).forEach(function (key) {
          if (key === "dawly_cart_v1" || key.indexOf("dawly_cart_v2_") === 0) localStorage.removeItem(key);
        });
      } catch (e) {}
    }
    var target = "https://" + PRIMARY + path + (query.toString() ? "?" + query.toString() : "") + window.location.hash;
    window.location.replace(target);
    return;
  }

  if (host === PRIMARY) {
    var params = new URLSearchParams(window.location.search);
    var payload = params.get("__dawly_cart");
    if (payload) {
      try {
        var incoming = JSON.parse(decodeURIComponent(payload));
        if (Array.isArray(incoming)) {
          var deviceId = localStorage.getItem("dawly_cart_device_v1");
          if (!deviceId) {
            deviceId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : "d" + Date.now().toString(36);
            localStorage.setItem("dawly_cart_device_v1", deviceId);
          }
          var key = "dawly_cart_v2_" + deviceId;
          var existing = JSON.parse(localStorage.getItem(key) || "[]");
          if (!Array.isArray(existing)) existing = [];
          incoming.forEach(function (item) {
            if (!item || item.id == null) return;
            var qty = Number(item.qty);
            if (!Number.isInteger(qty) || qty < 1) return;
            var found = existing.find(function (line) { return String(line.id) === String(item.id); });
            if (found) found.qty = Math.min(99, Number(found.qty || 0) + qty);
            else existing.push({ id: item.id, qty: Math.min(99, qty) });
          });
          localStorage.setItem(key, JSON.stringify(existing));
          localStorage.setItem("dawly_cart_last_updated_v1", String(Date.now()));
        }
      } catch (e) { console.warn("تعذر نقل السلة القديمة:", e); }
      params.delete("__dawly_cart");
      var clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
      window.history.replaceState({}, document.title, clean);
    }
  }
})();
