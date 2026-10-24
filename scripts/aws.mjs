import { CloudFormationClient, CreateChangeSetCommand, DescribeChangeSetCommand, ExecuteChangeSetCommand, DescribeStacksCommand, DescribeStackEventsCommand, DescribeEventsCommand, DeleteStackCommand } from '@aws-sdk/client-cloudformation';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { FreeTierClient, GetAccountPlanStateCommand } from '@aws-sdk/client-freetier';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeTemplate } from './template.mjs';
export const region = process.env.AWS_REGION || 'ap-southeast-2';
const StackName = process.env.ARCADE_STACK || 'arcade-hub';
const cf = new CloudFormationClient({ region });
const s3 = new S3Client({ region });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ROOT = new URL('../', import.meta.url);
const run = (command, args, env = {}) => {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`${command} failed.`);
};

export function assertFreePlan(plan, accountId) {
  if (plan.accountId !== accountId || plan.accountPlanType !== 'FREE' || plan.accountPlanStatus !== 'ACTIVE') {
    throw new Error('Deployment refused: the target account must have a verified ACTIVE FREE plan.');
  }
  if (!(plan.accountPlanRemainingCredits?.amount >= 10)) throw new Error('Deployment refused: keep at least US$10 of remaining credits.');
  if (!plan.accountPlanExpirationDate || new Date(plan.accountPlanExpirationDate).getTime() < Date.now() + 86400000) {
    throw new Error('Deployment refused: the Free plan must have at least one day remaining.');
  }
}
async function guard() {
  const identity = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
  const plan = await new FreeTierClient({ region: 'us-east-1' }).send(new GetAccountPlanStateCommand({}));
  assertFreePlan(plan, identity.Account);
  console.log(`Verified FREE plan in account ${identity.Account}: ${plan.accountPlanRemainingCredits.amount} ${plan.accountPlanRemainingCredits.unit}; expires ${plan.accountPlanExpirationDate}.`);
  return plan;
}
async function stack() {
  try { return (await cf.send(new DescribeStacksCommand({ StackName }))).Stacks[0]; }
  catch (error) { if (error.name === 'ValidationError' && /does not exist/.test(error.message)) return null; throw error; }
}
const outputs = value => Object.fromEntries(value.Outputs.map(output => [output.OutputKey, output.OutputValue]));
async function waitForStack() {
  for (;;) {
    const current = await stack();
    if (!current) return;
    const status = current.StackStatus;
    console.log(`Stack: ${status}`);
    if (status.endsWith('_IN_PROGRESS')) { await sleep(15000); continue; }
    if (!['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(status)) {
      const events = await cf.send(new DescribeStackEventsCommand({ StackName }));
      for (const event of events.StackEvents.filter(e => e.ResourceStatus.endsWith('FAILED')).slice(0, 5)) console.error(`${event.LogicalResourceId}: ${event.ResourceStatusReason}`);
      throw new Error(`Stack ended in ${status}.`);
    }
    return current;
  }
}
async function prepare() {
  await guard();
  const current = await stack();
  const template = await makeTemplate();
  const Origin = current?.Outputs?.find(o => o.OutputKey === 'WebsiteUrl')?.OutputValue || 'http://localhost:5173';
  const changeSet = await cf.send(new CreateChangeSetCommand({ StackName,
    ChangeSetName: `arcade-${Date.now()}`, ChangeSetType: current ? 'UPDATE' : 'CREATE',
    TemplateBody: JSON.stringify(template), Parameters: [{ ParameterKey: 'FrontendOrigin', ParameterValue: Origin }],
    Capabilities: ['CAPABILITY_IAM'], Tags: [{ Key: 'Project', Value: 'ArcadeHub' }],
  }));
  let result;
  do { await sleep(3000); result = await cf.send(new DescribeChangeSetCommand({ ChangeSetName: changeSet.Id })); } while (['CREATE_PENDING', 'CREATE_IN_PROGRESS'].includes(result.Status));
  if (result.Status !== 'CREATE_COMPLETE') throw new Error(result.StatusReason);
  await mkdir('.deploy', { recursive: true });
  await writeFile('.deploy/change-set.json', JSON.stringify(result, null, 2));
  console.log('Review .deploy/change-set.json. No application resources have been deployed.');
  for (const change of result.Changes || []) console.log(`${change.ResourceChange.Action}: ${change.ResourceChange.LogicalResourceId} (${change.ResourceChange.ResourceType})`);
}
async function deploy() {
  await guard();
  const prepared = JSON.parse(await readFile('.deploy/change-set.json', 'utf8'));
  if (prepared.StackName !== StackName) throw new Error('Prepared stack does not match ARCADE_STACK.');
  const validation = await cf.send(new DescribeEventsCommand({ ChangeSetName: prepared.ChangeSetId }));
  await writeFile('.deploy/service-validation.json', JSON.stringify(validation, null, 2));
  const failures = (validation.OperationEvents || []).filter(event => event.ValidationStatus === 'FAILED');
  if (failures.length) throw new Error('Deployment refused: review failed service validations in .deploy/service-validation.json.');
  await cf.send(new ExecuteChangeSetCommand({ ChangeSetName: prepared.ChangeSetId }));
  const current = await waitForStack();
  await writeFile('.deploy/outputs.json', JSON.stringify(outputs(current), null, 2));
  console.log('Infrastructure deployed. Run aws:prepare and aws:deploy once more on the first deployment to set the exact website CORS origin, then aws:publish.');
}
async function publish() {
  await guard();
  const current = await stack();
  if (!current || !['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(current.StackStatus)) throw new Error('Deploy the infrastructure first.');
  const out = outputs(current);
  const origin = current.Parameters.find(p => p.ParameterKey === 'FrontendOrigin')?.ParameterValue;
  if (origin !== out.WebsiteUrl) throw new Error('Run aws:prepare then aws:deploy again to configure the website origin before publishing.');
  const env = { VITE_AWS_REGION: region, VITE_COGNITO_CLIENT_ID: out.ClientId, VITE_API_URL: out.ApiUrl };
  // Only public identifiers go in Vite. Never place AWS credentials in VITE_* variables.
  await writeFile('.env.aws.local', Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
  run('npm', ['run', 'build', '--', '--mode', 'aws'], env);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
  async function upload(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name); const Key = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await upload(path, `${Key}/`);
      else await s3.send(new PutObjectCommand({ Bucket: out.AssetBucket, Key, Body: await readFile(path), ContentType: types[extname(path)] || 'application/octet-stream',
        CacheControl: Key.startsWith('assets/') ? 'public,max-age=31536000,immutable' : 'no-cache' }));
    }
  }
  await upload('dist');
  await new CloudFrontClient({ region }).send(new CreateInvalidationCommand({ DistributionId: out.DistributionId, InvalidationBatch: { CallerReference: `arcade-${Date.now()}`, Paths: { Quantity: 1, Items: ['/*'] } } }));
  console.log(`Published: ${out.WebsiteUrl}`);
}
async function destroy() {
  if (process.env.ARCADE_CONFIRM_DELETE !== StackName) throw new Error(`Export your data first. Set ARCADE_CONFIRM_DELETE=${StackName} to delete this stack and ALL its player data.`);
  // Cleanup must remain available even if the Free plan has expired or changed.
  const current = await stack(); if (!current) return console.log('Stack is already absent.');
  const out = outputs(current);
  // Only empty the bucket that CloudFormation identifies as belonging to this stack.
  let page;
  do {
    page = await s3.send(new ListObjectsV2Command({ Bucket: out.AssetBucket, MaxKeys: 1000 }));
    if (page.Contents?.length) {
      const result = await s3.send(new DeleteObjectsCommand({ Bucket: out.AssetBucket, Delete: { Objects: page.Contents.map(({ Key }) => ({ Key })) } }));
      if (result.Errors?.length) throw new Error('Could not empty the website bucket; deletion stopped.');
    }
  } while (page.Contents?.length);
  await cf.send(new DeleteStackCommand({ StackName }));
  await waitForStack();
  console.log('Stack removed. Any earlier CI trust or external resources must be cleaned up separately.');
}
const commands = { status: guard, prepare, deploy, publish, destroy };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const action = commands[process.argv[2]];
    if (!action) throw new Error('Choose status, prepare, deploy, publish or destroy.');
    await action();
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
