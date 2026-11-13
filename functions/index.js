const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

initializeApp();

const telegramBotToken = defineSecret("TELEGRAM_BOT_TOKEN");
const telegramChatId = defineSecret("TELEGRAM_CHAT_ID");

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
      return;
    }

    if (!response.ok) {
      logger.error("Telegram rejected the order notification.", {
        orderId: snapshot.id,
        httpStatus: response.status
      });
      return;
    }

    await orderRef.update({ telegramNotifiedAt: FieldValue.serverTimestamp() });
    logger.info("Telegram order notification sent.", { orderId: snapshot.id });
  }
);
