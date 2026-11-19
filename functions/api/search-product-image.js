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
    const body = await request.json();
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

    const prompt = "أنت فني متخصص في العدد اليدوية والكهربائية. المطلوب مطابقة صورة العميل مع منتج حقيقي من القائمة، وليس اقتراح أداة من نفس المجال فقط.\nقواعد صارمة: 1) حدد نوع الأداة ووظيفتها أولا. 2) لا تعتبر المنتج مطابقا لمجرد أن اسمه قريب أو لونه مشابه. 3) طابق الشكل والبنية وعدد القطع والرأس/الفك/الشفرة/الملحقات الظاهرة، ثم الماركة والموديل إذا كانا واضحين. 4) اقرأ أوصاف ومواصفات وأكواد المنتج؛ لا تتجاهلها. 5) إذا كانت الصورة أو بيانات المنتج لا تكفي لإثبات التطابق، أعد matches فارغة. 6) لا ترفع الثقة لمجرد أن هذا أفضل خيار متاح؛ الثقة يجب أن تعبر عن تطابق حقيقي. 7) أعد منتجا واحدا فقط إذا كان واضحا، أو منتجين كحد أقصى إذا كانا متقاربين فعلا. 8) لا تخترع مواصفات أو أكواد.\nأعد JSON فقط: {\"matches\":[{\"i\":رقم المنتج من القائمة,\"confidence\":0 إلى 100,\"reason\":\"سبب محدد للتطابق بالعربية\"}],\"identified\":\"وصف دقيق لما يظهر بالصورة\",\"brand\":\"الماركة المقروءة أو فارغ\",\"keywords\":[\"كلمات بحث\"]}.\nلا ترجع نتيجة إلا إذا كان نوع الأداة ووظيفتها متطابقين بوضوح؛ عند الشك أعد قائمة فارغة. القائمة: " + JSON.stringify(catalog)

    const encoded = image.slice(image.indexOf(",") + 1);
    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(context.env.GEMINI_API_KEY), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: encoded } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 1600 }
      }),
      signal: AbortSignal.timeout(45000)
    });
    const data = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      console.error("Gemini visual search failed", aiResponse.status);
      return reply({ error: "تعذر على خدمة الذكاء الاصطناعي تحليل الصورة الآن. حاول مرة أخرى بعد قليل." }, 502, origin);
    }
    const output = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
    const parsed = JSON.parse(output);
    const matches = Array.isArray(parsed.matches) ? parsed.matches.slice(0, 2).map(match => ({
      i: Number(match.i),
      confidence: Math.max(0, Math.min(100, Number(match.confidence) || 0)),
      reason: clean(match.reason, 130)
    })).filter(match => Number.isInteger(match.i) && match.i >= 0 && match.i < candidates.length && match.confidence >= 78) : [];
    return reply({
      matches,
      identified: clean(parsed.identified, 180),
      brand: clean(parsed.brand, 70),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8).map(x => clean(x, 45)) : []
    }, 200, origin);
  } catch (error) {
    console.error("Gemini visual search error:", error?.message || error);
    return reply({ error: "حدث خطأ أثناء البحث بالصورة. حاول بصورة أوضح." }, 500, origin);
  }
}
