"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import { useLanguage } from "@/components/LanguageProvider";

export default function SettingsPage() {
  const { t, lang, toggleLang } = useLanguage();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!currentPassword) {
      setError(t("settings_error_current_required"));
      return;
    }
    if (newPassword.length < 6) {
      setError(t("settings_error_short"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("settings_error_mismatch"));
      return;
    }

    setSaving(true);

    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verifyErr) {
      setSaving(false);
      setError(t("settings_error_wrong_current"));
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });

    setSaving(false);

    if (updateErr) {
      setError(t("settings_error_generic"));
      return;
    }

    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div>
      <PageHeader title={t("settings_title")} />

      <div className="space-y-4 p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{t("settings_email_label")}</p>
          <p className="mt-1 font-bold text-gray-900">{email || "..."}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-bold text-gray-900">{t("settings_language_section")}</h2>
          <p className="mb-3 text-xs text-gray-400">{t("settings_language_desc")}</p>
          <div className="flex gap-2">
            <button
              onClick={() => lang !== "ar" && toggleLang()}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${
                lang === "ar" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              العربية
            </button>
            <button
              onClick={() => lang !== "en" && toggleLang()}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${
                lang === "en" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              English
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-900">{t("settings_password_section")}</h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            {success && (
              <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{t("settings_success")}</div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("settings_current_password")}</span>
              <input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="••••••••"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("settings_new_password")}</span>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">{t("settings_confirm_password")}</span>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-sm active:bg-brand-700 disabled:opacity-60"
            >
              {saving ? t("settings_submit_loading") : t("settings_submit")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
