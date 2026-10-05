import { NextResponse, type NextRequest } from "next/server";

interface AccountResponse {
  success: boolean;
  data?: {
    role?: "client" | "freelancer";
  };
}

type Role = "client" | "freelancer";

const isAuthRoute = (pathname: string): boolean => {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/")
  );
};

const getServerUrl = (): string | undefined => {
  return process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/+$/, "");
};

const mergeCookies = (currentCookies: string, setCookies: string[]): string => {
  const cookieValues = new Map<string, string>();

  for (const cookie of currentCookies.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator > 0) {
      const name = cookie.slice(0, separator).trim();
      const value = cookie.slice(separator + 1).trim();
      if (name) cookieValues.set(name, value);
    }
  }

  for (const cookie of setCookies) {
    const pair = cookie.split(";", 1)[0];
    const separator = pair?.indexOf("=") ?? -1;
    if (separator > 0) {
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (name) cookieValues.set(name, value);
    }
  }

  return [...cookieValues.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
};

const withRotatedCookies = (
  response: NextResponse,
  cookies: string[]
): NextResponse => {
  for (const cookie of cookies) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
};

const resolveDashboardUrl = (role: Role, request: NextRequest): string => {
  const configuredDashboard =
    role === "client"
      ? process.env.NEXT_PUBLIC_CLIENT_DASHBOARD
      : process.env.NEXT_PUBLIC_FREELANCER_DASHBOARD;

  if (configuredDashboard) {
    try {
      // Use the configured dashboard URL exactly as provided
      return new URL(configuredDashboard).toString();
    } catch {
      // Invalid URL: fall through to the fallback below
    }
  }

  // Fallback only when the env value is missing or invalid
  return new URL(
    role === "client" ? "/client" : "/freelancer",
    request.nextUrl.origin
  ).toString();
};

export default async function proxy(request: NextRequest) {
  if (!isAuthRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const serverUrl = getServerUrl();
  if (!serverUrl) {
    return NextResponse.next();
  }

  const incomingCookies = request.headers.get("cookie") ?? "";
  let cookiesForApi = incomingCookies;
  let rotatedCookies: string[] = [];

  try {
    let meResponse = await fetch(`${serverUrl}/api/v1/auth/me`, {
      headers: { cookie: cookiesForApi },
      cache: "no-store",
    });

    if (meResponse.status === 401) {
      const refreshResponse = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          cookie: incomingCookies,
          origin: request.nextUrl.origin,
        },
        cache: "no-store",
      });

      if (!refreshResponse.ok) {
        return NextResponse.next();
      }

      rotatedCookies = refreshResponse.headers.getSetCookie();
      if (rotatedCookies.length === 0) {
        return NextResponse.next();
      }

      cookiesForApi = mergeCookies(incomingCookies, rotatedCookies);
      meResponse = await fetch(`${serverUrl}/api/v1/auth/me`, {
        headers: { cookie: cookiesForApi },
        cache: "no-store",
      });
    }

    if (meResponse.status === 401 || meResponse.status === 403) {
      return NextResponse.next();
    }

    if (!meResponse.ok) {
      return NextResponse.next();
    }

    const payload = (await meResponse.json()) as AccountResponse;
    const role = payload?.data?.role;

    if (!payload.success || !role) {
      return NextResponse.next();
    }

    const redirectResponse = NextResponse.redirect(
      resolveDashboardUrl(role, request)
    );
    return withRotatedCookies(redirectResponse, rotatedCookies);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/login", "/signup", "/login/:path*", "/signup/:path*"],
};