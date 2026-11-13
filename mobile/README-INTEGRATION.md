## إعداد عنوان الخادم وتخزين الجلسة

يُضبط عنوان API من متغير البيئة `EXPO_PUBLIC_API_BASE_URL`، وليس من عنوان IP ثابت داخل الكود.
انسخ `.env.example` إلى `.env` داخل مجلد `mobile`، ثم ضع عنوان جهاز الخادم الذي يمكن للهاتف الوصول إليه، مثل:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:5000
```

استبدل العنوان بعنوان LAN الفعلي عند التطوير على هاتف حقيقي. في الإنتاج يجب استخدام HTTPS.
رمز الجلسة يُحفظ في `expo-secure-store`؛ وعند أول تشغيل بعد التحديث يُنقل الرمز القديم تلقائيًا من AsyncStorage إلى التخزين الآمن.
بعد ضبط المتغير شغّل `npx expo start -c`. حزمة `expo-secure-store` موجودة بالفعل في dependencies وExpo plugins.

## الميزات الجديدة (الدفعة الأخيرة)

**الحزم الجديدة:** `npx expo install tweetnacl expo-crypto expo-contacts expo-dev-client react-native-webrtc @config-plugins/react-native-webrtc` ثم `npm install`.

* **المكالمات (WebRTC):** تحتاج Development Build ولا تعمل داخل Expo Go: `npx expo prebuild` ثم `npx expo run:android` (أو `eas build --profile development`). للمكالمات عبر شبكات مختلفة أضف TURN في `.env` للسيرفر (`TURN_URL/TURN_USERNAME/TURN_PASSWORD`). لا يوجد رنين خلفي/CallKit؛ المكالمة تصل أثناء فتح التطبيق.
* **التشفير من طرف لطرف:** نصوص المحادثات الفردية فقط. المفتاح السري محفوظ في SecureStore على الجهاز ولا يُنسخ احتياطياً (إعادة تثبيت التطبيق = الرسائل المشفرة القديمة لا تُقرأ). جهاز واحد لكل حساب. إذا لم يُنشئ الطرف الآخر مفتاحه بعد تُرسل الرسالة بدون تشفير (الشارة 🔒 في أعلى المحادثة تظهر عند تفعيله). البحث في الرسائل المشفرة محلي (على المحمّل منها فقط) والإشعار يعرض "رسالة جديدة" بدون المحتوى. الوسائط (صور/ملفات/صوت) غير مشفرة.
* **الرسائل المختفية:** تُطبّق على الرسائل الجديدة فقط ويحذفها السيرفر دورياً.
* **الحكايات:** صور/فيديو لمدة 24 ساعة. **الحساب الخاص:** المنشورات والحكايات للمتابعين المعتمدين فقط.
* **جهات الاتصال:** تتطلب بناءً يتضمن إذن الجهات (expo-contacts).

## دفعة الأمان والميزات الإضافية
* **الحظر والإبلاغ:** من قائمة ⋯ في البروفايل، زر ⚑ على المنشورات، والرسائل (ضغط مطوّل)، وقائمة المحادثة. البلاغات تظهر في السيرفر عبر `GET /api/admin/reports` و`POST /api/admin/reports/:id/resolve` (لم أبنِ لها واجهة داخل لوحة التحكم بعد).
* **الإعدادات:** حساب خاص، الحسابات المحظورة، المنشورات المحفوظة، تنزيل بياناتي، سياسة الخصوصية (`/privacy` على السيرفر، عدّل `APP_NAME` و`SUPPORT_EMAIL`)، حذف الحساب.
* **المنشورات:** استطلاعات رأي (حتى 4 خيارات)، إعادة نشر، اقتباس، حفظ.
* **المحادثة:** أرشفة، تثبيت رسالة، إرسال الموقع (`npx expo install expo-location`).
* **السيرفر:** اختبارات `npm test` (لا تحتاج قاعدة بيانات)، `?before=<id>` للترقيم بالمؤشر، ترويسات أمان لـ `/uploads` ومنع SVG/HTML، دعم Sentry الاختياري.

## الدفعة المجانية الأخيرة
* **واجهة البلاغات** في لوحة التحكم (تبويب Reports): حذف المحتوى / تم الحل / تجاهل.
* **المحادثة:** ملصقات مدمجة، جدولة رسالة (أوقات جاهزة)، صور تُعرض مرة واحدة (تُحذف من السيرفر بعد 5 دقائق من فتحها)، ترجمة رسالة (🌐).
* **الترجمة** تعتمد خدمة MyMemory المجانية بدون مفتاح (حصة يومية محدودة ~5000 حرف للسيرفر كله). لرفعها مجاناً لـ ~50000 ضع أي بريد تملكه في `MYMEMORY_EMAIL` بملف `.env`.
* **نسخة احتياطية لمفتاح التشفير** (الإعدادات): تشفّره عبارة مرور على جهازك ولا يقرأه السيرفر. استعادته على هاتف آخر تتيح قراءة نفس المحادثات المشفرة على جهازين.
* **ملفات الدردشة والحكايات** صارت خاصة: لا تُفتح إلا بجلسة صالحة (التطبيق يضيف الرمز تلقائياً).
* **خلاصة "For you"** مرتبة بالتفاعل والحداثة وتعطي أولوية لمن تتابعهم.
* **المكالمات:** قناة إشعارات عالية الأهمية "Calls" وإشعار Push فوري عند المكالمة الواردة.

## Free / no-account batch
- Privacy & notifications screen (Settings → Privacy & notifications): hide online status, read receipts, who can message me, per-type notification toggles, quiet hours. Server: `GET/PUT /api/users/me/settings`.
- Offline cache: last feed and conversation list are shown instantly/offline (`src/services/cache.ts`), cleared on logout.
- Arabic/English (Settings → Language). Strings live in `src/i18n/index.tsx`; wrap new UI text with `t('English text')` and add the Arabic to the `ar` dict. RTL applies after restarting the app.
- Edit own post (✎ on your post) → `PUT /api/social/posts/:id`, shows "· edited".
- "Recording a voice message…" indicator in chats.
- Server: banned-words filter + admin audit log (`/api/admin/banned-words`, `/api/admin/audit`), CI workflow, prefs tests. Restart the server so the DB migrations run.

## Expo Go
The app now runs in Expo Go: voice messages use `expo-audio`, story videos use `expo-video`; `expo-av`, `expo-dev-client` and `react-native-webrtc` were removed. Calls are disabled in Expo Go (they need a development build + `react-native-webrtc`).

## Design refresh (not Twitter-like)
Violet palette (`src/theme/colors.ts`, light + dark), soft-card layout (posts, chat rows, settings rows, composer are rounded floating cards on a tinted background), squircle avatars/story rings, pill "For you / Following" switch, left-aligned headers with the app mark, rounded tab bar, 16-18px button radii. Everything is token-driven: change `primary` in `colors.ts` to recolor the whole app.

## Voice messages v2
Hold the mic to record (release = send, slide left = cancel); a quick tap starts/stops with a preview. Live waveform while recording, real waveform stored with the message (`messages.voice_waveform`, 34 digits), unheard dot on received voice messages, play/pause, seek, 1x/1.5x/2x speed.

## ميزات الدردشة الجديدة
- طابور الإرسال دون اتصال (outbox) مع إعادة محاولة تلقائية وعلامة "Not sent"
- السحب للرد، معاينة الروابط، خلفيات المحادثة وألوان الفقاعات (قائمة ⋮ ← Chat theme)
- الرسائل المميزة بنجمة + شاشة Starred + بحث شامل
- تحديد عدة رسائل (حذف/تحويل)، "Seen by" في المجموعات
- زر الانتقال لآخر رسالة مع عدّاد، مسودات لكل محادثة، استطلاعات، كتم مؤقت
> أعد تشغيل السيرفر لتطبيق ترحيلات قاعدة البيانات الجديدة.
