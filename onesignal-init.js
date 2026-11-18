(function () {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.__oneSignalInstance = null;
  window.__oneSignalLoadError = null;

  function initializeOneSignal() {
    if (window.__oneSignalScriptStarted) return;
    window.__oneSignalScriptStarted = true;

    // Notifications are useful, but they should not compete with the storefront's
    // first render, product catalog, or images.
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({
          appId: "d87b624d-3b5b-46a9-aac0-ff545ae24022",
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          notifyButton: { enable: false }
        });
        window.__oneSignalInstance = OneSignal;
      } catch (error) {
        window.__oneSignalLoadError = error && error.message ? error.message : String(error);
        console.error("OneSignal initialization failed:", error);
      }
    });

    var script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.async = true;
    script.onerror = function () {
      window.__oneSignalLoadError = "تعذر الوصول إلى cdn.onesignal.com";
      console.warn("OneSignal SDK could not be downloaded. Push registration is unavailable.");
    };
    document.head.appendChild(script);
  }

  function scheduleOneSignal() {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(initializeOneSignal, { timeout: 5000 });
    } else {
      window.setTimeout(initializeOneSignal, 1800);
    }
  }

  if (document.readyState === "complete") {
    scheduleOneSignal();
  } else {
    window.addEventListener("load", scheduleOneSignal, { once: true });
    // Avoid waiting indefinitely on a slow third-party resource delaying window.load.
    window.setTimeout(scheduleOneSignal, 5000);
  }
})();
