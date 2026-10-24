import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { db, handler } from '../aws/achievements.mjs';
const stored = new Map();
let throttle = false;
mock.method(db, 'send', async ({ input }) => {
  if (throttle) throw Object.assign(new Error('retry'), { name: 'ProvisionedThroughputExceededException' });
  const k = `${input.Item.pk}/${input.Item.sk}`;
  if (stored.has(k)) throw Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' });
  stored.set(k, input.Item); return {};
});
const record = { eventID: 'record', dynamodb: { SequenceNumber: '123', ApproximateCreationDateTime: 1000,
  NewImage: { entity: { S: 'SCORE' }, pk: { S: 'USER#alice' }, game: { S: 'snake' }, score: { N: '100' } } } };
test('stream replays create one copy of each badge', async () => {
  assert.deepEqual(await handler({ Records: [record, record] }), { batchItemFailures: [] });
  assert.equal(stored.size, 2);
});
test('throttled stream records are returned for partial retry', async () => {
  throttle = true;
  assert.deepEqual(await handler({ Records: [record] }), { batchItemFailures: [{ itemIdentifier: '123' }] });
  throttle = false;
});
test('badge records do not cause recursive achievement writes', async () => {
  const size = stored.size;
  await handler({ Records: [{ dynamodb: { NewImage: { entity: { S: 'BADGE' } } } }] });
  assert.equal(stored.size, size);
});
