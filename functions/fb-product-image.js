import { getProductById, productImageResponse } from "./_lib/product-og.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing product id", { status: 400 });
  try {
    const product = await getProductById(id);
    if (!product) return new Response("Product not found", { status: 404 });
    const direct = product.image || product.imageUrl || product.photo || "";
    if (direct && /^https?:\\/\\//i.test(String(direct))) {
      return Response.redirect(String(direct), 302);
    }
    const imageId = (Array.isArray(product.imageIds) && product.imageIds[0]) || product.imageId;
    if (!imageId) return new Response("Product image not found", { status: 404 });
    return await productImageResponse(imageId);
  } catch (error) {
    console.error("Product image preview error:", error);
    return new Response("Unable to load product image", { status: 502 });
  }
}
