(function(){
"use strict";
if(document.getElementById("dawlyBotLauncher")) return;
var products=Array.isArray(window.DAWLY_PRODUCTS)?window.DAWLY_PRODUCTS:[];
var opened=false, history=[];
function norm(v){return String(v==null?"":v).toLocaleLowerCase("ar").normalize("NFD").replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[٠-٩]/g,function(d){return String("٠١٢٣٤٥٦٧٨٩".indexOf(d));}).replace(/[۰-۹]/g,function(d){return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d));}).replace(/[^\p{L}\p{N}.]+/gu," ").trim().replace(/\s+/g," ");}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function ptext(p){return norm([p.name,p.brand,p.brandName,p.manufacturer,p.cat,p.category,p.desc,p.description,p.specs,p.sku,p.code,p.model,p.partNumber].join(" "));}
var stop=("في من على عن الى الي او و هل ايه اي ما ماذا عايز عاوز محتاج عند لل من فضلك لو سمحت ممكن يكون تكون فيه حاجه حاجة حاجات اداة اداه الاداة المنتج منتجات").split(" ");
var aliases={
"خشب":["نجاره","نجار","منشار","صنفرة","صنفره","بنط","بنطة","بنطه","دريل","شنيور","مسمار","ازميل","أزميل"],
"نجاره":["خشب","نجار","منشار","ازميل","أزميل","صنفرة","صنفره"],
"حديد":["معدن","صاج","حديد","صاروخ","قطعية","قطعيه","بنط معدن"],
"خرسانه":["خرسانة","حائط","طوب","هيلتي","شاكوش","تخريم"],
"مفك":["مفكات","صليبة","صليبه","عادة","عاده","توركس","torx"],
"بنط":["بنطة","بنطه","ريشة","ريشه","hss","خرسانة","خرسانه"],
"قص":["قطعية","قطعيه","منشار","صاروخ","شفرة","شفره"]
};
function termsFor(q){var raw=norm(q).split(" ").map(function(t){return t.replace(/^(وال|بال|كال|لل|ال|و|ب|ل)/,"");}).filter(function(t){return t.length>=2&&!stop.includes(t);});var expanded=raw.slice();raw.forEach(function(t){Object.keys(aliases).forEach(function(k){if(t===k||aliases[k].indexOf(t)>=0){expanded.push(k);expanded=expanded.concat(aliases[k]);}});});return Array.from(new Set(expanded));}
function productScore(p,raw,expanded){var name=norm(p.name),full=ptext(p),score=0,matched=0;raw.forEach(function(t){var hit=name.split(" ").some(function(w){return w===t;});var any=full.split(" ").some(function(w){return w===t;});if(hit){score+=8;matched++;}else if(any){score+=3;matched++;}});expanded.forEach(function(t){if(raw.indexOf(t)>=0)return;if(name.split(" ").indexOf(t)>=0)score+=2;else if(full.split(" ").indexOf(t)>=0)score+=1;});return {score:score,matched:matched};}
function find(q){var raw=norm(q).split(" ").filter(function(t){return t.length>=2&&!stop.includes(t);});if(!raw.length)return [];var expanded=termsFor(q);var rows=products.filter(function(p){return p&&p.hiddenFromStore!==true;}).map(function(p){var r=productScore(p,raw,expanded);return {p:p,score:r.score,matched:r.matched};}).filter(function(x){return x.matched>=1&&x.score>=6;}).sort(function(a,b){return b.score-a.score;});if(!rows.length)return [];var best=rows[0].score;return rows.filter(function(x){return x.score>=Math.max(6,best*.65);}).slice(0,4).map(function(x){return x.p;});}
function price(p){var v=String(p.price==null?"":p.price).trim();if(!v)return "السعر عند التواصل";if(/استفسار|حسب الطلب/i.test(v))return esc(v);return /^(EGP|ج\.?م)/i.test(v)?esc(v):"EGP "+esc(v);}
function card(p){var name=esc(p.name||"منتج من الدولي"),url=p.image||p.imageUrl||p.imageURL||p.photo||"",iid=p.imageId||p._docId||p.id||"";var im=url?'<img src="'+esc(url)+'" alt="'+name+'" loading="lazy">':iid?'<img data-bot-image="'+esc(iid)+'" alt="'+name+'" loading="lazy">':'<span>🔧</span>';return '<article class="dawly-bot-product"><div class="dawly-bot-product-img">'+im+'</div><div class="dawly-bot-product-info"><strong>'+name+'</strong><small>'+esc(p.brand||p.cat||"من كتالوج الدولي")+'</small><b>'+price(p)+'</b><a href="product?id='+encodeURIComponent(p.id)+'">عرض المنتج ←</a></div></article>';}
function loadImages(root){if(typeof window.DAWLY_LOAD_PRODUCT_IMAGE!=="function")return;root.querySelectorAll("img[data-bot-image]").forEach(function(im){if(im.dataset.loading)return;im.dataset.loading="1";window.DAWLY_LOAD_PRODUCT_IMAGE(im.dataset.botImage).then(function(u){if(u&&im.isConnected)im.src=u;else if(im.isConnected)im.replaceWith(document.createTextNode("🔧"));}).catch(function(){if(im.isConnected)im.replaceWith(document.createTextNode("🔧"));});});}
function msg(t,who){var box=document.getElementById("dawlyBotMessages"),el=document.createElement("div");el.className="dawly-bot-msg "+who;el.textContent=t;box.appendChild(el);box.scrollTop=box.scrollHeight;}
function show(list){if(!list.length)return;var box=document.createElement("div");box.className="dawly-bot-results";box.innerHTML=list.map(card).join("");document.getElementById("dawlyBotMessages").appendChild(box);loadImages(box);}
function reply(q){var s=norm(q);if(!products.length){msg("الكتالوج لسه بيحمّل. جرّب بعد لحظات.","bot");return;}
if(/^(السلام عليكم|سلام|اهلا|اهلين|مرحبا|صباح الخير|مساء الخير)$/.test(s)){msg("وعليكم السلام 👋 أهلاً بيك في الدولي. بتدور على أداة معينة ولا محتاج ترشيح لاستخدام محدد؟","bot");return;}
var wantsPrice=/سعر|بكام|كام|تكلفه|تكلفة/.test(s),wantsAlt=/بديل|بدائل|شبيه|بدلا/.test(s),wantsSize=/مقاس|مقاسات|قطر|طول|عرض|mm|ملم|بوصه|انش|t\d+/.test(s);
var list=find(q);
if(!list.length){msg("مش لاقي تطابق موثوق في كتالوجنا، ومش هعرض عليك منتج عشوائي. وضّحلي نوع الأداة أو استخدامها والخامة اللي هتشتغل عليها (خشب، معدن، أو خرسانة)، أو ابعت صورة/رقم الموديل.","bot");return;}
if(wantsAlt)msg("لقيت المنتجات الأقرب المسجلة عندنا. عشان أحدد البديل المتوافق، محتاج أعرف موديل أو مقاس المنتج الأصلي لو مش واضح في الاسم.","bot");
else if(wantsSize)msg("دي المنتجات المطابقة في الكتالوج. هقدر أأكد المقاس فقط لو مكتوب في مواصفات المنتج المسجلة؛ مش هخمنه.","bot");
else if(wantsPrice)msg("دي المنتجات المطابقة وده السعر المسجل لكل منتج:","bot");
else msg("لقيت تطابق في كتالوج الدولي مع طلبك:","bot");
show(list);
if(wantsSize&&!String(list[0].specs||"").trim())msg("المقاس مش مسجل بوضوح في بيانات المنتج. ابعت رقم الموديل أو صورة الملصق عشان نتحقق.","bot");
history.push({q:q,ids:list.map(function(p){return String(p.id);})});history=history.slice(-5);
}
function send(q){q=String(q||"").trim();if(!q)return;msg(q,"user");reply(q);var i=document.getElementById("dawlyBotInput");i.value="";}
var launcher=document.createElement("button");launcher.id="dawlyBotLauncher";launcher.type="button";launcher.setAttribute("aria-label","افتح مساعد الدولي");launcher.innerHTML='<span class="dawly-bot-face" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v7.4a2.8 2.8 0 0 1-2.8 2.8h-5.1l-4.7 3.2v-3.2h-.6A2.8 2.8 0 0 1 4 13.2z"/><path d="M8 9h8M8 12h5"/></svg><i></i></span><span class="dawly-bot-prompt">أدورلك على أداة؟</span>';
var panel=document.createElement("section");panel.id="dawlyBotPanel";panel.hidden=true;panel.setAttribute("aria-label","مساعد الدولي");panel.innerHTML='<header class="dawly-bot-head"><div class="dawly-bot-avatar">🤖</div><div><strong>مساعد الدولي</strong><small>مساعد فني للعدد والمنتجات</small></div><button type="button" id="dawlyBotClose" aria-label="إغلاق">×</button></header><div class="dawly-bot-messages" id="dawlyBotMessages"><div class="dawly-bot-msg bot">أهلاً بيك 👋 أقدر أساعدك تلاقي أداة من كتالوج الدولي. قولي هتستخدمها في إيه وعلى أي خامة.</div><div class="dawly-bot-chips"><button type="button">طقم مفكات WÜRTH</button><button type="button">بنط HSS للمعادن</button><button type="button">أدوات النجارة</button></div></div><form class="dawly-bot-form" id="dawlyBotForm"><input id="dawlyBotInput" autocomplete="off" placeholder="اسم الأداة أو الاستخدام أو المقاس..." aria-label="اكتب سؤالك"><button type="submit">إرسال</button></form><a class="dawly-bot-wa" href="https://wa.me/201024787222" target="_blank" rel="noopener">محتاج تأكيد فني؟ كلمنا واتساب</a>';
document.body.appendChild(launcher);document.body.appendChild(panel);
/* Avoid overlapping the assistant with the expanded contact/WhatsApp menu. */
var contactPanel=document.getElementById("floatingContactPanel");
if(contactPanel){
  var syncContactMenu=function(){
    var contactOpen=!contactPanel.hidden;
    launcher.classList.toggle("dawly-contact-menu-open",contactOpen);
    if(contactOpen&&opened){opened=false;panel.hidden=true;}
  };
  new MutationObserver(syncContactMenu).observe(contactPanel,{attributes:true,attributeFilter:["hidden"]});
  syncContactMenu();
}
launcher.addEventListener("click",function(){opened=!opened;panel.hidden=!opened;launcher.classList.remove("dawly-prompt-visible");if(opened)document.getElementById("dawlyBotInput").focus();});
launcher.classList.add("dawly-prompt-visible");window.setTimeout(function(){launcher.classList.remove("dawly-prompt-visible");},6500);
document.getElementById("dawlyBotClose").addEventListener("click",function(){opened=false;panel.hidden=true;});
document.getElementById("dawlyBotForm").addEventListener("submit",function(e){e.preventDefault();send(document.getElementById("dawlyBotInput").value);});
panel.addEventListener("click",function(e){var b=e.target.closest(".dawly-bot-chips button");if(b)send(b.textContent);});
window.addEventListener("dawly-products-updated",function(e){if(Array.isArray(e.detail))products=e.detail;});
window.addEventListener("dawly-catalog-ready",function(){products=Array.isArray(window.DAWLY_PRODUCTS)?window.DAWLY_PRODUCTS:products;loadImages(panel);});
})();