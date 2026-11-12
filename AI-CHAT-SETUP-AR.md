# تفعيل مساعد الدولي الذكي

المساعد يستخدم Cloudflare Worker كخادم مجاني ضمن حدود Cloudflare، ويرسل الأسئلة إلى Gemini. الواجهة جاهزة والملف `workers/ai-chat.js` يتصل بالنموذج `gemini-3.8-flash`. يجب نشر الخادم وإضافة مفتاح Gemini قبل أن تعمل الردود الذكية.

> لا تضع مفتاح Gemini في GitHub أو في `ai-chat.js`. خزّنه في Cloudflare كـ Secret باسم `GEMINI_API_KEY`. لا ترسل المفتاح في محادثة.

## 1) إنشاء مفتاح Gemini

1. افتح [Google AI Studio — API keys](https://aistudio.google.com/app/apikey) وسجّل الدخول.
2. أنشئ مفتاح API وانسخه للاستخدام في خطوة Cloudflare.
3. لا تفعّل الفوترة إذا كنت تريد البقاء على الاستخدام المجاني. المجانية وحدودها تعتمد على النموذج والحساب وقد تتغير؛ راجع [صفحة الأسعار والحدود الرسمية](https://ai.google.dev/gemini-api/docs/pricing) قبل الاستخدام. الطلبات في الطبقة المجانية قد تُستخدم لتحسين منتجات Google.

## 2) إنشاء ونشر Cloudflare Worker

1. افتح [لوحة Cloudflare](https://dash.cloudflare.com/) وأنشئ حسابًا مجانيًا إن لم يكن لديك حساب.
2. اختر **Workers & Pages** ثم **Create application** ثم **Create Worker**.
3. سمِّ العامل مثلًا `aldawly-ai-chat)، ثم أنشئه.
4. افتح **Edit code**. استبدل محتوى الملف الافتراضي بالكامل بمحتوى `workers/ai-chat.js` من المستودع، ثم اختر **Deploy**.
5. افتح العامل المنشور، ثم **Settings** > **Variables and Secrets** > **Add**:
   - النوع: **Secret**
   - الاسم: `GEMINI_API_KEY`
   - القيمة: الصق مفتاح Gemini
6. أضف متغيرًا آخر:
   - النوع: **Text**
   - الاسم: `ALLOWED_ORIGIN`
   - القيمة: `https://aldawly-tools.github.io`
7. اختر **Deploy** لحفظ التغييرات. سيظهر رابط العامل على شكل `https://اسم-العامل.اسمك.workers.dev`. انسخ الرابط.

Cloudflare يخفي قيمة الـ Secret بعد حفظها، وهذا هو المكان المقصود للمفتاح. لا تكتب المفتاح كـ Text variable.

## 3) ربط الموقع بالعامل

1. افتح ملف `ai-chat.js` في GitHub.
2. في أول الملف، غيّر السطر `const API_URL="PUT_CLOUDFLARE_WORKER_URL_HERE";` إلى رابط العامل الذي نسخته، مع إبقاء علامات الاقتباس. مثال: `const API_URL="https://aldawly-ai-chat.example.workers.dev";`
3. احفظ التغيير في GitHub. لا تضع أي مفتاح في هذا الملف؛ رابط العامل ليس سرًا.
4. انتظر تحديث GitHub Pages، ثم افتح [مساعد اختيار العدد](https://aldawly-tools.github.io/aldawly-website/advisor.html) وجرّب سؤالًا عامًا عن اختيار أداة. زر المساعد يظهر أيضًا في صفحات المتجر.

## ملاحظات وحدود

- الخادم يقبل طلبات الموقع من نطاق GitHub Pages المحدد فقط، ويتحقق من أن الطريقة POST، ويضع حدًا احترازيًا قدره 20 طلبًا لكل عنوان IP في الساعة لكل نسخة تشغيلية. هذا الحد داخل ذاكرة العامل؛ ليس نظام حصص دقيقًا أو مضمونًا.
- Gemini وCloudflare لديهما حدود استخدام مستقلة. لا تفعّل الفوترة لدى Google إن كان شرطك عدم الدفع، وراجع الحصة في AI Studio.
- لا تُدخل بيانات شخصية للعملاء في أسئلة المساعد.
- إذا ظهر خطأ بعد الربط، تحقق من اسم الـ Secret والرابط وقيمة `ALLOWED_ORIGIN`، ثم راجع سجلات العامل في Cloudflare. لا تشارك مفتاح Gemini أثناء طلب المساعدة.
