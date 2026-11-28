# إعداد الرد التلقائي لمنتجات المتجر على واتساب

الرد التلقائي يستقبل رسالة العميل على رقم واتساب المتجر، يبحث عن أقرب المنتجات في مجموعة `products` في Firestore، ثم يرسل أسماء المنتجات والأسعار والتوفر المسجل وروابط صفحاتها. لا يخمّن المنتج عند عدم وجود تطابق. السعر والتوفر النهائيان يظلّان بحاجة إلى تأكيد المتجر.

## المتطلبات

- تطبيق Meta مضاف إليه منتج WhatsApp Business Platform، ورقم متجر مفعّل لاستقبال وإرسال الرسائل عبر Cloud API.
- رقم المتجر المختار للربط هو `01024787222`.
- Firebase CLI مسجّل الدخول على مشروع المتجر `wurth-29a1b`.
- مستودع الموقع منشور عبر Firebase Cloud Functions كما هو محدد في `firebase.json`.

## إعداد أسرار Firebase

من مجلد المشروع، نفّذ الأوامر التالية. سيطلب Firebase CLI قيمة كل سر؛ أدخلها في الطرفية ولا تحفظها في ملفات الموقع أو GitHub:

```sh
firebase use wurth-29a1b
firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN
firebase functions:secrets:set WHATSAPP_APP_SECRET
```

القيم:

- `WHATSAPP_ACCESS_TOKEN`: رمز وصول دائم للتطبيق مع صلاحية إرسال رسائل WhatsApp Business.
- `WHATSAPP_PHONE_NUMBER_ID`: معرّف رقم الهاتف `01024787222` الظاهر في إعدادات WhatsApp داخل Meta، وليس رقم الهاتف نفسه.
- `WHATSAPP_VERIFY_TOKEN`: قيمة عشوائية تختارها أنت. أدخل القيمة نفسها لاحقًا في إعداد Webhook لدى Meta.
- `WHATSAPP_APP_SECRET`: App Secret الخاص بتطبيق Meta، للتحقق من توقيع كل إشعار Webhook.

## نشر الدالة وربط Webhook

انشر الدالة:

```sh
firebase deploy --only functions:whatsappProductAutoReply
```

انسخ عنوان الدالة الذي يظهر في نتيجة النشر. في لوحة تطبيق Meta، افتح إعداد WhatsApp Webhooks، وضع عنوان الدالة في `Callback URL`، واستخدم قيمة `WHATSAPP_VERIFY_TOKEN` نفسها في `Verify token`. بعد نجاح التحقق، اشترك في حقل `messages`.

بعد ربط Webhook، أرسل من رقم اختبار مسجّل في تطبيق Meta سؤالًا مثل «محتاج بنطة خرسانة ٨ مم». الدالة تبحث في كتالوج Firestore وترد بأفضل ثلاثة تطابقات وروابطها. الرسائل النصية هي المدعومة للبحث؛ الرسائل الصوتية والصور تتلقى توجيهًا لإرسال اسم المنتج أو الماركة أو رقم الموديل كتابةً.

## تنظيف سجل منع التكرار

تكتب الدالة معرّفًا مجزّأً لكل رسالة واردة في مجموعة `whatsappWebhookEvents` لمنع تكرار الرد عند إعادة Meta إرسال Webhook. يضيف كل مستند حقل `expiresAt` بعد سبعة أيام. من إعدادات قاعدة Firestore، فعّل **Time to Live** على الحقل `expiresAt` لمجموعة المستندات `whatsappWebhookEvents` كي تُحذف سجلات منع التكرار تلقائيًا.

## ملاحظات تشغيل

- لا تضع Access Token أو App Secret في `firebase-config.js` أو أي ملف واجهة أمامية.
- إذا كانت الأسعار أو المخزونات غير محدّثة في Firestore، سيعكس الرد البيانات المسجلة هناك؛ راجعها من لوحة إدارة المنتجات.
- Cloud API وWebhook يشترطان إعدادًا صحيحًا في Meta. رفع التغييرات إلى الموقع وحده لا يفعّل الربط قبل إكمال إعداد الأسرار والاشتراك في حقل `messages`.
