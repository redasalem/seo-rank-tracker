# 🌟 RankBoost - دليل الـ API الشامل

مرحباً بك في دليل المطورين الخاص بـ API مشروع **RankBoost**. 
هذا الدليل يشرح لك كل المسارات (Endpoints) المتاحة في الباك إند، كيفية استخدامها، البيانات المطلوبة (Payloads)، وماذا تتوقع أن يرد عليك السيرفر (Responses).

---

## 🔒 المصادقة والحماية (Authentication)
معظم مسارات هذا النظام **محمية** وتحتاج إلى تسجيل دخول. عند تسجيل الدخول، ستحصل على `Token` (JWT) بالإضافة إلى كوكيز للحماية الإضافية. يجب إرسال الـ Token في **Header** أي طلب محمي كالتالي:
```http
Authorization: Bearer <your_jwt_token_here>
```

---

## 🧑‍💻 1. مسارات المستخدمين (Auth API)

- `POST /api/auth/register` - إنشاء حساب جديد (يحتاج: `name`, `email`, `password`)
- `POST /api/auth/login` - تسجيل الدخول (يحتاج: `email`, `password`)
- `POST /api/auth/logout` - تسجيل الخروج وإلغاء الجلسة
- `GET /api/auth/getCurrentUser` - جلب بيانات المستخدم الحالي المسجل
- `GET /api/auth/refresh` - تجديد الـ Access Token باستخدام الـ Refresh Token الموجود في الكوكيز
- `PUT /api/auth/profile` - تحديث الاسم والبريد الإلكتروني (يحتاج: `name`, `email`)
- `PUT /api/auth/password` - تحديث كلمة المرور (يحتاج: `currentPassword`, `newPassword`)
- `POST /api/auth/forgot-password` - طلب استعادة كلمة المرور (يحتاج: `email`)
- `POST /api/auth/reset-password/:token` - تعيين كلمة مرور جديدة باستخدام التوكن (يحتاج: `password`)

---

## 📈 2. مسارات تتبع الكلمات المفتاحية (Rank Tracking API)

- `POST /api/rank/add` - إضافة كلمة جديدة لبدء التتبع (يحتاج: `keyword`, `url`, `country`)
- `GET /api/rank/stats` - جلب إحصائيات عامة للوحة التحكم (Dashboard Stats)
- `GET /api/rank/competitors` - جلب تحليل المنافسين لجميع كلمات المستخدم
- `GET /api/rank` - جلب جميع الكلمات المفتاحية الخاصة بالمستخدم
- `GET /api/rank/:id` - جلب تفاصيل كلمة معينة بالـ ID (يتضمن تاريخ الترتيب والمنافسين)
- `POST /api/rank/:id/refresh` - إجبار السيرفر لتحديث الترتيب فوراً
- `PUT /api/rank/:id/toggle` - تفعيل/إيقاف التتبع التلقائي اليومي للكلمة
- `DELETE /api/rank/:id` - حذف الكلمة من سجلات النظام

---

## 🔍 3. مسارات تحليل السيو (SEO Analysis API)

- `POST /api/analysis/start` - بدء فحص وتقييم موقع (يحتاج: `url`)
- `GET /api/analysis` - جلب سجل وفحوصات الموقع السابقة الخاصة بالمستخدم
- `GET /api/analysis/:id` - جلب التقرير المفصل للفحص بالـ ID

---

## 🔔 4. مسارات الإشعارات (Notifications API)

- `GET /api/notifications` - جلب إشعارات المستخدم (ترتيب تحسن، فحص اكتمل، الخ)
- `PUT /api/notifications/read-all` - تحديد جميع الإشعارات كمقروءة
- `PUT /api/notifications/:id/read` - تحديد إشعار معين كمقروء

---

## 💳 5. مسارات الاشتراكات (Subscription API - Stripe)

- `POST /api/subscription/create-checkout-session` - بدء عملية الدفع للاشتراك
- `POST /api/subscription/create-portal-session` - الدخول لمدير الاشتراكات (Stripe Customer Portal)
- `POST /api/subscription/webhook` - مسار غير محمي مخصص لـ Stripe لتحديث حالات الدفع

---

## 🛠️ 6. مسارات لوحة تحكم الإدارة (Admin API)

**ملاحظة:** جميع هذه المسارات محمية وتتطلب صلاحيات `admin`.
- `GET /api/admin/stats` - جلب إحصائيات شاملة للنظام (عدد المستخدمين، الفحوصات، الخ)
- `GET /api/admin/users` - جلب جميع المستخدمين المسجلين في النظام
- `PUT /api/admin/users/:id` - تحديث صلاحيات أو خطة مستخدم معين

---

## ⏰ 7. مهام الخلفية التلقائية (Cron Jobs)

- `GET /api/cron/daily` - التحديث اليومي لترتيب المواقع. (مخصص لـ Vercel Cron ومحمي عبر `CRON_SECRET`)
