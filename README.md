# DealTrace

**An F&I compliance and fairness auditor that checks how a car deal got to its final contract, not only the contract itself.**

Built by **Team Codeies** for Tekion's *Tek-Qubit: Women of Impact 2026* (problem statement: F&I Compliance & Fairness Auditor).

> **This is a frontend-only, clickable prototype.** There is no backend, no network calls and no API keys. All data is fictional seed data. The review assistant is scripted, not a live model, and the UI says so. Rule text is an illustrative summary, not legal advice.

---

## The problem

Finance and insurance (F&I) is where a dealership sells add-on products such as GAP, service contracts and tire-and-wheel plans, and sets the loan rate and term. Most compliance tools check only the final signed contract. By then the questions that matter are already hidden:

- Was a GAP waiver added *after* the buyer had agreed on a price?
- Was the term stretched so the monthly payment barely moved while products were added?
- Was the rate raised *after* credit was approved?
- Did anyone write down why?

## What DealTrace does

DealTrace audits the whole path of a deal:

1. **Records** every change (price, add-ons, APR, term, documents) as an immutable event in a SHA-256 hash chain.
2. **Compares** each deal version with the previous one (semantic diff).
3. **Checks** each version against the rules in force on the deal date (California CARS Act from 1 Oct 2026; Civil Code 2982.12 GAP rules).
4. **Tests benefit**: can each add-on actually help *this* buyer (loan-to-value, warranty overlap, existing coverage)?
5. **Ranks** findings by refund exposure and customer exposure.
6. **Assists** with a drafted case summary (scripted in this prototype).
7. **Leaves the decision to a human reviewer** before the lender funds the deal.

Every finding is labelled **"Potential violation – human review required"**.

## Features

| # | Feature | Where |
|---|---------|-------|
| 1 | Dashboard: open findings, high severity, refund exposure, decision time | `/` |
| 2 | Review queue with filters, saved views, bulk actions and CSV export | `/queue` |
| 3 | Deal timeline replay | `/deals/:id` (Timeline tab) |
| 4 | Version diff and forensics | Versions & diff tab |
| 5 | Customer outcome (benefit) simulator | Benefit checks tab |
| 6 | Rules engine with effective dates, versions and toggles | `/rules` |
| 7 | Blast radius: what a rule change would affect | `/rules/:id/blast-radius` |
| 8 | AI review assistant panel (scripted, streamed token by token) | Deal and finding pages |
| 9 | What-if branches: change terms and see payment impact | What-if tab |
| 10 | Dependency graph: what recalculates when a term changes | Dependency graph tab |
| 11 | Pricing dispersion: add-on prices against peers, outliers flagged | `/insights/pricing` |
| 12 | Synthetic data generator with ground truth | `/tools/synthetic` |
| 13 | Accuracy metrics: precision, recall, F1, confusion matrix | `/insights/accuracy` |
| 14 | Audit log with in-browser hash-chain verification | `/audit` |
| 15 | Live deal sandbox with one-click scenario presets | `/tools/sandbox` |

Plus sign-in, settings, notifications and a command palette (**Ctrl/Cmd+K**) that searches deals, findings, rules and pages.

## What is real and what is mocked

| Real (TypeScript, unit tested) | Mocked or scripted |
|---|---|
| Loan payment, total of payments, what-if recalculation (`src/lib/finance.ts`) | Backend: a mock API returns seed JSON after 150 to 400 ms |
| Version diff (`src/lib/diff.ts`) | Review assistant answers (pre-written, streamed) |
| Dependency-graph recalculation (`src/lib/graph.ts`) | Rule clause text (illustrative paraphrase) |
| The four detectors: late add-on, payment masking, rate after approval, missing reason (`src/lib/detectors.ts`) | Accuracy page test-set scores (stored report) |
| SHA-256 hash chain, verified in the browser with Web Crypto (`src/lib/hashchain.ts`) | Users, deals, lenders and providers (all fictional) |
| Refund exposure and the synthetic generator's ground truth | |

Decisions, rule toggles, read notifications, branches and audit events live in an in-memory store backed by `localStorage`. **Settings → Reset demo data** restores the starting data.

## Try it in two minutes

1. Sign in (the demo credentials are prefilled) as **Priya Shah, Compliance Officer**.
2. Open the **Review queue**, then the finding **F-2291** (late add-on) on the hero deal **DT-10482**.
3. Walk the deal's **Timeline**, **Versions & diff** and **Benefit checks** tabs.
4. Open the **Live sandbox**, choose a preset (for example *GAP added after price agreement*) and press **Save as new version**. The real detectors run and the finding slides in.
5. Press **Ctrl/Cmd+K** and search `alvarez` or `F-2292`.
6. Open **Audit log** and run **Verify hash chain**.

## Run locally

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npx tsx scripts/generate-seed.ts` | Regenerate the seed data (deterministic, identical every run) |

## Tech stack

React 18.3, TypeScript (strict), Vite, Tailwind CSS v4, shadcn/ui (Radix), Recharts, React Router v7, TanStack Query v5, TanStack Table v8, @xyflow/react (dependency graph), lucide-react, sonner, date-fns, IBM Plex Sans and Mono. Tests with Vitest.

## Project structure

```
src/
  app/            Shell, router, sidebar, command palette, notifications
  components/     Shared UI (shadcn) and common building blocks
  features/       One folder per feature: dashboard, queue, deals, rules,
                  agent, analytics, metrics, synthetic, sandbox, audit, settings
  lib/            api.ts (mock API), finance, diff, detectors, graph, hashchain, synthetic
  mocks/          db.ts (localStorage-backed store) and seed JSON in data/
  types/          Shared types
scripts/          Seed generator
docs/             DESIGN.md (design rules) and DATA.md (data model, hero deal)
```

All data access goes through `src/lib/api.ts`, so the mock layer can later be swapped for a real service.

## Design principles

Calm, dense and data-first, in the spirit of Stripe, Linear and Sentry. Every screen has loading skeletons, empty states, error states with Retry and toasts after actions. Money is formatted as USD, dates in America/Los_Angeles, figures use tabular numbers, and the interface is keyboard navigable with visible focus rings. Full rules are in [docs/DESIGN.md](docs/DESIGN.md); the data model and the hero deal are in [docs/DATA.md](docs/DATA.md).

## Fictional names

The workspace is **Harborline Auto Group** (rooftops in San Jose, Fresno, Oakland, Sacramento and San Diego). Lenders are Pacific Crest Credit Union, Summit Auto Finance and Golden Bay Bank. Product providers are ShieldPoint (GAP), DriveCare (service contracts) and TreadSafe (tire and wheel). All people, companies and figures are fictional.

## Known limits

- It is a prototype: nothing is sent anywhere, and the assistant never calls a model.
- Generator scores are computed per run, so they differ from the stored test-set figures on the Accuracy page.
- Rule clauses are paraphrases for illustration and are not legal advice.

## Team

**Team Codeies**
