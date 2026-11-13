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
  'Messages': 'الرسائل',
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
  'Search': 'بحث',
  'Cancel': 'إلغاء',
  'Restart needed': 'يلزم إعادة التشغيل',
  'Close and reopen the app to apply the language and layout direction.': 'أغلق التطبيق وافتحه من جديد لتطبيق اللغة واتجاه الواجهة.',
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
