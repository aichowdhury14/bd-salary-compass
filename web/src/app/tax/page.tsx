import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { TaxTool } from "./TaxTool";

export const metadata: Metadata = {
  title: "Income tax & take-home calculator",
  description: "Bangladesh salary income tax and take-home pay under the Finance Act 2026: slabs, salary exemption, investment rebate and minimum tax.",
};

export default function Page() {
  return (
    <>
      <PageTitle eyebrow="Take-home & tax" title="Income tax & take-home pay" bn="আয়কর ও হাতে পাওয়া বেতন">
        Works out your monthly take-home pay and yearly income tax under the Finance Act 2026, and shows how much to invest for the full
        tax rebate.
      </PageTitle>
      <TaxTool />
    </>
  );
}
