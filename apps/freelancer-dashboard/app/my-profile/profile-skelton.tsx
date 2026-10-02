import { DashboardHeader } from "../_components/dashboard/dashboard-header";

function Bone({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-[#e3e8e0] ${className}`} />;
}

/** Matches SectionCard: border-b header + pt-6 body, p-5 sm:p-7 padding */
function SectionCardSkeleton({
  titleWidth,
  descriptionWidth,
  children,
}: {
  titleWidth: string;
  descriptionWidth: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-7">
      <div className="border-b border-black/7 pb-5">
        <Bone className={`h-5 ${titleWidth}`} />
        <Bone className={`mt-2.5 h-3.5 ${descriptionWidth}`} />
      </div>
      <div className="grid gap-5 pt-6">{children}</div>
    </section>
  );
}

/** Mirrors "Profile details": first/last name, country, city, languages list */
function ProfileDetailsSkeleton() {
  return (
    <SectionCardSkeleton titleWidth="w-36" descriptionWidth="w-80 max-w-full">
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item}>
            <Bone className="h-3 w-20" />
            <Bone className="mt-2 h-12 rounded-xl" />
          </div>
        ))}
      </div>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-4">
          <Bone className="h-3.5 w-24" />
          <Bone className="h-3 w-20" />
        </div>
        {[0, 1].map((row) => (
          <div
            key={row}
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_44px]"
          >
            <Bone className="h-12 rounded-xl" />
            <Bone className="h-12 rounded-xl" />
            <Bone className="h-12 w-11 rounded-xl" />
          </div>
        ))}
        <Bone className="h-11 w-40 rounded-xl" />
      </div>
    </SectionCardSkeleton>
  );
}

/** Mirrors "Professional profile": title, description textarea, rate/availability/weekly/experience */
function ProfessionalSkeleton() {
  return (
    <SectionCardSkeleton titleWidth="w-52" descriptionWidth="w-96 max-w-full">
      <div>
        <Bone className="h-3 w-32" />
        <Bone className="mt-2 h-12 rounded-xl" />
      </div>
      <div>
        <Bone className="h-3 w-52" />
        <Bone className="mt-2 h-36 rounded-xl" />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {[0, 1, 2, 3].map((item) => (
          <div key={item}>
            <Bone className="h-3 w-24" />
            <Bone className="mt-2 h-12 rounded-xl" />
          </div>
        ))}
      </div>
    </SectionCardSkeleton>
  );
}

/** Mirrors "Skills and expertise": tag pills, add-skill input, helper text */
function SkillsSkeleton() {
  const widths = ["w-20", "w-24", "w-16", "w-28", "w-20", "w-24", "w-16", "w-24"];
  return (
    <SectionCardSkeleton titleWidth="w-56" descriptionWidth="w-96 max-w-full">
      <div>
        <div className="flex flex-wrap gap-2">
          {widths.map((w, index) => (
            <Bone key={index} className={`h-9 ${w} rounded-xl`} />
          ))}
        </div>
        <div className="mt-5 flex max-w-lg gap-2">
          <Bone className="h-12 flex-1 rounded-xl" />
          <Bone className="h-12 w-20 rounded-xl" />
        </div>
        <Bone className="mt-2 h-3 w-56" />
      </div>
    </SectionCardSkeleton>
  );
}

/** Mirrors "Portfolio": image cards in a responsive grid, plus the add-project tile */
function PortfolioSkeleton() {
  return (
    <SectionCardSkeleton titleWidth="w-28" descriptionWidth="w-96 max-w-full">
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="overflow-hidden rounded-2xl border border-black/9 bg-white"
          >
            <div className="aspect-video bg-[#e4ead8]" />
            <div className="p-5">
              <Bone className="h-2.5 w-16" />
              <Bone className="mt-2.5 h-4 w-4/5" />
              <Bone className="mt-2 h-3 w-full" />
              <Bone className="mt-1.5 h-3 w-3/5" />
              <div className="mt-5 border-t border-black/7 pt-4">
                <Bone className="h-3 w-28" />
              </div>
            </div>
          </div>
        ))}
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-black/16 bg-[#fafbf9] p-6">
          <Bone className="h-12 w-12 rounded-2xl" />
          <Bone className="mt-4 h-3.5 w-40" />
          <Bone className="mt-2 h-3 w-44" />
        </div>
      </div>
    </SectionCardSkeleton>
  );
}

