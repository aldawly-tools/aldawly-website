# تفعيل مساعد الدولي الذكي مجانًا

تم تجهيز واجهة المحادثة وملف الخادم. لن يعمل الرد الذكي قبل نشر Worker وإضافة مفتاح Gemini كـ Secret. لا تضع المفتاح في GitHub أو ملفات الموقع.

## 1) إنشاء مفتاح Gemini المجاني
1. افتح https://aistudio.google.com/app/apikey
2. سجّل بحساب Google وأنشئ API key.
3. لا ترسل المفتاح في محادثة ولا تضعه في ملف بالمستودع. الخطة المجانية لها حدود استخدام وقد تتغير، وبيانات الطلبات على الخطة المجانية قد تستخدم لتحسين منتجات Google.

## 2) نشر خادم Cloudflare Worker
1. افتح https://dash.cloudflare.com/ وسجّل حسابًا مجانيًا.
2. Workers & Pages ثم Create ثم Create Worker.
3. افتح Edit code وانسخ محتوى الملف workers/ai-chat.js.
4. احفظ وانشر Worker.
5. من Settings ثم Variables and Secrets أضف Secret باسم GEMINI_API_KEY وضع فيه مفتاح Gemini.
6. أضف Text variable باسم ALLOWED_ORIGIN وقيمته https://aldawly-tools.github.io
7. احفظ ثم Deploy. يوجد حد احترازي مبدئي 20 طلبًا لكل عنوان IP في الساعة لكل نسخة تشغيلية، وليس نظام حصص مضمونًا.

## 3) ربط الموقع بالخادم
1. انسخ رابط Worker المنشور، مثل https://اسمك.workers.dev
2. افتح ملف ai-chat.js في GitHub.
3. استبدل PUT_CLOUDFLARE_WORKER_URL_HERE بالرابط، ثم احفظ.
4. افتح الموقع وجرّب زر اسأل مساعد الدولي.

## تنبيهات
- Gemini API يوفر مستوى مجانيًا محدودًا لبعض النماذج؛ تجاوز الحصة قد يوقف الردود حتى تجدد الحصة. لا تفعّل الفوترة إذا كان شرطك عدم الدفع.
- لا تستخدم بيانات العملاء الشخصية في المحادثة.
- لا تشارك مفتاح Gemini علنًا. راجع الحصة والاستخدام في Google AI Studio.
