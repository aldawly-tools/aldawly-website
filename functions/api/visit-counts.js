const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function cairoDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  return value("year") + "-" + value("month") + "-" + value("day");
}

function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(day + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

export async function onRequest({ request, env }) {
  if (!env.VISITS_DB) return json({ error: "Visit counter database is not configured." }, 503);

  if (request.method === "POST") {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (origin) {
      try {
        if (new URL(origin).origin !== requestUrl.origin) return json({ error: "Forbidden." }, 403);
      } catch {
        return json({ error: "Invalid Origin." }, 403);
      }
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
    const visitorId = String(body.visitorId || "");
    if (!/^[A-Za-z0-9-]{16,80}$/.test(visitorId)) {
      return json({ error: "Invalid visit data." }, 400);
    }
    const day = cairoDay();
    try {
      await env.VISITS_DB.prepare(
        "INSERT OR IGNORE INTO site_visits (visitor_id, visit_day, created_at) VALUES (?, ?, ?)"
      ).bind(visitorId, day, new Date().toISOString()).run();
      return json({ ok: true }, 201);
    } catch (error) {
      console.error("Could not record visit:", error);
      return json({ error: "Could not record visit." }, 503);
    }
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405, headers: { ...JSON_HEADERS, allow: "GET, POST" }
    });
  }

  const day = new URL(request.url).searchParams.get("day") || "";
  if (!validDay(day)) return json({ error: "Invalid date." }, 400);

  try {
    const [total, today] = await Promise.all([
      env.VISITS_DB.prepare("SELECT COUNT(*) AS count FROM site_visits").first(),
      env.VISITS_DB.prepare("SELECT COUNT(*) AS count FROM site_visits WHERE visit_day = ?").bind(day).first()
    ]);
    return json({ total: Number(total?.count) || 0, today: Number(today?.count) || 0 });
  } catch (error) {
    console.error("Could not read visit totals:", error);
    return json({ error: "تعذر تحميل أرقام الزيارات حاليًا." }, 503);
  }
}
