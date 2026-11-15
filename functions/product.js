import { getProductById, htmlEscape } from "./_lib/product-og.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");
  const assetUrl = new URL("/product.html" + url.search, url.origin);
  let page;
  try {
    const assetRequest = new Request(assetUrl.toString(), context.request);
    page = context.env.ASSETS
      ? await context.env.ASSETS.fetch(assetRequest)
      : await fetch(assetRequest);
  } catch (_) {
    return new Response("تعذر تحميل صفحة المنتج", { status: 502 });
  }
  if (!id) return page;

  try {
    const product = await getProductById(id);
    if (!product) return page;
    const name = String(product.name || "منتج من الدولي").slice(0, 120);
    const brand = String(product.brand || product.brandName || "");
    const description = String(product.desc || product.specs || "تفاصيل المنتج من الدولي للعدد الأصلية والمستوردة").replace(/\s+/g, " ").slice(0, 220);
    const imageUrl = product.image && /^https?:\/\//i.test(product.image)
      ? product.image
      : "https://aldawly-website.pages.dev/fb-product-image?id=" + encodeURIComponent(id);
    const canonical = "https://aldawly-website.pages.dev/product?id=" + encodeURIComponent(id);
    const tags = [
      '<meta property="og:type" content="product">',
      '<meta property="og:title" content="' + htmlEscape(name + (brand ? " | " + brand : "") + " | الدولي") + '">',
      '<meta property="og:description" content="' + htmlEscape(description) + '">',
      '<meta property="og:url" content="' + htmlEscape(canonical) + '">',
      '<meta property="og:image" content="' + htmlEscape(imageUrl) + '">',
      '<meta property="og:image:secure_url" content="' + htmlEscape(imageUrl) + '">',
      '<meta property="og:image:alt" content="' + htmlEscape(name) + '">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="' + htmlEscape(name + " | الدولي") + '">',
      '<meta name="twitter:description" content="' + htmlEscape(description) + '">',
      '<meta name="twitter:image" content="' + htmlEscape(imageUrl) + '">'
    ].join("\n");
    const socialKeys = /(?:property|name)=["'](?:og:type|og:title|og:description|og:url|og:image|og:image:secure_url|og:image:alt|twitter:card|twitter:title|twitter:description|twitter:image)["']/i;
    const baseHtml = (await page.text()).replace(/<meta\b[^>]*>/gi, function(tag) { return socialKeys.test(tag) ? "" : tag; });
    const html = baseHtml.replace("</head>", tags + "\n</head>");
    return new Response(html, {
      status: page.status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=900" }
    });
  } catch (error) {
    console.error("Product social preview error:", error);
    return page;
  }
}
