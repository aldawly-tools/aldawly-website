const { createHash, createHmac, timingSafeEqual } = require("node:crypto");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const whatsappAccessToken = defineSecret("WHATSAPP_ACCESS_TOKEN");
const whatsappPhoneNumberId = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
const whatsappVerifyToken = defineSecret("WHATSAPP_VERIFY_TOKEN");
const whatsappAppSecret = defineSecret("WHATSAPP_APP_SECRET");

const GRAPH_API_VERSION = "v27.0";
const PRODUCT_SITE_ORIGIN = "https://aldawly-website.pages.dev";
const MAX_MATCHES = 3;
const EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const PROCESSING_LEASE_MS = 2 * 60 * 1000;
const CATALOG_CACHE_MS = 60 * 1000;

let catalogCache = { loadedAt: 0, products: [] };

const stopWords = new Set((
  "في من على عن الى الي او و هل ايه اي ما ماذا عايز عاوز محتاج عند لل من فضلك " +
  "لو سمحت ممكن يكون تكون فيه حاجه حاجة حاجات اداة اداه الاداة المنتج منتجات عندكم عندك"
).split(/\s+/));

const aliases = {
  "خشب": ["نجاره", "نجار", "منشار", "صنفرة", "صنفره", "بنط", "بنطة", "بنطه", "دريل", "شنيور", "مسمار", "ازميل", "أزميل"],
  "نجاره": ["خشب", "نجار", "منشار", "ازميل", "أزميل", "صنفرة", "صنفره"],
  "حديد": ["معدن", "صاج", "صاروخ", "قطعية", "قطعيه", "بنط معدن"],
  "خرسانه": ["خرسانة", "حائط", "طوب", "هيلتي", "شاكوش", "تخريم"],
  "مفك": ["مفكات", "صليبة", "صليبه", "عادة", "عاده", "توركس", "torx"],
  "بنط": ["بنطة", "بنطه", "ريشة", "ريشه", "hss", "خرسانة", "خرسانه"],
  "قص": ["قطعية", "قطعيه", "منشار", "صاروخ", "شفرة", "شفره"]
};

