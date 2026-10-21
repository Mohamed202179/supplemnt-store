"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

export default function ResetPasswordPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    // A recovery link carries a recovery marker (implicit hash or PKCE code).
    // Never allow a normal signed-in session alone to authorize a password change here.
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recoveryLink = hash.get("type") === "recovery" ||
      params.get("type") === "recovery" || !!params.get("code") || !!params.get("token_hash");
    const linkError = hash.get("error_description") || params.get("error_description") ||
      hash.get("error") || params.get("error");
    if (linkError) {
      setMessage(ar ? "الرابط غير صالح أو انتهت صلاحيته. اطلب رابط جديد من تسجيل الدخول." : "The link is invalid or expired. Request a new one from login.");
      setReady(true);
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setValid(true);
        setReady(true);
      }
    });

    async function verify() {
      try {
        if (params.get("token_hash") && params.get("type") === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: params.get("token_hash")!, type: "recovery",
          });
          if (error) throw error;
        } else if (params.get("code")) {
          // PKCE callback (in case automatic URL handling hasn't already exchanged it).
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            const { error } = await supabase.auth.exchangeCodeForSession(params.get("code")!);
            if (error) throw error;
          }
        }
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setValid(recoveryLink && !!data.session);
      } catch {
        if (mounted) setValid(false);
      } finally {
        if (mounted) setReady(true);
      }
    }
    void verify();
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [ar]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!valid) return;
    if (password.length < 8) {
      setMessage(ar ? "كلمة المرور لازم تكون 8 حروف أو أرقام على الأقل." : "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage(ar ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(ar ? "تعذر تحديث كلمة المرور. جرّب رابط استعادة جديد." : "Unable to update password. Try a new recovery link.");
      return;
    }
    setDone(true);
    setPassword("");
    setConfirmPassword("");
    // Sign out so the user explicitly signs in with their new password.
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h1 className="mb-4 text-center text-xl font-bold text-gray-900 dark:text-gray-100">
          {ar ? "تعيين كلمة مرور جديدة" : "Set a new password"}
        </h1>
        {!ready ? (
          <p className="text-center text-sm text-gray-500">{ar ? "جارِ التحقق من الرابط..." : "Verifying link..."}</p>
        ) : done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-green-700">{ar ? "تم تغيير كلمة المرور بنجاح." : "Password updated successfully."}</p>
            <Link href="/login" className="block rounded-xl bg-brand-600 py-3 text-sm font-bold text-white">{ar ? "تسجيل الدخول" : "Sign in"}</Link>
          </div>
        ) : !valid ? (
          <div className="space-y-4 text-center">
            <p role="alert" className="text-sm text-red-600">{message || (ar ? "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابط جديد." : "Invalid or expired recovery link. Request a new one.")}</p>
            <Link href="/login" className="block text-sm font-semibold text-brand-600">{ar ? "العودة لتسجيل الدخول" : "Back to login"}</Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
            <label className="block text-sm text-gray-700 dark:text-gray-200">
              {ar ? "كلمة المرور الجديدة" : "New password"}
              <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </label>
            <label className="block text-sm text-gray-700 dark:text-gray-200">
              {ar ? "تأكيد كلمة المرور" : "Confirm password"}
              <input type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </label>
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand-600 py-3 font-bold text-white disabled:opacity-60">
              {busy ? (ar ? "جارِ الحفظ..." : "Saving...") : (ar ? "حفظ كلمة المرور" : "Save password")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
