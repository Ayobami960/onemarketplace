"use client";

import { useQuery } from "@tanstack/react-query";
import { useClientAccount } from "../provider";
import { clientApiFetch } from "../utils/api";

export type FreelancerProposalMetadata = {
  proposals: Array<{
    jobId: string;
    status: string;
    submittedAt: string | null;
  }>;
  counts: {
    total: number;
    active: number;
    viewed: number;
    interviewed: number;
  };
};

export const proposalMetadataQueryKey = [
  "freelancer-proposal-metadata",
] as const;

export function useProposalMetadata() {
  const account = useClientAccount();

  return useQuery<FreelancerProposalMetadata>({
    queryKey: proposalMetadataQueryKey,
    enabled: Boolean(account),
    staleTime: 30_000,
    queryFn: async () => {
      const response = await clientApiFetch("proposals/metadata?role=freelancer");

      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        data?: FreelancerProposalMetadata;
      } | null;

      if (!response.ok || !result?.data) {
        throw new Error(
          result?.message || "Proposal activity could not be loaded.",
        );
      }

      return result.data;
    },
  });
}