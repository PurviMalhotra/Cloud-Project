import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { db, handler } from '../aws/api.mjs';
import { badgesFor, validateScore } from '../aws/domain.mjs';
const requestId = '5f54ea8a-153e-47bb-b383-49dc7a85a9a2';
const event = (method, rawPath, body, sub = 'alice-id') => ({ rawPath, body: body === undefined ? undefined : JSON.stringify(body),
  requestContext: { requestId: 'test', http: { method }, authorizer: sub ? { jwt: { claims: { sub, username: 'alice' } } } : undefined } });

// AWS is never contacted: exercise authorization, receipt replay and transaction behavior.
const rows = new Map();
const rowKey = k => `${k.pk}/${k.sk}`;
let writes = 0;
mock.method(db, 'send', async command => {
  const input = command.input;
  if (command.constructor.name === 'GetCommand') return { Item: rows.get(rowKey(input.Key)) };
  if (command.constructor.name === 'TransactWriteCommand') {
    writes++;
    const [receipt, score, profile] = input.TransactItems;
    const rk = rowKey(receipt.Put.Item);
    if (rows.has(rk)) throw Object.assign(new Error('duplicate'), { name: 'TransactionCanceledException' });
    if (!rows.has(rowKey(profile.Update.Key))) throw Object.assign(new Error('missing profile'), { name: 'TransactionCanceledException' });
    rows.set(rk, receipt.Put.Item);
    const old = rows.get(rowKey(score.Update.Key)) || { ...score.Update.Key, score: 0 };
    rows.set(rowKey(score.Update.Key), { ...old, score: old.score + score.Update.ExpressionAttributeValues[':s'] });
    const p = rows.get(rowKey(profile.Update.Key)); p.xp += profile.Update.ExpressionAttributeValues[':xp'];
    return {};
  }
  throw new Error(`Unexpected operation: ${command.constructor.name}`);
});

test('rejects anonymous access before reading the database', async () => {
  assert.equal((await handler(event('GET', '/leaderboard', undefined, null))).statusCode, 401);
});
test('rejects malformed JSON and non-object request bodies', async () => {
  assert.equal((await handler({ ...event('POST', '/scores'), body: '{' })).statusCode, 400);
  assert.equal((await handler(event('POST', '/scores', []))).statusCode, 400);
});
test('validates score ranges, games and replay IDs', () => {
  for (const scoreDelta of [-1, 0, 1.5, 100001, '10', NaN]) assert.throws(() => validateScore({ game: 'snake', scoreDelta, requestId }));
  assert.throws(() => validateScore({ game: 'unknown', scoreDelta: 10, requestId }));
  assert.throws(() => validateScore({ game: 'snake', scoreDelta: 10, requestId: 'abc' }));
});
test('same request cannot award score or XP twice; identity comes from the token', async () => {
  rows.clear(); writes = 0;
  rows.set('USER#alice-id/PROFILE', { pk: 'USER#alice-id', sk: 'PROFILE', xp: 0 });
  const payload = { game: 'snake', scoreDelta: 100, requestId, userId: 'victim' };
  assert.equal((await handler(event('POST', '/scores', payload))).statusCode, 200);
  const replay = await handler(event('POST', '/scores', payload));
  assert.equal(JSON.parse(replay.body).duplicate, true);
  assert.equal(writes, 1);
  assert.equal(rows.get('USER#alice-id/SCORE#snake').score, 100);
  assert.equal(rows.get('USER#alice-id/PROFILE').xp, 20);
  assert.equal(rows.has('USER#victim/PROFILE'), false);
  assert.equal((await handler(event('POST', '/scores', { ...payload, scoreDelta: 200 }))).statusCode, 409);
});
test('private scores and badges are denied to non-friends', async () => {
  assert.equal((await handler(event('GET', '/players/bob-id/scores'))).statusCode, 403);
  assert.equal((await handler(event('GET', '/players/bob-id/achievements'))).statusCode, 403);
});
test('achievements use cumulative game points at the threshold', () => {
  assert.equal(badgesFor('snake', 99).length, 1);
  assert.equal(badgesFor('snake', 100).length, 2);
  assert.equal(badgesFor('pong', 100)[1].id, 'pong-century');
});

test('rejects invalid score payloads without changing stored XP', async () => {
  const xp = rows.get('USER#alice-id/PROFILE').xp;
  assert.equal((await handler(event('POST', '/scores', { game: 'snake', scoreDelta: -10, requestId }))).statusCode, 400);
  assert.equal(rows.get('USER#alice-id/PROFILE').xp, xp);
});
