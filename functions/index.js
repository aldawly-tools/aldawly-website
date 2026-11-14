const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

initializeApp();

const telegramBotToken = defineSecret("TELEGRAM_BOT_TOKEN");
const telegramChatId = defineSecret("TELEGRAM_CHAT_ID");

const oneSignalRestApiKey = defineSecret("ONESIGNAL_REST_API_KEY");
const oneSignalAppId = "d87b624d-3b5b-46a9-aac0-ff545ae24022";

async function sendStorePush(title, message, url) {
  const apiKey = oneSignalRestApiKey.value();
  if (!apiKey) throw new Error("OneSignal REST API key is not configured.");
  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Authorization": "Key " + apiKey
    },
    body: JSON.stringify({
      app_id: oneSignalAppId,
      target_channel: "push",
      filters: [{ field: "tag", key: "store_admin", relation: "=", value: "true" }],
      headings: { en: title, ar: title },
      contents: { en: message, ar: message },
      url: url
    }),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error("OneSignal rejected push notification.", {
      status: response.status,
      errors: result.errors || null
    });
    throw new Error("OneSignal notification failed with HTTP " + response.status + ".");
  }
  logger.info("OneSignal push sent.", { notificationId: result.id || null });
}

exports.notifyNewProductOnOneSignal = onDocumentCreated(
  {
    document: "products/{productId}",
    region: "me-central1",
    retry: true,
    secrets: [oneSignalRestApiKey]
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const product = snapshot.data() || {};
    const name = safeText(product.name, 120) || "منتج جديد";
    const brand = safeText(product.brand, 80);
    await sendStorePush(
      "🆕 منتج جديد في متجر الدولي",
      name + (brand ? " — " + brand : "") + " أصبح متاحًا في المتجر.",
      "https://aldawly-website.pages.dev/products.html"
    );
  }
);

exports.notifyNewOrderOnOneSignal = onDocumentCreated(
  {
    document: "orders/{orderId}",
    region: "me-central1",
    retry: true,
    secrets: [oneSignalRestApiKey]
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const order = snapshot.data() || {};
    if (order.status !== "new" || order.source !== "website") return;
    const orderNumber = safeText(order.orderNumber, 40) || snapshot.id;
    const customer = safeText(order.customerName, 80);
    await sendStorePush(
      "🛒 طلب جديد من متجر الدولي",
      "طلب " + orderNumber + (customer ? " من العميل " + customer : "") + " — افتح لوحة الإدارة لمراجعته.",
      "https://aldawly-website.pages.dev/admin.html"
    );
  }
);


function safeText(value, maxLength) {
  return String(value == null ? "" : value).slice(0, maxLength);
}

function buildOrderMessage(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.slice(0, 50).map((item, index) => {
    const name = safeText(item && item.name, 160) || "منتج";
    const brand = safeText(item && item.brand, 80);
    const qty = Math.max(0, Math.min(999, Number(item && item.qty) || 0));
    const price = safeText(item && item.unitPrice, 80);
    return (index + 1) + ") " + name + (brand ? " — " + brand : "") +
      "\n   الكمية: " + qty + (price ? "\n   سعر الوحدة: " + price : "");
  });

  const fields = [
    "🛒 طلب جديد من متجر الدولي",
    "رقم الطلب: " + safeText(order.orderNumber, 40),
    "",
    "العميل: " + safeText(order.customerName, 80),
    "الهاتف: " + safeText(order.customerPhone, 24),
    "العنوان: " + safeText(order.customerAddress, 300)
  ];
  const notes = safeText(order.notes, 300);
  if (notes) fields.push("ملاحظات: " + notes);
  fields.push("", "المنتجات:", itemLines.join("\n\n") || "لا توجد تفاصيل منتجات.");
  fields.push("", safeText(order.totalText, 500));
  return fields.join("\n").slice(0, 3900);
}

exports.notifyOrderOnTelegram = onDocumentCreated(
  {
    document: "orders/{orderId}",
    region: "me-central1",
    retry: true,
    secrets: [telegramBotToken, telegramChatId]
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const order = snapshot.data();
    // Only the order submitted by the storefront checkout is sent.
    // Cart changes stay in localStorage and never create an orders document.
    if (order.status !== "new" || order.source !== "website") return;

    const token = telegramBotToken.value();
    const chatId = telegramChatId.value();
    if (!token || !chatId) {
      logger.error("Telegram order notification secrets are not configured.");
      return;
    }

    const db = getFirestore();
    const orderRef = db.collection("orders").doc(snapshot.id);
    const existing = await orderRef.get();
    if (existing.get("telegramNotifiedAt")) return;

    const endpoint = "https://api.telegram.org/bot" + token + "/sendMessage";
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: buildOrderMessage(order),
          disable_web_page_preview: true
        }),
        signal: AbortSignal.timeout(10000)
      });
    } catch (error) {
      logger.error("Telegram delivery failed for order document.", {
        orderId: snapshot.id,
        error: error && error.name === "TimeoutError" ? "timeout" : "network error"
      });
      throw new Error("Telegram delivery failed due to a network error.");
    }

    if (!response.ok) {
      logger.error("Telegram rejected the order notification.", {
        orderId: snapshot.id,
        httpStatus: response.status
      });
      throw new Error("Telegram rejected the order notification with HTTP " + response.status + ".");
    }

    await orderRef.update({ telegramNotifiedAt: FieldValue.serverTimestamp() });
    logger.info("Telegram order notification sent.", { orderId: snapshot.id });
  }
);
