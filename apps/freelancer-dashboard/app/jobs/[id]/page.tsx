import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "../../_components/dashboard/dashboard-header";
import JobDetails from "./job-details";

type JobDetail = {
  title: string;
  company: string;
  posted: string;
  budget: string;
  duration: string;
  level: string;
  summary: string[];
  skills: string[];
  requirements: string[];
  deliverables: string[];
  milestones: Array<{ title: string; description: string; amount: string }>;
  rating: string;
  spent: string;
  hires: string;
  proposals: string;
};

export const metadata: Metadata = {
  title: "Job details | OneMarketplace.io",
  description: "Review the project scope, skills, and milestones."
}

export default async function JobDetailsPage() {
  return (
   <JobDetails/>
  );
}
