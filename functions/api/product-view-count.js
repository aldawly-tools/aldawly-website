function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function cairoDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  return value("year") + "-" + value("month") + "-" + value("day");
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "قاعدة عداد المشاهدات غير مربوطة بعد." }, 503);

  const url = new URL(request.url);
  if (request.method === "POST") {
    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).origin !== url.origin) return json({ error: "Forbidden" }, 403);
    let body;
    try { body = await request.json(); } catch (_) { return json({ error: "Invalid JSON" }, 400); }
    const id = String(body.productId || "");
    const visitorId = String(body.visitorId || "");
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !/^[a-zA-Z0-9_-]{16,100}$/.test(visitorId)) {
      return json({ error: "Invalid product or visitor id" }, 400);
    }
    const day = cairoDay();
    try {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO product_views (visitor_id, product_id, view_day) VALUES (?, ?, ?)"
      ).bind(visitorId, id, day).run();
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM product_views WHERE product_id = ?"
      ).bind(id).first();
      return json({ total: Number(row && row.total) || 0 });
    } catch (error) {
      console.error("Product view insert failed:", error && error.message || error);
      return json({ error: "تعذر تسجيل مشاهدة المنتج." }, 500);
    }
  }

  if (request.method === "GET") {
    const topLimit = Number(url.searchParams.get("top") || 0);
    if (topLimit > 0) {
      const limit = Math.max(1, Math.min(50, Math.floor(topLimit)));
      try {
        const result = await env.DB.prepare(
          "SELECT product_id, COUNT(*) AS total FROM product_views GROUP BY product_id ORDER BY total DESC, product_id ASC LIMIT ?"
        ).bind(limit).all();
        return json({ items: (result.results || []).map(row => ({
          productId: String(row.product_id),
          total: Number(row.total) || 0
        })) });
      } catch (error) {
        console.error("Product view ranking failed:", error && error.message || error);
        return json({ error: "تعذر تحميل ترتيب مشاهدات المنتجات." }, 500);
      }
    }
    const id = String(url.searchParams.get("id") || "");
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return json({ error: "Invalid product id" }, 400);
    try {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM product_views WHERE product_id = ?"
      ).bind(id).first();
      return json({ total: Number(row && row.total) || 0 });
    } catch (error) {
      console.error("Product view count failed:", error && error.message || error);
      return json({ error: "تعذر تحميل عدد المشاهدات." }, 500);
    }
  }

  return json({ error: "Method not allowed" }, 405);
}
