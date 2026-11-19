/* Dawly Smart Search — suggestions over the existing live catalog; does not replace store.js filtering. */
(function () {
  "use strict";
  var input = document.getElementById("searchInput");
  var form = document.getElementById("searchForm");
  if (!input || !form || input.dataset.smartSearchReady === "1") return;
  input.dataset.smartSearchReady = "1";
  var products = Array.isArray(window.DAWLY_PRODUCTS) ? window.DAWLY_PRODUCTS : [];
  var searchIndex = [];
  var activeIndex = -1;
  var panel = document.createElement("div");
  panel.className = "dawly-search-suggestions";
  panel.id = "dawlySearchSuggestions";
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", "اقتراحات المنتجات");
  panel.hidden = true;
  form.classList.add("dawly-search-enhanced");
  form.style.setProperty("overflow", "visible", "important");
  form.appendChild(panel);
  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", panel.id);
  input.setAttribute("aria-expanded", "false");

  var style = document.createElement("style");
  style.textContent = `
    .dawly-search-enhanced{position:relative!important;z-index:10030!important;overflow:visible!important;flex-shrink:0}
    .dawly-search-suggestions{position:absolute!important;top:calc(100% + 8px);left:0;right:0;width:100%;box-sizing:border-box;z-index:10040;max-height:min(66vh,430px);overflow:auto;background:#fff;border:1px solid #e2e7ec;border-radius:15px;box-shadow:0 16px 42px rgba(20,32,45,.18);padding:7px;direction:rtl}
    .dawly-search-suggestions[hidden]{display:none!important}
    .dawly-search-suggestion{display:flex;align-items:center;gap:11px;width:100%;padding:10px;border:0;border-radius:10px;background:#fff;text-align:right;color:#202a35;cursor:pointer}
    .search-form .dawly-search-suggestion{display:flex!important;position:relative!important;align-items:center!important;justify-content:flex-start!important;gap:11px!important;width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:68px!important;flex:0 0 auto!important;padding:10px!important;border:0!important;border-radius:10px!important;background:#fff!important;color:#202a35!important;box-shadow:none!important;text-align:right!important;white-space:normal!important;}
    .search-form .dawly-search-suggestion:hover,.search-form .dawly-search-suggestion[aria-selected="true"]{background:#fff1f2!important}
    .dawly-search-thumb{flex:0 0 56px!important;width:56px!important;height:56px!important}
    .dawly-search-copy{flex:1 1 auto!important;width:auto!important;min-width:0!important;text-align:right!important}
    .dawly-search-name,.dawly-search-meta{display:block!important;width:100%!important;white-space:normal!important;color:#202a35!important}
    .dawly-search-meta{color:#77818c!important}
    .dawly-search-suggestion:hover,.dawly-search-suggestion[aria-selected="true"]{background:#fff1f2}
    .dawly-search-thumb{width:48px;height:48px;flex:0 0 48px;border:1px solid #edf0f3;border-radius:9px;background:#f7f8fa;display:grid;place-items:center;overflow:hidden;font-size:23px}
    .dawly-search-thumb img{width:100%;height:100%;object-fit:contain}
    .dawly-search-copy{min-width:0;display:flex;flex-direction:column;gap:3px}
    .dawly-search-name{font-size:13px;font-weight:900;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .dawly-search-meta{font-size:11px;color:#77818c}
    .dawly-search-empty{padding:14px 12px;color:#6d7782;font-size:13px;line-height:1.8}
    .dawly-search-footer{padding:8px 11px 5px;border-top:1px solid #f0f2f4;color:#8a929b;font-size:11px}
    @media(max-width:820px){.dawly-search-suggestions{max-height:58vh}}
  `;
  document.head.appendChild(style);

  function norm(value) {
    return String(value == null ? "" : value).toLocaleLowerCase("ar").normalize("NFD")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/[٠-٩]/g, function(d){return String("٠١٢٣٤٥٦٧٨٩".indexOf(d));})
      .replace(/[۰-۹]/g, function(d){return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d));})
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  }
  function termVariants(term) {
    return term === "بنطه" ? ["بنطه", "بنط"] : [term];
  }
  function matchesTerm(text, term) {
    return termVariants(term).some(function(variant) { return text.includes(variant); });
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function buildSearchIndex(list) {
    searchIndex = (Array.isArray(list) ? list : []).map(function(p) {
      var name=norm(p.name), brand=norm(p.brand||p.brandName||p.manufacturer);
      var code=norm([p.sku,p.code,p.model,p.partNumber,p.id].join(" "));
      var category=norm(p.cat), details=norm([p.desc,p.specs].join(" "));
      var hay=norm([p.name,p.brand,p.brandName,p.manufacturer,p.cat,p.desc,p.specs,p.sku,p.code,p.model,p.partNumber,p.id].join(" "));
      return {p:p,name:name,brand:brand,code:code,category:category,details:details,hay:hay};
    }).filter(function(entry){return entry.hay;});
  }
  function score(entry, terms) {
    var total=0;
    terms.forEach(function(t){
      var matched=termVariants(t).find(function(variant){return entry.hay.includes(variant);});
      if(!matched)return;
      total += entry.name===matched?100:entry.name.startsWith(matched)?65:entry.name.includes(matched)?45:0;
      if(entry.brand.includes(matched)) total+=35;
      if(entry.code.split(" ").some(function(x){return x===matched;})) total+=90;
      else if(entry.code.includes(matched)) total+=50;
      if(entry.category.includes(matched)) total+=12;
      if(entry.details.includes(matched)) total+=5;
    });
    return total;
  }
  buildSearchIndex(products);
  function hide() {
    panel.hidden=true; input.setAttribute("aria-expanded","false");
    input.removeAttribute("aria-activedescendant"); activeIndex=-1;
  }
  function go(p) {
    if(!p) return;
    window.location.href="product.html?id="+encodeURIComponent(String(p.id));
  }
  function render() {
    var terms=norm(input.value).split(" ").filter(Boolean);
    if(!terms.length){hide();return;}
    var matches=searchIndex.map(function(entry){return {p:entry.p,s:score(entry,terms),hay:entry.hay};})
      .filter(function(x){return x.s>0 && terms.every(function(t){return matchesTerm(x.hay,t);});})
      .sort(function(a,b){return b.s-a.s;}).slice(0,7);
    activeIndex=-1;
    if(!matches.length){
      panel.innerHTML='<div class="dawly-search-empty">مفيش اقتراح مطابق حاليًا. جرّب اسم الماركة أو رقم الصنف أو كلمة أبسط.</div>';
    } else {
      panel.innerHTML=matches.map(function(x,i){
        var p=x.p, directImage=p.image||p.imageUrl||p.photo||p.thumbnail||"", cloudImage=(Array.isArray(p.imageIds)&&p.imageIds[0])||p.imageId||"", image=directImage?'<img src="'+esc(directImage)+'" alt="" loading="lazy">' : cloudImage?'<img data-smart-cloud="'+esc(cloudImage)+'" alt="" loading="lazy">' :(p.icon||"🔧");
        var brand=p.brand||p.brandName||p.manufacturer||p.cat||"منتجات";
        return '<button type="button" class="dawly-search-suggestion" role="option" aria-selected="false" data-smart-index="'+i+'"><span class="dawly-search-thumb">'+image+'</span><span class="dawly-search-copy"><span class="dawly-search-name">'+esc(p.name||"منتج")+'</span><span class="dawly-search-meta">'+esc(brand)+' · '+(p.price==null||p.price===""?"السعر عند التواصل":esc(p.price)+" جنيه")+'</span></span></button>';
      }).join("")+'<div class="dawly-search-footer">اختار المنتج لفتح التفاصيل • أو اضغط بحث لعرض كل النتائج</div>';
      panel._matches=matches;
    }
    panel.hidden=false; input.setAttribute("aria-expanded","true");
    panel.querySelectorAll("img[data-smart-cloud]").forEach(function(img){
      var cloudId=img.getAttribute("data-smart-cloud");
      if(img.dataset.loading==="1")return;
      img.dataset.loading="1";
      if(typeof window.DAWLY_LOAD_PRODUCT_IMAGE==="function"){
        window.DAWLY_LOAD_PRODUCT_IMAGE(cloudId).then(function(url){
          if(url&&img.isConnected){img.src=url;img.removeAttribute("data-smart-cloud");}
          else if(img.isConnected){img.replaceWith(document.createTextNode("🔧"));}
        }).catch(function(){if(img.isConnected)img.replaceWith(document.createTextNode("🔧"));});
      }
    });
  }
  input.addEventListener("input",render);
  input.addEventListener("focus",function(){if(input.value.trim())render();});
  input.addEventListener("keydown",function(e){
    if(panel.hidden)return;
    var options=panel.querySelectorAll("[data-smart-index]");
    if(e.key==="ArrowDown"&&options.length){e.preventDefault();activeIndex=Math.min(activeIndex+1,options.length-1);}
    else if(e.key==="ArrowUp"&&options.length){e.preventDefault();activeIndex=Math.max(activeIndex-1,0);}
    else if(e.key==="Escape"){hide();return;}
    else if(e.key==="Enter"&&activeIndex>=0){e.preventDefault();go(panel._matches&&panel._matches[activeIndex]&&panel._matches[activeIndex].p);return;}
    else return;
    options.forEach(function(el,i){el.setAttribute("aria-selected",String(i===activeIndex));});
    input.setAttribute("aria-activedescendant","dawlySmartOption"+activeIndex);
    if(options[activeIndex]){options[activeIndex].id="dawlySmartOption"+activeIndex;options[activeIndex].scrollIntoView({block:"nearest"});}
  });
  panel.addEventListener("click",function(e){
    var button=e.target.closest("[data-smart-index]");
    if(!button)return;
    var item=panel._matches&&panel._matches[Number(button.dataset.smartIndex)];
    go(item&&item.p);
  });
  document.addEventListener("click",function(e){if(!form.contains(e.target))hide();});
  form.addEventListener("submit",hide);
  window.addEventListener("dawly-products-updated",function(e){
    if(Array.isArray(e.detail))products=e.detail;
    else if(Array.isArray(window.DAWLY_PRODUCTS))products=window.DAWLY_PRODUCTS;
    buildSearchIndex(products);
    if(!panel.hidden)render();
  });
  // Catch catalogs assigned by the initial product loader before its update event.
  if(!products.length) {
    var attempts=0;
    var refresh=function(){
      if(Array.isArray(window.DAWLY_PRODUCTS)&&window.DAWLY_PRODUCTS.length){products=window.DAWLY_PRODUCTS;buildSearchIndex(products);if(input.value.trim())render();return;}
      if(++attempts<30)window.setTimeout(refresh,300);
    };
    window.setTimeout(refresh,300);
  }
})();
