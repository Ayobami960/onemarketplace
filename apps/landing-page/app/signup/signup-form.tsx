"use client";

import Link from "next/link";
import { useEffect, useState, type SubmitEvent } from "react";
import styles from "./signup.module.css";
import { getCountries } from "./countries";
import { postAuth, redirectToDashboard } from "../_components/auth-api";

interface SignupFormProps {
  role: "client" | "freelancer";
}

export function SignupForm({ role }: SignupFormProps) {
  const countries = getCountries();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const isClient = role === "client";

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setTimeout(() => {
      setResendCooldown((value) => value - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function handleRegister(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setStatus("");
    setIsError(false);
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const country = String(form.get("country") ?? "").trim();
    const emailAddress = String(form.get("email") ?? "").trim().toLowerCase();

    try {
      await postAuth("register", {
        firstName,
        lastName,
        country,
        email: emailAddress,
        password: String(form.get("password") ?? ""),
        role,
      });
      setEmail(emailAddress);
      setIsVerifying(true);
      setResendCooldown(60);
      setStatus("If registration can be completed, a verification code will be sent to your email.");
    } catch (error) {
      setIsError(true);
      const message = error instanceof Error ? error.message : "We could not create your account.";
      if (message === "We could not send the verification code. Please try again.") {
        setEmail(emailAddress);
        setIsVerifying(true);
        setResendCooldown(60);
      }
      setStatus(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setStatus("");
    setIsError(false);
    try {
      const account = await postAuth<{ role: "client" | "freelancer" }>("verify-email", { email, code });
      redirectToDashboard(account.role);
    } catch (error) {
      setIsError(true);
      const message = error instanceof Error ? error.message : "We could not verify that code.";
      setStatus(message.includes("expired") || message.includes("invalid")
        ? "That code is invalid or expired. Request a new code or try again."
        : message);
    } finally {
      setIsLoading(false);
    }
  }

  async function resendCode() {
    if (!email || resendCooldown > 0) return;

    setIsLoading(true);
    setIsError(false);
    setStatus("");
    try {
      await postAuth("resend-otp", { email });
      setResendCooldown(60);
      setStatus("If this account needs verification, a new code will be sent.");
    } catch (error) {
      setIsError(true);
      setResendCooldown(60);
      setStatus(error instanceof Error ? error.message : "We could not send a new code.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md text-left">
      {!isVerifying ? (
        <>
          <Link href="/signup" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#5e625c] transition hover:text-[#252724]">
            <span aria-hidden="true">←</span> Change account type
          </Link>
          <div className="text-center">
            <span className="inline-flex rounded-full bg-[#e9f4e6] px-3 py-1.5 text-xs font-semibold text-[#4f754d]">
              {isClient ? "Client account" : "Freelancer account"}
            </span>
            <h1 className={`${styles.formTitle} mt-4 text-[#171916]`}>
              Create your {isClient ? "client" : "freelancer"} account
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#72766f]">
              {isClient
                ? "Start hiring trusted independent professionals and agencies."
                : "Build your profile, find meaningful work, and grow your career."}
            </p>
          </div>
          <form className="mt-8 space-y-5" onSubmit={handleRegister}>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#30332f]">
                First name
                <input
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  className="h-12 rounded-xl border border-black/13 bg-white px-4 font-normal outline-none transition placeholder:text-[#a2a59f] focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]"
                  placeholder="Alex"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#30332f]">
                Last name
                <input
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  className="h-12 rounded-xl border border-black/13 bg-white px-4 font-normal outline-none transition placeholder:text-[#a2a59f] focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]"
                  placeholder="Morgan"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-[#30332f]">
              Country
              <select
                name="country"
                required
                className="h-12 rounded-xl border border-black/13 bg-white px-4 font-normal outline-none transition focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]"
                defaultValue=""
              >
                <option value="" disabled>Select your country</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#30332f]">
              Email address
              <input name="email" type="email" autoComplete="email" required className="h-12 rounded-xl border border-black/13 bg-white px-4 font-normal outline-none transition placeholder:text-[#a2a59f] focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]" placeholder="you@example.com" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#30332f]">
              Password
              <div className="relative flex items-center">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                  className="h-12 w-full rounded-xl border border-black/13 bg-white pl-4 pr-16 font-normal outline-none transition focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]"
                  placeholder="At least 10 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 cursor-pointer text-xs font-semibold text-[#52764f]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className="flex items-start gap-3 text-xs leading-5 text-[#686c65]">
              <input
                name="terms"
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 rounded border-black/20 accent-[#426f40]"
              />
              <span>I agree to the <Link href="/terms" className="font-semibold text-[#416d3e] hover:underline!">
                Terms of Service</Link> and <Link href="/privacy" className="font-semibold text-[#416d3e] hover:underline!">Privacy Policy</Link>.
              </span>
            </label>
            <button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full cursor-pointer rounded-xl bg-[#252724] text-sm font-semibold text-white shadow-sm transition hover:bg-[#3b3e39] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Creating account..." : `Create ${isClient ? "client" : "freelancer"} account`}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-[#555952]">
            Already have an account? <Link href="/login" className="font-semibold text-[#397236] hover:underline!">Log in</Link>
          </p>
        </>
      ) : (
        <>
          <button 
              type="button" 
              onClick={() => { setIsVerifying(false); setStatus(""); }} 
              className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#5e625c] hover:text-[#252724]"
          >
            <span aria-hidden="true">←</span> Back to account details
          </button>
          <div className="text-center">
            <span className="inline-flex rounded-full bg-[#e9f4e6] px-3 py-1.5 text-xs font-semibold text-[#4f754d]">Verify your email</span>
            <h1 className={`${styles.formTitle} mt-4 text-[#171916]`}>Check your inbox</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#72766f]">Enter the six-digit code sent to <strong className="text-[#30332f]">{email}</strong>.</p>
          </div>
          <form onSubmit={handleVerify} className="mt-8 space-y-5">
            <label className="grid gap-2 text-sm font-semibold text-[#30332f]">
              Verification code
              <input 
                value={code} 
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} 
                inputMode="numeric" 
                autoComplete="one-time-code" 
                minLength={6} 
                maxLength={6} 
                required 
                autoFocus 
                className="h-12 rounded-xl border border-black/13 bg-white px-4 text-center font-mono text-lg tracking-[0.35em] outline-none transition focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]" 
                placeholder="000000" 
              />
            </label>
            <button 
                type="submit" 
                disabled={isLoading || code.length !== 6} 
                className="h-12 w-full cursor-pointer rounded-xl bg-[#252724] text-sm font-semibold text-white shadow-sm transition hover:bg-[#3b3e39] disabled:cursor-not-allowed disabled:opacity-50"
              >
                 {isLoading ? "Verifying..." : "Verify and continue"}
            </button>
            <button
                type="button"
                onClick={() => void resendCode()}
                disabled={isLoading || resendCooldown > 0}
                className="w-full cursor-pointer text-center text-sm font-semibold text-[#497446] disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[#555952]">Already verified? <Link href="/login" className="font-semibold text-[#397236] hover:underline!">Log in</Link></p>
        </>
      )}
      {status && 
          <p className={`mt-4 rounded-xl px-4 py-3 text-center text-xs font-medium 
            ${isError ? "bg-[#fff0ee] text-[#9a4d45]" : "bg-[#edf5eb] text-[#4e704b]"}`} 
            role={isError ? "alert" : "status"}>
              {status}
          </p>
          }
    </div>
  );
}