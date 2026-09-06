"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, toggleLang } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError(t("login_error_missing"));
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(t("login_error_invalid"));
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gray-50 px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <button
            onClick={toggleLang}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600"
          >
            {lang === "ar" ? t("settings_language_switch_to_en") : t("settings_language_switch_to_ar")}
          </button>
        </div>

        <div className="mb-8 text-center">
          <img
            src="/icons/icon-512.png"
            alt="Daily Dose Supplements"
            className="mx-auto mb-3 h-20 w-20 rounded-2xl object-cover shadow-sm"
          />
          <h1 className="text-xl font-bold text-gray-900">Daily Dose Supplements</h1>
          <p className="mt-1 text-sm text-gray-400">{t("login_subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("login_email_label")}</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="owner@store.com"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("login_password_label")}</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-sm active:bg-brand-700 disabled:opacity-60"
          >
            {loading ? t("login_button_loading") : t("login_button")}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">{t("login_footer_note")}</p>
      </div>
    </div>
  );
}
