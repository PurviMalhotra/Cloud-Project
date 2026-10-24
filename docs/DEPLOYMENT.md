# Deployment and cleanup

## Prerequisites

- Active AWS Free plan, with sufficient credits; do not upgrade.
- Node.js 22+ and current AWS CLI v2 (2.32+ supports browser login).
- A local AWS session allowed to deploy CloudFormation, IAM, S3, CloudFront, Lambda, DynamoDB, API Gateway, Cognito, logs and alarms, plus `freetier:GetAccountPlanState`.

AWS CLI 2.38.5 is installed persistently in `~/.local/share/aws-cli`, with its executable at `~/.local/bin/aws`. The official installer verified its signature. The older system CLI was preserved; `~/.local/bin` was added to zsh PATH. AWS MCP configuration also includes that tools path and the `arcade-hub` profile.

## Authenticate

```sh
aws login --profile arcade-hub --region ap-southeast-2
export AWS_PROFILE=arcade-hub
export AWS_REGION=ap-southeast-2
npm run aws:status
```

The AWS SDK uses that named profile. Authentication is separate from a paid-plan upgrade. Do not paste access keys into source, chat, or `.env`.

## Review, deploy, publish

```sh
npm ci
npm test
npm run lint
npm run build
npm run aws:prepare
```

Read `.deploy/change-set.json`. This prepares a change set without deploying application resources. It creates two scoped Lambda runtime roles along with the app infrastructure. The generated CloudFormation template is available through `npm run aws:template`.

```sh
npm run aws:deploy
# First deployment only: update the exact CloudFront CORS origin.
npm run aws:prepare
npm run aws:deploy
npm run aws:publish
# Optional live checks: creates and cleans up disposable players, without emails.
node scripts/smoke.mjs
```

The first deployment must finish before its CloudFront hostname is known. The second update sets that exact frontend origin on API Gateway. Publishing refuses to proceed if this origin is missing. Localhost port 5173 is also allowed for development.

Publishing reads stack outputs, builds the frontend with public Cognito/API settings, uploads static assets to the private bucket and invalidates the CDN cache. `.env.aws.local` and `.deploy` are ignored by Git.

Do not run the historical Node backend for AWS deployment.

## GitHub Actions

`checks.yml` runs tests, lint, build and template generation on pushes/PRs. It needs no AWS credentials.

`publish.yml` provides a manual frontend deployment workflow on `main`, using OIDC and an `arcade-demo` GitHub environment. It is not connected until a repository-specific AWS publish role is configured and its ARN is saved as `ARCADE_PUBLISH_ROLE_ARN` in that environment. A GitHub repository push and trust setup are separate from local implementation.

The publish role should trust only the exact repository's `arcade-demo` environment, with audience `sts.amazonaws.com`, and allow only:

- `s3:PutObject` on this stack's asset bucket objects;
- `cloudfront:CreateInvalidation` on this distribution;
- `cloudformation:DescribeStacks` on this stack;
- `freetier:GetAccountPlanState` on `*` (read-only account check).

GitHub environment branch rules must restrict deployment to `main`; environment OIDC uses `repo:OWNER/REPOSITORY:environment:arcade-demo` as its subject. Do not use a wildcard repository trust or stored AWS access keys. Infrastructure updates continue to use reviewed change sets locally.

Check GitHub Actions availability/minutes for the repository before enabling CI; AWS Free plan protection does not cover GitHub billing.

## Verify

- CloudFront website loads, including a direct `/profile` route refresh.
- S3 object URL denies public access.
- API `/me` without a token returns 401.
- Cognito signup/email code/login works.
- Scores persist after reload; leaderboard updates eventually.
- Replaying one score request ID awards XP once.
- Badges appear after asynchronous stream processing.
- Non-friends cannot read another player's scores.
- Live Free plan status is still FREE/ACTIVE.

## Export and remove

Export DynamoDB player data and any required demo evidence **before** credits/plan expiry. The project does not automatically export data. Cleanup deletes all player accounts, database records, logs, frontend objects and stack resources.

```sh
# Destructive: only after exporting needed data.
ARCADE_CONFIRM_DELETE=arcade-hub npm run aws:destroy
```

CloudFront deletion can take several minutes. Inspect CloudFormation to confirm `DELETE_COMPLETE`. Cleanup works without the Free plan preflight so it remains usable if account status changes. Any separately configured GitHub OIDC role/provider requires separate cleanup.

## Cost choices

No EC2, NAT gateway, load balancer, RDS, containers, purchased domain, SMS, custom KMS key, paid backups, or always-running server. Small provisioned DynamoDB capacity; API throttling; short Lambda timeout; three-day logs. CloudFront is pay-as-you-go within the protected Free account plan, so it can consume credits. The preflight is not a perpetual billing cap and cannot prevent charges after someone upgrades the account. This setup must stay on Free plan throughout the project.

## Additional validation used for this deployment

Local schema validation: cfn-lint 1.58.0 for ap-southeast-2. Security checks: guardpycfn 0.1.0 with five selected AWS-managed rules in `aws/guard`, pinned to the registry commit documented there. These checks cover S3 public read/write access, encryption, TLS and CloudFront HTTPS; they do not constitute comprehensive compliance certification.

After `npm run aws:template`, run `python scripts/check-cloudformation.py` from an environment containing those exact tools. AWS change-set validation uses `cloudformation describe-events`. No durable CloudTrail trail was configured for this demo; management-event history provides limited 90-day audit coverage.

Agent Toolkit installed its AWS skills and MCP configuration. The connection is bound to `arcade-hub` through `AWS_MCP_PROXY_PROFILES`; restarting Codex loads the new MCP tools. Local AWS CLI/SDK deployment works in this session without a restart.

## Initial deployment record

The initial resources were deployed in ap-southeast-2. A first attempt rolled back because API Gateway rejected duplicate localhost CORS origins; rollback deleted its resources. The corrected configuration uses a conditional origin list and passed local schema checks, five selected Guard rules, and AWS change-set validation. The deployed stack uses the protected Free plan.

## Live website and verification

Website: https://d1q26zxj8f4vri.cloudfront.net

The live smoke check passed Cognito login/profile creation, score/XP persistence, replay protection, friend-only access, stream badges, leaderboard updates, private S3 access and CloudFront SPA routing. Disposable test players and their records were removed. Real signup email delivery was not exercised, because the test suppresses emails; verify it with your own player signup.

The project remained FREE/ACTIVE at verification, with US$120 credits and expiry April 24, 2027. Credit availability can change; `npm run aws:status` reads the current state.
