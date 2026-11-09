"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: "system",
  setThemeMode: () => {},
  resolvedTheme: "light",
});

const STORAGE_KEY = "daily_dose_theme";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [ready, setReady] = useState(false);

  // Load saved preference + current system preference once on mount.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeModeState(stored);
    }
    setSystemPrefersDark(getSystemPrefersDark());
    setReady(true);
  }, []);

  // Keep listening to the device's setting while "system" mode is active.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: "light" | "dark" =
    themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : themeMode;

  // Apply/remove the `dark` class Tailwind's dark: variants key off of.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    window.localStorage.setItem(STORAGE_KEY, themeMode);
  }, [resolvedTheme, themeMode, ready]);

  function setThemeMode(mode: ThemeMode) {
    setThemeModeState(mode);
  }

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