function normalize(value) {
  return String(value == null ? "" : value)
    .toLocaleLowerCase("ar")
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function queryTerms(query) {
  const raw = normalize(query).split(" ")
    .map(term => term.replace(/^(وال|بال|كال|لل|ال|و|ب|ل)/, ""))
    .filter(term => term.length >= 2 && !stopWords.has(term));
  const expanded = raw.slice();
  raw.forEach(term => {
    Object.keys(aliases).forEach(key => {
      if (term === key || aliases[key].includes(term)) expanded.push(key, ...aliases[key]);
    });
  });
  return { raw, expanded: Array.from(new Set(expanded)) };
}

function productText(product) {
  const specs = typeof product.specs === "string" ? product.specs : JSON.stringify(product.specs || "");
  return normalize([
    product.name, product.brand, product.brandName, product.manufacturer,
    product.cat, product.category, product.desc, product.description,
    specs, product.sku, product.code, product.model, product.partNumber
  ].join(" "));
}

function scoreProduct(product, raw, expanded) {
  const nameWords = normalize(product.name).split(" ");
  const allWords = productText(product).split(" ");
  let score = 0;
  let matched = 0;
  raw.forEach(term => {
    if (nameWords.includes(term)) {
      score += 8;
      matched += 1;
    } else if (allWords.includes(term)) {
      score += 3;
      matched += 1;
    }
  });
  expanded.forEach(term => {
    if (raw.includes(term)) return;
    if (nameWords.includes(term)) score += 2;
    else if (allWords.includes(term)) score += 1;
  });
  return { score, matched };
}

function findProducts(products, query) {
  const { raw, expanded } = queryTerms(query);
  if (!raw.length) return [];
  const ranked = products
    .filter(product => product && product.hiddenFromStore !== true)
    .map(product => ({ product, ...scoreProduct(product, raw, expanded) }))
    .filter(item => item.matched >= 1 && item.score >= 6)
    .sort((a, b) => b.score - a.score || String(a.product.name || "").localeCompare(String(b.product.name || ""), "ar"));
  if (!ranked.length) return [];
  const best = ranked[0].score;
  return ranked
    .filter(item => item.score >= Math.max(6, best * 0.65))
    .slice(0, MAX_MATCHES)
    .map(item => item.product);
}

async function loadProducts() {
  if (Date.now() - catalogCache.loadedAt < CATALOG_CACHE_MS) return catalogCache.products;
  const snapshot = await getFirestore().collection("products").get();
  const products = snapshot.docs.map(document => {
    const data = document.data() || {};
    const id = data.id == null || String(data.id).trim() === "" ? document.id : data.id;
    return { ...data, id, _docId: document.id };
  });
  catalogCache = { loadedAt: Date.now(), products };
  return products;
}

function plainText(value, maxLength = 180) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function formatPrice(value) {
  const price = plainText(value, 80);
  if (!price || /استفسار|حسب الطلب/i.test(price)) return "يُؤكَّد من المتجر";
  if (/(?:EGP|LE|ج\.?\s?م|جنيه)/i.test(price)) return price;
  return price + " ج.م";
}

function formatAvailability(product) {
  if (product.stock === null || product.stock === undefined || String(product.stock).trim() === "") return "يُؤكَّد من المتجر";
  const stock = Number(product.stock);
  if (!Number.isInteger(stock) || stock < 0) return "يُؤكَّد من المتجر";
  return stock > 0 ? "متوفر حسب البيانات المسجلة" : "غير متوفر حسب البيانات المسجلة";
}

function productSummary(product) {
  const description = plainText(product.description || product.desc, 240);
  if (description) return description;

  const raw = product.specs;
  let rows = [];
  if (Array.isArray(raw)) {
    rows = raw.slice(0, 2).map(item => {
      const name = plainText(item && item.name || "مواصفة", 50);
      const value = plainText(item && item.value, 100);
      return name && value ? name + ": " + value : "";
    });
  } else if (raw && typeof raw === "object") {
    rows = Object.keys(raw).slice(0, 2).map(name => plainText(name, 50) + ": " + plainText(raw[name], 100));
  } else {
    rows = String(raw || "").split(/\r?\n/).slice(0, 2).map(line => plainText(line, 150));
  }
  return rows.filter(Boolean).join("؛ ").slice(0, 240);
}

function productLink(product) {
  const id = product.id == null || String(product.id).trim() === "" ? product._docId : product.id;
  return PRODUCT_SITE_ORIGIN + "/product?id=" + encodeURIComponent(String(id || ""));
}

function buildReply(query, products) {
  const normalized = normalize(query);
  if (/^(السلام عليكم|سلام|اهلا|اهلين|مرحبا|صباح الخير|مساء الخير)$/.test(normalized)) {
    return "وعليكم السلام 👋 أهلاً بيك في الدولي. ابعت اسم المنتج أو الماركة أو رقم الموديل، وهبحث لك في الكتالوج.";
  }

  const matches = findProducts(products, query);
  if (!matches.length) {
    return "أهلاً بيك في الدولي 👋 مش لاقي تطابق موثوق لطلبك في الكتالوج. ابعت اسم المنتج أو الماركة أو رقم الموديل، أو وضّح استخدامه والخامة اللي هتشتغل عليها.";
  }

  const blocks = matches.map((product, index) => {
    const name = plainText(product.name || "منتج من الدولي");
    const brand = plainText(product.brand || product.brandName || product.manufacturer, 80);
    const summary = productSummary(product);
    return [
      (index + 1) + ") " + name + (brand ? " — " + brand : ""),
      summary,
      "السعر: " + formatPrice(product.price),
      "التوفر: " + formatAvailability(product),
      productLink(product)
    ].join("\n");
  });

  return [
    "أهلاً بيك في الدولي 👋 لقيت المنتجات الأقرب لطلبك:",
    "",
    blocks.join("\n\n"),
    "",
    "لو تقصد مقاس أو موديل محدد، ابعتهولي. السعر والتوفر النهائي يؤكدهما المتجر."
  ].join("\n").slice(0, 3900);
}

function messageText(message) {
  if (message.type === "text") return plainText(message.text && message.text.body, 1000);
  if (message.type === "button") return plainText(message.button && (message.button.text || message.button.payload), 1000);
  if (message.type === "interactive") {
    const interactive = message.interactive || {};
    return plainText(
      interactive.button_reply && interactive.button_reply.title ||
      interactive.list_reply && interactive.list_reply.title,
      1000
    );
  }
  return "";
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left == null ? "" : left));
  const b = Buffer.from(String(right == null ? "" : right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function validSignature(rawBody, signatureHeader, appSecret) {
  const match = /^sha256=([a-f0-9]{64})$/i.exec(String(signatureHeader || ""));
  if (!match) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const received = Buffer.from(match[1], "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function claimWebhookEvent(eventRef) {
  return getFirestore().runTransaction(async transaction => {
    const snapshot = await transaction.get(eventRef);
    const event = snapshot.exists ? snapshot.data() || {} : {};
    const ageMs = Date.now() - Number(event.claimedAtMs || 0);
    if (event.status === "sent") return false;
    if (event.status === "processing" && ageMs < PROCESSING_LEASE_MS) return false;
    transaction.set(eventRef, {
      status: "processing",
      claimedAtMs: Date.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + EVENT_RETENTION_MS),
      attemptCount: FieldValue.increment(1)
    }, { merge: true });
    return true;
  });
}

async function sendWhatsAppText(to, body) {
  const phoneNumberId = whatsappPhoneNumberId.value();
  const accessToken = whatsappAccessToken.value();
  if (!phoneNumberId || !accessToken) throw new Error("whatsapp-credentials-not-configured");

  const response = await fetch(
    "https://graph.facebook.com/" + GRAPH_API_VERSION + "/" + encodeURIComponent(phoneNumberId) + "/messages",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body }
      }),
      signal: AbortSignal.timeout(15000)
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error("WhatsApp rejected an automated product reply.", {
      httpStatus: response.status,
      errorCode: result.error && result.error.code || null
    });
    throw new Error("whatsapp-send-failed");
  }
  return result.messages && result.messages[0] && result.messages[0].id || "";
}

