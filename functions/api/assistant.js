const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};
function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:cors});
}
export async function onRequest({request, env}) {
  if (request.method === "OPTIONS") return new Response(null, {status:204, headers:cors});
  if (request.method !== "POST") return json({error:"Method not allowed"},405);
  if (!env.GEMINI_API_KEY) return json({error:"AI_NOT_CONFIGURED", message:"مساعد الذكاء الاصطناعي لم يتم تفعيله بعد."},503);
  try {
    const body = await request.json();
    const question = String(body.question || "").trim().slice(0,1200);
    const products = Array.isArray(body.products) ? body.products.slice(0,100) : [];
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    if (!question) return json({error:"EMPTY_QUESTION"},400);
    const catalog = products.map(p => ({
      id:String(p.id ?? ""),
      name:String(p.name ?? "").slice(0,180),
      brand:String(p.brand || p.brandName || p.manufacturer || "").slice(0,80),
      category:String(p.cat || p.category || "").slice(0,100),
      description:String(p.desc || p.description || "").slice(0,300),
      specifications:String(p.specs || "").slice(0,500),
      price:String(p.price ?? "").slice(0,50)
    }));
    const instruction = [
      "أنت مساعد مبيعات فني لمتجر الدولي للعدد الأصلية في مصر. تحدث باللهجة المصرية الواضحة والمهذبة.",
      "مهمتك فهم احتياج العميل ومساعدته في اختيار العدد اليدوية والكهربائية ومستلزماتها.",
      "اعتمد حصراً على بيانات كتالوج المنتجات المرفقة عند ذكر منتج أو سعر أو مقاس أو مواصفة أو توفر.",
      "ممنوع اختراع منتج أو سعر أو مقاس أو بلد منشأ أو توافق فني. لا تعتبر مجرد تشابه الكلمات تطابقاً.",
      "لا ترشح منتجاً إلا إذا كان اسمه أو وصفه أو مواصفاته تدعم بوضوح أنه مناسب لطلب العميل.",
      "إذا كان الطلب عاماً مثل (حاجة للخشب)، اسأل سؤال توضيح واحداً محدداً: هل يقصد بنطة أم منشار أم شفرة أم أداة أخرى؟ لا تعرض منتجات عشوائية.",
      "إذا لم تجد تطابقاً موثوقاً، قل ذلك بوضوح واسأل عن نوع الأداة أو الموديل أو صورة.",
      "إذا سأل عن بديل، رشح فقط منتجاً تتوافق مواصفاته المسجلة مع المطلوب؛ وإلا اطلب المقاس/الموديل.",
      "لا تعرض أكثر من 4 منتجات. لا تذكر أي منتج غير موجود في القائمة.",
      "أرجع JSON فقط بالشكل: {\"answer\":\"رد عربي مختصر\",\"productIds\":[\"id1\"]}. productIds يجب أن تكون IDs من القائمة فقط، وتكون [] إذا لم يوجد تطابق واضح."
    ].join("\n");
    const prompt = "كتالوج المنتجات (بيانات المتجر):\n" + JSON.stringify(catalog) +
      "\nسياق المحادثة السابق:\n" + JSON.stringify(history) +
      "\nسؤال العميل الحالي:\n" + question;
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
      body:JSON.stringify({
        system_instruction:{parts:[{text:instruction}]},
        contents:[{role:"user",parts:[{text:prompt}]}],
        generationConfig:{temperature:0.2,responseMimeType:"application/json"}
      })
    });
    const raw = await upstream.json();
    if (!upstream.ok) {
      return json({error:"AI_PROVIDER_ERROR", message:"تعذر الحصول على رد الذكاء الاصطناعي حالياً."},502);
    }
    const output = raw.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("") || "";
    const parsed = JSON.parse(output);
    const allowed = new Set(catalog.map(p=>p.id));
    const productIds = Array.isArray(parsed.productIds) ? parsed.productIds.map(String).filter(id=>allowed.has(id)).slice(0,4) : [];
    return json({answer:String(parsed.answer || "ممكن توضح نوع الأداة المطلوبة؟").slice(0,1200), productIds});
  } catch (error) {
    return json({error:"SERVER_ERROR", message:"حصلت مشكلة مؤقتة. حاول مرة أخرى."},500);
  }
}
