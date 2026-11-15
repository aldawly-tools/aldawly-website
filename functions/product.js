export async function onRequest(context) {
  const url = new URL(context.request.url);
  const target = new URL("/product.html" + url.search + url.hash, url.origin);
  return Response.redirect(target.toString(), 302);
}
