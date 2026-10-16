import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { GovtTool } from "./GovtTool";

export const metadata: Metadata = {
  title: "Government pay scale 2026 calculator",
  description: "Calculate basic pay, house rent and total salary under Bangladesh's National Pay Scale 2026, phase by phase.",
};

export default function Page() {
  return (
    <>
      <PageTitle eyebrow="Government" title="Government pay scale 2026" bn="জাতীয় বেতন স্কেল ২০২৬">
        The new scale took effect on 1 July 2026 and is being phased in until July 2027. Pick your grade to see your basic pay,
        allowances and yearly total.
      </PageTitle>
      <GovtTool />
    </>
  );
}
