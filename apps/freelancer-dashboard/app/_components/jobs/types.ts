export type Job = {
  id: number;
  title: string;
  company: string;
  verified: boolean;
  posted: string;
  type: "Hourly" | "Fixed price";
  budget: string;
  level: string;
  duration: string;
  description: string;
  skills: string[];
  proposals: string;
  clientRating?: number;
  clientSpent?: string;
  location?: string;
  featured?: boolean;
};



// export type ApiJob = {
//   id: number;
//   title: string;
//   description: string;
//   skills: string[];
//   total_budget: string | number;
//   expertise_level: string;
//   expected_duration: string;
//   published_at?: string | null;
//   created_at?: string | null;
//   companyName: string;
//   paymentVerified: boolean;
//   proposalCounts: number;
//   matchScore?: number;
// };