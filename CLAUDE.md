# DealTrace: project instructions (frontend mockup)

## 1. What DealTrace is
DealTrace is an F&I (finance and insurance) compliance and fairness auditor for car dealerships.
Most compliance tools check only the final signed contract. DealTrace checks how the deal got there:
- records every change to a deal (price, add-on products, APR, term, documents) as an immutable event,
- compares each deal version with the previous one (semantic diff),
- checks each version against the rules in force on the deal date (California CARS Act, in force from 1 Oct 2026; Civil Code 2982.12 GAP rules),
- tests whether each add-on (GAP, service contract, etc.) can actually benefit this buyer,
- ranks findings by refund exposure and customer exposure,
- lets an AI assistant draft a case summary,
- and a human reviewer makes the final decision before the lender funds the deal.
Built by Team Codeies for Tekion's Tek-Qubit: Women of Impact 2026 (problem statement: F&I Compliance & Fairness Auditor).

## 2. Goal of this project
A frontend-only, clickable prototype to showcase in a hackathon ideation round. It must look and feel like a production SaaS product used daily by compliance teams.
- NO backend, NO network calls to external services, NO API keys anywhere.
- All data comes from seed JSON in src/mocks/data, served through a mock API layer (src/lib/api.ts) that returns Promises with 150 to 400 ms latency so loading states are visible.
- Mutable state (decisions, rule toggles, read notifications, branches, audit events) lives in an in-memory store backed by localStorage, with a "Reset demo data" action.
- REAL logic (written in TypeScript, unit tested): loan payment and total of payments, what-if recalculation, version diff, dependency-graph recalculation, the 4 detectors, SHA-256 hash-chain verification (Web Crypto).
- The review assistant is SCRIPTED: pre-written answers streamed token by token with live-looking tool steps. The UI must say it is running in prototype mode. Never claim it is a live model.
- Clause text for rules is an illustrative paraphrase. Show "Illustrative summary, not legal advice" on rule clause cards. Do not invent precise statutory thresholds.

## 3. Tech stack (do not add or swap libraries without asking)
React 18.3 (NOT 19), TypeScript (strict), Vite, Tailwind CSS v4, shadcn/ui (Radix), Recharts (through shadcn chart components), React Router v7, TanStack Query v5, TanStack Table v8, lucide-react, sonner, date-fns, @xyflow/react (dependency graph only), @fontsource/ibm-plex-sans and ibm-plex-mono.
Dev only: vitest, tsx (seed script), eslint.
If a library needs React 19, pick the newest version that supports React 18.

## 4. Personas and fake names (use everywhere)
- Logged-in user: Priya Shah, Compliance Officer, Harborline Auto Group.
- Others: Marcus Reed (Internal Auditor), Jordan Lee (F&I Manager), Chris Patel (Sales Consultant), Elena Torres (Lender Funding Analyst).
- Dealer group: Harborline Auto Group. Rooftops: Harborline Motors San Jose, Harborline Motors Fresno, Bayview Auto Oakland, Sierra Vista Auto Sacramento, Coastline Motors San Diego.
- Lenders: Pacific Crest Credit Union, Summit Auto Finance, Golden Bay Bank.
- Product providers: ShieldPoint (GAP), DriveCare (service contracts), TreadSafe (tire and wheel).
All names are fictional. Never use real company logos or brands.

## 5. Features (each needs its own screen or panel)
1 Dashboard 2 Review queue 3 Deal timeline replay 4 Version diff and forensics 5 Customer outcome (benefit) simulator 6 Rules engine with effective dates 7 Blast radius 8 AI review assistant panel 9 What-if branches 10 Dependency graph 11 Pricing dispersion 12 Synthetic data generator 13 Accuracy metrics 14 Audit log and hash-chain verify 15 Live deal sandbox. Plus: login, settings, notifications, command palette (Ctrl/Cmd+K).

## 6. Design and code rules
- Full design rules are in docs/DESIGN.md. Data model and the hero deal are in docs/DATA.md. Read both before building any screen.
- Look like Stripe, Linear and Sentry: calm, dense, data-first. NOT an AI-generated template.
- Every screen has loading skeletons, empty states, error states with Retry, and toasts after actions.
- Every button and link must do something (navigate, dialog, or toast). No dead clicks.
- TypeScript strict, no `any`. Feature folders: src/features/<feature>/ (components, hooks, types). Shared types in src/types. All data access through src/lib/api.ts only.
- Money: Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}). Dates like 'Oct 20, 2026, 10:40 AM' in America/Los_Angeles.
- Never use the word "fraud". Findings carry "Potential violation – human review required".
- No lorem ipsum, no "Test User", no visible TODO, no console errors or warnings.
- Amounts shown anywhere must come from the data layer or src/lib/finance.ts, never hard-coded in components.

## 7. How to work
- Do only the phase I ask for. Do not build extra features or rename existing things.
- If something is unclear, ask before coding.
- After every change run typecheck, lint and tests, and fix errors before saying you are done.
- Never delete working features to fix an error.
