(function () {
  var root = document.documentElement;
  var key = "dawly_theme_preference";
  var modes = ["auto", "light", "dark"];
  var labels = {auto:"تلقائي", light:"فاتح", dark:"داكن"};
  var mode = root.dataset.themePreference || "auto";
  var sensor = null;
  var ambientTheme = null;
  var button = document.createElement("button");
  var media = null;

  try { media = window.matchMedia("(prefers-color-scheme: dark)"); } catch (error) {}

  function systemTheme() {
    return media && media.matches ? "dark" : "light";
  }

  function stopSensor() {
    if (!sensor) return;
    try { sensor.stop(); } catch (error) {}
    sensor = null;
    ambientTheme = null;
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#10161e" : "#d71920";
  }

  function updateButton() {
    var currentTheme = root.dataset.theme || systemTheme();
    var icon = currentTheme === "dark" ? "☾" : "☀";
    button.textContent = icon + " " + labels[mode];
    button.setAttribute("aria-label", "مظهر الموقع: " + labels[mode]);
    button.title = mode === "auto"
      ? "تلقائي: حساس الإضاءة إن كان متاحًا، وإلا إعداد المظهر في الجهاز. اضغط للتبديل."
      : "مظهر الموقع: " + labels[mode] + ". اضغط للتبديل بين تلقائي وفاتح وداكن.";
  }

  function useSystemFallback() {
    if (mode === "auto") setTheme(systemTheme());
    updateButton();
  }

  function startSensor() {
    if (mode !== "auto" || !("AmbientLightSensor" in window)) {
      useSystemFallback();
      return;
    }
    stopSensor();
    try {
      sensor = new window.AmbientLightSensor({frequency: 1});
      sensor.addEventListener("reading", function () {
        if (!sensor || sensor.illuminance == null) return;
        var lux = Number(sensor.illuminance);
        if (!Number.isFinite(lux)) return;
        if (ambientTheme === null) ambientTheme = lux < 50 ? "dark" : "light";
        else if (ambientTheme === "dark" && lux >= 80) ambientTheme = "light";
        else if (ambientTheme === "light" && lux <= 35) ambientTheme = "dark";
        setTheme(ambientTheme);
        updateButton();
      });
      sensor.addEventListener("error", function () {
        stopSensor();
        useSystemFallback();
      });
      sensor.start();
    } catch (error) {
      stopSensor();
      useSystemFallback();
    }
  }

  function setMode(next, fromUser) {
    mode = next;
    root.dataset.themePreference = mode;
    try { localStorage.setItem(key, mode); } catch (error) {}
    if (mode === "auto") {
      setTheme(systemTheme());
      if (fromUser) startSensor();
    } else {
      stopSensor();
      setTheme(mode);
    }
    updateButton();
  }

  button.type = "button";
  button.className = "theme-toggle";
  button.addEventListener("click", function () {
    var index = modes.indexOf(mode);
    setMode(modes[(index + 1) % modes.length], true);
  });
  document.body.appendChild(button);

  if (media) {
    var onSystemThemeChange = function () {
      if (mode === "auto" && !sensor) {
        setTheme(systemTheme());
        updateButton();
      }
    };
    if (media.addEventListener) media.addEventListener("change", onSystemThemeChange);
    else if (media.addListener) media.addListener(onSystemThemeChange);
  }

  if (mode === "auto" && ("AmbientLightSensor" in window) && navigator.permissions) {
    navigator.permissions.query({name:"ambient-light-sensor"}).then(function (permission) {
      if (permission.state === "granted" && mode === "auto") startSensor();
    }).catch(function () {});
  }
  updateButton();
})();
