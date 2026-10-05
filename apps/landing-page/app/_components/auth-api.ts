type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
};

export async function postAuth<T = undefined>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/+$/, "");
  if (!serverUrl) throw new Error("Authentication service is not configured.");

  const response = await fetch(`${serverUrl}/api/v1/auth/${endpoint}`, {
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

export function redirectToDashboard(role: "client" | "freelancer"): void {
  const dashboardUrl = role === "client"
    ? process.env.NEXT_PUBLIC_CLIENT_DASHBOARD
    : process.env.NEXT_PUBLIC_FREELANCER_DASHBOARD;

  if (!dashboardUrl) throw new Error("The dashboard URL is not configured yet.");
  window.location.replace(dashboardUrl);
}