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

**Free and private:** there is no database and no paid service. Every calculation runs in the browser, and nothing is stored or logged. It runs on Vercel's free plan. The optional AI coach (off unless configured) is the one exception: when a visitor asks it for advice, their job details and salary rounded to ৳1,000 go to a free AI service, and the page says so.

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
  src/app/api/coach  streaming endpoint for the free AI coach (Groq, Cloudflare Workers AI as backup)
```

## The salary model

There is no open, crawlable Bangladesh salary dataset, and Bdjobs.com's robots.txt disallows crawlers, so it is not scraped. Instead:

1. `pipeline/data/anchors.csv` holds **108 published salary figures from 60 sources**. They include bank MTO circulars (City, MTB, DBBL, BRAC Bank, Prime, AB, Meghna, SBAC, IDLC, IPDC), Glassdoor and Levels.fyi figures for named employers (Unilever, Grameenphone, bKash, Standard Chartered, Optimizely, Cefalo, Enosis, PRAN-RFL), the RMG minimum-wage gazette, and recruiter guides. Each row records its source, date and type.
2. Estimates combine **job function** (20, e.g. finance, software, data science, product management), **employer group** (15, e.g. multinational FMCG & tobacco, mobile operator, large private bank, top software company, NGO) and **experience**: `ln(monthly gross) = function + employer group + experience + city`. This is fitted by weighted ridge regression with priors.
3. `pipeline/data/taxonomy.json` lists the real companies in each group and which jobs each group hires for. `companies.json` links named companies to their published figures, which the salary check shows next to the estimate.
4. Confidence is shown per job, employer and experience level. Combinations without a direct figure borrow the employer's general pay level and show a wider range.
5. Leave-one-out validation gives a **21.9% median absolute error**, against 28.2% for the priors alone. Job circulars are reproduced within about 8%.

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
npm test                     # 647 tests
npm run dev                  # http://localhost:3000
```

### Optional free AI coach

The salary check can show an AI coach as a chat: starter questions, follow-ups, and replies in the language the visitor writes in (English or Bangla). It knows the visitor's results, and the conversation stays in the browser; nothing is saved. Each chat is capped at 10 questions and only the recent turns are re-sent, which keeps requests inside the free limits (`web/src/lib/chat.ts`). It uses free-tier AI services, so it costs nothing:

| Order | Provider | Default model | Free allowance |
|---|---|---|---|
| 1 | [Groq](https://console.groq.com) | `qwen/qwen3.8-27b` | about 1,000 requests a day |
| 2 | [Cloudflare Workers AI](https://dash.cloudflare.com) | `@cf/google/gemma-4-26b-a4b-it` | 10,000 Neurons a day, about 390 answers |

The route (`web/src/lib/coach.ts`) tries Groq first and switches to Cloudflare when Groq refuses (for example HTTP 429 once the daily allowance is used up). If both refuse, visitors see a short message and the template negotiation script still works. **Don't add a payment card to either account**: without one, reaching a limit only refuses requests and can never create a bill.

Only the job, level, employer type, city and salary rounded to ৳1,000 are sent, and the page tells visitors so. Free tiers can change their limits; check the providers' consoles.

To switch it on, set these in Vercel (Project → Settings → Environment Variables), then redeploy. `NEXT_PUBLIC_*` values are built into the page, so a redeploy is required:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_AI_COACH` | `on` |
| `GROQ_API_KEY` | Groq console → API Keys |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers AI → "Use REST API" |
| `CLOUDFLARE_API_TOKEN` | Same page → create a token with the Workers AI permission |
| `GROQ_MODEL`, `CLOUDFLARE_MODEL` | Optional, to change the models |

Either provider alone also works. Without these settings the coach is hidden and the free template script is used.

## Deploy (Vercel)

1. Push the repo to GitHub.
2. In Vercel, import the repo and set **Root Directory** to `web` (the framework is detected as Next.js).
3. No environment variables are needed (only the optional AI coach above uses any).
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
