import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { I18nManager, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'en' | 'ar';

// Add new strings here: the key is the English text itself, so untranslated strings simply stay English.
const ar: Record<string, string> = {
  'Settings': 'الإعدادات',
  'Account information': 'معلومات الحساب',
  'Name, bio and profile photo': 'الاسم والنبذة والصورة',
  'Private account': 'حساب خاص',
  'Only people you approve can follow you and see your posts and stories': 'فقط من توافق عليهم يتابعونك ويرون منشوراتك وحكاياتك',
  'Privacy & notifications': 'الخصوصية والإشعارات',
  'Language': 'اللغة',
  'Starred messages': 'الرسائل المميزة بنجمة',
  'Encryption key backup': 'نسخة احتياطية لمفتاح التشفير',
  'Keep your encrypted chats after reinstalling or on a second phone': 'احتفظ بمحادثاتك المشفرة بعد إعادة التثبيت أو على هاتف ثانٍ',
  'Saved posts': 'المنشورات المحفوظة',
  'Blocked accounts': 'الحسابات المحظورة',
  'Security': 'الأمان',
  'Download my data': 'تنزيل بياناتي',
  'Privacy policy': 'سياسة الخصوصية',
  'Delete account': 'حذف الحساب',
  'Terms of Service': 'شروط الخدمة',
  'Log out': 'تسجيل الخروج',
  'Home': 'الرئيسية',
  'Search': 'بحث',
  'Messages': 'الرسائل',
  'Go back': 'رجوع',
  'Profile': 'الملف الشخصي',
  'More': 'المزيد',
  'Search chats': 'ابحث في المحادثات',
  'For you': 'لك',
  'Following': 'المتابَعون',
  'Posts': 'المنشورات',
  'Media': 'الوسائط',
  'Likes': 'الإعجابات',
  'Hide online status': 'إخفاء حالة الاتصال',
  'Others will not see when you are online or your last seen': 'لن يرى الآخرون متى تكون متصلاً أو آخر ظهور لك',
  'Read receipts': 'إشعارات القراءة',
  'If off, people will not see when you read their messages': 'عند الإيقاف لن يرى الآخرون متى قرأت رسائلهم',
  'Who can message me': 'من يستطيع مراسلتي',
  'Everyone': 'الجميع',
  'Only people I follow': 'فقط من أتابعهم',
  'Nobody': 'لا أحد',
  'Notifications': 'الإشعارات',
  'Messages notifications': 'إشعارات الرسائل',
  'Likes and reactions': 'الإعجابات والتفاعلات',
  'Comments': 'التعليقات',
  'New followers': 'المتابعون الجدد',
  'Mentions': 'الإشارات',
  'Groups': 'المجموعات',
  'Quiet hours': 'ساعات الهدوء',
  'No push notifications during these hours': 'بدون إشعارات خلال هذه الساعات',
  'From': 'من',
  'To': 'إلى',
  'Cancel': 'إلغاء',
  'Restart needed': 'يلزم إعادة التشغيل',
  'Close and reopen the app to apply the language and layout direction.': 'أغلق التطبيق وافتحه من جديد لتطبيق اللغة واتجاه الواجهة.',
  'Admin dashboard': 'لوحة تحكم المسؤول',
  'Overview': 'نظرة عامة',
  'Users': 'المستخدمون',
  'Content': 'المحتوى',
  'Reports': 'البلاغات',
  'Audit': 'سجل النشاط',
  'Online': 'متصلون',
  'New today': 'جدد اليوم',
  'Banned': 'محظورون',
  'Messages today': 'رسائل اليوم',
  'Conversations': 'المحادثات',
  'Open reports': 'بلاغات مفتوحة',
  'All': 'الكل',
  'Interactions': 'التفاعلات',
  'Follows': 'المتابعات',
  'Announcements': 'الإعلانات',
  'Today': 'اليوم',
  'Yesterday': 'أمس',
  'This week': 'هذا الأسبوع',
  'Earlier': 'سابقاً',
  'No notifications yet': 'لا توجد إشعارات بعد',
  'App updates, announcements, reactions, replies and group invitations will show up here.': 'ستظهر هنا تحديثات التطبيق والإعلانات والتفاعلات والردود ودعوات المجموعات.',
  'reacted to your post': 'تفاعل مع منشورك',
  'reacted to your comment': 'تفاعل مع تعليقك',
  'replied to you': 'رد عليك',
  'replied to your post': 'رد على منشورك',
  'started following you': 'بدأ بمتابعتك',
  'requested to follow you': 'طلب متابعتك',
  'accepted your follow request': 'قبل طلب متابعتك',
  'invited you to join': 'دعاك للانضمام إلى',
  'asked to join': 'طلب الانضمام إلى',
  'approved your request to join': 'وافق على طلبك للانضمام إلى',
  'mentioned you in a comment': 'أشار إليك في تعليق',
  'mentioned you in a post': 'أشار إليك في منشور',
  'published an announcement': 'نشر إعلاناً جديداً',
  'sent your daily notification summary': 'أرسل ملخص إشعاراتك اليومي',
  'sent you a message': 'أرسل لك رسالة',
  'replied to your message': 'رد على رسالتك',
  'sent you a notification': 'أرسل لك إشعاراً',
  'Delete notification': 'حذف الإشعار',
  'Remove this notification?': 'هل تريد إزالة هذا الإشعار؟',
  'Delete': 'حذف',
  'Error': 'خطأ',
  'Could not update the request': 'تعذر تحديث الطلب',
  'Follow back': 'متابعة بالمقابل',
  'Accept': 'قبول',
  'Decline': 'رفض',
  'Request accepted': 'تم قبول الطلب',
  'Request declined': 'تم رفض الطلب',
};

const dict: Record<Lang, Record<string, string>> = { en: {}, ar };

interface Ctx { lang: Lang; t: (s: string) => string; setLang: (l: Lang) => Promise<void> }
const I18n = createContext<Ctx>({ lang: 'en', t: (s) => s, setLang: async () => {} });
export const useI18n = () => useContext(I18n);

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem('app_lang').then((l) => { if (l === 'ar' || l === 'en') setLangState(l); }).catch(() => {});
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem('app_lang', l).catch(() => {});
    const rtl = l === 'ar';
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl); // takes effect after the next launch
      Alert.alert(dict[l]['Restart needed'] || 'Restart needed', dict[l]['Close and reopen the app to apply the language and layout direction.'] || 'Close and reopen the app to apply the language and layout direction.');
    }
  }, []);

  const t = useCallback((s: string) => dict[lang][s] || s, [lang]);
  return <I18n.Provider value={{ lang, t, setLang }}>{children}</I18n.Provider>;
};
