"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarNavigation } from "./navigation";

function ProfileSummarySkeleton() {
  return (
    <section
      aria-label="Loading profile summary"
      aria-busy="true"
      className="rounded-2xl border border-black/8 bg-white p-5"
    >
      <div className="animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-full bg-[#dce3d9]" />
          <div className="flex-1">
            <div className="h-4 w-3/4 rounded-full bg-[#e1e5de]" />
            <div className="mt-2 h-3 w-1/2 rounded-full bg-[#e9ece6]" />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <div className="h-3 w-24 rounded-full bg-[#e1e5de]" />
          <div className="h-3 w-8 rounded-full bg-[#dce3d9]" />
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#e1e5de]" />
        <div className="mt-4 h-3 w-28 rounded-full bg-[#dce3d9]" />
      </div>
    </section>
  );
}

type WorkspaceSidebarProps = {
  fullName: string;
  title?: string | undefined;
  avatarUrl?: string | undefined;
  strengthPercent: number;
  strengthSuggestions: string[];
  loading?: boolean;
};

export function WorkspaceSidebar({
  fullName,
  title,
  avatarUrl,
  strengthPercent,
  strengthSuggestions,
  loading = false,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const showSkeleton = loading;

  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <aside className="grid gap-5 xl:sticky xl:top-24">
      {showSkeleton ? (
        <ProfileSummarySkeleton />
      ) : (
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
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#496e67] text-sm font-semibold text-white"
              >
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{fullName}</h2>
              <p className="truncate text-xs text-[#7b8078]">{title}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs">
            <span className="font-medium">Profile strength</span>

            <span className="flex items-center gap-1.5">
              <strong className="text-[#52784f]">
                {Math.round(strengthPercent)}%
              </strong>

              {strengthPercent < 100 && strengthSuggestions.length > 0 && (
                <span className="group relative">
                  <button
                    type="button"
                    aria-label="How to complete your profile"
                    className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[#789075] bg-white text-[10px] font-bold text-[#52784f]"
                  >
                    ?
                  </button>

                  <span
                    role="tooltip"
                    className="pointer-events-none absolute right-0 bottom-6 z-20 hidden w-56 rounded-xl bg-[#252724] p-3 text-left text-[11px] leading-5 font-normal text-white shadow-xl group-focus-within:block group-hover:block"
                  >
                    <strong className="mb-1 block font-semibold">
                      Reach 100%
                    </strong>
                    {strengthSuggestions.map((suggestion) => (
                      <span key={suggestion} className="block text-white/75">
                        • {suggestion}
                      </span>
                    ))}
                  </span>
                </span>
              )}
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e6e9e3]">
            <div
              className="h-full rounded-full bg-[#648b61] transition-all"
              style={{ width: `${strengthPercent}%` }}
            />
          </div>

          <Link
            href="/my-profile"
            className="mt-4 inline-block text-xs font-semibold text-[#4e774b] hover:underline"
          >
            Preview your profile
          </Link>
        </section>
      )}

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
                icon={
                  active ? item.icon.replace("-linear", "-bold") : item.icon
                }
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