import { listProducts, htmlEscape } from "./_lib/product-og.js";

const ORIGIN = "https://aldawly-website.pages.dev";

function xml(value) {
  return htmlEscape(value).replace(/&#39;/g, "&apos;");
}

function isPublicProduct(product) {
  if (!product || product.id == null || String(product.id).trim() === "") return false;
  if (product.isActive === false || product.hidden === true || product.deleted === true) return false;
  // Respect publication flags when present, while keeping legacy products visible.
  if (product.published === false || product.isPublished === false) return false;
  return true;
}

export async function onRequest() {
  try {
    const products = await listProducts();
    const urls = [
      { loc: ORIGIN + "/", changefreq: "daily", priority: "1.0" },
      { loc: ORIGIN + "/products.html", changefreq: "daily", priority: "0.9" },
      { loc: ORIGIN + "/advisor.html", changefreq: "monthly", priority: "0.6" }
    ];

    products.filter(isPublicProduct).forEach(product => {
      urls.push({
        loc: ORIGIN + "/product?id=" + encodeURIComponent(String(product.id)),
        changefreq: "weekly",
        priority: "0.8"
      });
    });

    const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(item => [
        "  <url>",
        "    <loc>" + xml(item.loc) + "</loc>",
        "    <changefreq>" + item.changefreq + "</changefreq>",
        "    <priority>" + item.priority + "</priority>",
        "  </url>"
      ].join("\n")).join("\n") +
      "\n</urlset>\n";

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Dynamic sitemap generation failed:", error);
    return new Response("Sitemap generation temporarily unavailable", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
