const PROJECT_ID = "wurth-29a1b";
const ALLOWED_EMAILS = new Set([
  "elgoharemahmoud@gmail.com",
  "ahmedelgohare90@gmail.com"
]);
const ALLOWED_ORIGINS = new Set([
  "https://aldawly-website.pages.dev",
  "https://aldawlytools.com.eg",
  "https://www.aldawlytools.com.eg"
]);
const GOOGLE_KEYS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

function json(data, status = 200, origin = "") {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin" };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-headers"] = "Authorization, Content-Type";
    headers["access-control-allow-methods"] = "POST, OPTIONS";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function verifyFirebaseToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("invalid-token");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  if (header.alg !== "RS256" || !header.kid) throw new Error("invalid-token");
  if (claims.aud !== PROJECT_ID || claims.iss !== "https://securetoken.google.com/" + PROJECT_ID) throw new Error("invalid-token");
  if (!claims.sub || typeof claims.sub !== "string" || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("expired-token");
  if (claims.iat > Math.floor(Date.now() / 1000) + 60) throw new Error("invalid-token");
  const keyResponse = await fetch(GOOGLE_KEYS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!keyResponse.ok) throw new Error("key-fetch-failed");
  const keySet = await keyResponse.json();
  const jwk = (keySet.keys || []).find(key => key.kid === header.kid);
  if (!jwk) throw new Error("unknown-key");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!valid) throw new Error("invalid-signature");
  const email = String(claims.email || "").toLowerCase();
  if (claims.email_verified !== true || !ALLOWED_EMAILS.has(email)) throw new Error("not-admin");
  return claims;
}

function safeText(value, max) {
  return String(value == null ? "" : value).slice(0, max);
}

export async function onRequest(context) {
  const request = context.request;
  const origin = request.headers.get("Origin") || "";
  if (request.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "Authorization, Content-Type",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-max-age": "86400",
      "vary": "Origin"
    }});
  }
  if (request.method !== "POST") return json({ error: "الطلب غير مدعوم." }, 405, origin);
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "مصدر الطلب غير مسموح." }, 403, origin);
  try {
    const authorization = request.headers.get("Authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return json({ error: "سجّل الدخول بحساب الإدارة أولًا." }, 401, origin);
    try {
      await verifyFirebaseToken(match[1]);
    } catch (error) {
      const denied = error && error.message === "not-admin";
      return json({ error: denied ? "هذا الحساب غير مصرح له بتحليل صور المنتجات." : "انتهت جلسة الدخول أو تعذر التحقق منها. سجّل الدخول مرة أخرى." }, denied ? 403 : 401, origin);
    }
    const body = await request.json();
    const image = body && body.image;
    const mimeType = String(body && body.mimeType || "");
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType) || typeof image !== "string" || image.length > 11_500_000) {
      return json({ error: "الصورة غير صالحة أو حجمها أكبر من المسموح." }, 400, origin);
    }
    const encoded = image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!encoded) return json({ error: "تعذر قراءة صيغة الصورة." }, 400, origin);
    if (!context.env.GEMINI_API_KEY) return json({ error: "مفتاح خدمة الذكاء الاصطناعي غير مضبوط على Cloudflare بعد." }, 503, origin);
    const prompt = "أنت خبير في العدد اليدوية والكهربائية ومستلزمات الورش والمعدات الصناعية. حلل صورة المنتج فقط. أعد JSON بالعربية بالمفاتيح: name (اسم مقترح قصير)، brand (الماركة فقط إذا كان الشعار مقروءا بوضوح وإلا فارغ)، category (واحدة من: عدد يدوية، عدد كهربائية، مستلزمات الورش، قياس)، description (وصف تسويقي واقعي دون اختلاق)، specifications (مصفوفة عناصر name/value للمعلومات المقروءة أو المؤكدة بصريا فقط)، notes (تنبيه مختصر لأي شيء غير مؤكد). لا تخمن الموديل أو بلد المنشأ أو المقاسات أو عدد القطع. إذا لم تتضح معلومة فاتركها فارغة.";
    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(context.env.GEMINI_API_KEY), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: encoded[2] } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 1200 }
      }),
      signal: AbortSignal.timeout(45000)
    });
    const aiData = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      console.error("Gemini image analysis failed", aiResponse.status);
      return json({ error: "خدمة تحليل الصور لم تستجب. راجع مفتاح Gemini وحدود الاستخدام." }, 502, origin);
    }
    const output = aiData.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
    const product = JSON.parse(output);
    return json({ product: {
      name: safeText(product.name, 140),
      brand: safeText(product.brand, 80),
      category: ["عدد يدوية", "عدد كهربائية", "مستلزمات الورش", "قياس"].includes(product.category) ? product.category : "مستلزمات الورش",
      description: safeText(product.description, 1200),
      specifications: Array.isArray(product.specifications) ? product.specifications.slice(0, 12).map(item => ({ name: safeText(item.name, 60), value: safeText(item.value, 120) })).filter(item => item.name && item.value) : [],
      notes: safeText(product.notes, 300)
    }}, 200, origin);
  } catch (error) {
    console.error("Cloudflare product image analysis error:", error?.message || error);
    return json({ error: "حدث خطأ أثناء تحليل الصورة. حاول مرة أخرى." }, 500, origin);
  }
}
