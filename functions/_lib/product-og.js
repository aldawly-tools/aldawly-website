const PROJECT = "wurth-29a1b";
const API_KEY = "AIzaSyBRkIA7yD9kYm9BKCdMDExvKtVDjsCMVY8";

function decodeValue(value) {
  if (!value || typeof value !== "object") return value;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return null;
}
function decodeFields(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(key => { out[key] = decodeValue(fields[key]); });
  return out;
}
export async function listProducts() {
  const endpoint = "https://firestore.googleapis.com/v1/projects/" + PROJECT +
    "/databases/(default)/documents/products?pageSize=1000&key=" + API_KEY;
  const response = await fetch(endpoint, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Firestore products read failed: " + response.status);
  const body = await response.json();
  return (body.documents || []).map(doc => {
    const id = doc.name.split("/").pop();
    return Object.assign({ id }, decodeFields(doc.fields || {}));
  });
}
export async function getProductById(id) {
  const products = await listProducts();
  return products.find(item => String(item.id) === String(id) || String(item._docId || "") === String(id)) || null;
}
export function htmlEscape(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
export async function productImageResponse(id) {
  const endpoint = "https://firestore.googleapis.com/v1/projects/" + PROJECT +
    "/databases/(default)/documents/productImages/" + encodeURIComponent(id) + "?key=" + API_KEY;
  const response = await fetch(endpoint, { headers: { accept: "application/json" } });
  if (!response.ok) return new Response("Image not found", { status: 404 });
  const doc = await response.json();
  const fields = decodeFields(doc.fields || {});
  let data = String(fields.data || fields.image || "");
  let mime = "image/jpeg";
  const match = data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (match) { mime = match[1]; data = data.slice(match[0].length); }
  data = data.replace(/\s/g, "");
  if (!data || data.length > 12_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    return new Response("Invalid image data", { status: 404 });
  }
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, { headers: {
    "content-type": mime,
    "cache-control": "public, max-age=86400, s-maxage=604800",
    "x-content-type-options": "nosniff"
  }});
}
