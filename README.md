# BD Salary Compass

Designed and developed by **Atiqul Islam Chowdhury**.

Free, private salary tools for people working in Bangladesh, built on cited 2026 data.

| Tool | What it does |
|---|---|
| **Salary check** (`/check`) | Pick your employer (Unilever, City Bank, Grameenphone, bKash, PRAN-RFL...) and job, including career switches. It shows the fair range, how it was calculated, a 5-30 year salary forecast, the figures your employer type has published, ranked next steps, and a ready-to-send negotiation script in English or Bangla |
| **Tax & take-home** (`/tax`) | Income tax under the Finance Act 2026: salary exemption, slabs, investment rebate, minimum tax, monthly tax deduction |
| **Compare offers** (`/offers`) | Full offer value: festival bonuses, provident fund, gratuity, benefits, tax and commute |
| **Job post check** (`/job-post`) | Paste a post in English or Bangla. It extracts salary, experience, location and employer, and compares the pay with the market |
| **Govt pay 2026** (`/govt`) | National Pay Scale 2026 by grade, step, implementation phase and duty station |
| **Market insights** (`/insights`) | Pay scale vs inflation, tax curve, role benchmarks and experience curve |

**Free and private:** there is no database and no paid service. Every calculation runs in the browser, and nothing is stored or logged. It runs on Vercel's free plan.

## Repository layout

```
pipeline/            Python data science
  data/              cited source data (tax rules, pay scale, CPI, salary anchors, role taxonomy)
  salary_compass/    tax engine, salary model, job-post parser, analysis, charts, report
  build.py           fit model -> web/src/data/*.json + reports/market-analysis.md
  ingest.py          turn a licensed job-post CSV into extra model anchors
  tests/             pytest
reports/             generated analysis report and charts
web/                 Next.js 16 app (deploy this folder)
  src/lib/           tax, benchmark, recommendation, offer, govt pay and job-post logic (pure TypeScript)
  src/app/api/coach  streaming Claude endpoint for the AI coach
```

## The salary model

There is no open, crawlable Bangladesh salary dataset, and Bdjobs.com's robots.txt disallows crawlers, so it is not scraped. Instead:

1. `pipeline/data/anchors.csv` holds **76 published salary figures from 30 sources**. They include bank MTO circulars (City, MTB, DBBL, BRAC Bank, Prime, AB, Meghna, SBAC, IDLC, IPDC), Glassdoor and Levels.fyi figures for named employers (Unilever, Grameenphone, bKash, Standard Chartered, Optimizely, Cefalo, Enosis, PRAN-RFL), the RMG minimum-wage gazette, and recruiter guides. Each row records its source, date and type.
2. Estimates combine **job function** (14, e.g. finance, software, sales), **employer group** (14, e.g. multinational FMCG & tobacco, mobile operator, large private bank, top software company, NGO) and **experience**: `ln(monthly gross) = function + employer group + experience + city`. This is fitted by weighted ridge regression with priors.
3. `pipeline/data/taxonomy.json` lists the real companies in each group and which jobs each group hires for. `companies.json` links named companies to their published figures, which the salary check shows next to the estimate.
4. Confidence is shown per job, employer and experience level. Combinations without a direct figure borrow the employer's general pay level and show a wider range.
5. Leave-one-out validation gives an **18.9% median absolute error**, against 22.6% for the priors alone. Job circulars are reproduced within about 8%.

More data improves the model directly. Add rows to `anchors.csv`, or run `python ingest.py posts.csv` on job posts you are licensed to use, then rebuild.

The Python and TypeScript tax engines and job-post parsers are checked against the same test vectors, so the report and the website always agree.

## Run locally

```bash
# 1. Data pipeline (Python 3.11+)
cd pipeline
pip install -r requirements.txt
python -m pytest -q
python build.py              # writes web/src/data/*.json and reports/

# 2. Web app (Node 20+)
cd ../web
npm install
npm test                     # 644 tests
npm run dev                  # http://localhost:3000
```

An optional paid AI coach (Claude) is included but **switched off**. To enable it, set `NEXT_PUBLIC_AI_COACH=on` and `ANTHROPIC_API_KEY`. Each answer costs about $0.04 on Claude Opus 5.5. Without those settings, the free template-based negotiation script is used.

## Deploy (Vercel)

1. Push the repo to GitHub.
2. In Vercel, import the repo and set **Root Directory** to `web` (the framework is detected as Next.js).
3. No environment variables are needed.
4. Deploy. Every page except `/api/coach` is static.

From the CLI: `cd web && npx vercel --prod`.

## Updating the data

| When | Update |
|---|---|
| New budget (June) | `pipeline/data/tax_rules.json` |
| Pay scale gazette or phase change | `pipeline/data/pay_scale_2026.json` |
| Monthly BBS inflation release | `pipeline/data/cpi.json` |
| New salary circulars or surveys | `pipeline/data/anchors.csv` |

Then run `python build.py`, commit, and redeploy.

## Caveats

- Estimates are for guidance, not financial or tax advice. Some taxpayer-category thresholds differ between post-Act guides, so check them against the Finance Act 2026 gazette.
- City multipliers outside Dhaka are assumptions.
- Unilever, BAT, Grameenphone, bKash and several banks don't publish salaries. Their figures are crowd-reported or from career blogs, with small samples.
- NGO officer figures rest on a sector range only. UN figures come from a third-party transcription of the scale. Pharma MPOs are not covered.
