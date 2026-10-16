import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { CheckTool } from "./CheckTool";

export const metadata: Metadata = {
  title: "Salary check",
  description: "Is your salary fair? Compare it with people in the same job at banks, multinationals, telecoms, software companies, NGOs and local firms in Bangladesh.",
};

export default function Page() {
  return (
    <>
      <PageTitle eyebrow="Salary check" title="Am I paid fairly?" bn="আমার বেতন কি ন্যায্য?">
        Choose your employer and job, set your experience, and enter your salary. You&apos;ll see what people in the same position
        typically earn, and what to do about it.
      </PageTitle>
      <CheckTool />
    </>
  );
}
