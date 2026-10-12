export type Role = "client" | "freelancer";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
};

/**
 * The browser calls this app's own `/api/v1` proxy, which forwards to the API.
 * Same-origin requests keep the session cookies first-party, so the deployment
 * works on separate Vercel domains without a shared `COOKIE_DOMAIN`.
 */
export async function postAuth<T = undefined>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/v1/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null) as ApiResponse<T> | null;
  if (!response.ok) throw new Error(result?.message || "Authentication request failed.");
  return result?.data as T;
}

/**
 * Confirms the authenticated session straight from the API using the session
 * cookies. A successful login/verification response does not by itself prove
 * that the browser stored the cookie, so the role used for redirection always
 * comes from this server-confirmed call.
 */
export async function fetchCurrentAccount(): Promise<{ role: Role }> {
  const response = await fetch("/api/v1/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const result = await response.json().catch(() => null) as ApiResponse<{ role?: string }> | null;
  const role = result?.data?.role;

  if (!response.ok || !result?.success || !role) {
    throw new Error(
      "We signed you in but could not confirm the session. Allow cookies for this site and try again.",
    );
  }

  if (role !== "client" && role !== "freelancer") {
    throw new Error("This account has an unsupported role. Contact support for help.");
  }

  return { role };
}

export function resolveDashboardUrl(role: Role): string {
  if (role !== "client" && role !== "freelancer") {
    throw new Error("This account has an unsupported role. Contact support for help.");
  }

  const dashboardUrl = role === "client"
    ? process.env.NEXT_PUBLIC_CLIENT_DASHBOARD
    : process.env.NEXT_PUBLIC_FREELANCER_DASHBOARD;

  if (!dashboardUrl) throw new Error("The dashboard URL is not configured yet.");
  return dashboardUrl.replace(/\/+$/, "");
}

/**
 * Hands the session to the destination dashboard with a one-time code, so the
 * dashboard can issue its own first-party session without sharing cookies. If
 * the hand-off cannot be created (for example a same-site deployment that shares
 * cookies already), we fall back to a plain redirect.
 */
export async function redirectToDashboard(role: Role): Promise<void> {
  const dashboardUrl = resolveDashboardUrl(role);

  let code: string | undefined;
  try {
    const response = await fetch("/api/v1/auth/handoff", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    const result = await response.json().catch(() => null) as ApiResponse<{ code?: string }> | null;
    if (response.ok && result?.success && typeof result.data?.code === "string") {
      code = result.data.code;
    }
  } catch {
    code = undefined;
  }

  window.location.replace(
    code ? `${dashboardUrl}/session?code=${encodeURIComponent(code)}` : dashboardUrl,
  );
}
