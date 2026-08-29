import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ta from './locales/ta.json';
import hi from './locales/hi.json';
import gu from './locales/gu.json';
import mr from './locales/mr.json';
import kok from './locales/kok.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import te from './locales/te.json';
import or from './locales/or.json';
import bn from './locales/bn.json';

const resources = {
  en: { translation: en },
  ta: { translation: ta },
  hi: { translation: hi },
  gu: { translation: gu },
  mr: { translation: mr },
  kok: { translation: kok },
  kn: { translation: kn },
  ml: { translation: ml },
  te: { translation: te },
  or: { translation: or },
  bn: { translation: bn },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
