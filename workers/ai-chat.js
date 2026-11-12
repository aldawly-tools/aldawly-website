const MODEL = "gemini-3.8-flash";
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 20;
const hits = new Map();
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"", allowed=env.ALLOWED_ORIGIN||"https://aldawly-tools.github.io";
 const headers={"Access-Control-Allow-Origin":origin===allowed?origin:"null","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(origin!==allowed)return json({error:"Origin not allowed"},403,headers);
 if(request.method!=="POST")return json({error:"Method not allowed"},405,headers);
 if(!env.GEMINI_API_KEY)return json({error:"المساعد لم يتم تفعيل مفتاحه بعد."},503,headers);
 const ip=request.headers.get("CF-Connecting-IP")||"unknown",now=Date.now(),recent=(hits.get(ip)||[]).filter(t=>now-t<WINDOW_MS);
 if(recent.length>=MAX_REQUESTS)return json({error:"وصلت للحد المؤقت من الأسئلة. حاول بعد ساعة."},429,headers);
 recent.push(now);hits.set(ip,recent);
 let body;try{const raw=await request.text();if(raw.length>18000)return json({error:"الرسالة كبيرة جدًا."},413,headers);body=JSON.parse(raw);}catch{return json({error:"طلب غير صالح."},400,headers);}
 const message=String(body.message||"").trim().slice(0,1200);if(!message)return json({error:"اكتب سؤالك أولاً."},400,headers);
 const catalog=Array.isArray(body.products)?body.products.slice(0,60).map(p=>({id:String(p.id||"").slice(0,30),name:String(p.name||"").slice(0,100),brand:String(p.brand||"").slice(0,50),category:String(p.cat||"").slice(0,60),price:String(p.price||"السعر عند الاستفسار").slice(0,50),stock:Number.isInteger(p.stock)&&p.stock>=0?p.stock:null,description:String(p.desc||"").slice(0,220),specs:String(p.specs||"").slice(0,300)})):[];
 const history=Array.isArray(body.history)?body.history.slice(-8).map(m=>({role:m.role==="model"?"model":"user",parts:[{text:String(m.text||"").slice(0,1000)}]})):[];
 const system="أنت مساعد المبيعات الفني لمتجر الدولي للعدد الأصلية في مصر. أجب بالعربية المصرية الواضحة وباختصار مفيد. استخدم كتالوج المنتجات المرفق فقط عند ذكر منتج أو سعر أو كمية أو مواصفة. لا تخترع بلد منشأ أو أصالة أو سعرًا أو مخزونًا أو مواصفة غير موجودة. إذا لم تجد المعلومة فقل إنها غير متاحة واطلب التواصل على واتساب 01024787222. اسأل سؤالًا توضيحيًا واحدًا عند الحاجة. لا تقدم تعليمات خطرة ولا تدّعِ أنك موظف بشري.";
 const contents=[...history,{role:"user",parts:[{text:"كتالوج المتجر JSON:\n"+JSON.stringify(catalog)+"\nسؤال العميل: "+message}]}];
 const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature:0.35,maxOutputTokens:700}})});
 if(!response.ok)return json({error:response.status===429?"المساعد مشغول حاليًا. حاول بعد قليل.":"تعذر الحصول على رد من المساعد حاليًا."},502,headers);
 const result=await response.json(),answer=result.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();
 if(!answer)return json({error:"لم يصل رد واضح. جرّب صياغة السؤال بطريقة أخرى."},502,headers);
 return json({reply:answer},200,headers);
}};