"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientApiFetch, isNetworkError } from "@/app/utils/api";
import { DashboardHeader } from "../_components/dashboard/dashboard-header";
import { WorkspaceSidebar } from "../_components/dashboard/workspace-sidebar";
import { EarningsStatementModal } from "../_components/settings/earnings-statement-modal";
import { FinanceModal } from "../_components/settings/finance-modal";
import { FinanceOverview } from "../_components/settings/finance-overview";
import { type SettingsSectionId } from "../_components/settings/settings-data";
import { SettingsNavigation } from "../_components/settings/settings-navigation";
import {
  AccountPanel,
  AgencyPanel,
  ConnectsPanel,
  EarningsPanel,
  IdentityVerificationPanel,
  WithdrawalPanel,
} from "../_components/settings/settings-panels";
import { useSidebarProfile } from "../hooks/use-sidebar-profile";

const validSections: SettingsSectionId[] = [
  "overview",
  "connects",
  "earnings",
  "withdrawal",
  "agency",
  "tax",
  "verification",
  "security",
  "notifications",
];

type CheckoutStatus = "idle" | "confirming" | "confirmed" | "retry";

export function SettingsDashboard({
  initialSection,
  paymentSucceeded = false,
  checkoutSessionId,
}: {
  initialSection?: string;
  paymentSucceeded?: boolean;
  checkoutSessionId?: string;
}) {
  const [section, setSection] = useState<SettingsSectionId>(
    validSections.includes(initialSection as SettingsSectionId)
      ? (initialSection as SettingsSectionId)
      : "overview",
  );
  const [modal, setModal] = useState<"connects" | "withdraw" | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
    const sidebar = useSidebarProfile();
  
  /*
   * The first render already knows what to show: a returning buyer arrives with
   * the checkout flags set. Seeding the state here instead of in the effect
   * keeps the effect free of synchronous state updates.
   */
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>(() =>
    paymentSucceeded ? (checkoutSessionId ? "confirming" : "confirmed") : "idle",
  );
  const [checkoutNotice, setCheckoutNotice] = useState(() =>
    paymentSucceeded
      ? checkoutSessionId
        ? "Confirming your payment…"
        : "Payment received. Your Connects balance is updating."
      : "",
  );
  const router = useRouter();
  const queryClient = useQueryClient();

  const sectionAtMount = useRef(section);
  const paymentHandled = useRef(false);

  const refreshConnects = useCallback(() => {
    // Prefix match refreshes the balance on both the settings panel and the
    // main dashboard, while the balance history key is kept separate.
    void queryClient.invalidateQueries({ queryKey: ["connects"] });
    void queryClient.invalidateQueries({ queryKey: ["connects-history"] });
  }, [queryClient]);

  /*
   * Stripe returns the Checkout Session id, so confirm the purchase directly.
   * The server verifies the session with Stripe and credits it idempotently,
   * which keeps the balance correct even when the webhook is delayed or was
   * never delivered. A dropped connection is the one failure worth retrying:
   * the payment already went through, so the same call finishes the credit once
   * the network is back.
   */
  const confirmPurchase = useCallback(async () => {
    if (!checkoutSessionId) return;

    try {
      const response = await clientApiFetch("connects/confirm?role=freelancer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: checkoutSessionId }),
      });

      // A 409 means Stripe has not marked the session paid yet; the webhook and
      // the reconciliation job still cover it, so this stays retryable.
      if (!response.ok) throw new Error(`confirm-failed-${response.status}`);

      setCheckoutStatus("confirmed");
      setCheckoutNotice("Payment confirmed. Your Connects balance is up to date.");
      toast.success("Payment complete. Your Connects have been added.");
      refreshConnects();
    } catch (cause) {
      setCheckoutStatus("retry");
      setCheckoutNotice(
        isNetworkError(cause)
          ? "Your network dropped while we confirmed the payment. Check your connection and try again."
          : "We couldn't confirm your payment yet. Please try again in a moment.",
      );
      toast.error("Payment confirmation failed. Please try again.");
    }
  }, [checkoutSessionId, refreshConnects]);

  // Callers that are not the mount effect show the in-progress state first.
  const retryConfirmPurchase = useCallback(() => {
    setCheckoutStatus("confirming");
    setCheckoutNotice("Confirming your payment…");
    void confirmPurchase();
  }, [confirmPurchase]);

  useEffect(() => {
    if (!paymentSucceeded || paymentHandled.current) return;
    paymentHandled.current = true;

    // Drop the one-time checkout flags so a refresh does not repeat this work.
    router.replace(`/settings?section=${sectionAtMount.current}`, { scroll: false });

    // The purchase webhook can land just after the redirect, so refresh briefly.
    refreshConnects();
    [1500, 4000].forEach((delay) => window.setTimeout(refreshConnects, delay));

    if (checkoutSessionId) {
      /*
       * The request is asynchronous, but it is started from a microtask so the
       * effect body itself never writes state. That keeps React from treating
       * the confirmation as a synchronous, cascading render.
       */
      void Promise.resolve().then(confirmPurchase);
      return;
    }

    toast.success("Payment received. Your Connects balance is updating.");
  }, [paymentSucceeded, checkoutSessionId, confirmPurchase, refreshConnects, router]);

  // Recover on its own as soon as the browser reports the network is back.
  useEffect(() => {
    if (checkoutStatus !== "retry") return;

    const retryWhenOnline = () => retryConfirmPurchase();
    window.addEventListener("online", retryWhenOnline);

    return () => window.removeEventListener("online", retryWhenOnline);
  }, [checkoutStatus, retryConfirmPurchase]);

  const openSection = (nextSection: SettingsSectionId) => {
    setSection(nextSection);
    router.push(`/settings?section=${nextSection}`, { scroll: false });
  };

  return (
    <div className="min-h-svh bg-[#f4f6f2] font-(family-name:--font-dm-sans) text-[#242724]">
      <DashboardHeader />
      <main className="mx-auto max-w-360 px-5 py-8 sm:px-8 lg:py-10">
        <div className="grid items-start gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <WorkspaceSidebar  {...sidebar}/>
          <div className="min-w-0">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[#62805f] uppercase">Account center</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Settings</h1>
              <p className="mt-2 text-sm text-[#72776f]">Manage your finances, account preferences, security, and marketplace activity.</p>
            </div>

            {checkoutStatus !== "idle" && (
              <div
                role={checkoutStatus === "retry" ? "alert" : "status"}
                className={`mt-6 flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${checkoutStatus === "retry" ? "border-[#e6c9c5] bg-[#fbeceb] text-[#8f3f37]" : "border-[#cfe0cb] bg-[#eef5ec] text-[#42653f]"}`}
              >
                <span className="text-xs leading-5 font-medium">{checkoutNotice}</span>
                {checkoutStatus === "retry" && (
                  <button
                    type="button"
                    onClick={retryConfirmPurchase}
                    className="h-9 shrink-0 cursor-pointer rounded-lg bg-[#8f3f37] px-4 text-xs font-semibold text-white"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}

            <div className="mt-8 grid items-start gap-5 lg:grid-cols-[235px_minmax(0,1fr)]">
              <div className="lg:sticky lg:top-24">
                <SettingsNavigation active={section} onChange={openSection} />
              </div>
              <div className="min-w-0">
                {section === "overview" && <FinanceOverview onOpenSection={openSection} onBuyConnects={() => setModal("connects")} onWithdraw={() => setModal("withdraw")} />}
                {section === "connects" && <ConnectsPanel onBuy={() => setModal("connects")} />}
                {section === "earnings" && <EarningsPanel onWithdraw={() => setModal("withdraw")} onDownloadStatement={() => setStatementOpen(true)} />}
                {section === "withdrawal" && <WithdrawalPanel onWithdraw={() => setModal("withdraw")} />}
                {section === "agency" && <AgencyPanel />}
                {section === "verification" && <IdentityVerificationPanel />}
                {["tax", "security", "notifications"].includes(section) && <AccountPanel kind={section as "tax" | "security" | "notifications"} />}
              </div>
            </div>
          </div>
        </div>
      </main>
      {modal && <FinanceModal mode={modal} onClose={() => setModal(null)} />}
      {statementOpen && <EarningsStatementModal onClose={() => setStatementOpen(false)} />}
    </div>
  );
}
