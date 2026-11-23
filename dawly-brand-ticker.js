/* Dynamic selectable brand ticker with official brand marks where available. */
(function(){
  "use strict";
  var host=document.getElementById("dawlyShowcaseBrands");
  if(!host)return;
  function normalize(value){
    return String(value||"").trim().toLocaleLowerCase("ar")
      .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
      .replace(/[ـ\u064B-\u065F\u0670]/g,"").replace(/[\s._-]/g,"");
  }
  var logos={
    "gesipa":"assets/brands/gesipa.webp","luxtools":"assets/brands/lux-tools.webp",
    "bahco":"assets/brands/bahco.webp","koken":"assets/brands/koken.webp",
    "modeco":"assets/brands/modeco.webp","normex":"assets/brands/normex.webp",
    "riss":"assets/brands/riss.webp",
    "bosch":"https://upload.wikimedia.org/wikipedia/commons/1/16/Bosch-logo.svg",
    "knipex":"https://upload.wikimedia.org/wikipedia/commons/e/e3/Knipex_logo.svg",
    "wera":"https://upload.wikimedia.org/wikipedia/commons/e/ec/Wera_schwarz_Logo_ohne_Effekt_4C.svg",
    "wurth":"https://upload.wikimedia.org/wikipedia/commons/c/c3/Wuerth_Logo_2024.svg",
    "dewalt":"https://upload.wikimedia.org/wikipedia/commons/8/89/DeWalt_Logo.svg",
    "milwaukee":"https://upload.wikimedia.org/wikipedia/commons/d/de/Milwaukee_Logo.svg",
    "makita":"https://upload.wikimedia.org/wikipedia/commons/7/71/Makita_Logo.svg",
    "beta":"https://static.cdnlogo.com/logos/b/13/beta-tools.svg",
    "elora":"https://www.elora.de/wp-content/uploads/2021/02/elora-logo.png"
  };
  var canonical={"wurth":"WÜRTH","wera":"Wera","knipex":"KNIPEX","bosch":"BOSCH","dewalt":"DEWALT","milwaukee":"Milwaukee","makita":"Makita","beta":"Beta","gesipa":"GESIPA","luxtools":"LUX-TOOLS","bahco":"BAHCO","koken":"KOKEN","modeco":"MODECO","normex":"Normex","riss":"RISS","elora":"ELORA"};
  function render(products){
    if(!Array.isArray(products))return;
    var brands=new Map();
    products.forEach(function(product){
      var raw=String(product&&product.brand||"").trim(),key=normalize(raw);
      if(raw&&key&&!brands.has(key))brands.set(key,{name:canonical[key]||raw,imageId:String(product.brandLogoImageId||"").trim()});
    });
    var list=Array.from(brands.entries()).sort(function(a,b){return a[1].name.localeCompare(b[1].name,"ar");});
    if(!list.length)return;
    host.replaceChildren();
    list.forEach(function(entry){
      var key=entry[0],name=entry[1].name,link=document.createElement("a");
      link.className="dawly-brand-pill";link.href="products.html?brand="+encodeURIComponent(name)+"#productGrid";
      link.dataset.brandKey=key;link.setAttribute("aria-label","تصفح منتجات "+name);
      var src=logos[key];
      if(src){
        var img=document.createElement("img");img.src=src;img.alt=name+" logo";img.width=180;img.height=72;img.loading="lazy";img.decoding="async";
        img.onerror=function(){img.remove();link.classList.add("has-text-fallback");link.appendChild(document.createTextNode(name));};
        link.appendChild(img);
      }else{
        link.classList.add("has-text-fallback");link.appendChild(document.createTextNode(name));
      }
      host.appendChild(link);
    });
    Array.from(host.children).forEach(function(link){
      var clone=link.cloneNode(true);clone.setAttribute("aria-hidden","true");clone.setAttribute("tabindex","-1");
      clone.querySelectorAll("img").forEach(function(img){img.alt="";});host.appendChild(clone);
    });
    host.dataset.brandCount=String(list.length);
    loadSavedBrandLogos(list);
  }
  function loadSavedBrandLogos(list){
    var metaLoader=window.DAWLY_LOAD_BRAND_LOGO_META;
    var imageLoader=window.DAWLY_LOAD_PRODUCT_IMAGE;
    if(typeof metaLoader!=="function"&&typeof imageLoader!=="function")return;
    list.forEach(function(entry){
      var key=entry[0],imageId=entry[1].imageId;if(!imageId)return;
      (typeof metaLoader==="function"?Promise.resolve(metaLoader(imageId)):Promise.resolve(imageLoader(imageId)).then(function(url){return {url:url,scale:34};})).then(function(meta){
        if(!meta||!meta.url)return;
        host.querySelectorAll('[data-brand-key="'+key+'"]').forEach(function(link){
          var img=link.querySelector("img");
          if(!img){img=document.createElement("img");img.alt=link.getAttribute("aria-hidden")==="true"?"":entry[1].name+" logo";img.width=180;img.height=72;img.loading="lazy";img.decoding="async";link.replaceChildren(img);}
          var logoHeight=Math.max(16,Math.min(100,Number(meta.scale)||34));img.src=meta.url;img.style.width="180px";img.style.height=logoHeight+"px";img.style.maxWidth="78%";img.style.maxHeight=logoHeight+"px";img.style.objectFit="contain";img.style.objectPosition="center";link.classList.remove("has-text-fallback");
        });
      }).catch(function(error){console.warn("Saved brand logo could not be loaded:",key,error);});
    });
  }
  window.addEventListener("dawly-product-image-loader-ready",function(){if(Array.isArray(window.DAWLY_PRODUCTS))render(window.DAWLY_PRODUCTS);});
  window.addEventListener("dawly-products-updated",function(event){render(event.detail);});
  window.addEventListener("dawly-catalog-ready",function(){render(window.DAWLY_PRODUCTS);});
  if(Array.isArray(window.DAWLY_PRODUCTS))render(window.DAWLY_PRODUCTS);
})();
