import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTemplate } from '../scripts/template.mjs';
import { assertFreePlan } from '../scripts/aws.mjs';

test('deployment fails closed on paid, unknown, expired or low-credit accounts', () => {
  const plan = { accountId: '123', accountPlanType: 'FREE', accountPlanStatus: 'ACTIVE', accountPlanRemainingCredits: { amount: 100 }, accountPlanExpirationDate: new Date(Date.now() + 86400000 * 20) };
  assert.doesNotThrow(() => assertFreePlan(plan, '123'));
  for (const changes of [{ accountPlanType: 'PAID' }, { accountPlanStatus: 'EXPIRED' }, { accountPlanRemainingCredits: { amount: 9 } }, { accountPlanExpirationDate: undefined }, { accountId: 'different-account' }]) {
    assert.throws(() => assertFreePlan({ ...plan, ...changes }, '123'));
  }
});
test('template keeps S3 private, all API routes authorized, and capacity within free allowances', async () => {
  const template = await makeTemplate(); const r = template.Resources;
  assert.ok(Buffer.byteLength(JSON.stringify(template)) < 51200, 'CloudFormation inline template size');
  assert.equal(r.Assets.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy, true);
  assert.equal(r.UserPool.Properties.UserPoolTier, 'LITE');
  assert.equal(r.UserPool.Properties.EmailConfiguration.EmailSendingAccount, 'COGNITO_DEFAULT');
  for (const v of Object.values(r).filter(v => v.Type === 'AWS::ApiGatewayV2::Route')) {
    assert.equal(v.Properties.AuthorizationType, 'JWT'); assert.ok(v.Properties.AuthorizationScopes.length);
  }
  const throughputs = [r.Players.Properties.ProvisionedThroughput, ...r.Players.Properties.GlobalSecondaryIndexes.map(i => i.ProvisionedThroughput)];
  for (const key of ['ReadCapacityUnits', 'WriteCapacityUnits']) assert.ok(throughputs.reduce((sum, t) => sum + t[key], 0) <= 25);
  assert.equal(r.ApiLogs.Properties.RetentionInDays, 3);
  const origins = r.HttpApi.Properties.CorsConfiguration.AllowOrigins['Fn::If'];
  assert.equal(origins[0], 'IsLocalOrigin');
  assert.equal(origins[1].length, 1, 'First deployment must not duplicate localhost');
  assert.equal(origins[2].length, 2);
  assert.ok(!Object.values(r).some(v => /EC2|RDS|Organizations|ControlTower|EKS/.test(v.Type)));
  assert.deepEqual(r.AchievementStream.Properties.FunctionResponseTypes, ['ReportBatchItemFailures']);
});
