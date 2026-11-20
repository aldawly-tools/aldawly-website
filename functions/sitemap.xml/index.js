const PROJECT_ID = "wurth-29a1b";
const API_KEY = "AIzaSyBRkIA7yD9kYm9BKCdMDExvKtVDjsCMYV8";
const SITE = "https://aldawly-website.pages.dev";

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[char]);
}

function firestoreValue(value) {
  if (!value) return "";
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return value.integerValue;
  if (value.doubleValue !== undefined) return value.doubleValue;
  return "";
}

export async function onRequest() {
  const urls = new Map([
    [SITE + "/", ""],
    [SITE + "/products.html", ""],
    [SITE + "/advisor.html", ""]
  ]);

  try {
    let pageToken = "";
    do {
      const endpoint = new URL(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products`
      );
      endpoint.searchParams.set("pageSize", "1000");
      endpoint.searchParams.set("key", API_KEY);
      if (pageToken) endpoint.searchParams.set("pageToken", pageToken);

      const response = await fetch(endpoint.toString(), {
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error("Firestore products query failed: " + response.status);
      const payload = await response.json();

      for (const document of (payload.documents || [])) {
        const fields = document.fields || {};
        const id = firestoreValue(fields.id) || document.name.split("/").pop();
        if (id !== undefined && id !== null && String(id).trim() !== "") {
          const productUrl = SITE + "/product?id=" + encodeURIComponent(String(id).trim());
          const modified = document.updateTime ? String(document.updateTime).slice(0, 10) : "";
          urls.set(productUrl, modified);
        }
      }
      pageToken = payload.nextPageToken || "";
    } while (pageToken);
  } catch (error) {
    // Keep the core sitemap available even if Firestore is temporarily unavailable.
    console.error("Dynamic sitemap product lookup failed:", error);
  }

  const entries = Array.from(urls.entries()).map(([url, lastmod]) =>
    "  <url><loc>" + xmlEscape(url) + "</loc>" +
    (lastmod ? "<lastmod>" + xmlEscape(lastmod) + "</lastmod>" : "") +
    "</url>"
  ).join("\n");

  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries + "\n</urlset>\n",
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    }
  );
}
