(function () {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  var script = document.createElement("script");
  script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  script.defer = true;
  document.head.appendChild(script);
  window.OneSignalDeferred.push(async function (OneSignal) {
    await OneSignal.init({
      appId: "d87b624d-3b5b-46a9-aac0-ff545ae24022",
      serviceWorkerPath: "/aldawly-website/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/aldawly-website/" },
      notifyButton: { enable: false }
    });
  });
})();