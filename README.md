# Arcade Hub — AWS serverless arcade

React + Vite games with Cognito accounts, API Gateway HTTP API, Lambda, DynamoDB scores/friends/leaderboards, event-driven achievements, private S3 hosting and CloudFront HTTPS delivery.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

All games work as a guest without AWS credentials. Account features need the three public settings in `.env.example`. Deployment generates `.env.aws.local`; use `npm run dev -- --mode aws` afterward to connect to AWS from localhost. AWS credentials must never appear in `VITE_*` settings.

```sh
npm test
npm run lint
npm run build
npm run aws:template
```

See [the architecture and class demonstration guide](docs/ARCHITECTURE.md) and [deployment instructions](docs/DEPLOYMENT.md).

## ₹0 requirement

Deploy only on the **active AWS Free account plan**. The plan protects against out-of-pocket charges while active; services still consume free allowances and credits. Hosting is **not free indefinitely**. The observed account has US$100 credits and expires April 24, 2027, or sooner when credits are depleted. Recheck the live account before every deployment.

Deployment and publishing fail closed unless the Free Tier API confirms the target account is FREE and ACTIVE, with at least US$10 credits and one day remaining. This is a preflight check, not an ongoing spending cap. No scripts activate paid features, Organizations, Control Tower, or a paid plan. Export needed data before expiry.

## Migration

This implementation replaces Supabase for the active app. Existing Supabase users, passwords and scores are not migrated. Players create a new Cognito account, verify an email code, and sign in using a unique username. Google sign-in was removed because it requires separate provider configuration. The old `server/` code is retained only as historical code and is not deployed or used by the AWS app.


## Cloud Project repository

Course: Cloud Architecture Design (BCSE355L)

Project by Purvi Malhotra, registration number 24BCI0040.

Repository: https://github.com/PurviMalhotra/Cloud-Project

This repository contains a clean snapshot of the current project and report.
Local environment files and player records are excluded. The former AWS deployment
was stopped; GitHub Actions is disabled and no cloud deployment is triggered by a push.

### Local report preview

After installing dependencies with `npm ci`, run:

```sh
npx vite --config report-assets/local-preview/vite.config.mjs --port 5174
```

Open http://127.0.0.1:5174/profile. This separate preview uses labeled sample data
for report screenshots and does not connect to AWS. It is not a production backend.
