import { listProducts } from "../_lib/product-og.js";

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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
}

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
  const products = await listProducts();
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
  const a = new TextEncoder().encode(String(left == null ? "" : left));
  const b = new TextEncoder().encode(String(right == null ? "" : right));
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function validSignature(rawBody, signatureHeader, appSecret) {
  const match = /^sha256=([a-f0-9]{64})$/i.exec(String(signatureHeader || ""));
  if (!match) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const expected = toHex(await crypto.subtle.sign("HMAC", key, rawBody));
  return constantTimeEqual(expected, match[1].toLowerCase());
}

async function claimWebhookEvent(db, messageId) {
  const now = Date.now();
  await db.prepare("DELETE FROM whatsapp_webhook_events WHERE expires_at <= ?").bind(now).run();
  const result = await db.prepare(
    "INSERT INTO whatsapp_webhook_events (message_id, status, claimed_at, expires_at, attempts) " +
    "VALUES (?, 'processing', ?, ?, 1) " +
    "ON CONFLICT(message_id) DO UPDATE SET status = 'processing', claimed_at = excluded.claimed_at, " +
    "expires_at = excluded.expires_at, attempts = whatsapp_webhook_events.attempts + 1 " +
    "WHERE whatsapp_webhook_events.status <> 'sent' AND " +
    "(whatsapp_webhook_events.status <> 'processing' OR whatsapp_webhook_events.claimed_at < ?)"
  ).bind(messageId, now, now + EVENT_RETENTION_MS, now - PROCESSING_LEASE_MS).run();
  return Number(result && result.meta && result.meta.changes) > 0;
}

async function sendWhatsAppText(env, to, body) {
  const phoneNumberId = String(env.WHATSAPP_PHONE_NUMBER_ID || "");
  const accessToken = String(env.WHATSAPP_ACCESS_TOKEN || "");
  if (!phoneNumberId || !accessToken) throw new Error("whatsapp-credentials-not-configured");
  const response = await fetch(
    "https://graph.facebook.com/" + GRAPH_API_VERSION + "/" + encodeURIComponent(phoneNumberId) + "/messages",
    {
      method: "POST",
      headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body }
      })
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("WhatsApp rejected an automated product reply.", {
      httpStatus: response.status,
      errorCode: result.error && result.error.code || null
    });
    throw new Error("whatsapp-send-failed");
  }
  return result.messages && result.messages[0] && result.messages[0].id || "";
}

async function handleIncomingMessage(env, message) {
  const messageId = String(message && message.id || "");
  const sender = String(message && message.from || "").replace(/[^0-9]/g, "");
  if (!messageId || messageId.length > 200 || !/^\d{6,20}$/.test(sender)) return;
  if (!await claimWebhookEvent(env.DB, messageId)) return;
  try {
    const incomingText = messageText(message);
    let reply;
    if (!incomingText) {
      reply = "أهلاً بيك في الدولي 👋 ابعت اسم المنتج أو الماركة أو رقم الموديل في رسالة نصية، وهبحث لك في الكتالوج.";
    } else {
      try {
        reply = buildReply(incomingText, await loadProducts());
      } catch (error) {
        console.error("WhatsApp product catalog lookup failed:", error && error.message || "catalog-read-failed");
        reply = "الكتالوج مش متاح دلوقتي. جرّب تبعت اسم المنتج بعد شوية، أو ابعت رقم الموديل عشان فريقنا يساعدك.";
      }
    }
    const outboundMessageId = await sendWhatsAppText(env, sender, reply);
    await env.DB.prepare(
      "UPDATE whatsapp_webhook_events SET status = 'sent', outbound_message_id = ?, completed_at = ? WHERE message_id = ?"
    ).bind(outboundMessageId, Date.now(), messageId).run();
  } catch (error) {
    await env.DB.prepare(
      "UPDATE whatsapp_webhook_events SET status = 'failed', completed_at = ? WHERE message_id = ?"
    ).bind(Date.now(), messageId).run().catch(() => {});
    throw error;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method === "GET") {
    const expectedToken = String(env.WHATSAPP_VERIFY_TOKEN || "");
    if (!expectedToken) return text("Webhook is not configured.", 503);
    if (url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.has("hub.challenge") &&
        constantTimeEqual(url.searchParams.get("hub.verify_token"), expectedToken)) {
      return text(url.searchParams.get("hub.challenge"));
    }
    return text("Forbidden.", 403);
  }
  if (request.method !== "POST") return text("Method not allowed.", 405);
  if (!env.DB || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_APP_SECRET) {
    return text("Webhook is not configured.", 503);
  }
  let rawBody;
  try {
    rawBody = await request.arrayBuffer();
  } catch (_) {
    return text("Invalid request body.", 400);
  }
  if (rawBody.byteLength > 1_000_000) return text("Request body is too large.", 413);
  if (!await validSignature(rawBody, request.headers.get("x-hub-signature-256"), String(env.WHATSAPP_APP_SECRET))) {
    return text("Invalid webhook signature.", 401);
  }
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch (_) {
    return text("Invalid JSON.", 400);
  }
  if (payload.object !== "whatsapp_business_account") return text("EVENT_RECEIVED");
  const incoming = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value || {};
      const receivedPhoneNumberId = String(value.metadata && value.metadata.phone_number_id || "");
      if (receivedPhoneNumberId && receivedPhoneNumberId !== String(env.WHATSAPP_PHONE_NUMBER_ID)) continue;
      incoming.push(...(value.messages || []));
    }
  }
  try {
    await Promise.all(incoming.map(message => handleIncomingMessage(env, message)));
    return text("EVENT_RECEIVED");
  } catch (error) {
    console.error("WhatsApp webhook message processing failed:", error && error.message || "processing-failed");
    return text("Temporary processing error.", 500);
  }
}
