const PROJECT_ID = "wurth-29a1b";
const API_KEY = "AIzaSyBRkIA7yD9kYm9BKCdMDExvKtVDjsCMY";

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  const id = String(new URL(context.request.url).searchParams.get("id") || "");
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    return new Response(JSON.stringify({ error: "Invalid product id" }), {
      status: 400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
  try {
    const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
      "/databases/(default)/documents/productViewCounts/" + encodeURIComponent(id) +
      "?key=" + encodeURIComponent(API_KEY);
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (response.status === 404) {
      return new Response(JSON.stringify({ total: 0 }), {
        status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
      });
    }
    if (!response.ok) throw new Error("Firestore returned " + response.status);
    const document = await response.json();
    const total = Number(document.fields && document.fields.total &&
      (document.fields.total.integerValue ?? document.fields.total.doubleValue)) || 0;
    return new Response(JSON.stringify({ total: Math.max(0, total) }), {
      status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  } catch (error) {
    console.error("Product view count unavailable:", error && error.message || error);
    return new Response(JSON.stringify({ error: "تعذر تحميل عدد المشاهدات." }), {
      status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
