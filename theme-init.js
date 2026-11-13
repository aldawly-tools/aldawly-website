(function () {
  var key = "dawly_theme_preference";
  var root = document.documentElement;
  var mode = "auto";
  try {
    var saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark" || saved === "auto") mode = saved;
  } catch (error) {}
  var dark = mode === "dark";
  if (mode === "auto") {
    try { dark = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (error) {}
  }
  root.dataset.themePreference = mode;
  root.dataset.theme = dark ? "dark" : "light";
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#10161e" : "#d71920";
})();
