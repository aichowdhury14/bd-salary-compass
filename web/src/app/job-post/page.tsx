import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { JobPostTool } from "./JobPostTool";

export const metadata: Metadata = {
  title: "Check a job post",
  description: "Paste a Bangladeshi job post to see whether the offered salary is fair for the role, experience and location.",
};

export default function Page() {
  return (
    <>
      <PageTitle eyebrow="Job post check" title="Is this job post paying fairly?" bn="এই চাকরির বেতন কি ঠিক আছে?">
        Paste any job post in English or Bangla. We pick out the salary, experience, location and employer (Unilever, City Bank, bKash and many more), match the job, and show
        how the pay compares with the market.
      </PageTitle>
      <JobPostTool />
    </>
  );
}
