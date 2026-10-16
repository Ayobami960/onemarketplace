"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useClientAccount } from "../provider";
import { clientApiFetch } from "../utils/api";

export type JobRow = Record<string, any>;

const SAVED_KEY = ["freelancer-saved-jobs"];


const JOBS_BASE = "jobs";


const savedUrl = (jobId?: string | number) =>
  `${JOBS_BASE}/saved${jobId !== undefined ? `/${jobId}` : ""}?role=freelancer`;

// Some APIs return saved rows wrapped (e.g. { job: {...} }); unwrap if so.
const unwrap = (row: any): JobRow => {
  const job = row?.job ?? row;
  return { ...job, id: job.id ?? row?.jobId ?? row?.job_id };
};

export function useSavedJobs() {
  const account = useClientAccount();
  const queryClient = useQueryClient();

  const {
    data: savedRows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: SAVED_KEY,
    enabled: Boolean(account),
    retry: 1,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await clientApiFetch(savedUrl());

      if (!response.ok) {
        throw new Error(`Failed to load saved jobs (${response.status})`);
      }

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: any[];
      };

      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || "Could not load saved jobs.");
      }

      return result.data.map(unwrap);
    },
  });

  const savedIds = useMemo(
    () => new Set(savedRows.map((row) => String(row.id))),
    [savedRows],
  );

  const mutation = useMutation({
    mutationFn: async ({ row, save }: { row: JobRow; save: boolean }) => {
      const response = await clientApiFetch(savedUrl(row.id), {
        method: save ? "POST" : "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to update saved job (${response.status})`);
      }
    },
    // Optimistic update: the bookmark flips instantly and rolls back on error.
    onMutate: async ({ row, save }) => {
      await queryClient.cancelQueries({ queryKey: SAVED_KEY });
      const previous = queryClient.getQueryData<JobRow[]>(SAVED_KEY);

      queryClient.setQueryData<JobRow[]>(SAVED_KEY, (old = []) =>
        save
          ? [row, ...old.filter((item) => String(item.id) !== String(row.id))]
          : old.filter((item) => String(item.id) !== String(row.id)),
      );

      return { previous };
    },
    onSuccess: (_data, { save }) => {
      toast.success(save ? "Job saved" : "Job removed from saved jobs");
    },
    onError: (error, { save }, context) => {
      console.error("Saved job update failed:", error);
      queryClient.setQueryData(SAVED_KEY, context?.previous);
      toast.error(
        save
          ? "Couldn't save this job. Please try again."
          : "Couldn't remove this job. Please try again.",
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_KEY });
    },
  });

  const toggleSaved = (row: JobRow) =>
    mutation.mutate({ row, save: !savedIds.has(String(row.id)) });

  return { savedRows, savedIds, isLoading, isError, toggleSaved };
}