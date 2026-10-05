"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clientSidebarNavigation } from "./navigation";
import { useQuery } from "@tanstack/react-query";
import { clientApiFetch } from "@/app/utils/client-api";
import { useClientAccount } from "@/app/provider";

export function ClientSidebar() {
  const account = useClientAccount();
  const pathname = usePathname();

  const { data: profileMetaData, isLoading: profileMetaDataLoading } = useQuery({
    queryKey: ["profile-metadata"],
    queryFn: async () => {
      const response = await clientApiFetch("client/profile?role=client");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "The client profile could not be loaded.");
      return result.data;
    },
  });
  const initials = account.email.split("@")[0]?.slice(0, 2).toUpperCase() || "CL";
  
  return (
    <aside className="hidden xl:sticky xl:top-24 xl:block">
      <section className="rounded-2xl border border-black/8 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#496e67] text-sm font-semibold text-white">{initials}</span>
          
          <div>
            <h2 className="text-sm font-semibold ">{profileMetaData?.firstName} {""} {profileMetaData?.lastName}</h2>
            <p className="mt-1 text-xs text-[#858a82]">{profileMetaDataLoading ? "..." : profileMetaData?.companyName}</p>
          </div>
        </div>
        <div className="mt-5 border-t border-black/7 pt-4">
          <p className="text-[10px] font-semibold tracking-[.12em] text-[#6e826c] uppercase">Client account</p>
          <Link
            href="/profile"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#52784f] hover:underline"
          >
            View profile
            <Icon icon="solar:arrow-right-up-linear" width="14" />
          </Link>
        </div>
      </section>
      <nav className="mt-5 rounded-2xl border border-black/8 bg-white p-2">
        {clientSidebarNavigation.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${active ? "bg-[#edf4ea] text-[#4e774b]" : "text-[#686d65] hover:bg-black/3"}`}>
              <Icon icon={active ? item.icon.replace("-linear", "-bold") : item.icon} width="19" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
