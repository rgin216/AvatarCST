import { useContext } from "react";
import { LanguageContext } from "./languageContextValue.js";

export function useLanguage() {
  return useContext(LanguageContext);
}
