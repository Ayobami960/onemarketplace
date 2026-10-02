"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Loading from "../_components/Loading";
import { LoginForm } from "./login-form";

function dashboardUrlFor(role: unknown): string | undefined {
  if (role === "client") {
    return process.env.NEXT_PUBLIC_CLIENT_DASHBOARD;
  }

  if (role === "freelancer") {
    return process.env.NEXT_PUBLIC_FREELANCER_DASHBOARD;
  }

  return undefined;
}

export function LoginGate() {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const dashboardUrl = dashboardUrlFor(
      user.unsafeMetadata?.role ?? user.unsafeMetadata?.signupRole,
    );

    if (dashboardUrl) {
      window.location.replace(dashboardUrl);
    }
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded || isSignedIn) {
    if (isLoaded && isSignedIn && user && !dashboardUrlFor(
      user.unsafeMetadata?.role ?? user.unsafeMetadata?.signupRole,
    )) {
      return <Loading message="Your account role is not configured yet." />;
    }

    return <Loading />;
  }

  return <LoginForm />;
}