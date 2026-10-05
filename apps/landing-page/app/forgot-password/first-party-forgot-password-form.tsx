"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "../signup/signup.module.css";
import { postAuth } from "../_components/auth-api";

type RecoveryStep = "email" | "code" | "password" | "done";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<RecoveryStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emailAddress = String(form.get("email") ?? "").trim().toLowerCase();
    setEmail(emailAddress);
    setIsLoading(true);
    setStatus("");
    setIsError(false);
    try {
      await postAuth("forgot-password", { email: emailAddress });
      setStep("code");
      setStatus("If an account exists, reset instructions will be sent to that address.");
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : "Unable to request a reset code.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resendCode() {
    setIsLoading(true);
    setIsError(false);
    setStatus("");
    try {
      await postAuth("forgot-password", { email });
      setStatus("If an account exists, a new reset code will be sent.");
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : "Unable to request a reset code.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) {
      setIsError(true);
      setStatus("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    setIsError(false);
    setStatus("");
    try {
      await postAuth("reset-password", { email, code, password });
      setStep("done");
      setStatus("");
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : "Unable to reset your password.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md text-left">
      <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#5e625c] hover:text-[#252724]"><span aria-hidden="true">←</span> Back to login</Link>
      <div className="text-center">
        <span className="inline-flex rounded-full bg-[#e9f4e6] px-3 py-1.5 text-xs font-semibold text-[#4f754d]">Account recovery</span>
        <h1 className={`${styles.formTitle} mt-4 text-[#171916]`}>{step === "done" ? "Password updated" : step === "password" ? "Create a new password" : "Forgot your password?"}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#72766f]">{step === "done" ? "Your password has been reset. Sign in with your new password." : step === "email" ? "Enter the email associated with your account and we’ll send a reset code." : `Enter the code sent to ${email}.`}</p>
      </div>
      {step === "email" && <form className="mt-8 space-y-5" onSubmit={sendCode}>
        <label className="grid gap-2 text-sm font-semibold text-[#30332f]">Email address<input name="email" type="email" autoComplete="email" required autoFocus className="h-12 rounded-xl border border-black/13 bg-white px-4 font-normal outline-none focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]" placeholder="you@example.com" /></label>
        <button type="submit" disabled={isLoading} className="h-12 w-full cursor-pointer rounded-xl bg-[#252724] text-sm font-semibold text-white disabled:opacity-50">{isLoading ? "Sending..." : "Send reset code"}</button>
      </form>}
      {step === "code" && <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); setStep("password"); }}>
        <label className="grid gap-2 text-sm font-semibold text-[#30332f]">Reset code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} required className="h-12 rounded-xl border border-black/13 bg-white px-4 text-center font-mono text-lg tracking-[0.35em] outline-none focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]" placeholder="000000" /></label>
        <button type="submit" disabled={code.length !== 6} className="h-12 w-full cursor-pointer rounded-xl bg-[#252724] text-sm font-semibold text-white disabled:opacity-50">Continue</button>
        <button type="button" onClick={() => void resendCode()} disabled={isLoading} className="w-full text-sm font-semibold text-[#477445] disabled:opacity-50">Resend code</button>
      </form>}
      {step === "password" && <form className="mt-8 space-y-5" onSubmit={resetPassword}>
        <label className="grid gap-2 text-sm font-semibold text-[#30332f]">New password<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required className="h-12 rounded-xl border border-black/13 bg-white px-4 font-normal outline-none focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]" placeholder="At least 10 characters" /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#30332f]">Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} required className="h-12 rounded-xl border border-black/13 bg-white px-4 font-normal outline-none focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]" placeholder="Repeat your password" /></label>
        <button type="submit" disabled={isLoading} className="h-12 w-full cursor-pointer rounded-xl bg-[#252724] text-sm font-semibold text-white disabled:opacity-50">{isLoading ? "Updating..." : "Reset password"}</button>
      </form>}
      {status && <p className={`mt-4 rounded-xl px-4 py-3 text-center text-xs font-medium ${isError ? "bg-[#fff0ee] text-[#9a4d45]" : "bg-[#edf5eb] text-[#4e704b]"}`} role={isError ? "alert" : "status"}>{status}</p>}
      {step === "done" && <Link href="/login" className="mt-7 inline-flex w-full justify-center text-sm font-semibold text-[#477445] hover:underline!">Continue to login</Link>}
    </div>
  );
}