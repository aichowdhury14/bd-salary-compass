import companiesJson from "@/data/companies.json";

export interface CompanyFigure {
  function: string;
  level: string;
  low: number;
  high: number;
  median: number;
  note: string;
  source_name: string;
  source_url: string;
  published: string;
  source_type: string;
}
export interface Company {
  name: string;
  group: string;
  figures: CompanyFigure[];
}

export const companies = companiesJson as Company[];

/** Published figures for an employer group, optionally only for one job function. Named company first. */
export function publishedFigures(groupId: string, functionId?: string, company?: string) {
  const rows: { company: string; figure: CompanyFigure }[] = [];
  for (const c of companies) {
    if (c.group !== groupId) continue;
    for (const f of c.figures) {
      if (!functionId || f.function === functionId) rows.push({ company: c.name, figure: f });
    }
  }
  return rows.sort((a, b) => Number(b.company === company) - Number(a.company === company));
}

export const SOURCE_LABEL: Record<string, string> = {
  official: "official",
  job_circular: "job circular",
  news: "news report",
  aggregator: "self-reported (Glassdoor etc.)",
  recruiter: "recruiter guide",
  job_post: "job post",
  blog: "career blog estimate",
  news_secondary: "secondary report",
};