export function ProfileSkeleton({ editing }: { editing: boolean }) {
  return (
    <div className="min-h-svh bg-[#f4f6f2]  text-[#242724]">
      <div>
       <DashboardHeader />
     
      <main 
      role="status"
      aria-live="polite"
      aria-label="Loading profile information"
      className="mx-auto max-w-360 px-5 py-8 sm:px-8 lg:py-10 min-h-svh animate-pulse bg-[#f4f6f2]">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Bone className="h-4 w-32" />
            <Bone className="mt-4 h-9 w-48" />
            <Bone className="mt-2.5 h-3.5 w-80 max-w-[70vw]" />
          </div>
          <Bone className="hidden h-11 w-44 rounded-xl sm:block" />
        </div>

        {editing ? (
          <div className="mt-8 grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
            {/* Sidebar: avatar card + section nav */}
            <aside className="grid gap-5 xl:sticky xl:top-24">
              <section className="rounded-2xl border border-black/8 bg-white p-5 text-center">
                <Bone className="mx-auto h-24 w-24 rounded-full" />
                <Bone className="mx-auto mt-4 h-5 w-32" />
                <Bone className="mx-auto mt-2 h-3 w-40" />
                <div className="mt-5 flex items-center justify-between">
                  <Bone className="h-3 w-24" />
                  <Bone className="h-3 w-8" />
                </div>
                <Bone className="mt-2 h-1.5 w-full rounded-full" />
              </section>

              <nav className="grid gap-1 rounded-2xl border border-black/8 bg-white p-2">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="flex items-center gap-3 px-3 py-3">
                    <Bone className="h-[19px] w-[19px] rounded-md" />
                    <Bone className="h-3 w-28" />
                  </div>
                ))}
              </nav>
            </aside>

            {/* One skeleton per real SectionCard, in the same order */}
            <div className="grid gap-5">
              <ProfileDetailsSkeleton />
              <ProfessionalSkeleton />
              <SkillsSkeleton />
              <PortfolioSkeleton />

              {/* Sticky save bar */}
              <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-2xl border border-black/9 bg-white/95 p-4 shadow-xl shadow-black/8 backdrop-blur">
                <Bone className="hidden h-3 w-48 sm:block" />
                <Bone className="ml-auto h-11 w-32 rounded-xl" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
            <aside className="grid gap-5 lg:sticky lg:top-24">
              <section className="rounded-3xl border border-black/8 bg-white p-6 text-center">
                <Bone className="mx-auto h-28 w-28 rounded-full" />
                <Bone className="mx-auto mt-5 h-6 w-40" />
                <Bone className="mx-auto mt-3 h-3 w-48" />
                <Bone className="mx-auto mt-2 h-3 w-36" />
                <div className="mt-6 grid grid-cols-3 gap-3 border-y border-black/7 py-4">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="mx-auto">
                      <Bone className="h-4 w-8" />
                      <Bone className="mt-2 h-2.5 w-12" />
                    </div>
                  ))}
                </div>
                <div className="mt-5 text-left">
                  <Bone className="h-3 w-20" />
                  <Bone className="mt-3 h-3 w-32" />
                  <Bone className="mt-4 h-3 w-16" />
                  <Bone className="mt-2 h-3 w-28" />
                </div>
              </section>
              <section className="rounded-2xl border border-black/8 bg-[#f4f6f2] p-5">
                <Bone className="h-4 w-32" />
                <div className="mt-4 grid gap-3">
                  <Bone className="h-3 w-28" />
                  <Bone className="h-3 w-36" />
                </div>
              </section>
            </aside>

            <div className="grid gap-5">
              <section className="rounded-3xl border border-black/8 bg-white p-6 sm:p-8">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                  <div>
                    <Bone className="h-3 w-56" />
                    <Bone className="mt-3 h-8 w-full max-w-lg" />
                  </div>
                  <div className="shrink-0">
                    <Bone className="h-3 w-16" />
                    <Bone className="mt-2 h-6 w-20" />
                  </div>
                </div>
                <div className="mt-6 grid gap-2">
                  <Bone className="h-3 w-full" />
                  <Bone className="h-3 w-full" />
                  <Bone className="h-3 w-4/5" />
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4].map((item) => (
                    <Bone key={item} className="h-8 w-20 rounded-xl" />
                  ))}
                </div>
              </section>
              <section className="rounded-3xl border border-black/8 bg-white p-6 sm:p-8">
                <Bone className="h-3 w-24" />
                <Bone className="mt-2 h-6 w-32" />
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {[0, 1].map((item) => (
                    <div key={item} className="overflow-hidden rounded-2xl border border-black/8">
                      <div className="h-44 bg-[#e4ead8]" />
                      <div className="p-5">
                        <Bone className="h-2.5 w-16" />
                        <Bone className="mt-2.5 h-4 w-3/4" />
                        <Bone className="mt-2 h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-3xl border border-black/8 bg-white p-6 sm:p-8">
                <Bone className="h-3 w-24" />
                <Bone className="mt-2 h-6 w-40" />
                <div className="mt-6 overflow-hidden rounded-2xl border border-black/8">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className={`p-5 sm:p-6 ${item ? "border-t border-black/7" : ""}`}
                    >
                      <Bone className="h-4 w-64" />
                      <Bone className="mt-2 h-3 w-40" />
                      <Bone className="mt-4 h-3 w-full" />
                      <Bone className="mt-1.5 h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
      <span className="sr-only">Loading profile information</span>
    </div>
    </div>
  );
}