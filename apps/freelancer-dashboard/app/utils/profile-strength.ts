"use client";

import { useQuery } from "@tanstack/react-query";
import { useClientAccount } from "@/app/provider";
import { clientApiFetch } from "./api";

type StrengthInput = {
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  professional_title?: string;
  professional_description?: string;
  hourly_rate?: number | string;
  availability_status?: string;
  weekly_availability?: string;
  experience_level?: string;
  skillsCount: number;
  languagesCount: number;
  portfoliosCount: number;
};

export function computeProfileStrength(i: StrengthInput) {
  const personal = [i.firstName, i.lastName, i.country, i.city];
  const professional = [
    i.professional_title,
    i.professional_description,
    i.hourly_rate,
    i.availability_status,
    i.weekly_availability,
    i.experience_level,
  ];

  const value =
    (i.avatarUrl ? 10 : 0) +
    personal.filter(Boolean).length * 3.75 +
    professional.filter(Boolean).length * 5 +
    Math.min(i.skillsCount / 10, 1) * 15 +
    Math.min(i.languagesCount / 3, 1) * 10 +
    Math.min(i.portfoliosCount / 3, 1) * 20;

  return Math.round(value * 100) / 100;
}

/** One shared source for the avatar, used by sidebar, editor and preview. */
export const AVATAR_QUERY_KEY = ["avatar-url"];

const AVATAR_KEYS = [
  "avatarUrl",
  "avatar_url",
  "avatar",
  "profileImage",
  "profile_image",
  "image",
  "photo",
  "picture",
];

function pickAvatar(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;

  for (const key of AVATAR_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
    // handles { avatar: { url: "..." } }
    if (value && typeof value === "object") {
      const nested = (value as Record<string, unknown>).url;
      if (typeof nested === "string" && nested) return nested;
    }
  }
  return null;
}

export function useAvatar() {
  const account = useClientAccount();

  const { data, isLoading } = useQuery<string | null>({
    queryKey: AVATAR_QUERY_KEY,
    enabled: Boolean(account),
    staleTime: 60_000,
    queryFn: async () => {
      const fromAccount = pickAvatar(account);
      if (fromAccount) return fromAccount;

      try {
        const response = await clientApiFetch("auth/me", { method: "GET" });
        if (!response.ok) return null;
        const result = await response.json();
        const user = result?.data?.user ?? result?.data ?? result;
        const fromAuthMe = pickAvatar(user);
        if (fromAuthMe) return fromAuthMe;
      } catch {
        // fall through to profile fetch
      }

      // For freelancers, the avatar lives in the profile metadata.
      try {
        const response = await clientApiFetch(
          "freelancer/profile?role=freelancer",
          { method: "GET" },
        );
        if (!response.ok) return null;
        const result = await response.json();
        const profile = result?.data ?? result;
        return pickAvatar(profile);
      } catch {
        return null;
      }
    },
  });

  return { avatarUrl: data ?? null, avatarLoading: isLoading };
}

// Keeps the editor and preview working without changes.
export function useAvatarUrl() {
  return useAvatar().avatarUrl;
}