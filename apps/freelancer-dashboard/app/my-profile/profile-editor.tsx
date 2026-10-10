"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import type { SubmitEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DashboardHeader } from "../_components/dashboard/dashboard-header";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProfileSkeleton } from "./profile-skelton";
import { countries } from "../utils/countries";
import { useRouter } from "next/navigation";
import { clientApiFetch } from "../utils/api";
import { useClientAccount, type ClientAccount } from "../provider";

const MAX_PORTFOLIO_PROJECTS = 12;
const MAX_PORTFOLIO_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, matches backend limit
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type PreviewPortfolio = {
  id: number;
  title: string;
  category: string;
  description: string;
  liveLink?: string;
  color: string;
  icon: string;
};

type FreelancerPortfolioValue = {
  client_id: string;
  title: string;
  category: string;
  description: string;
  live_url: string | null;
  cover_image: {
    imageId: string;
    url: string;
  };
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
  identityVerified: boolean;
  joined_at: string | null;
};

type Language = {
  language: string;
  proficiency: "Conversational" | "Fluent" | "Native";
};
type FreelancerProfileFormValues = {
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  professional_title: string;
  professional_description: string;
  hourly_rate: number;
  availability_status: string;
  weekly_availability: string;
  experience_level: string;
  languages: Language[];
  skills: string[];
  portfolios: FreelancerPortfolioValue[];
};


const languageOptions = [
  "Afrikaans",
  "Albanian",
  "Amharic",
  "Arabic",
  "Armenian",
  "Azerbaijani",
  "Bambara",
  "Basque",
  "Belarusian",
  "Bengali",
  "Bosnian",
  "Bulgarian",
  "Burmese",
  "Catalan",
  "Cebuano",
  "Chichewa",
  "Chinese",
  "Croatian",
  "Czech",
  "Dari",
  "Danish",
  "Dutch",
  "Dzongkha",
  "English",
  "Estonian",
  "Filipino",
  "Finnish",
  "French",
  "Fula",
  "Georgian",
  "German",
  "Greek",
  "Gujarati",
  "Haitian Creole",
  "Hausa",
  "Hawaiian",
  "Hebrew",
  "Hindi",
  "Hmong",
  "Hungarian",
  "Icelandic",
  "Igbo",
  "Indonesian",
  "Irish",
  "Italian",
  "Japanese",
  "Javanese",
  "Kannada",
  "Kazakh",
  "Khmer",
  "Kikuyu",
  "Kinyarwanda",
  "Kirundi",
  "Konkani",
  "Korean",
  "Kurdish",
  "Kyrgyz",
  "Lao",
  "Latvian",
  "Lithuanian",
  "Luganda",
  "Luxembourgish",
  "Macedonian",
  "Malagasy",
  "Malay",
  "Malayalam",
  "Maltese",
  "Maori",
  "Marathi",
  "Mongolian",
  "Montenegrin",
  "Nepali",
  "Norwegian",
  "Oromo",
  "Papiamento",
  "Pashto",
  "Persian",
  "Polish",
  "Portuguese",
  "Punjabi",
  "Quechua",
  "Romanian",
  "Russian",
  "Samoan",
  "Sango",
  "Serbian",
  "Sesotho",
  "Setswana",
  "Shona",
  "Sindhi",
  "Sinhala",
  "Slovak",
  "Slovenian",
  "Somali",
  "Spanish",
  "Swahili",
  "Swedish",
  "Swazi",
  "Tagalog",
  "Tajik",
  "Tamil",
  "Telugu",
  "Tetum",
  "Thai",
  "Tibetan",
  "Tigrinya",
  "Tongan",
  "Turkish",
  "Turkmen",
  "Twi",
  "Ukrainian",
  "Urdu",
  "Uyghur",
  "Uzbek",
  "Venda",
  "Vietnamese",
  "Welsh",
  "Wolof",
  "Xhosa",
  "Xitsonga",
  "Yiddish",
  "Yoruba",
  "Zulu",
];
 

const initialLanguages: Language[] = [
  { language: "English", proficiency: "Fluent" },
];

const initialSkills = [
  "Next.js",
  "TypeScript",
  "React",
  "Node.js",
  "PostgreSQL",
  "Tailwind CSS",
  "AWS",
  "UI Engineering",
];

const initialPortfolio: PreviewPortfolio[] = [
  {
    id: 1,
    title: "B2B analytics workspace",
    category: "SaaS product",
    description:
      "Designed and built a collaborative analytics platform used by 4,000+ product teams.",
    liveLink: "https://example.com/analytics-workspace",
    color: "from-[#dcebe2] to-[#abcbb8]",
    icon: "solar:chart-square-linear",
  },
  {
    id: 2,
    title: "AI research assistant",
    category: "AI application",
    description:
      "Production research workflow with source citations, evaluation, and team collaboration.",
    liveLink: "https://example.com/research-assistant",
    color: "from-[#e6e2f1] to-[#beb5d8]",
    icon: "solar:magic-stick-3-linear",
  },
];

const inputClass =
  "h-12 w-full rounded-xl border border-black/10 bg-white px-3.5 text-sm outline-none transition placeholder:text-[#a1a59e] focus:border-[#71936e] focus:ring-3 focus:ring-[#71936e]/10";
const labelClass = "grid gap-2 text-sm font-semibold text-[#343833]";

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const validateImageFile = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "The cover image must be a PNG, JPEG, or WebP file.";
  }

  if (file.size > MAX_PORTFOLIO_IMAGE_BYTES) {
    return "The cover image must be 5 MB or smaller.";
  }

  return null;
};

const fetchApi = async (
  path: string,
  method: "GET" | "PUT" | "POST",
  payload?: Record<string, unknown> | FormData,
): Promise<unknown> => {
  let response: Response;
  const sendRequest = () => clientApiFetch(path, {
    method,
    ...(payload instanceof FormData
      ? { body: payload }
      : payload
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
        : {}),
  });

  try {
    response = await sendRequest();
    if (response.status === 401) {
      const refreshResponse = await clientApiFetch("auth/refresh", { method: "POST" });
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
    throw new Error(`The server returned an unexpected response (${response.status}).`);
  }

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `The request failed (${response.status}).`,
    );
  }

  return result.data;
};

const fetchProfileApi = (method: "GET" | "PUT", payload?: Record<string, unknown>) =>
  fetchApi("freelancer/profile?role=freelancer", method, payload);

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-black/8 bg-white p-5 sm:p-7"
    >
      <div className="border-b border-black/7 pb-5">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-[#747a72]">{description}</p>
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}

