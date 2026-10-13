import type { Metadata } from "next";
import { settingsSections, type SettingsSectionId } from "../_components/settings/settings-data";
import { SettingsDashboard } from "./settings-dashboard";

export const metadata: Metadata = {
  title: "Settings | OneMarketplace.io",
  description: "Manage your freelancer account, finances, Connects, and security.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; payment?: string; session_id?: string }>;
}) {
  const { section, payment, session_id: checkoutSessionId } = await searchParams;
  const paymentSucceeded = payment === "success";

  /*
   * Resolve the section instead of redirect()ing an unknown one. Stripe returns
   * here with `?payment=success` (and no valid section), and a redirect aborts
   * the server render mid-measurement, which trips the known React/Turbopack
   * dev bug: "cannot have a negative time stamp".
   */
  const validSection = settingsSections.some((item) => item.id === section);
  const initialSection: SettingsSectionId = validSection
    ? (section as SettingsSectionId)
    : paymentSucceeded
      ? "connects"
      : "overview";

  return (
    <SettingsDashboard
      key={initialSection}
      initialSection={initialSection}
      paymentSucceeded={paymentSucceeded}
      checkoutSessionId={checkoutSessionId}
    />
  );
}
