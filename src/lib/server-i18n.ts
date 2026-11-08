import { createInstance } from "i18next";
import en from "../locales/en.json";

const i18n = createInstance();
await i18n.init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});
export default i18n;
