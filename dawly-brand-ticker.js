/* Build the hero brand ticker from the brands actually present in the live catalog. */
(function(){
  "use strict";
  var host=document.getElementById("dawlyShowcaseBrands");
  if(!host)return;
  function normalize(value){
    return String(value||"").trim().toLocaleLowerCase("ar")
      .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
      .replace(/[ـ\u064B-\u065F\u0670]/g,"").replace(/[\s._-]/g,"");
  }
  function render(products){
    if(!Array.isArray(products))return;
    var brands=new Map();
    products.forEach(function(product){
      var name=String(product&&product.brand||"").trim();
      var key=normalize(name);
      if(name&&key&&!brands.has(key))brands.set(key,name);
    });
    var list=Array.from(brands.entries()).sort(function(a,b){return a[1].localeCompare(b[1],"ar");});
    if(!list.length)return;
    host.replaceChildren();
    list.forEach(function(entry){
      var link=document.createElement("a");
      link.className="dawly-brand-pill";
      link.href="products.html?brand="+encodeURIComponent(entry[1])+"#productGrid";
      link.dataset.brandKey=entry[0];
      link.textContent=entry[1];
      link.setAttribute("aria-label","تصفح منتجات "+entry[1]);
      host.appendChild(link);
    });
    /* Duplicate the sequence for a seamless loop; duplicate links are removed from keyboard navigation. */
    Array.from(host.children).forEach(function(link){
      var clone=link.cloneNode(true);
      clone.setAttribute("aria-hidden","true");
      clone.setAttribute("tabindex","-1");
      host.appendChild(clone);
    });
    host.dataset.brandCount=String(list.length);
  }
  window.addEventListener("dawly-products-updated",function(event){render(event.detail);});
  window.addEventListener("dawly-catalog-ready",function(){render(window.DAWLY_PRODUCTS);});
  if(Array.isArray(window.DAWLY_PRODUCTS))render(window.DAWLY_PRODUCTS);
})();
