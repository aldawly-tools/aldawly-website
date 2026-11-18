(function(){
"use strict";
if(document.getElementById("dawlyBotLauncher")) return;
var fullPage=document.body.dataset.assistantPage==="true";
var products=Array.isArray(window.DAWLY_PRODUCTS)?window.DAWLY_PRODUCTS:[];
var opened=false, history=[], chatTurns=[], aiSetupNoticeShown=false, aiBusy=false;
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
function findForAI(q){var raw=norm(q).split(" ").filter(function(t){return t.length>=2&&!stop.includes(t);});if(!raw.length)return [];var expanded=termsFor(q);return products.filter(function(p){return p&&p.hiddenFromStore!==true;}).map(function(p){var r=productScore(p,raw,expanded);return {p:p,score:r.score,matched:r.matched};}).filter(function(x){return x.matched>=1&&x.score>=6;}).sort(function(a,b){return b.score-a.score;}).slice(0,12).map(function(x){return x.p;});}
function price(p){var v=String(p.price==null?"":p.price).trim();if(!v)return "السعر عند التواصل";if(/استفسار|حسب الطلب/i.test(v))return esc(v);return /^(EGP|ج\.?م)/i.test(v)?esc(v):"EGP "+esc(v);}
function card(p){var name=esc(p.name||"منتج من الدولي"),url=p.image||p.imageUrl||p.imageURL||p.photo||"",iid=p.imageId||p._docId||p.id||"",href="product.html?id="+encodeURIComponent(p.id);var im=url?'<img src="'+esc(url)+'" alt="'+name+'" loading="lazy">':iid?'<img data-bot-image="'+esc(iid)+'" alt="'+name+'" loading="lazy">':'<span>🔧</span>';return '<a class="dawly-bot-product" href="'+href+'" target="_blank" rel="noopener noreferrer" aria-label="عرض تفاصيل '+name+'"><div class="dawly-bot-product-img">'+im+'</div><div class="dawly-bot-product-info"><strong>'+name+'</strong><small>'+esc(p.brand||p.cat||"من كتالوج الدولي")+'</small><b>'+price(p)+'</b><span class="dawly-bot-product-open">عرض المنتج ←</span></div></a>';}
function loadImages(root){if(typeof window.DAWLY_LOAD_PRODUCT_IMAGE!=="function")return;root.querySelectorAll("img[data-bot-image]").forEach(function(im){if(im.dataset.loading)return;im.dataset.loading="1";window.DAWLY_LOAD_PRODUCT_IMAGE(im.dataset.botImage).then(function(u){if(u&&im.isConnected)im.src=u;else if(im.isConnected)im.replaceWith(document.createTextNode("🔧"));}).catch(function(){if(im.isConnected)im.replaceWith(document.createTextNode("🔧"));});});}
function msg(t,who){var box=document.getElementById("dawlyBotMessages"),el=document.createElement("div");el.className="dawly-bot-msg "+who;el.textContent=t;box.appendChild(el);box.scrollTop=box.scrollHeight;}
function show(list){
 if(!Array.isArray(list)||!list.length)return;
 var messages=document.getElementById("dawlyBotMessages");
 if(!messages)return;
 var box=document.createElement("div");
 box.className="dawly-bot-results";
 box.setAttribute("aria-label","المنتجات المطابقة من كتالوج الدولي");
 box.innerHTML='<div class="dawly-bot-results-title">المنتجات المطابقة في الكتالوج</div>'+list.map(card).join("");
 messages.appendChild(box);
 loadImages(box);
 // The reply bubble is appended before the product cards. Scroll again after
 // inserting cards so the customer actually sees the matched products.
 requestAnimationFrame(function(){messages.scrollTop=messages.scrollHeight;});
}
function replyFallback(q){var s=norm(q);if(!products.length){msg("الكتالوج لسه بيحمّل. جرّب بعد لحظات.","bot");return;}
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
function compactProduct(p){
 return {
  id:String(p.id==null?"":p.id).slice(0,80),
  name:String(p.name||"").slice(0,180),
  brand:String(p.brand||p.brandName||p.manufacturer||"").slice(0,80),
  category:String(p.category||p.cat||"").slice(0,100),
  description:String(p.description||p.desc||"").slice(0,300),
  specs:(typeof p.specs==="string"?p.specs:JSON.stringify(p.specs||"")).slice(0,650),
  price:p.price==null?"":String(p.price).slice(0,80),
  stock:p.stock==null?null:String(p.stock).slice(0,40)
 };
}
function readSpecs(p){
 var raw=p&&p.specs;
 if(Array.isArray(raw))return raw.map(function(x){return {name:String(x.name||"مواصفة"),value:String(x.value||"")};}).filter(function(x){return x.value.trim();});
 if(raw&&typeof raw==="object")return Object.keys(raw).map(function(k){return {name:k,value:String(raw[k]||"")};}).filter(function(x){return x.value.trim();});
 return String(raw||"").split(/\r?\n/).map(function(line){
  var i=line.search(/[:：]/);return i<0?null:{name:line.slice(0,i).trim(),value:line.slice(i+1).trim()};
 }).filter(function(x){return x&&x.name&&x.value;});
}
function specsText(p){
 var rows=readSpecs(p);return rows.length?rows.map(function(x){return "• "+x.name+": "+x.value;}).join("\n"):"لا توجد مواصفات فنية مسجلة لهذا المنتج حتى الآن.";
}
function answerFromCatalog(q){
 var s=norm(q),list=findForAI(q);
 if(!list.length)return false;
 var asksCompare=/قارن|الفرق|افضل|أفضل|انسب|أنسب|بديل|مقارنه|مقارنة/.test(s);
 var asksSpec=/مواصف|المقاس|مقاس|خامة|عدد القطع|القدره|قدرة|الجهد|فولت|سرعه|سرعة|وزن|طول|عرض|بلد المنشأ|صناعه|صناعة|موديل|رقم/.test(s);
 if(!asksSpec&&!asksCompare)return false;
 var chosen=list.slice(0,asksCompare?3:2);
 if(asksCompare){
  msg("دي مقارنة مبنية على البيانات المسجلة في كتالوج الدولي. أي معلومة غير موجودة مش هخمنها:", "bot");
  chosen.forEach(function(p){msg((p.name||"منتج")+(p.brand?" — "+p.brand:"")+"\n"+specsText(p),"bot");});
  show(chosen);return true;
 }
 var p=chosen[0],rows=readSpecs(p);
 var requested=rows;
 var terms=[];
 if(/مقاس|قطر|طول|عرض/.test(s))terms.push(/مقاس|قطر|طول|عرض/);
 if(/خامة/.test(s))terms.push(/خامة|ماده/);
 if(/عدد القطع|قطع/.test(s))terms.push(/عدد القطع|قطع/);
 if(/بلد المنشأ|صناعه|صناعة/.test(s))terms.push(/بلد المنشأ|صناعه|صناعة/);
 if(/قدره|قدرة|واط|watt|الجهد|فولت|سرعه|سرعة|وزن/.test(s))terms.push(/قدره|قدرة|واط|الجهد|فولت|سرعه|سرعة|وزن/);
 if(terms.length)requested=rows.filter(function(row){return terms.some(function(re){return re.test(norm(row.name));});});
 msg("بالنسبة لمنتج "+(p.name||"المحدد")+"، دي المعلومات المسجلة عندنا:"+"\n"+(requested.length?requested.map(function(x){return "• "+x.name+": "+x.value;}).join("\n"):"المواصفة المطلوبة مش مسجلة بوضوح لهذا المنتج. دي باقي المواصفات المتاحة:\n"+specsText(p)),"bot");
 show([p]);return true;
}
function reply(q){
 /* Local-only assistant: no external AI requests, API keys, or customer-chat uploads. */
 var s=norm(q);
 if(/شحن|توصيل|محافظات/.test(s)){
  msg("الشحن متاح لجميع محافظات مصر 🚚 لتأكيد تكلفة ومدة الشحن حسب عنوانك، تواصل معنا على واتساب 01024787222.","bot");
  return;
 }
 if(/واتساب|تواصل|رقم|اتصل/.test(s)){
  msg("تقدر تتواصل مع فريق الدولي مباشرة على واتساب 01024787222 لتأكيد السعر والتوفر والطلب.","bot");
  return;
 }
 if(/دفع|تحويل|فيزا|كاش|الدفع/.test(s)){
  msg("لتأكيد طرق الدفع المتاحة لطلبك، تواصل مع فريق الدولي على واتساب 01024787222. مش هأكد طريقة دفع غير مسجلة عندنا.","bot");
  return;
 }
 if(answerFromCatalog(q))return;
 if(/سعر|بكام|كام/.test(s)){
  var results=find(q);
  if(!results.length){replyFallback(q);return;}
  msg("دي المنتجات اللي لقيتها في الكتالوج، والسعر الظاهر هو السعر المسجل حاليًا. لو السعر غير ظاهر، تواصل معنا للتأكيد:","bot");
  show(results);
  return;
 }
 // Hybrid path: use the exact store catalog as context; fall back locally if AI is not configured.
 var matched=findForAI(q).slice(0,6).map(compactProduct);
 fetch("/api/assistant",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({question:q,products:matched,history:chatTurns.slice(-6)})
 }).then(function(response){
  if(!response.ok)throw new Error("assistant_unavailable");
  return response.json();
 }).then(function(data){
  var answer=String(data&&data.answer||"").trim();
  if(!answer)throw new Error("empty_answer");
  msg(answer,"bot");
  var ids=Array.isArray(data.productIds)?data.productIds.map(String):[];
  if(ids.length){
   var selected=products.filter(function(p){return ids.indexOf(String(p.id))>=0;}).slice(0,4);
   if(selected.length)show(selected);
  }
 }).catch(function(){replyFallback(q);});
}
function send(q){
 q=String(q||"").trim();if(!q)return;
 msg(q,"user");
 chatTurns.push({role:"user",content:q});chatTurns=chatTurns.slice(-8);
 reply(q);
 var i=document.getElementById("dawlyBotInput");i.value="";
}
var launcher=document.createElement("button");launcher.id="dawlyBotLauncher";launcher.type="button";launcher.setAttribute("aria-label","افتح مساعد الدولي");launcher.innerHTML='<span class="dawly-bot-face" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M3 13v-2a9 9 0 0 1 18 0v2"/><rect x="2.5" y="11" width="4.5" height="8" rx="2"/><rect x="17" y="11" width="4.5" height="8" rx="2"/><path d="M19 19a5 5 0 0 1-5 3h-2"/></svg></span><span class="dawly-bot-prompt">تحدث مع مساعد الدولي</span>';
var panel=document.createElement("section");panel.id="dawlyBotPanel";panel.hidden=true;panel.setAttribute("aria-label","مساعد الدولي");panel.innerHTML='<header class="dawly-bot-head"><div class="dawly-bot-avatar">🤖</div><div><strong>مساعد الدولي</strong><small>مساعد فني للعدد والمنتجات</small></div><button type="button" id="dawlyBotClose" aria-label="إغلاق">×</button></header><div class="dawly-bot-messages" id="dawlyBotMessages" aria-live="polite"><div class="dawly-bot-chips" id="dawlyBotChips" hidden><button type="button">طقم مفكات WÜRTH</button><button type="button">بنط HSS للمعادن</button><button type="button">أدوات النجارة</button></div></div><form class="dawly-bot-form" id="dawlyBotForm"><input id="dawlyBotInput" autocomplete="off" placeholder="اسم الأداة أو الاستخدام أو المقاس..." aria-label="اكتب سؤالك"><button type="submit">إرسال</button></form><a class="dawly-bot-wa" href="https://wa.me/201024787222" target="_blank" rel="noopener">محتاج تأكيد فني؟ كلمنا واتساب</a>';
if(!fullPage) document.body.appendChild(launcher);
var chatHost=fullPage?(document.getElementById("assistantPageChat")||document.body):document.body;
panel.hidden=!fullPage;
if(fullPage) panel.classList.add("dawly-bot-fullpage");
chatHost.appendChild(panel);
function typeWelcomeMessage(){
  var messageBox=document.getElementById("dawlyBotMessages");
  var chips=document.getElementById("dawlyBotChips");
  if(!messageBox||messageBox.querySelector(".dawly-bot-msg"))return;
  var welcome="أهلاً بيك 👋\nأنا مساعدك الفني في الدولي. أقدر أساعدك تلاقي الأداة المناسبة من الكتالوج.\nقولي هتستخدمها في إيه وعلى أي خامة؟";
  var bubble=document.createElement("div");
  bubble.className="dawly-bot-msg bot dawly-welcome-typing";
  bubble.setAttribute("aria-label",welcome);
  messageBox.insertBefore(bubble,chips||null);
  var chars=Array.from(welcome),index=0;
  var reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function finish(){
    bubble.textContent=welcome;
    bubble.classList.remove("dawly-welcome-typing");
    if(chips)chips.hidden=false;
    messageBox.scrollTop=messageBox.scrollHeight;
  }
  if(reduced){finish();return;}
  function typeNext(){
    if(!bubble.isConnected)return;
    bubble.textContent+=chars[index++]||"";
    messageBox.scrollTop=messageBox.scrollHeight;
    if(index<chars.length)window.setTimeout(typeNext,27);
    else finish();
  }
  window.setTimeout(typeNext,420);
}
typeWelcomeMessage();
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
if(!fullPage){
  launcher.addEventListener("click",function(){window.location.href="assistant.html";});
  launcher.classList.add("dawly-prompt-visible");

}
document.getElementById("dawlyBotClose").addEventListener("click",function(){if(fullPage){window.location.href="index.html";return;}opened=false;panel.hidden=true;});
document.getElementById("dawlyBotForm").addEventListener("submit",function(e){e.preventDefault();send(document.getElementById("dawlyBotInput").value);});
panel.addEventListener("click",function(e){var b=e.target.closest(".dawly-bot-chips button");if(b)send(b.textContent);});
window.addEventListener("dawly-products-updated",function(e){if(Array.isArray(e.detail))products=e.detail;});
window.addEventListener("dawly-catalog-ready",function(){products=Array.isArray(window.DAWLY_PRODUCTS)?window.DAWLY_PRODUCTS:products;loadImages(panel);});
})();