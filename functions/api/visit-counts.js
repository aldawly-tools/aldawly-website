const PROJECT_ID = "wurth-29a1b";
const API_KEY = "AIzaSyBRkIA7yD9kYm9BKCdMDExvKtVDjsCMYV8";

async function readCount(day) {
  const structuredQuery = { from: [{ collectionId: "siteVisits" }] };
  if (day) structuredQuery.where = {
    fieldFilter: {
      field: { fieldPath: "day" },
      op: "EQUAL",
      value: { stringValue: day }
    }
  };
  const endpoint = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
    "/databases/(default)/documents:runAggregationQuery?key=" + encodeURIComponent(API_KEY);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json" },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery,
        aggregations: [{ count: {}, alias: "count" }]
      }
    }),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("Firestore aggregation failed: " + response.status);
  const rows = await response.json();
  const value = rows?.[0]?.result?.aggregateFields?.count;
  const count = Number(value?.integerValue ?? value?.doubleValue ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  const day = new URL(context.request.url).searchParams.get("day") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Response(JSON.stringify({ error: "Invalid date" }), {
      status: 400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  try {
    const [total, today] = await Promise.all([readCount(""), readCount(day)]);
    return new Response(JSON.stringify({ total, today }), {
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
      status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
