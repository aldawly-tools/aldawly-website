import { getProductById, htmlEscape } from "./_lib/product-og.js";

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const id = requestUrl.searchParams.get("id");

  // Serve the real product detail HTML directly. Do not redirect to
  // /product.html: Cloudflare clean URLs can redirect that path back to
  // /product and create an ERR_TOO_MANY_REDIRECTS loop.
  let page;
  try {
    const assetUrl = new URL("/product.html", requestUrl.origin);
    const assetRequest = new Request(assetUrl.toString(), {
      method: "GET",
      headers: context.request.headers
    });
    page = await context.env.ASSETS.fetch(assetRequest);
  } catch (error) {
    console.error("Product detail asset error:", error);
    return new Response("تعذر تحميل صفحة تفاصيل المنتج", { status: 502 });
  }

  if (!page || !page.ok || !id) return page;

  try {
    const product = await getProductById(id);
    if (!product) return page;

    const name = String(product.name || "منتج من الدولي").slice(0, 120);
    const brand = String(product.brand || product.brandName || "");
    const description = String(product.desc || product.specs ||
      "تفاصيل المنتج من الدولي للعدد الأصلية والمستوردة").replace(/\\s+/g, " ").slice(0, 220);
    const imageUrl = product.image && /^https?:\\/\\//i.test(String(product.image))
      ? String(product.image)
      : new URL("/fb-product-image?id=" + encodeURIComponent(id), requestUrl.origin).toString();
    const canonical = new URL("/product?id=" + encodeURIComponent(id), requestUrl.origin).toString();

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
    ].join("\\n");

    const socialKeys = /(?:property|name)=["'](?:og:type|og:title|og:description|og:url|og:image|og:image:secure_url|og:image:alt|twitter:card|twitter:title|twitter:description|twitter:image)["']/i;
    const html = (await page.text())
      .replace(/<meta\\b[^>]*>/gi, tag => socialKeys.test(tag) ? "" : tag)
      .replace("</head>", tags + "\\n</head>");

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60, s-maxage=300"
      }
    });
  } catch (error) {
    console.error("Product social metadata error:", error);
    return page;
  }
}
