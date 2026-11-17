# DealTrace

DealTrace is an F&I compliance and fairness auditor for car dealerships. Instead of checking only the final signed contract, it records every change to a deal as an immutable event, compares each deal version with the one before, checks each version against the rules in force on the deal date, tests whether each add-on product can actually benefit the buyer, and ranks findings by refund and customer exposure so a human reviewer can decide before the lender funds the deal. This repository is a frontend-only, clickable prototype that runs entirely on seeded mock data.

## Run locally

```bash
npm install
npm run dev
```

Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`.

## Team

Team Codeies
