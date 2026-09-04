import { createContext } from "react";

export const LanguageContext = createContext({ language: "en", t: (key) => key });
