const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
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

exports.notifyConfirmedOrderOnOneSignal = onDocumentUpdated(
  {
    document: "orders/{orderId}",
    region: "me-central1",
    retry: true,
    secrets: [oneSignalRestApiKey]
  },
  async (event) => {
    const before = event.data && event.data.before && event.data.before.data();
    const afterSnapshot = event.data && event.data.after;
    if (!before || !afterSnapshot || !afterSnapshot.exists) return;
    const order = afterSnapshot.data() || {};

    // Notify only on the first transition into confirmed, never when a draft is created.
    if (before.status === "confirmed" || order.status !== "confirmed") return;
    if (order.source !== "website") return;
    if (order.oneSignalConfirmedAt) return;

    const orderNumber = safeText(order.orderNumber, 40) || afterSnapshot.id;
    const customer = safeText(order.customerName, 80);
    await sendStorePush(
      "✅ تم تأكيد طلب من متجر الدولي",
      "تم تأكيد الطلب " + orderNumber + (customer ? " للعميل " + customer : "") + ". افتح لوحة الإدارة لمتابعته.",
      "https://aldawly-website.pages.dev/admin.html"
    );

    // Mark successful delivery; the status-transition guard prevents repeat sends
    // when this metadata update itself triggers the function again.
    await afterSnapshot.ref.update({ oneSignalConfirmedAt: FieldValue.serverTimestamp() });
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


// Secure product-photo analysis. Gemini key and admin allowlist stay server-side.
const { onRequest } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const storeAdminEmails = ["elgoharemahmoud@gmail.com", "ahmedelgohare90@gmail.com"];

exports.analyzeProductImage = onRequest(
  { region: "me-central1", cors: ["https://aldawly-website.pages.dev", "https://aldawlytools.com.eg", "https://www.aldawlytools.com.eg"], secrets: [geminiApiKey], timeoutSeconds: 60, memory: "512MiB" },
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "الطلب غير مدعوم." });
    try {
      const origin = req.get("origin") || "";
      const allowedOrigins = ["https://aldawly-website.pages.dev", "https://aldawlytools.com.eg", "https://www.aldawlytools.com.eg"];
      if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ error: "مصدر الطلب غير مسموح." });
      const authorization = String(req.get("authorization") || "");
      const match = authorization.match(/^Bearer (.+)$/);
      if (!match) return res.status(401).json({ error: "سجّل الدخول أولًا." });
      const decoded = await getAuth().verifyIdToken(match[1]);
      const allowed = storeAdminEmails;
      if (!decoded.email || decoded.email_verified !== true || !allowed.includes(decoded.email.toLowerCase())) {
        return res.status(403).json({ error: "هذا الحساب غير مصرح له بتحليل صور المنتجات." });
      }
      const image = req.body && req.body.image;
      const mimeType = String(req.body && req.body.mimeType || "");
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType) || typeof image !== "string" || image.length > 11_500_000) {
        return res.status(400).json({ error: "الصورة غير صالحة أو حجمها أكبر من المسموح." });
      }
      const encoded = image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!encoded) return res.status(400).json({ error: "تعذر قراءة صيغة الصورة." });
      const prompt = "أنت خبير في العدد اليدوية والكهربائية ومستلزمات الورش والمعدات الصناعية. حلل صورة المنتج فقط. أعد JSON بالعربية بالمفاتيح: name (اسم مقترح قصير)، brand (الماركة فقط إذا كان الشعار مقروءا بوضوح وإلا فارغ)، category (واحدة من: عدد يدوية، عدد كهربائية، مستلزمات الورش، قياس)، description (وصف تسويقي واقعي دون اختلاق)، specifications (مصفوفة عناصر name/value للمعلومات المقروءة أو المؤكدة بصريا فقط)، notes (تنبيه مختصر لأي شيء غير مؤكد). لا تخمن الموديل أو بلد المنشأ أو المقاسات أو عدد القطع. إذا لم تتضح معلومة فاتركها فارغة.";
      const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(geminiApiKey.value());
      const aiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: encoded[2] } }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 1200 }
        }),
        signal: AbortSignal.timeout(45000)
      });
      const aiData = await aiResponse.json().catch(() => ({}));
      if (!aiResponse.ok) {
        logger.error("Gemini image analysis failed", { status: aiResponse.status });
        return res.status(502).json({ error: "خدمة تحليل الصور لم تستجب. راجع تفعيل المفتاح وحدود الاستخدام." });
      }
      const textOutput = aiData.candidates && aiData.candidates[0] && aiData.candidates[0].content && aiData.candidates[0].content.parts
        ? aiData.candidates[0].content.parts.map(p => p.text || "").join("") : "";
      const parsed = JSON.parse(textOutput);
      return res.status(200).json({ product: {
        name: safeText(parsed.name, 140),
        brand: safeText(parsed.brand, 80),
        category: ["عدد يدوية", "عدد كهربائية", "مستلزمات الورش", "قياس"].includes(parsed.category) ? parsed.category : "مستلزمات الورش",
        description: safeText(parsed.description, 1200),
        specifications: Array.isArray(parsed.specifications) ? parsed.specifications.slice(0, 12).map(x => ({ name: safeText(x.name, 60), value: safeText(x.value, 120) })).filter(x => x.name && x.value) : [],
        notes: safeText(parsed.notes, 300)
      }});
    } catch (error) {
      logger.error("Product image analysis request failed", { message: safeText(error && error.message, 180) });
      return res.status(500).json({ error: "حدث خطأ أثناء تحليل الصورة. حاول مرة أخرى." });
    }
  }
);
