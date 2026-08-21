import { useMemo } from "react";
import translations from "./translations";
import { LanguageContext } from "./languageContextValue.js";

export function LanguageProvider({ language = "en", children }) {
  const value = useMemo(() => ({
    language,
    t: (key) => translations[language]?.[key] ?? translations.en[key] ?? key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
