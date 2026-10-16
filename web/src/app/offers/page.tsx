import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { OffersTool } from "./OffersTool";

export const metadata: Metadata = {
  title: "Compare job offers",
  description: "Compare Bangladeshi job offers on their full value: festival bonuses, provident fund, gratuity, tax and commute.",
};

export default function Page() {
  return (
    <>
      <PageTitle eyebrow="Compare offers" title="Compare job offers" bn="চাকরির অফার তুলনা">
        A higher gross can still be the worse deal. Compare offers on everything they include: festival bonuses, provident fund,
        gratuity, benefits, tax and the cost of the commute.
      </PageTitle>
      <OffersTool />
    </>
  );
}