async function handleIncomingMessage(message) {
  const messageId = String(message && message.id || "");
  const sender = String(message && message.from || "").replace(/[^0-9]/g, "");
  if (!messageId || !/^\d{6,20}$/.test(sender)) return;

  const eventId = createHash("sha256").update(messageId).digest("hex");
  const eventRef = getFirestore().collection("whatsappWebhookEvents").doc(eventId);
  if (!await claimWebhookEvent(eventRef)) return;

  try {
    const text = messageText(message);
    let reply;
    if (!text) {
      reply = "أهلاً بيك في الدولي 👋 ابعت اسم المنتج أو الماركة أو رقم الموديل في رسالة نصية، وهبحث لك في الكتالوج.";
    } else {
      try {
        reply = buildReply(text, await loadProducts());
      } catch (error) {
        logger.error("WhatsApp product catalog lookup failed.", {
          error: plainText(error && error.message || "catalog-read-failed", 120)
        });
        reply = "الكتالوج مش متاح دلوقتي. جرّب تبعت اسم المنتج بعد شوية، أو ابعت رقم الموديل عشان فريقنا يساعدك.";
      }
    }

    const outboundMessageId = await sendWhatsAppText(sender, reply);
    await eventRef.set({
      status: "sent",
      outboundMessageId,
      completedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + EVENT_RETENTION_MS)
    }, { merge: true });
  } catch (error) {
    await eventRef.set({
      status: "failed",
      failedAt: FieldValue.serverTimestamp(),
      failure: plainText(error && error.message || "send-failed", 120),
      expiresAt: Timestamp.fromMillis(Date.now() + EVENT_RETENTION_MS)
    }, { merge: true }).catch(() => {});
    throw error;
  }
}

exports.whatsappProductAutoReply = onRequest(
  {
    region: "me-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
    invoker: "public",
    secrets: [whatsappAccessToken, whatsappPhoneNumberId, whatsappVerifyToken, whatsappAppSecret]
  },
  async (req, res) => {
    if (req.method === "GET") {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];
      const expectedToken = whatsappVerifyToken.value();
      if (!expectedToken) return res.status(503).send("Webhook is not configured.");
      if (mode === "subscribe" && challenge && constantTimeEqual(token, expectedToken)) {
        return res.status(200).send(String(challenge));
      }
      return res.status(403).send("Forbidden.");
    }

    if (req.method !== "POST") {
      res.set("Allow", "GET, POST");
      return res.status(405).send("Method not allowed.");
    }

    const appSecret = whatsappAppSecret.value();
    if (!appSecret) return res.status(503).send("Webhook is not configured.");
    if (!Buffer.isBuffer(req.rawBody) || !validSignature(
      req.rawBody,
      req.get("x-hub-signature-256"),
      appSecret
    )) return res.status(401).send("Invalid webhook signature.");

    const payload = req.body || {};
    if (payload.object !== "whatsapp_business_account") return res.status(200).send("EVENT_RECEIVED");

    const incoming = [];
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value || {};
        const receivedPhoneNumberId = String(value.metadata && value.metadata.phone_number_id || "");
        if (receivedPhoneNumberId && receivedPhoneNumberId !== whatsappPhoneNumberId.value()) continue;
        incoming.push(...(value.messages || []));
      }
    }

    try {
      await Promise.all(incoming.map(handleIncomingMessage));
      return res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
      logger.error("WhatsApp webhook message processing failed.", {
        error: plainText(error && error.message || "processing-failed", 120)
      });
      return res.status(500).send("Temporary processing error.");
    }
  }
);
