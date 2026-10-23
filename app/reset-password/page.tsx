
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { lang, toggleLang } = useLanguage();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      try {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const recoveryError = params.get("error_description");
        const recoveryType = params.get("type");

        if (recoveryError) {
          if (active) {
            setError(
              lang === "ar"
                ? "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا."
                : "This reset link is invalid or expired. Please request a new one."
            );
          }
          return;
        }

        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (
          active &&
          data.session &&
          (recoveryType === "recovery" || data.session.user)
        ) {
          setRecoveryReady(true);
        } else if (active) {
          setError(
            lang === "ar"
              ? "الرابط غير صالح أو انتهت صلاحيته. اطلب رابط استعادة جديدًا."
              : "This link is invalid or expired. Please request a new reset link."
          );
        }
      } catch {
        if (active) {
          setError(
            lang === "ar"
              ? "تعذر التحقق من الرابط. اطلب رابط استعادة جديدًا."
              : "Unable to verify the link. Please request a new reset link."
          );
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    checkRecoverySession();

    return () => {
      active = false;
    };
  }, [lang]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError(
        lang === "ar"
          ? "كلمة المرور لازم تكون 6 أحرف على الأقل."
          : "Password must be at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        lang === "ar"
          ? "كلمتا المرور غير متطابقتين."
          : "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        setRecoveryReady(false);
        setError(
          lang === "ar"
            ? "جلسة الاستعادة غير موجودة أو انتهت صلاحيتها. اطلب رابطًا جديدًا."
            : "Your recovery session is missing or expired. Please request a new link."
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(
          lang === "ar"
            ? "تعذر تغيير كلمة المرور. حاول مرة أخرى."
            : "Unable to update your password. Please try again."
        );
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(
        lang === "ar"
          ? "تم تغيير كلمة المرور بنجاح. جاري تحويلك لتسجيل الدخول..."
          : "Password updated successfully. Redirecting to login..."
      );

      await supabase.auth.signOut();
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      window.setTimeout(() => {
        router.replace("/login");
      }, 1500);
    } catch {
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
              ? "تعيين كلمة مرور جديدة"
              : "Set a new password"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {lang === "ar"
              ? "اكتب كلمة المرور الجديدة وأكدها."
              : "Enter and confirm your new password."}
          </p>
        </div>

        {checkingSession ? (
          <div className="rounded-2xl bg-white p-5 text-center text-sm text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
            {lang === "ar" ? "جاري التحقق من الرابط..." : "Verifying reset link..."}
          </div>
        ) : recoveryReady ? (
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
                className="rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300"
              >
                {success}
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                {lang === "ar" ? "كلمة المرور الجديدة" : "New password"}
              </span>

              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
                {lang === "ar" ? "تأكيد كلمة المرور" : "Confirm password"}
              </span>

              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>

            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-sm active:bg-brand-700 disabled:opacity-60"
            >
              {loading
                ? lang === "ar"
                  ? "جاري الحفظ..."
                  : "Saving..."
                : lang === "ar"
                  ? "حفظ كلمة المرور"
                  : "Save password"}
            </button>
          </form>
        ) : (
          <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900">
            {error && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-600 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <Link
              href="/forgot-password"
              className="block w-full rounded-xl bg-brand-600 py-3.5 text-center text-sm font-bold text-white"
            >
              {lang === "ar"
                ? "طلب رابط استعادة جديد"
                : "Request a new reset link"}
            </Link>

            <Link
              href="/login"
              className="block rounded-xl border border-gray-200 py-3 text-center text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to login"}
            </Link>
          </div>
        )}

        {success && !recoveryReady && (
          <p className="mt-4 text-center text-sm text-green-700 dark:text-green-300">
            {success}
          </p>
        )}

        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-600">
          Mr Supplement
        </p>
      </div>
    </div>
  );
}
