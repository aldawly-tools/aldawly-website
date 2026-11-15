/* Canonical storefront routing. Cart data is never transferred through product URLs. */
(function () {
  "use strict";
  var PRIMARY = "aldawly-website.pages.dev";
  var LEGACY = "aldawly-tools.github.io";
  var host = window.location.hostname.toLowerCase();

  if (host === LEGACY) {
    var path = window.location.pathname.replace(/^\/aldawly-website(?=\/|$)/, "") || "/";
    var params = new URLSearchParams(window.location.search);
    params.delete("__dawly_cart");
    var target = "https://" + PRIMARY + path +
      (params.toString() ? "?" + params.toString() : "") + window.location.hash;
    window.location.replace(target);
    return;
  }

  if (host === PRIMARY) {
    var current = new URL(window.location.href);
    if (current.searchParams.has("__dawly_cart")) {
      current.searchParams.delete("__dawly_cart");
      window.history.replaceState({}, document.title,
        current.pathname + (current.searchParams.toString() ? "?" + current.searchParams.toString() : "") + current.hash);
    }
  }
})();