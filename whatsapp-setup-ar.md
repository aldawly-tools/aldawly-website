# تفعيل الرد التلقائي لمنتجات المتجر على واتساب

يستقبل الموقع رسائل WhatsApp Cloud API على المسار `/api/whatsapp-webhook`، ويبحث عن المنتجات في كتالوج Firestore، ثم يرسل أسماء أقرب النتائج وأسعارها والتوفر المسجل وروابطها. يعتمد المسار على Cloudflare Pages Functions وقاعدة D1 المرتبطة حاليًا باسم `DB`.

رقم المتجر المطلوب ربطه: `01024787222`. يلزم استخدام حساب WhatsApp Business Platform مفعّل لهذا الرقم؛ رقم الهاتف وحده لا يكفي لإنشاء اتصال API.

## 1. تجهيز قاعدة منع التكرار

من لوحة Cloudflare، افتح قاعدة D1 المربوطة بمشروع Pages باسم `DB`، ثم نفّذ محتوى الملف:

```text
migrations/0002_create_whatsapp_webhook_events.sql
```

يسجل الجدول معرّفات الرسائل الواردة حتى لا يرسل الموقع الرد مرتين عند إعادة Meta إرسال الإشعار.

## 2. إضافة الأسرار إلى Cloudflare Pages

افتح مشروع Pages المسمى `aldawly-website` ثم **Settings → Variables and Secrets**. أضف الأسرار التالية لبيئتي **Production** و**Preview**، ثم أعد نشر الموقع بعد حفظها:

| الاسم | القيمة المطلوبة |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | رمز وصول WhatsApp Cloud API بصلاحية إرسال الرسائل |
| `WHATSAPP_PHONE_NUMBER_ID` | معرّف رقم الهاتف داخل Meta، وليس `01024787222` نفسه |
| `WHATSAPP_VERIFY_TOKEN` | عبارة عشوائية تختارها وتستخدمها نفسها في إعداد Webhook لدى Meta |
| `WHATSAPP_APP_SECRET` | App Secret لتطبيق Meta، للتحقق من توقيع الإشعارات |

احفظ القيم كـ **Encrypted secrets**، ولا تضفها إلى ملفات الموقع أو GitHub أو المحادثة.

## 3. ربط Webhook لدى Meta

في تطبيق Meta الذي يحتوي على منتج WhatsApp، افتح إعدادات Webhooks وأدخل:

- **Callback URL:** `https://aldawly-website.pages.dev/api/whatsapp-webhook`
- **Verify token:** القيمة نفسها المخزنة في `WHATSAPP_VERIFY_TOKEN`

تحقق من عنوان Webhook، ثم اشترك في حقل `messages` لحساب WhatsApp Business المرتبط بالرقم. يجب أن يكون هذا الرقم مضافًا ومفعّلًا في WhatsApp Cloud API، وأن يطابق `WHATSAPP_PHONE_NUMBER_ID` معرّف الرقم الظاهر في Meta.

## 4. تجربة الرد

بعد نشر الأسرار وتفعيل Webhook، أرسل من هاتف آخر رسالة مثل «محتاج بنطة خرسانة ٨ مم» إلى رقم المتجر. يرد الموقع بأفضل ثلاثة تطابقات من الكتالوج، ويطلب وصفًا إضافيًا إذا لم يجد تطابقًا موثوقًا. الرسائل النصية مدعومة للبحث؛ الرسائل الصوتية والصور تتلقى توجيهًا لإرسال اسم المنتج كتابةً.

يؤكد الرد أن السعر والتوفر النهائيين لدى المتجر حتى لا يعرض بيانات Firestore كضمان للبيع. يلزم اختبار الرسالة بعد تفعيل حساب WhatsApp API فعليًا؛ معاينة الموقع وحدها لا ترسل رسائل واتساب.
