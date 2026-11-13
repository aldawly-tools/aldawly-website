(function () {
  // Keep a single readiness promise so the admin page can wait for SDK init.
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  var resolveReady, rejectReady;
  window.__oneSignalReady = new Promise(function (resolve, reject) {
    resolveReady = resolve;
    rejectReady = reject;
  });
  var script = document.createElement("script");
  script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  script.defer = true;
  script.onerror = function () {
    rejectReady(new Error("تعذر تحميل خدمة الإشعارات. تحقق من الاتصال ثم أعد المحاولة."));
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
      resolveReady(OneSignal);
    } catch (error) {
      rejectReady(error);
    }
  });
  // Prevent an unhandled rejection if the admin page is not opened.
  window.__oneSignalReady.catch(function () {});
})();