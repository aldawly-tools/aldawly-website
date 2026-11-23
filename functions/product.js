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
    const rawDescription = String(product.desc || product.specs ||
      "عدد وأدوات أصلية ومستوردة للاستخدام المهني").replace(/\s+/g, " ").trim();
    const description = (rawDescription + (brand ? " — " + brand : "") +
      " | متوفر لدى الدولي للعدد الأصلية والمستوردة في مصر.").slice(0, 220);
    const imageUrl = product.image && /^https?:\/\//i.test(String(product.image))
      ? String(product.image)
      : new URL("/fb-product-image?id=" + encodeURIComponent(id), requestUrl.origin).toString();
    const canonical = new URL("/product?id=" + encodeURIComponent(id), requestUrl.origin).toString();

    const title = name + (brand ? " | " + brand : "") + " | الدولي للعدد الأصلية";
    const shortDescription = description.slice(0, 160);
    const priceText = String(product.price == null ? "" : product.price)
      .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[,،٬\s]/g, "")
      .replace(/(?:جنيه(?:مصري)?|ج\.?م\.?|EGP|LE)/gi, "");
    const basePrice = /^\d+(?:\.\d+)?$/.test(priceText) ? Number(priceText) : NaN;
    const offerEnd = product.offerTimerEnabled === true ? Date.parse(product.offerEndsAt || "") : NaN;
    const offerActive = product.offerTimerEnabled === true && Number.isFinite(offerEnd) && offerEnd > Date.now();
    const discountPercent = offerActive ? Math.max(0, Math.min(90, Number(product.discountPercent) || 0)) : 0;
    const numericPrice = Number.isFinite(basePrice) && basePrice > 0
      ? Math.round(basePrice * (1 - discountPercent / 100) * 100) / 100 : NaN;
    const stockKnown = Number.isInteger(product.stock) && product.stock >= 0;

    const structuredProduct = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": name,
      "description": shortDescription,
      "image": imageUrl,
      "url": canonical
    };
    if (brand) structuredProduct.brand = { "@type": "Brand", "name": brand };
    if (product.cat) structuredProduct.category = String(product.cat).slice(0, 100);
    const sku = product.sku || product.code || product.partNumber || product.model;
    if (sku) structuredProduct.sku = String(sku).slice(0, 100);
    if (Number.isFinite(numericPrice) && numericPrice > 0) {
      const offer = {
        "@type": "Offer",
        "url": canonical,
        "priceCurrency": "EGP",
        "price": numericPrice,
        "seller": { "@type": "Organization", "name": "الدولي للعدد الأصلية والمستوردة" }
      };
      if (stockKnown) offer.availability = "https://schema.org/" + (product.stock > 0 ? "InStock" : "OutOfStock");
      if (offerActive) offer.priceValidUntil = new Date(offerEnd).toISOString().slice(0, 10);
      structuredProduct.offers = offer;
    }
    const jsonLd = JSON.stringify(structuredProduct)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");

    const tags = [
      '<meta property="og:type" content="product">',
      '<meta property="og:title" content="' + htmlEscape(title) + '">',
      '<meta property="og:description" content="' + htmlEscape(shortDescription) + '">',
      '<meta property="og:url" content="' + htmlEscape(canonical) + '">',
      '<meta property="og:image" content="' + htmlEscape(imageUrl) + '">',
      '<meta property="og:image:secure_url" content="' + htmlEscape(imageUrl) + '">',
      '<meta property="og:image:alt" content="' + htmlEscape(name) + '">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="' + htmlEscape(title) + '">',
      '<meta name="twitter:description" content="' + htmlEscape(description) + '">',
      '<meta name="twitter:image" content="' + htmlEscape(imageUrl) + '">'
    ].join("\n");

    const socialKeys = /(?:property|name)=["'](?:og:type|og:title|og:description|og:url|og:image|og:image:secure_url|og:image:alt|twitter:card|twitter:title|twitter:description|twitter:image|description)["']/i;
    const tagsWithSeo = [
      '<meta name="description" content="' + htmlEscape(shortDescription) + '">',
      '<link rel="canonical" href="' + htmlEscape(canonical) + '">',
      '<script type="application/ld+json">' + jsonLd + '</script>',
      tags
    ].join("\n");
    const html = (await page.text())
      .replace(/<meta\b[^>]*>/gi, tag => socialKeys.test(tag) ? "" : tag)
      .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "")
      .replace(/<title>[\s\S]*?<\/title>/i, "<title>" + htmlEscape(title) + "</title>")
      .replace("</head>", tagsWithSeo + "\n</head>");

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