function ProfilePreview({ account, avatarUrl, profileMetaData }: {
  account: ClientAccount;
  avatarUrl: string | null;
  profileMetaData: FreelancerProfileData | null | undefined;
}) {
  const fullName = [account.firstName, account.lastName].filter(Boolean).join(" ") || account.email;
  const initials = [account.firstName, account.lastName].map((name) => name[0] ?? "").join("").toUpperCase() || "U";
  const completedJobs = [
    {
      title: "Build a collaborative analytics dashboard",
      client: "Northstar Labs",
      completed: "June 2026",
      budget: "$8,400",
      rating: "5.0",
      review:
        "Shahriar brought strong product judgment to every decision. The implementation was fast, polished, and exceptionally well documented.",
      skills: ["Next.js", "TypeScript", "PostgreSQL"],
    },
    {
      title: "Frontend architecture for an AI research platform",
      client: "Lumen Research",
      completed: "March 2026",
      budget: "$12,750",
      rating: "5.0",
      review:
        "A genuinely senior engineer. He simplified a difficult architecture and delivered each milestone exactly when promised.",
      skills: ["React", "Node.js", "OpenAI"],
    },
    {
      title: "SaaS design system and accessibility upgrade",
      client: "Aster Technologies",
      completed: "December 2025",
      budget: "$5,600",
      rating: "4.9",
      review:
        "Excellent attention to detail and communication. Our product is more consistent, accessible, and much easier to maintain.",
      skills: ["Design systems", "WCAG", "Tailwind CSS"],
    },
  ];

  return (
    <div className="min-h-svh bg-[#f4f6f2] font-(family-name:--font-dm-sans) text-[#242724]">
      <DashboardHeader />
      <main className="mx-auto max-w-360 px-5 py-8 sm:px-8 lg:py-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#587855] hover:underline"
            >
              <Icon icon="solar:arrow-left-linear" width="18" />
              Back to dashboard
            </Link>
            <p className="mt-3 text-xs font-semibold tracking-[0.14em] text-[#6f766d] uppercase">
              My public profile
            </p>
          </div>
          <Link
            href="/profile/edit"
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#252724] px-5 text-sm font-semibold text-white hover:bg-[#3b3e39]"
          >
            <Icon icon="solar:pen-new-square-linear" width="18" />
            Edit profile
          </Link>
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="grid gap-5 lg:sticky lg:top-24">
            <section className="rounded-3xl border border-black/8 bg-white p-6 text-center">
              <div className=" mx-auto  w-28">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="relative h-28 w-28 rounded-full object-cover" />
                ) : (
                  <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[#496e67] text-2xl font-semibold text-white">{initials}</span>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                {fullName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#656b63]">
               {profileMetaData?.professional_title}
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#777c74]">
                <Icon icon="solar:map-point-linear" width="16" />
                  {profileMetaData?.city}, {" "}
                  {countries.find(
                    (country) => country.code === profileMetaData?.country,
                  )?.name ?? ""}
              </p>

              <div className="mt-6 grid grid-cols-3 border-y border-black/7 py-4">
                <div>
                  <strong className="block">100%</strong>
                  <span className="mt-1 block text-[10px] text-[#858a82]">
                    Job success
                  </span>
                </div>
                <div className="border-x border-black/7">
                  <strong className="block">4.9</strong>
                  <span className="mt-1 block text-[10px] text-[#858a82]">
                    Rating
                  </span>
                </div>
                <div>
                  <strong className="block">24</strong>
                  <span className="mt-1 block text-[10px] text-[#858a82]">
                    Projects
                  </span>
                </div>
              </div>

              <div className="mt-5 text-left">
                <p className="text-xs font-semibold tracking-wide text-[#7b8078] uppercase">
                 {profileMetaData?.availability_status}
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                  <span className="h-2 w-2 rounded-full bg-[#59a05d]" />
                 {profileMetaData?.weekly_availability}
                </p>
                <p className="mt-4 text-xs font-semibold tracking-wide text-[#7b8078] uppercase">
                  Languages
                </p>
               {
                profileMetaData?.languages.map((language: any) => (
                <p key={`${language.language}-${language.proficiency}`} className="mt-2 text-sm text-[#656b63]">
                  {language.language} - {language.proficiency}
                </p>
                ))
               }
              </div>
            </section>

            <section className="rounded-2xl border border-[#d2dfcf] bg-[#edf4ea] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#476f44]">
                <Icon icon="solar:shield-check-bold" width="20" />
                Account  Verification Status
              </div>
              <div className="mt-4 grid gap-3 text-xs text-[#657063]">
                
                {profileMetaData?.identityVerified && (
                  <p className="flex items-center gap-2">
                  <Icon
                    icon="solar:check-circle-bold"
                    width="15"
                    className="text-[#5d895a]"
                  />
                 Personal Identity Verified
                </p>
                )}
              </div>
            </section>
          </aside>

          <div className="grid gap-5">
            <section className="rounded-3xl border border-black/8 bg-white p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-[#5c8159] uppercase">
                    {profileMetaData?.availability_status} for selected projects
                  </p>
                  <h2 className="mt-3 max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.04em]">
                     {profileMetaData?.professional_title}
                  </h2>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs text-[#7c8179]">Hourly rate</p>
                  <p className="mt-1 text-xl font-semibold">
                    ${parseInt(profileMetaData?.hourly_rate ?? "0", 10)}
                    <span className="text-sm font-medium text-[#7c8179]">
                      /hr
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4 text-sm leading-7 text-[#626860]">
                <p>
                  {profileMetaData?.professional_description}
                </p>
                
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {profileMetaData?.skills.map((skill: any) => (
                  <span
                    key={skill}
                    className="rounded-xl bg-[#edf2eb] px-3 py-2 text-xs font-medium text-[#4f584d]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-black/8 bg-white p-6 sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-[#6e756c] uppercase">
                    Selected work
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                    Portfolio
                  </h2>
                </div>
                <span className="text-xs text-[#838880]">
                  {profileMetaData?.portfolios?.length} projects
                </span>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {profileMetaData?.portfolios.map((project: any) => (
                   <article
                      key={project.id}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-black/9 bg-white"
                    >
                      <div
                        className="relative aspect-video overflow-hidden bg-[#e4ead8] bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${project.cover_image.url})`,
                        }}
                      >
                  
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-[#62805f] uppercase">
                          {project.category}
                        </p>

                        <h3 className="mt-2 text-base font-semibold">
                          {project.title}
                        </h3>

                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#777c74]">
                          {project.description}
                        </p>

                        <div className="mt-5 border-t border-black/7 pt-4">
                          {project.live_url ? (
                            <a
                              href={
                                project.live_url
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52784f]"
                            >
                              View live project

                              <Icon
                                icon="solar:arrow-right-up-linear"
                                width="15"
                              />
                            </a>
                          ) : (
                            <span className="text-xs text-[#969b94]">
                              Portfolio case
                              study
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-black/8 bg-white p-6 sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-[#6e756c] uppercase">
                    Work history
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                    Completed jobs
                  </h2>
                </div>
                <span className="text-xs text-[#838880]">24 completed</span>
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-black/8">
                {completedJobs.map((job, index) => (
                  <article
                    key={job.title}
                    className={`p-5 sm:p-6 ${index ? "border-t border-black/7" : ""}`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <h3 className="font-semibold">{job.title}</h3>
                        <p className="mt-1.5 text-xs text-[#7b8078]">
                          {job.client} · Completed {job.completed}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold text-[#d1a238]">
                          ★ <span className="text-[#30342f]">{job.rating}</span>
                        </span>
                        <span className="text-sm font-semibold">
                          {job.budget}
                        </span>
                      </div>
                    </div>
                    <blockquote className="mt-4 border-l-2 border-[#b8ceb4] pl-4 text-sm leading-6 text-[#687067]">
                      “{job.review}”
                    </blockquote>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-lg bg-[#f0f2ee] px-2.5 py-1.5 text-[11px] font-medium text-[#656b63]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <Link
                href={"/contracts"}
                className="mt-5 cursor-pointer text-sm font-semibold text-[#52784f] hover:underline"
              >
                Show all completed jobs
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export function ProfileEditor({
  initialEditing = false,
}: {
  initialEditing?: boolean;
}) {
  const account = useClientAccount();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const isEditing = initialEditing;
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    clearErrors,
    reset,
    control,
    setError,
    formState: { errors, isDirty, isValid },
  } = useForm<FreelancerProfileFormValues>({
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      country: "",
      city: "",
      professional_title: "",
      professional_description: "",
      hourly_rate: 20,
      availability_status: "AVAILABLE",
      weekly_availability: "20–30 hours / week",
      experience_level: "Entry",
      languages: initialLanguages,
      skills: [],
      portfolios: [],
    },
  });

  const [activeSection, setActiveSection] =
    useState("profile-details");

  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  const [portfolio, setPortfolio] =
    useState<FreelancerPortfolioValue[]>([]);

  const [languages, setLanguages] =
    useState<Language[]>(initialLanguages);

  const [showPortfolioForm, setShowPortfolioForm] =
    useState(false);

  /*
   * Portfolio item being edited in the dialog; null when the dialog is
   * creating a new project, undefined when the dialog is closed.
   */
  const [editingPortfolioId, setEditingPortfolioId] =
    useState<string | null | undefined>(undefined);

  /*
   * Portfolio item pending deletion, shown in the confirm dialog.
   */
  const [portfolioPendingDelete, setPortfolioPendingDelete] =
    useState<FreelancerPortfolioValue | null>(null);

  const [saved, setSaved] = useState(false);

  const [savedDynamicValues, setSavedDynamicValues] =
    useState(() =>
      JSON.stringify({
        skills: [],
        languages: initialLanguages,
        portfolios: [],
      }),
    );

  const hasInitializedProfile = useRef(false);

  const router = useRouter();

  /*
   * -------------------------------------------------------
   * LOAD PROFILE
   * -------------------------------------------------------
   */

  const {
    data: profileMetaData,
    isLoading: profileMetaDataLoading,
    isError: profileMetaDataError,
    refetch: refetchProfileMetaData,
  } = useQuery({
    queryKey: ["profile-metadata"],
    enabled: Boolean(account),
    retry: 1,
    staleTime: 30_000,

    queryFn: async () => {
      return (await fetchProfileApi("GET")) as FreelancerProfileData | null;
    },
  });

  /*
   * -------------------------------------------------------
   * INITIALIZE FORM WITH EXISTING PROFILE
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (
      profileMetaDataLoading ||
      profileMetaDataError ||
      hasInitializedProfile.current
    ) {
      return;
    }

    /*
     * The backend is the source of truth. Blank defaults are only used
     * for a first-time profile that has not been saved yet.
     */

    const nextSkills: string[] = profileMetaData?.skills ?? [];

    const nextLanguages: Language[] =
      (profileMetaData?.languages?.length ?? 0) > 0
        ? (profileMetaData?.languages as Language[])
        : initialLanguages;

    const nextPortfolio: FreelancerPortfolioValue[] = (
      profileMetaData?.portfolios ?? []
    ).map((project) => ({
      client_id: crypto.randomUUID(),
      title: project.title,
      category: project.category,
      description: project.description,
      live_url: project.live_url,
      cover_image: project.cover_image,
    }));

    const nextCountry =
      profileMetaData?.country ??
      account.country;

    /*
     * Put the API values into React Hook Form.
     */

    reset({
      firstName: account.firstName,
      lastName: account.lastName,

      country: nextCountry,

      city: profileMetaData?.city ?? "",

      professional_title:
        profileMetaData?.professional_title ?? "",

      professional_description:
        profileMetaData?.professional_description ?? "",

      hourly_rate:
        Number(profileMetaData?.hourly_rate) || 20,

      availability_status:
        profileMetaData?.availability_status ?? "AVAILABLE",

      weekly_availability:
        profileMetaData?.weekly_availability ??
        "20–30 hours / week",

      experience_level:
        profileMetaData?.experience_level ?? "Entry",

      languages: nextLanguages,
      skills: nextSkills,
      portfolios: nextPortfolio,
    });

    /*
     * Keep local dynamic state in sync.
     */

    setSkills(nextSkills);
    setLanguages(nextLanguages);
    setPortfolio(nextPortfolio);

    /*
     * Store the current saved state.
     */

    setSavedDynamicValues(
      JSON.stringify({
        skills: nextSkills,
        languages: nextLanguages,
        portfolios: nextPortfolio,
      }),
    );

    hasInitializedProfile.current = true;
  }, [
    account,
    profileMetaData,
    profileMetaDataLoading,
    profileMetaDataError,
    reset,
  ]);

  /*
   * -------------------------------------------------------
   * LANGUAGES
   * -------------------------------------------------------
   */

  const updateLanguage = (
    index: number,
    update: Partial<Language>,
  ) => {
    setLanguages((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, ...update }
          : item,
      ),
    );

    clearErrors("languages");
  };

  const addLanguage = () => {
    if (
      languages.length < 5 &&
      languages.every((item) => item.language)
    ) {
      setLanguages((current) => [
        ...current,
        {
          language: "",
          proficiency: "Conversational",
        },
      ]);
    }
  };

  /*
   * -------------------------------------------------------
   * SKILLS
   * -------------------------------------------------------
   */

  const addSkill = () => {
    const skill = skillInput.trim();

    if (!skill) {
      return;
    }

    if (skill.length > 20) {
      setError("skills", {
        message:
          "A skill cannot be longer than 20 characters.",
      });

      toast.error(
        "A skill cannot be longer than 20 characters.",
      );

      return;
    }

    if (
      !skills.some(
        (item) =>
          item.toLowerCase() === skill.toLowerCase(),
      )
    ) {
      const updatedSkills = [...skills, skill];

      setSkills(updatedSkills);
      setSkillInput("");

      if (updatedSkills.length >= 3) {
        clearErrors("skills");
      }
    }
  };

  /*
   * -------------------------------------------------------
   * PORTFOLIO CRUD (local state; images upload on save)
   * -------------------------------------------------------
   */

  const openAddPortfolioForm = () => {
    setEditingPortfolioId(null);
    setShowPortfolioForm(true);
  };

  const openEditPortfolioForm = (project: FreelancerPortfolioValue) => {
    setEditingPortfolioId(project.client_id);
    setShowPortfolioForm(true);
  };

  const closePortfolioForm = () => {
    setShowPortfolioForm(false);
    setEditingPortfolioId(undefined);
  };

  const submitPortfolioForm = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget; // capture synchronously, before any await
    const data = new FormData(form);
    const coverImage = data.get("cover_image");

    const title = String(data.get("title") || "").trim();
    const category = String(data.get("category") || "").trim();
    const description = String(data.get("description") || "").trim();
    const liveUrl = String(data.get("live_url") || "").trim();

    if (!title || !category || !description) {
      toast.error("Please fill in the project title, category, and description.");
      return;
    }

    const isEditingProject = typeof editingPortfolioId === "string";
    const existingProject = isEditingProject
      ? portfolio.find((item) => item.client_id === editingPortfolioId)
      : undefined;

    /*
     * New projects require an image. Existing projects only require one
     * when the image is being replaced.
     */
    const hasNewImage = coverImage instanceof File && coverImage.size > 0;

    if (!hasNewImage && (!isEditingProject || !existingProject)) {
      toast.error("Please select a portfolio cover image.");
      return;
    }

    if (hasNewImage) {
      const imageError = validateImageFile(coverImage);

      if (imageError) {
        toast.error(imageError);
        return;
      }
    }

    let coverImageValue = existingProject?.cover_image ?? {
      imageId: "",
      url: "",
    };

    if (hasNewImage) {
      try {
        coverImageValue = {
          imageId: "", // assigned by the backend after upload
          url: await readFileAsDataUrl(coverImage),
        };
      } catch {
        toast.error(
          "Could not read the portfolio image. Please try another file.",
        );
        return;
      }
    }

    const nextProject: FreelancerPortfolioValue = {
      client_id: existingProject?.client_id ?? crypto.randomUUID(),
      title,
      category,
      description,
      live_url: liveUrl || null,
      cover_image: coverImageValue,
    };

    setPortfolio((current) =>
      isEditingProject && existingProject
        ? current.map((item) =>
          item.client_id === existingProject.client_id
            ? nextProject
            : item,
        )
        : [...current, nextProject],
    );

    clearErrors("portfolios");
    closePortfolioForm();
    form.reset();
  };

  /*
   * -------------------------------------------------------
   * PORTFOLIO DELETION
   * -------------------------------------------------------
   */

  const confirmDeletePortfolio = () => {
    if (!portfolioPendingDelete) {
      return;
    }

    const remaining = portfolio.filter(
      (item) => item.client_id !== portfolioPendingDelete.client_id,
    );

    setPortfolio(remaining);
    setPortfolioPendingDelete(null);

    if (remaining.length < 1) {
      setError("portfolios", {
        message: "Add at least 1 portfolio project.",
      });
    }

    toast.success(
      "Portfolio project removed. Save to apply the change.",
    );
  };

  /*
   * -------------------------------------------------------
   * SAVE PROFILE
   * -------------------------------------------------------
   */  
  const profileMutation = useMutation({
    mutationFn: async (
      values: FreelancerProfileFormValues,
    ) => {
      const {
        firstName,
        lastName,
        portfolios,
        ...freelancer_metadata
      } = values;

      await fetchApi("auth/me", "PUT", { firstName, lastName });

      /*
       * Update freelancer profile in backend.
       */

      return (await fetchProfileApi("PUT", {
        freelancer_metadata,

        freelancer_portfolios: portfolios.map(
          ({
            client_id: _clientId,
            ...portfolioData
          }) => portfolioData,
        ),
      })) as FreelancerProfileData;
    },

    /*
     * ---------------------------------------------------
     * SAVE SUCCESS
     * ---------------------------------------------------
     */

    onSuccess: async (savedProfile, values) => {
      /*
       * Adopt the server's copy of the portfolios so locally-held base64
       * data URLs are replaced by the hosted URLs + imageIds the backend
       * stored. Otherwise an untouched new image would be re-uploaded on
       * the next save.
       */

      const savedPortfolios: FreelancerPortfolioValue[] =
        savedProfile?.portfolios?.length === values.portfolios.length
          ? savedProfile.portfolios.map((project, index) => ({
            client_id:
              values.portfolios[index]?.client_id ??
              crypto.randomUUID(),
            title: project.title,
            category: project.category,
            description: project.description,
            live_url: project.live_url,
            cover_image: project.cover_image,
          }))
          : values.portfolios;

      const savedValues: FreelancerProfileFormValues = {
        ...values,
        portfolios: savedPortfolios,
      };

      /*
       * Reset React Hook Form's dirty state.
       */

      reset(savedValues);

      /*
       * Keep local dynamic values synchronized.
       */

      setSkills(values.skills);

      setLanguages(values.languages);

      setPortfolio(savedPortfolios);

      /*
       * Store the exact saved state.
       */

      setSavedDynamicValues(
        JSON.stringify({
          skills: values.skills,
          languages: values.languages,
          portfolios: savedPortfolios,
        }),
      );

      /*
       * Sync the cache with the saved profile so the UI reflects the
       * database state without a manual browser refresh.
       */

      queryClient.setQueryData(
        ["profile-metadata"],
        savedProfile,
      );

      await queryClient.invalidateQueries({
        queryKey: ["profile-metadata"],
      });

      setSaved(true);

      toast.success(
        "Profile saved successfully",
      );

      window.setTimeout(() => {
        setSaved(false);
      }, 3000);

      router.push("/my-profile");
    },

    /*
     * ---------------------------------------------------
     * SAVE ERROR
     * ---------------------------------------------------
     */

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "The profile could not be saved.",
      );
    },
  });



  const updateAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile photos must be 5 MB or smaller");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const uploaded = await fetchApi("upload/avatar", "POST", formData) as { url: string };
      setAvatarUrl(uploaded.url);
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error("The profile photo could not be updated.");
    }

    event.target.value = "";
  }

  /*
   * -------------------------------------------------------
   * FORM SUBMIT
   * -------------------------------------------------------
   */

  const onSubmit = (
    values: FreelancerProfileFormValues,
  ) => {
    let hasCollectionError = false;

    /*
     * Validate languages.
     */

    if (
      languages.length === 0 ||
      languages.some((item) => !item.language)
    ) {
      setError("languages", {
        message: "Select every language.",
      });

      hasCollectionError = true;
    }

    /*
     * Validate skills.
     */
    if (skills.length < 3) {
      setError("skills", {
        message:
          "Add at least 3 skills or expertise tags.",
      });
      hasCollectionError = true;
    }

    /*
     * Validate portfolio.
     */

    if (portfolio.length < 1) {
      setError("portfolios", {
        message:
          "Add at least 1 portfolio project.",
      });

      hasCollectionError = true;
    }

    if (hasCollectionError) {
      toast.error(
        "Please complete all required profile fields.",
      );

      return;
    }

    /*
     * Send everything to mutation.
     */

    profileMutation.mutate({
      ...values,
      skills,
      languages,
      portfolios: portfolio,
    });
  };

  /*
   * -------------------------------------------------------
   * INVALID FORM
   * -------------------------------------------------------
   */

  const onInvalid = () => {
    toast.error(
      "Please fix the highlighted fields before saving.",
    );
  };

  /*
   * -------------------------------------------------------
   * DETECT DYNAMIC CHANGES
   * -------------------------------------------------------
   */

  const hasDynamicChanges =
    JSON.stringify({
      skills,
      languages,
      portfolios: portfolio,
    }) !== savedDynamicValues;

  /*
   * -------------------------------------------------------
   * SAVE BUTTON STATE
   * -------------------------------------------------------
   */

  const canSave =
    !profileMutation.isPending &&
    (isDirty || hasDynamicChanges) &&
    isValid &&
    skills.length >= 3 &&
    skills.length <= 15 &&
    portfolio.length >= 1 &&
    portfolio.length <= MAX_PORTFOLIO_PROJECTS &&
    languages.length > 0 &&
    languages.length <= 5 &&
    languages.every(
      (item) => Boolean(item.language),
    );



  /*
* -------------------------------------------------------
* PROFILE STRENGTH
* -------------------------------------------------------
*/
 const formValues = useWatch({ control })


  const personalFields = [
    formValues.firstName,
    formValues.lastName,
    formValues.country,
    formValues.city,
  ];

  const professionalFields = [
    formValues.professional_title,
    formValues.professional_description,
    formValues.hourly_rate,
    formValues.availability_status,
    formValues.weekly_availability,
    formValues.experience_level
  ];

  const completedLanguage = languages.filter((item) => item.language).length;

  const strength =
    (
      Math.min(avatarUrl ? 10 : 0) +
    personalFields.filter(Boolean).length * 3.75 +
    professionalFields.filter(Boolean).length * 5 +
    Math.min(skills.length / 10, 1) * 15 +
    Math.min(completedLanguage / 3, 1) * 10 +
    Math.min(portfolio.length / 3, 1) * 20
    ).toFixed(2);


  const strengthSuggestions = [
    !avatarUrl && "Add a profile photo.",
    personalFields.some((field) => !field) && "Complete your personal details.",
    professionalFields.some((field) => !field) && "Complete every professional field.",
    skills.length < 10 && `Add ${10 - skills.length} more skills.`,
    completedLanguage < 3 && `Add ${3 - completedLanguage} more language.`,
    portfolio.length < 3 && `Add ${3 - portfolio.length} more portfolio project`
  ].filter(Boolean) as string[];

  /*
   * -------------------------------------------------------
   * ACTIVE SECTION OBSERVER
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const sectionIds = [
      "profile-details",
      "professional",
      "skills",
      "portfolio",
    ];

    const sections = sectionIds
      .map((id) =>
        document.getElementById(id),
      )
      .filter(
        (section): section is HTMLElement =>
          Boolean(section),
      );

    const observer =
      new IntersectionObserver(
        (entries) => {
          const visibleSection = entries
            .filter(
              (entry) => entry.isIntersecting,
            )
            .sort(
              (a, b) =>
                b.intersectionRatio -
                a.intersectionRatio,
            )[0];

          if (visibleSection) {
            setActiveSection(
              visibleSection.target.id,
            );
          }
        },
        {
          rootMargin:
            "-18% 0px -62% 0px",

          threshold: [
            0,
            0.1,
            0.25,
            0.5,
          ],
        },
      );

    sections.forEach((section) =>
      observer.observe(section),
    );

    return () => observer.disconnect();
  }, [isEditing]);


   /*
   * -------------------------------------------------------
   * LOADING
   * -------------------------------------------------------
   */

  if (
    profileMetaDataLoading
  ) {
    return (
      <ProfileSkeleton editing={isEditing} />
    );
  }


  /*
   * -------------------------------------------------------
   * PUBLIC PROFILE
   * -------------------------------------------------------
   */

  if (!isEditing) {
    return <ProfilePreview
    account={account}
    avatarUrl={avatarUrl}
    profileMetaData={profileMetaData}
    />;
  }

 
  /*
   * -------------------------------------------------------
   * LOAD ERROR
   *
   * A failed profile fetch must never fall through to the
   * editor with blank defaults — that silently looks like a
   * wiped profile and one accidental "save" would overwrite
   * the real data.
   * -------------------------------------------------------
   */

  if (profileMetaDataError) {
    return (
      <div className="min-h-svh bg-[#f4f6f2] font-(family-name:--font-dm-sans) text-[#242724]">
        <DashboardHeader />

        <main className="mx-auto max-w-360 px-5 py-8 sm:px-8 lg:py-10">
          <div className="rounded-2xl border border-black/8 bg-white p-8 text-center sm:p-12">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f7e9e7] text-[#a44c4c]">
              <Icon
                icon="solar:danger-triangle-bold"
                width="24"
              />
            </span>

            <h1 className="mt-4 text-xl font-semibold">
              We couldn’t load your profile
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#747a72]">
              Something went wrong while fetching your saved profile. Your
              data is safe — check your connection and try again.
            </p>

            <button
              type="button"
              onClick={() => refetchProfileMetaData()}
              className="mt-6 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#252724] px-6 text-sm font-semibold text-white hover:bg-[#3b3e39]"
            >
              <Icon
                icon="solar:refresh-linear"
                width="18"
              />

              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  /*
   * -------------------------------------------------------
   * EDIT PROFILE UI
   * -------------------------------------------------------
   */

  return (
    <div className="min-h-svh bg-[#f4f6f2] font-(family-name:--font-dm-sans) text-[#242724]">
      <DashboardHeader />

      <main className="mx-auto max-w-360 px-5 py-8 sm:px-8 lg:py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#587855] hover:underline"
            >
              <Icon
                icon="solar:arrow-left-linear"
                width="18"
              />

              Back to dashboard
            </Link>

            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              My profile
            </h1>

            <p className="mt-2 text-sm text-[#72776f]">
              Keep your profile complete, credible,
              and ready for the right clients.
            </p>
          </div>

          <Link
            href="/my-profile"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold hover:bg-black/3"
          >
            Preview public profile

            <Icon
              icon="solar:arrow-right-up-linear"
              width="18"
            />
          </Link>
        </div>

        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="grid gap-5 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-black/8 bg-white p-5 text-center">
              <div className="relative mx-auto h-24 w-24">
              
                {avatarUrl ? (
                  <img src={avatarUrl} alt={[account.firstName, account.lastName].filter(Boolean).join(" ")} className="relative h-24 w-24 rounded-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-[#496e67] text-2xl font-semibold text-white">
                    {[account.firstName, account.lastName].map((name) => name[0] ?? "").join("").toUpperCase() || "U"}
                  </span>
                )}
                <label className="absolute right-0 bottom-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#252724] text-white">
                  <Icon icon="solar:camera-linear" width="17" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={updateAvatar}
                  />
                </label>

              </div>

              <h2 className="mt-4 text-lg font-semibold">
                {[account.firstName, account.lastName].filter(Boolean).join(" ") || account.email}
              </h2>

              <p className="mt-1 text-xs text-[#777c74]">
                {profileMetaData?.professional_title}
              </p>


              <div className="mt-5 flex items-center justify-between text-xs">
                <span className="font-medium">Profile strength</span>

                <span className="flex items-center gap-1.5">
                  <strong className="text-[#52784f]">
                    {strength}%
                  </strong>
                  {parseInt(strength) < 100 && (
                    <span className="group relative">
                      <button
                        type="button"
                        aria-label="How to complete your profile"
                        className="flex h-4 w-4  cursor-help items-center justify-center rounded-full bg border border-[#789075] text-[10px] font-bold text-[#52784f]"
                      >
                        ?
                      </button>
                      <span className="pointer-events-none absolute right-0 bottom-6 z-20 hidden w-56 rounded-xl bg-[#252724] 
                    p-3 text-left text-[11px] leading-5 font-normal text-white shadow-xl group-hover:block group-focus-within:block">
                        <strong className="mb-1 block font-semibold">
                          Reach 100%
                        </strong>
                        {strengthSuggestions.map((suggestion) => (
                          <span key={suggestion}
                          className="block text-white/75"
                          >
                            . {suggestion}
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
                  style={{
                    width: `${strength}%`,
                  }}
                />
              </div>
            </section>

            <nav className="rounded-2xl border border-black/8 bg-white p-2 text-sm">
              {[
                [
                  "profile-details",
                  "solar:user-linear",
                  "Profile details",
                ],
                [
                  "professional",
                  "solar:case-round-linear",
                  "Professional",
                ],
                [
                  "skills",
                  "solar:stars-minimalistic-linear",
                  "Skills",
                ],
                [
                  "portfolio",
                  "solar:gallery-wide-linear",
                  "Portfolio",
                ],
              ].map(
                ([href, icon, label]) => (
                  <a
                    key={href}
                    href={`#${href}`}
                    aria-current={
                      activeSection === href
                        ? "location"
                        : undefined
                    }
                    onClick={() =>
                      setActiveSection(href)
                    }
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition ${activeSection === href
                      ? "bg-[#edf4ea] text-[#4e774b]"
                      : "text-[#686d65] hover:bg-[#f0f4ee] hover:text-[#4e774b]"
                      }`}
                  >
                    <Icon
                      icon={icon}
                      width="19"
                    />

                    {label}
                  </a>
                ),
              )}
            </nav>
          </aside>

          <form
            onSubmit={handleSubmit(
              onSubmit,
              onInvalid,
            )}
            className="grid gap-5"
            noValidate
          >
            {/* PROFILE DETAILS */}

            <SectionCard
              id="profile-details"
              title="Profile details"
              description="The personal information clients see when reviewing your profile."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <label className={labelClass}>
                  First name *

                  <input
                    className={inputClass}
                    {...register("firstName", {
                      required:
                        "First name is required.",
                    })}
                  />

                  {errors.firstName && (
                    <span className="text-xs font-medium text-[#a44c4c]">
                      {errors.firstName.message}
                    </span>
                  )}
                </label>

                <label className={labelClass}>
                  Last name *

                  <input
                    className={inputClass}
                    {...register("lastName", {
                      required:
                        "Last name is required.",
                    })}
                  />

                  {errors.lastName && (
                    <span className="text-xs font-medium text-[#a44c4c]">
                      {errors.lastName.message}
                    </span>
                  )}
                </label>

                <label className={labelClass}>
                  Country *

                  <select
                    className={inputClass}
                    {...register("country", {
                      required:
                        "Country is required.",
                    })}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select your country
                    </option>

                    {countries.map(
                      (country) => (
                        <option
                          value={country.code}
                          key={country.code}
                        >
                          {country.name}
                        </option>
                      ),
                    )}
                  </select>

                  {errors.country && (
                    <span className="text-xs font-medium text-[#a44c4c]">
                      {errors.country.message}
                    </span>
                  )}
                </label>

                <label className={labelClass}>
                  City *

                  <input
                    className={inputClass}
                    placeholder="New York"
                    {...register("city", {
                      required:
                        "City is required.",
                    })}
                  />

                  {errors.city && (
                    <span className="text-xs font-medium text-[#a44c4c]">
                      {errors.city.message}
                    </span>
                  )}
                </label>

                {/* LANGUAGES */}

                <div className="grid gap-3 sm:col-span-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-[#343833]">
                      Languages *
                    </span>

                    <span className="text-xs text-[#777c74]">
                      {languages.length}/5
                      languages
                    </span>
                  </div>

                  {languages.map(
                    (item, index) => (
                      <div
                        key={index}
                        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_44px]"
                      >
                        <select
                          value={
                            item.language
                          }
                          required
                          onChange={(event) =>
                            updateLanguage(
                              index,
                              {
                                language:
                                  event.target
                                    .value,
                              },
                            )
                          }
                          className={
                            inputClass
                          }
                        >
                          <option value="">
                            Select language
                          </option>

                          {languageOptions.map(
                            (language) => (
                              <option
                                key={
                                  language
                                }
                                value={
                                  language
                                }
                                disabled={languages.some(
                                  (
                                    selected,
                                    selectedIndex,
                                  ) =>
                                    selectedIndex !==
                                    index &&
                                    selected.language ===
                                    language,
                                )}
                              >
                                {language}
                              </option>
                            ),
                          )}
                        </select>

                        <select
                          value={
                            item.proficiency
                          }
                          onChange={(event) =>
                            updateLanguage(
                              index,
                              {
                                proficiency:
                                  event.target
                                    .value as Language["proficiency"],
                              },
                            )
                          }
                          className={
                            inputClass
                          }
                        >
                          <option value="Conversational">
                            Conversational
                          </option>

                          <option value="Fluent">
                            Fluent
                          </option>

                          <option value="Native">
                            Native
                          </option>
                        </select>

                        <button
                          type="button"
                          aria-label={`Remove ${item.language ||
                            "language"
                            }`}
                          disabled={
                            languages.length ===
                            1
                          }
                          onClick={() =>
                            setLanguages(
                              (current) =>
                                current.filter(
                                  (
                                    _,
                                    itemIndex,
                                  ) =>
                                    itemIndex !==
                                    index,
                                ),
                            )
                          }
                          className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-black/10 text-[#767b73] transition hover:bg-[#f4f6f2] hover:text-[#9a4d45] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Icon
                            icon="solar:trash-bin-trash-linear"
                            width="18"
                          />
                        </button>
                      </div>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={addLanguage}
                    disabled={
                      languages.length >= 5 ||
                      languages.some(
                        (item) =>
                          !item.language,
                      )
                    }
                    className="inline-flex h-11 w-fit cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold transition hover:bg-[#f4f6f2] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Icon
                      icon="solar:add-circle-linear"
                      width="18"
                    />

                    Add language
                  </button>

                  {errors.languages && (
                    <span className="text-xs font-medium text-[#a44c4c]">
                      {
                        errors.languages
                          .message
                      }
                    </span>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* PROFESSIONAL */}

            <SectionCard
              id="professional"
              title="Professional profile"
              description="Show clients what you do best and the value you bring."
            >
              <div className="grid gap-5">
                <label className={labelClass}>
                  Professional title *

                  <input
                    className={inputClass}
                    placeholder="Software engineer"
                    {...register(
                      "professional_title",
                      {
                        required:
                          "Professional title is required.",
                      },
                    )}
                  />

                  {errors.professional_title && (
                    <span className="text-xs font-medium text-[#a44c4c]">
                      {
                        errors
                          .professional_title
                          .message
                      }
                    </span>
                  )}
                </label>

                <label className={labelClass}>
                  Professional Description *

                  <textarea
                    placeholder="Write something about your professional experience"
                    rows={7}
                    {...register(
                      "professional_description",
                      {
                        required:
                          "Professional description is required.",
                        minLength: {
                          value: 80,
                          message:
                            "Professional description must be at least 80 characters.",
                        },
                      },
                    )}
                    className="w-full resize-none rounded-xl border border-black/10 bg-white p-3.5 text-sm leading-6 outline-none focus:border-[#71936e] focus:ring-3 focus:ring-[#71936e]/10"
                  />

                  {errors.professional_description && (
                    <span className="text-xs font-medium text-[#a44c4c]">
                      {
                        errors
                          .professional_description
                          .message
                      }
                    </span>
                  )}
                </label>

                <div className="grid gap-5 sm:grid-cols-3">
                  <label className={labelClass}>
                    Hourly rate *

                    <span className="relative">
                      <span className="absolute inset-y-0 left-3.5 flex items-center text-[#777c74]">
                        $
                      </span>

                      <input
                        type="number"
                        min="5"
                        max="1000"
                        className={`${inputClass} px-8`}
                        {...register(
                          "hourly_rate",
                          {
                            required:
                              "Hourly rate is required.",
                            valueAsNumber:
                              true,
                            min: {
                              value: 5,
                              message:
                                "Hourly rate must be at least $5.",
                            },
                            max: {
                              value: 1000,
                              message:
                                "Hourly rate cannot exceed $1,000.",
                            },
                          },
                        )}
                      />

                      <span className="absolute inset-y-0 right-3.5 flex items-center text-xs text-[#777c74]">
                        / hour
                      </span>
                    </span>

                    {errors.hourly_rate && (
                      <span className="text-xs font-medium text-[#a44c4c]">
                        {
                          errors
                            .hourly_rate
                            .message
                        }
                      </span>
                    )}
                  </label>

                  <label className={labelClass}>
                    Availability status *

                    <select
                      className={inputClass}
                      {...register(
                        "availability_status",
                        {
                          required:
                            "Availability status is required.",
                        },
                      )}
                    >
                      <option value="AVAILABLE">
                        Available
                      </option>

                      <option value="LIMITED">
                        Limited availability
                      </option>

                      <option value="UNAVAILABLE">
                        Not available
                      </option>
                    </select>
                  </label>

                  <label className={labelClass}>
                    Weekly availability *

                    <select
                      className={inputClass}
                      {...register(
                        "weekly_availability",
                        {
                          required:
                            "Weekly availability is required.",
                        },
                      )}
                    >
                      <option>
                        Less than 20 hours / week
                      </option>

                      <option>
                        20–30 hours / week
                      </option>

                      <option>
                        30+ hours / week
                      </option>
                    </select>
                  </label>

                  <label className={labelClass}>
                    Experience level *

                    <select
                      className={inputClass}
                      {...register(
                        "experience_level",
                        {
                          required:
                            "Experience level is required.",
                        },
                      )}
                    >
                      <option value="Entry">
                        Entry
                      </option>

                      <option value="Intermediate">
                        Intermediate
                      </option>

                      <option value="Expert">
                        Expert
                      </option>
                    </select>
                  </label>
                </div>
              </div>
            </SectionCard>

            {/* SKILLS */}

            <SectionCard
              id="skills"
              title="Skills and expertise"
              description="Add at least 3 of your strongest skills. You can include up to 15."
            >
              <p className="mb-3 text-sm font-semibold text-[#343833]">
                Skills and expertise *
              </p>

              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#edf2eb] px-3 py-2 text-sm font-medium text-[#4f584d]"
                  >
                    {skill}

                    <button
                      type="button"
                      onClick={() => {
                        const updatedSkills =
                          skills.filter(
                            (item) =>
                              item !== skill,
                          );

                        setSkills(
                          updatedSkills,
                        );

                        if (
                          updatedSkills.length <
                          3
                        ) {
                          setError(
                            "skills",
                            {
                              message:
                                "Add at least 3 skills or expertise tags.",
                            },
                          );
                        }
                      }}
                      aria-label={`Remove ${skill}`}
                      className="cursor-pointer text-[#858b83] hover:text-[#a44c4c]"
                    >
                      <Icon
                        icon="solar:close-circle-linear"
                        width="16"
                      />
                    </button>
                  </span>
                ))}
              </div>

              <div className="mt-5 flex max-w-lg gap-2">
                <input
                  value={skillInput}
                  onChange={(event) =>
                    setSkillInput(
                      event.target.value,
                    )
                  }
                  maxLength={20}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                  disabled={
                    skills.length >= 15
                  }
                  className={inputClass}
                  placeholder="Add a skill"
                />

                <button
                  type="button"
                  onClick={addSkill}
                  disabled={
                    !skillInput.trim() ||
                    skills.length >= 15
                  }
                  className="cursor-pointer rounded-xl border border-black/10 px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add
                </button>
              </div>

              <p className="mt-2 text-xs text-[#858a82]">
                {skills.length} of 15 skills
                added · 20 characters maximum per
                skill
              </p>

              {errors.skills && (
                <p className="mt-2 text-xs font-medium text-[#a44c4c]">
                  {errors.skills.message}
                </p>
              )}
            </SectionCard>

            {/* PORTFOLIO */}

            <SectionCard
              id="portfolio"
              title="Portfolio"
              description="Add at least 1 project that best represents your skills and results."
            >
              <p className="mb-3 text-sm font-semibold text-[#343833]">
                Portfolio projects *
              </p>

              <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {portfolio.map(
                  (project) => (
                    <article
                      key={project.client_id}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-black/9 bg-white"
                    >
                      <div
                        className="relative aspect-video overflow-hidden bg-[#e4ead8] bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${project.cover_image.url})`,
                        }}
                      >
                        <div className="absolute top-3 right-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditPortfolioForm(
                                project,
                              )
                            }
                            aria-label={`Edit ${project.title}`}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/65 bg-white/92 text-[#565d54] shadow-md hover:text-[#4e774b]"
                          >
                            <Icon
                              icon="solar:pen-new-square-linear"
                              width="17"
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setPortfolioPendingDelete(
                                project,
                              )
                            }
                            aria-label={`Remove ${project.title}`}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/65 bg-white/92 text-[#565d54] shadow-md hover:text-[#a44c4c]"
                          >
                            <Icon
                              icon="solar:trash-bin-trash-linear"
                              width="17"
                            />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-[#62805f] uppercase">
                          {project.category}
                        </p>

                        <h3 className="mt-2 text-base font-semibold">
                          {project.title}
                        </h3>

                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#777c74]">
                          {project.description}
                        </p>

                        <div className="mt-5 border-t border-black/7 pt-4">
                          {project.live_url ? (
                            <a
                              href={
                                project.live_url
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52784f]"
                            >
                              View live project

                              <Icon
                                icon="solar:arrow-right-up-linear"
                                width="15"
                              />
                            </a>
                          ) : (
                            <span className="text-xs text-[#969b94]">
                              Portfolio case
                              study
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  ),
                )}

                <button
                  type="button"
                  onClick={openAddPortfolioForm}
                  disabled={
                    portfolio.length >=
                    MAX_PORTFOLIO_PROJECTS
                  }
                  className="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-black/16 bg-[#fafbf9] p-6 text-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f1e4] text-[#52784f]">
                    <Icon
                      icon="solar:add-circle-linear"
                      width="24"
                    />
                  </span>

                  <span className="mt-4 text-sm font-semibold">
                    Add portfolio project
                  </span>

                  <span className="mt-1.5 max-w-48 text-xs leading-5 text-[#858a82]">
                    Add a cover image, project
                    details, and an optional live
                    link
                  </span>
                </button>
              </div>

              {errors.portfolios && (
                <p className="mt-3 text-xs font-medium text-[#a44c4c]">
                  {errors.portfolios.message}
                </p>
              )}
            </SectionCard>

            {/* SAVE */}

            <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-2xl border border-black/9 bg-white/95 p-4 shadow-xl shadow-black/8 backdrop-blur">
              <p className="hidden text-xs text-[#777c74] sm:block">
                Review your changes before saving.
              </p>

              <button
                type="submit"
                disabled={
                  !canSave ||
                  profileMutation.isPending
                }
                className="ml-auto cursor-pointer rounded-xl bg-[#252724] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3b3e39] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {profileMutation.isPending
                  ? "Saving..."
                  : "Save profile"}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* PORTFOLIO MODAL (add / edit) */}

      {showPortfolioForm &&
        (() => {
          const editingProject =
            typeof editingPortfolioId === "string"
              ? portfolio.find(
                (item) =>
                  item.client_id ===
                  editingPortfolioId,
              )
              : undefined;

          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="portfolio-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#172018]/55 p-4 backdrop-blur-[2px]"
            >
              <form
                key={editingProject?.client_id ?? "new"}
                onSubmit={submitPortfolioForm}
                className="max-h-svh w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-[#5d815a] uppercase">
                      Portfolio
                    </p>

                    <h2
                      id="portfolio-title"
                      className="mt-2 text-2xl font-semibold"
                    >
                      {editingProject
                        ? "Edit project"
                        : "Add a project"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closePortfolioForm
                    }
                    aria-label="Close"
                    className="cursor-pointer"
                  >
                    <Icon
                      icon="solar:close-circle-linear"
                      width="24"
                    />
                  </button>
                </div>

                <div className="mt-6 grid gap-5">
                  <label className={labelClass}>
                    Project title *

                    <input
                      name="title"
                      required
                      maxLength={120}
                      defaultValue={
                        editingProject?.title
                      }
                      className={inputClass}
                      placeholder="e.g. Fintech mobile experience"
                    />
                  </label>

                  <label className={labelClass}>
                    Category *

                    <input
                      name="category"
                      required
                      maxLength={120}
                      defaultValue={
                        editingProject?.category
                      }
                      className={inputClass}
                      placeholder="e.g. Web application"
                    />
                  </label>

                  <label className={labelClass}>
                    Description *

                    <textarea
                      name="description"
                      required
                      minLength={40}
                      maxLength={2000}
                      rows={4}
                      defaultValue={
                        editingProject?.description
                      }
                      className="resize-none rounded-xl border border-black/10 p-3.5 text-sm leading-6 outline-none focus:border-[#71936e]"
                      placeholder="What did you build, what was your role, and what changed?"
                    />
                  </label>

                  <label className={labelClass}>
                    <span>
                      Live link{" "}
                      <span className="font-normal text-[#8a8f87]">
                        (optional)
                      </span>
                    </span>

                    <input
                      name="live_url"
                      type="url"
                      defaultValue={
                        editingProject?.live_url ??
                        ""
                      }
                      className={inputClass}
                      placeholder="https://your-project.com"
                    />
                  </label>

                  {editingProject?.cover_image
                    .url ? (
                    <div className="grid gap-2">
                      <span className="text-sm font-semibold text-[#343833]">
                        Current cover image
                      </span>

                      {/*
                        eslint-disable-next-line @next/next/no-img-element --
                        the cover is a user-uploaded data URL or remote asset
                        that is unknown at build time, so next/image cannot
                        optimize it reliably.
                      */}
                      <img
                        src={
                          editingProject.cover_image.url
                        }
                        alt={`${editingProject.title} cover`}
                        className="h-40 w-full rounded-xl border border-black/10 object-cover"
                      />
                    </div>
                  ) : null}

                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 bg-[#f8f9f6] px-4 py-6 text-sm font-semibold text-[#5e655d]">
                    <Icon
                      icon="solar:upload-linear"
                      width="20"
                    />

                    {editingProject
                      ? "Replace cover image (optional)"
                      : "Upload cover image *"}

                    <input
                      name="cover_image"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      required={!editingProject}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-black/7 pt-5">
                  <button
                    type="button"
                    onClick={
                      closePortfolioForm
                    }
                    className="cursor-pointer rounded-xl border border-black/10 px-5 py-2.5 text-sm font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="cursor-pointer rounded-xl bg-[#252724] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    {editingProject
                      ? "Save changes"
                      : "Add project"}
                  </button>
                </div>
              </form>
            </div>
          );
        })()}

      {/* PORTFOLIO DELETE CONFIRMATION */}

      {portfolioPendingDelete && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="portfolio-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172018]/55 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f7e9e7] text-[#a44c4c]">
                <Icon
                  icon="solar:danger-triangle-bold"
                  width="20"
                />
              </span>

              <div>
                <h2
                  id="portfolio-delete-title"
                  className="text-lg font-semibold"
                >
                  Delete portfolio?
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#747a72]">
                  This will permanently delete
                  &ldquo;{portfolioPendingDelete.title}
                  &rdquo; and its image. This
                  action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-black/7 pt-5">
              <button
                type="button"
                onClick={() =>
                  setPortfolioPendingDelete(
                    null,
                  )
                }
                className="cursor-pointer rounded-xl border border-black/10 px-5 py-2.5 text-sm font-semibold hover:bg-[#f4f6f2]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  confirmDeletePortfolio
                }
                className="cursor-pointer rounded-xl bg-[#a44c4c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#8f3f3f]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVED MESSAGE */}

      {saved && (
        <div
          role="status"
          className="fixed right-5 bottom-5 z-60 flex items-center gap-3 rounded-xl bg-[#252724] px-5 py-3.5 text-sm font-semibold text-white shadow-xl"
        >
          <Icon
            icon="solar:check-circle-bold"
            width="20"
            className="text-[#9ac296]"
          />

          Profile saved successfully
        </div>
      )}
    </div>
  );
}