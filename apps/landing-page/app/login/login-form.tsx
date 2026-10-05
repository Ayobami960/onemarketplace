"use client";

import Link from "next/link";
import { useEffect, useState, SubmitEvent } from "react";
import styles from "../signup/signup.module.css";
import { postAuth, redirectToDashboard } from "../_components/auth-api";

export function LoginForm() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [verifyEmail, setVerifyEmail] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [isError, setIsError] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [resendCooldown]);

    async function handleLogin(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const emailAddress = String(form.get("email") ?? "").trim().toLowerCase();
        setEmail(emailAddress);
        setIsLoading(true);
        setStatus("");
        setIsError(false);
        try {
            const account = await postAuth<{ role: "client" | "freelancer" }>("login", {
                email: emailAddress,
                password: String(form.get("password") ?? ""),
            });
            redirectToDashboard(account.role);
        } catch (error) {
            const message = error instanceof Error ? error.message : "We could not log you in.";
            if (message === "EMAIL_NOT_VERIFIED") {
                setVerifyEmail(true);
                try {
                    await postAuth("resend-otp", { email: emailAddress });
                    setResendCooldown(60);
                    setStatus("Verify your email with the code we sent to your inbox.");
                    return;
                } catch (resendError) {
                    setResendCooldown(60);
                    setStatus(resendError instanceof Error ? resendError.message : "We could not send a verification code.");
                }
            } else {
                setStatus(message);
            }
            setIsError(true);
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
            setStatus(error instanceof Error ? error.message : "We could not verify that code.");
        } finally {
            setIsLoading(false);
        }
    }

    async function resendCode() {
        if (!email || resendCooldown > 0 || isLoading) return;
        setIsLoading(true);
        setStatus("");
        setIsError(false);
        try {
            await postAuth("resend-otp", { email });
            setResendCooldown(60);
            setStatus("If this account needs verification, a new code will be sent.");
        } catch (error) {
            setResendCooldown(60);
            setIsError(true);
            setStatus(error instanceof Error ? error.message : "We could not send a new code.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="w-full max-w-md text-left">
            <div className="text-center">
                <span className="inline-flex rounded-full bg-[#e9f4e6] px-3 py-1.5 text-xs font-semibold text-[#4f754d]">
                    Welcome back
                </span>
                <h1 className={`${styles.formTitle} mt-4 text-[#171916] text-[clamp(1.65rem,5vw,2.25rem)]!`}>
                    Log in to OneMarketplace
                </h1>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#72766f]">
                    Continue to your projects, conversations, and opportunities.
                </p>
            </div>
            {!verifyEmail ? (
                <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                    <label className="grid gap-2 text-sm font-semibold text-[#30332f]">Email address
                        <input 
                        name="email" 
                        type="email" 
                        autoComplete="email" 
                        required 
                        className="h-12 rounded-xl border border-black/13 bg-white px-4 font-normal outline-none transition focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]" 
                        placeholder="Enter your email" 
                    />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#30332f]">
                        <span className="flex items-center justify-between">
                            Password
                            <Link 
                            href="/forgot-password" className="text-xs font-semibold text-[#477445] hover:underline!">
                                Forgot password?
                            </Link>
                        </span>

                        {/* Added a relative container here to anchor the absolute button to the input box */}
                        <div className="relative flex items-center">
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                className="h-12 w-full rounded-xl border border-black/13 bg-white pl-4 pr-16 font-normal outline-none transition focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]"
                                placeholder="Enter your password"
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

                    <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="h-12 w-full cursor-pointer rounded-xl bg-[#252724] text-sm font-semibold text-white shadow-sm transition hover:bg-[#3b3e39] disabled:opacity-50">
                        {isLoading ? "Checking..." : "Log in"}
                    </button>
                </form>
            ) : (
                <form className="mt-8 space-y-5" onSubmit={handleVerify}>
                    <label className="grid gap-2 text-sm font-semibold text-[#30332f]">Verification code
                        <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} required className="h-12 rounded-xl border border-black/13 bg-white px-4 text-center font-mono text-lg tracking-[0.35em] outline-none focus:border-[#5d8b59] focus:ring-3 focus:ring-[#dcebd9]" placeholder="000000" />
                    </label>
                    <button type="submit" disabled={isLoading || code.length !== 6} className="h-12 w-full cursor-pointer rounded-xl bg-[#252724] text-sm font-semibold text-white disabled:opacity-50">{isLoading ? "Verifying..." : "Verify and continue"}</button>
                    <button type="button" onClick={() => void resendCode()} disabled={isLoading || resendCooldown > 0} className="w-full cursor-pointer text-center text-sm font-semibold text-[#497446] disabled:opacity-50">
                        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                    </button>
                </form>
            )}
            {status && <p className={`mt-4 rounded-xl px-4 py-3 text-center text-xs font-medium ${isError ? "bg-[#fff0ee] text-[#9a4d45]" : "bg-[#edf5eb] text-[#4e704b]"}`} role={isError ? "alert" : "status"}>{status}</p>}
            <p className="mt-7 text-center text-sm text-[#555952]">
                New to OneMarketplace? <Link href="/signup" className="font-semibold text-[#397236] hover:underline!">Create an account</Link>
            </p>
        </div>
    );
}