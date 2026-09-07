import { useMemo } from "react";
import translations from "./translations";
import { LanguageContext } from "./languageContextValue.js";

export function LanguageProvider({ language = "en", children }) {
  const value = useMemo(() => ({
    language,
    t: (key, vars) => {
      let str = translations[language]?.[key] ?? translations.en[key] ?? key;
      if (vars) {
        for (const [name, val] of Object.entries(vars)) {
          str = str.split(`{${name}}`).join(String(val));
        }
      }
      return str;
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
