const ALLOWED_ORIGINS = new Set([
  "https://aldawly-website.pages.dev",
  "https://aldawlytools.com.eg",
  "https://www.aldawlytools.com.eg"
]);
const recentRequests = new Map();

function reply(data, status, origin) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin" };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-headers"] = "Content-Type";
    headers["access-control-allow-methods"] = "POST, OPTIONS";
  }
  return new Response(JSON.stringify(data), { status: status || 200, headers });
}

function clean(value, max) {
  return String(value == null ? "" : value).replace(/[<>]/g, " ").slice(0, max);
}

export async function onRequest(context) {
  const request = context.request;
  const origin = request.headers.get("Origin") || "";
  if (request.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "Content-Type",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-max-age": "86400",
      "vary": "Origin"
    }});
  }
  if (request.method !== "POST") return reply({ error: "الطلب غير مدعوم." }, 405, origin);
  if (!ALLOWED_ORIGINS.has(origin)) return reply({ error: "مصدر الطلب غير مسموح." }, 403, origin);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const recent = (recentRequests.get(ip) || []).filter(time => now - time < 60000);
  if (recent.length >= 8) return reply({ error: "تم إجراء عمليات بحث كثيرة. انتظر دقيقة ثم حاول مرة أخرى." }, 429, origin);
  recent.push(now);
  recentRequests.set(ip, recent);
  if (recentRequests.size > 2000) {
    for (const [key, times] of recentRequests) if (!times.length || now - times[times.length - 1] > 60000) recentRequests.delete(key);
  }

  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 5_500_000) return reply({ error: "حجم الصورة أو بيانات المنتجات أكبر من المسموح." }, 413, origin);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 5_500_000) {
      return reply({ error: "حجم الصورة أو بيانات المنتجات أكبر من المسموح." }, 413, origin);
    }
    let body;
    try { body = JSON.parse(rawBody); }
    catch (_) { return reply({ error: "بيانات البحث غير صالحة." }, 400, origin); }
    const image = body && body.image;
    const mimeType = String(body && body.mimeType || "");
    const candidates = Array.isArray(body && body.products) ? body.products.slice(0, 500) : [];
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType) ||
        typeof image !== "string" || image.length > 5_000_000 ||
        !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) ||
        !candidates.length) {
      return reply({ error: "الصورة أو قائمة المنتجات غير صالحة." }, 400, origin);
    }
    if (!context.env.GEMINI_API_KEY) return reply({ error: "خدمة البحث الذكي غير مفعلة على الخادم." }, 503, origin);

    const catalog = candidates.map((p, index) => ({
      i: index,
      n: clean(p && p.name, 110),
      b: clean(p && p.brand, 50),
      c: clean(p && p.category, 55),
      d: clean(p && (p.description || p.desc || p.details), 220),
      specs: clean(p && (p.specs || p.features || p.technicalDetails), 180),
      code: clean(p && (p.code || p.sku || p.productCode || p.barcode || p.model || p.partNumber), 55)
    })).filter(p => p.n);

    const encoded = image.slice(image.indexOf(",") + 1);
    const model = "gemini-3.8-flash";
    async function askGemini(parts, maxOutputTokens) {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(context.env.GEMINI_API_KEY), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.05, maxOutputTokens },
        }),
        signal: AbortSignal.timeout(45000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const apiMessage = clean(result.error && result.error.message, 260);
        console.error("Gemini visual search failed", response.status, apiMessage);
        const publicMessage = response.status === 429 ? "خدمة البحث الذكي وصلت للحد المؤقت للاستخدام. انتظر دقيقة ثم حاول مرة أخرى." : response.status === 403 || response.status === 401 ? "مفتاح خدمة الذكاء الاصطناعي غير صالح أو لا يملك صلاحية الاستخدام. راجع GEMINI_API_KEY في Cloudflare." : response.status === 404 ? "موديل Gemini المحدد غير متاح لهذا المفتاح. راجع إعداد الموديل وصلاحية المفتاح." : "فشل تحليل الصورة من Gemini (HTTP " + response.status + "). " + (apiMessage || "راجع إعدادات مفتاح Gemini وحصته في Cloudflare.");
        throw Object.assign(new Error(publicMessage), { status: response.status, apiMessage });
      }
      const output = result.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
      if (!output) throw new Error("لم ترجع خدمة الذكاء الاصطناعي وصفًا للصورة. جرّب صورة أوضح.");
      try { return JSON.parse(output); }
      catch (_) { throw new Error("تعذر قراءة نتيجة تحليل الصورة. حاول مرة أخرى بصورة أوضح."); }
    }

    // Stage 1: identify the photographed object without showing the model the store catalog.
    const vision = await askGemini([
      { text: "حلل الصورة فقط دون محاولة تخمين منتجات متجر. أعد JSON فقط بهذا الشكل: {\\"object_type\\":\\"نوع الشيء المحدد\\",\\"brand\\":\\"العلامة الظاهرة أو فارغ\\",\\"model\\":\\"الموديل أو الكود الظاهر أو فارغ\\",\\"visual_features\\":[\\"سمات مميزة مرئية\\"]}. اذكر ما تراه فعلاً. إذا كانت الصورة غير واضحة أو لا تحتوي على أداة، قل ذلك صراحة ولا تخترع علامة أو موديل." },
      { inline_data: { mime_type: mimeType, data: encoded } }
    ], 500);
    const objectType = clean(vision.object_type, 120);
    const visibleBrand = clean(vision.brand, 70);
    const visibleModel = clean(vision.model, 70);
    const visualFeatures = Array.isArray(vision.visual_features) ? vision.visual_features.slice(0, 6).map(x => clean(x, 90)) : [];
    if (!objectType || /غير واضحة|لا يمكن|غير معروف|لا يظهر/i.test(objectType)) {
      return reply({ matches: [], identified: objectType || "الصورة غير واضحة بما يكفي للتعرف على الأداة.", brand: visibleBrand, keywords: visualFeatures }, 200, origin);
    }

    // Stage 2: compare the independently identified object against catalog records.
    const prompt = "أنت مدقق مطابقة منتجات، ومهمتك منع النتائج الخاطئة. تحليل الصورة المستقل: نوع الشيء=" + objectType + "؛ العلامة الظاهرة=" + (visibleBrand || "غير واضحة") + "؛ الموديل الظاهر=" + (visibleModel || "غير واضح") + "؛ السمات المرئية=" + JSON.stringify(visualFeatures) + ".\nقارن هذا الوصف مع المنتجات التالية. شروط إلزامية: لا تطابق منتجاً من فئة أو وظيفة مختلفة. لا تعتبر تشابه اللون أو الشكل العام أو كلمة مشتركة دليلاً كافياً. إذا اختلف نوع الأداة أو استخدامها فاستبعد المنتج. إذا كانت العلامة أو الموديل واضحين فلا تختر منتجاً بعلامة/موديل مختلف. إذا لم يوجد تطابق قوي أعد matches فارغة. أعد منتجاً واحداً فقط غالباً، واثنين كحد أقصى إذا كانا متقاربين فعلاً. confidence يعبر عن تطابق النوع والوظيفة والسمات، وليس مجرد قرب بصري. لا تخترع معلومات. أعد JSON فقط: {\\"matches\\":[{\\"i\\":رقم المنتج كما في القائمة،\\"confidence\\":0 إلى 100،\\"reason\\":\\"سبب محدد بالعربية يوضح تطابق النوع والوظيفة\\ "}]}\nقائمة المنتجات: " + JSON.stringify(catalog);
    const parsed = await askGemini([{ text: prompt }], 900);
    const matches = Array.isArray(parsed.matches) ? parsed.matches.slice(0, 2).map(match => ({
      i: Number(match.i),
      confidence: Math.max(0, Math.min(100, Number(match.confidence) || 0)),
      reason: clean(match.reason, 130)
    })).filter(match => Number.isInteger(match.i) && match.i >= 0 && match.i < candidates.length && match.confidence >= 86) : [];
    return reply({
      matches,
      identified: objectType + (visibleModel ? " — " + visibleModel : ""),
      brand: visibleBrand,
      keywords: visualFeatures
    }, 200, origin);
  } catch (error) {
    console.error("Gemini visual search error:", error?.message || error);
    return reply({ error: clean(error?.message || "حدث خطأ أثناء البحث بالصورة. حاول بصورة أوضح.", 300) }, error?.status === 429 ? 429 : 500, origin);
  }
}
