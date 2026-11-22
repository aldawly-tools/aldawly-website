const COUNTS_FUNCTION = "https://me-central1-wurth-29a1b.cloudfunctions.net/getPublicVisitCounts";

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "allow": "GET", "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  const day = new URL(context.request.url).searchParams.get("day") || "";
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day)) {
    return new Response(JSON.stringify({ error: "Invalid date" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  try {
    const endpoint = new URL(COUNTS_FUNCTION);
    endpoint.searchParams.set("day", day);
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: { "accept": "application/json" },
      signal: AbortSignal.timeout(12000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Visitor aggregation function returned " + response.status);
    return new Response(JSON.stringify({
      total: Math.max(0, Number(payload.total) || 0),
      today: Math.max(0, Number(payload.today) || 0)
    }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "https://aldawly-website.pages.dev",
        "vary": "Origin"
      }
    });
  } catch (error) {
    console.error("Public visit count unavailable:", error?.message || error);
    return new Response(JSON.stringify({ error: "تعذر تحميل أرقام الزيارات حاليًا." }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
