(function () {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.__oneSignalInstance = null;
  window.__oneSignalLoadError = null;
  var script = document.createElement("script");
  script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  script.defer = true;
  script.onerror = function () {
    window.__oneSignalLoadError = "تعذر الوصول إلى cdn.onesignal.com";
    console.warn("OneSignal SDK could not be downloaded. Browser permission can still be requested, but push registration is unavailable.");
  };
  document.head.appendChild(script);
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.init({
        appId: "d87b624d-3b5b-46a9-aac0-ff545ae24022",
        serviceWorkerPath: "/aldawly-website/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/aldawly-website/" },
        notifyButton: { enable: false }
      });
      window.__oneSignalInstance = OneSignal;
    } catch (error) {
      window.__oneSignalLoadError = error && error.message ? error.message : String(error);
      console.error("OneSignal initialization failed:", error);
    }
  });
})();