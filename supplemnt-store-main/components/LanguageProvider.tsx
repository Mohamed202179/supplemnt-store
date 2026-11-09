"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translations, Lang, TranslationKey } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "daily_dose_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");
  const [ready, setReady] = useState(false);

  // Load saved preference once on mount.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "en" || stored === "ar") {
      setLang(stored);
    }
    setReady(true);
  }, []);

  // Reflect the current language on <html> (dir + lang) and persist it.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, ready]);

  function toggleLang() {
    setLang((prev) => (prev === "ar" ? "en" : "ar"));
  }

  function t(key: TranslationKey): string {
    return translations[lang][key] ?? translations.ar[key] ?? key;
  }

  return <LanguageContext.Provider value={{ lang, toggleLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
