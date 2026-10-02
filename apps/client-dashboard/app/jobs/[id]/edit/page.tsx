
import type { Metadata } from "next";

import { ClientShell } from "../../../_components/dashboard/client-shell";
import EditJobPost from "@/app/_components/jobs/edit-job-post";

export const metadata: Metadata = {
  title: "Edit Job Post",
  description: "Update an open fixed-price marketplace job post.",
};

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  



  return (
    <ClientShell>
      <EditJobPost jobId={id}/>
    </ClientShell>
  );
}
