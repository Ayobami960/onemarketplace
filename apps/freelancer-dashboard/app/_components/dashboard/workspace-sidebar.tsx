"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarNavigation } from "./navigation";
import { useClientAccount } from "@/app/provider";
import { useQuery } from "@tanstack/react-query";
import { clientApiFetch } from "@/app/utils/api";
import {
  computeProfileStrength,
  useAvatarUrl,
} from "@/app/utils/profile-strength";

type Language = {
  language: string;
  proficiency: "Conversational" | "Fluent" | "Native";
};

/** Shape returned by GET /api/v1/freelancer/profile. */
type FreelancerProfileData = {
  professional_title: string;
  professional_description: string;
  hourly_rate: string;
  country: string;
  city: string;
  availability_status: string;
  weekly_availability: string;
  experience_level: string;
  skills: string[];
  languages: Language[];
  portfolios: Array<{
    id: string;
    title: string;
    category: string;
    description: string;
    live_url: string | null;
    cover_image: {
      imageId: string;
      url: string;
    };
  }>;
  avatarUrl: string;
  identityVerified: boolean;
  joined_at: string | null;
};

const fetchApi = async (
  path: string,
  method: "GET" | "PUT" | "POST",
  payload?: Record<string, unknown> | FormData,
): Promise<unknown> => {
  let response: Response;
  const sendRequest = () =>
    clientApiFetch(path, {
      method,
      ...(payload instanceof FormData
        ? { body: payload }
        : payload
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          : {}),
    });

  try {
    response = await sendRequest();
    if (response.status === 401) {
      const refreshResponse = await clientApiFetch("auth/refresh", {
        method: "POST",
      });
      if (refreshResponse.ok) response = await sendRequest();
    }
  } catch {
    throw new Error(
      "The server could not be reached. Check your connection and try again.",
    );
  }

  let result: { success?: boolean; message?: string; data?: unknown };

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `The server returned an unexpected response (${response.status}).`,
    );
  }

  if (!response.ok || result.success === false) {
    throw new Error(result.message || `The request failed (${response.status}).`);
  }

  return result.data;
};

const fetchProfileApi = (
  method: "GET" | "PUT",
  payload?: Record<string, unknown>,
) => fetchApi("freelancer/profile?role=freelancer", method, payload);

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const account = useClientAccount();
  const avatarUrl = useAvatarUrl();

  const fullName =
    [account.firstName, account.lastName].filter(Boolean).join(" ") ||
    account.email;
  const initials =
    [account.firstName, account.lastName]
      .map((n) => n?.[0] ?? "")
      .join("")
      .toUpperCase() || "U";

  const { data: profile } = useQuery({
    queryKey: ["profile-metadata"], // same key as the editor, so the cache is shared
    enabled: Boolean(account),
    retry: 1,
    staleTime: 30_000,
    queryFn: async () =>
      (await fetchProfileApi("GET")) as FreelancerProfileData | null,
  });

  const profileStrength = computeProfileStrength({
    avatarUrl,
    firstName: account.firstName,
    lastName: account.lastName,
    country: profile?.country,
    city: profile?.city,
    professional_title: profile?.professional_title,
    professional_description: profile?.professional_description,
    hourly_rate: profile?.hourly_rate,
    availability_status: profile?.availability_status,
    weekly_availability: profile?.weekly_availability,
    experience_level: profile?.experience_level,
    skillsCount: profile?.skills?.length ?? 0,
    languagesCount: profile?.languages?.length ?? 0,
    portfoliosCount: profile?.portfolios?.length ?? 0,
  });

  return (
    <aside className="grid gap-5 xl:sticky xl:top-24">
      <section className="rounded-2xl border border-black/8 bg-white p-5">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={fullName}
              width={48}
              height={48}
              unoptimized
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#496e67] text-sm font-semibold text-white">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{fullName}</h2>
            <p className="truncate text-xs text-[#7b8078]">
              {profile?.professional_title}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between text-xs">
          <span className="font-medium">Profile strength</span>
          <strong className="text-[#52784f]">
            {Math.round(profileStrength)}%
          </strong>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e6e9e3]">
          <div
            className="h-full rounded-full bg-[#648b61] transition-all"
            style={{ width: `${profileStrength}%` }}
          />
        </div>
        <Link
          href="/my-profile"
          className="mt-4 inline-block text-xs font-semibold text-[#4e774b] hover:underline"
        >
          Preview your profile
        </Link>
      </section>

      <nav className="rounded-2xl border border-black/8 bg-white p-2 text-sm">
        {sidebarNavigation.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition ${
                active
                  ? "bg-[#edf4ea] text-[#4e774b]"
                  : "text-[#686d65] hover:bg-black/3"
              }`}
            >
              <Icon
                icon={active ? item.icon.replace("-linear", "-bold") : item.icon}
                width="19"
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}