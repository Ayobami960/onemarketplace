"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClientAccount } from "../provider";
import { clientApiFetch } from "../utils/api";

export type FreelancerProfile = {
  professional_title: string;
  professional_description: string;
  hourly_rate: string;
  country: string;
  city: string;
  skills: string[];
  languages: unknown[];
  avatarUrl: string;
  portfolios: unknown[];
  identityVerified: boolean;
};

export const getProfileStrength = (profile?: FreelancerProfile | null) => {
  const checks: [boolean, string][] = [
    [Boolean(profile?.professional_title), "Add a professional title"],
    [
      Boolean(profile?.professional_description),
      "Write a professional description",
    ],
    [Boolean(profile?.hourly_rate), "Set your hourly rate"],
    [Boolean(profile?.country && profile?.city), "Add your location"],
    [(profile?.skills?.length ?? 0) > 0, "Add your skills"],
    [(profile?.languages?.length ?? 0) > 0, "Add the languages you speak"],
    [Boolean(profile?.avatarUrl), "Upload a profile photo"],
    [(profile?.portfolios?.length ?? 0) > 0, "Add a portfolio project"],
    [profile?.identityVerified === true, "Verify your identity"],
  ];

  const done = checks.filter(([ok]) => ok).length;
  return {
    percent: (done / checks.length) * 100,
    suggestions: checks.filter(([ok]) => !ok).map(([, label]) => label),
  };
};

export function useSidebarProfile() {
  const account = useClientAccount();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["freelancer-profile"],
    enabled: Boolean(account),
    retry: 1,
    staleTime: 30_000,
    queryFn: async () => {
      // Change this path to wherever getLoggedInFreelancerProfileHandler is mounted.
      const response = await clientApiFetch("freelancer/profile");

      if (!response.ok) {
        throw new Error(`Failed to load profile (${response.status})`);
      }

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: FreelancerProfile | null;
      };

      if (!result.success) {
        throw new Error(result.message || "Could not load profile.");
      }

      return result.data ?? null;
    },
  });

  const strength = useMemo(() => getProfileStrength(profile), [profile]);

  return {
    fullName: account?.firstName || account?.email || "",
    title: profile?.professional_title,
    avatarUrl: profile?.avatarUrl,
    strengthPercent: strength.percent,
    strengthSuggestions: strength.suggestions,
    loading: isLoading,
  };
}