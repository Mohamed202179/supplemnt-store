"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
export default function ForgotPasswordPage() {
  const { lang, toggleLang } = useLanguage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError(
        lang === "ar"
          ? "من فضلك اكتب البريد الإلكتروني."
          : "Please enter your email address."
      );
      return;
    }
    setLoading(true);
    try {
      // Use the main production domain, not a Vercel Preview URL.
      const redirectTo =
        "https://mr-supplement.vercel.app/reset-password";
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo,
        });
      if (resetError) {
        console.error("Password reset request failed:", resetError);
        setError(
          lang === "ar"
            ? "تعذر إرسال رابط الاستعادة. حاول مرة أخرى."
            : "Unable to send the reset link. Please try again."
        );
        return;
      }
      setSuccess(
        lang === "ar"
          ? "لو البريد مسجل عندنا، هتوصلك رسالة فيها رابط تعيين كلمة مرور جديدة. راجع صندوق الوارد والرسائل غير المرغوب فيها."
          : "If this email is registered, you will receive a password reset link. Check your inbox and spam folder."
      );
    } catch (err) {
      console.error("Unexpected password reset error:", err);
      setError(
        lang === "ar"
          ? "حصل خطأ غير متوقع. حاول مرة أخرى."
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex min-h-screen flex-col justify-center bg-gray-50 px-6 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={toggleLang}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {lang === "ar" ? "English" : "العربية"}
          </button>
        </div>
        <div className="mb-8 text-center">
          <img
            src="/icons/icon-512.png"
            alt="Mr Supplement"
            className="mx-auto mb-3 h-20 w-20 rounded-2xl object-cover shadow-sm"
          />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {lang === "ar"
              ? "استعادة كلمة المرور"
              : "Reset your password"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {lang === "ar"
              ? "اكتب البريد الإلكتروني المرتبط بحسابك وسنبعتلك رابط تعيين كلمة مرور جديدة."
              : "Enter the email address associated with your account and we'll send you a password reset link."}
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900"
        >
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="rounded-xl bg-green-50 p-3 text-sm leading-6 text-green-700 dark:bg-green-950/40 dark:text-green-300"
            >
              {success}
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
              {lang === "ar" ? "البريد الإلكتروني" : "Email address"}
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              required
              dir="ltr"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder="owner@store.com"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-sm active:bg-brand-700 disabled:opacity-60"
          >
            {loading
              ? lang === "ar"
                ? "جاري الإرسال..."
                : "Sending..."
              : lang === "ar"
                ? "إرسال رابط الاستعادة"
                : "Send reset link"}
          </button>
          <Link
            href="/login"
            className="block rounded-xl border border-gray-200 py-3 text-center text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
          >
            {lang === "ar"
              ? "العودة لتسجيل الدخول"
              : "Back to login"}
          </Link>
        </form>
      </div>
    </div>
  );
}
