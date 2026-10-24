import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { validateScore } from './domain.mjs';

export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName = process.env.TABLE_NAME;
const key = (id, sk = 'PROFILE') => ({ pk: `USER#${id}`, sk });
const fail = (status, message) => Object.assign(new Error(message), { status });
const publicProfile = (p) => ({ id: p.id, username: p.username, xp: p.xp || 0 });
const get = async (Key) => (await db.send(new GetCommand({ TableName, Key, ConsistentRead: true }))).Item;
const query = async (input) => (await db.send(new QueryCommand({ TableName, ...input }))).Items || [];

async function profileByName(username) {
  const [profile] = await query({ IndexName: 'Directory', KeyConditionExpression: 'directoryPk = :p AND directorySk = :s',
    ExpressionAttributeValues: { ':p': 'PLAYERS', ':s': username } });
  if (!profile) throw fail(404, 'Player not found.');
  return profile;
}

async function canView(actor, target) {
  if (actor !== target && !await get(key(actor, `FRIEND#${target}`))) throw fail(403, 'Add this player as a friend to view their profile.');
}

export async function route(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub || !claims.username) throw fail(401, 'Sign in to continue.');
  const id = claims.sub;
  const username = claims.username;
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body); }
    catch { throw fail(400, 'Invalid JSON.'); }
    if (!body || Array.isArray(body) || typeof body !== 'object') throw fail(400, 'Expected a JSON object.');
  }

  if (path === '/me' && method === 'GET') {
    let profile = await get(key(id));
    if (!profile) {
      profile = { ...key(id), entity: 'PROFILE', id, username, xp: 0,
        directoryPk: 'PLAYERS', directorySk: username, rankPk: 'PLAYERS', createdAt: new Date().toISOString() };
      try { await db.send(new PutCommand({ TableName, Item: profile, ConditionExpression: 'attribute_not_exists(pk)' })); }
      catch (error) { if (error.name !== 'ConditionalCheckFailedException') throw error; profile = await get(key(id)); }
    }
    return publicProfile(profile);
  }

  if (path === '/scores' && method === 'POST') {
    let score;
    try { score = validateScore(body); } catch (error) { throw fail(400, error.message); }
    const receiptKey = key(id, `REQUEST#${score.requestId}`);
    const oldReceipt = await get(receiptKey);
    if (oldReceipt) {
      if (oldReceipt.game !== score.game || oldReceipt.scoreDelta !== score.scoreDelta) throw fail(409, 'Request ID already used for another score.');
      return { accepted: true, duplicate: true };
    }
    // A conditional transaction makes score, XP and replay protection one atomic operation.
    const now = Math.floor(Date.now() / 1000);
    const transact = [
      { Put: { TableName, Item: { ...receiptKey, entity: 'RECEIPT', game: score.game, scoreDelta: score.scoreDelta, expiresAt: now + 604800 }, ConditionExpression: 'attribute_not_exists(pk)' } },
      { Update: { TableName, Key: key(id, `SCORE#${score.game}`), UpdateExpression: 'SET entity = :entity, game = :g, updatedAt = :t ADD score :s', ExpressionAttributeValues: { ':entity': 'SCORE', ':g': score.game, ':t': new Date().toISOString(), ':s': score.scoreDelta } } },
      { Update: { TableName, Key: key(id), UpdateExpression: 'ADD xp :xp', ConditionExpression: 'attribute_exists(pk)', ExpressionAttributeValues: { ':xp': score.xpGain } } },
    ];
    try { await db.send(new TransactWriteCommand({ TransactItems: transact })); }
    catch (error) {
      if (error.name === 'TransactionCanceledException') {
        const receipt = await get(receiptKey);
        if (receipt?.game === score.game && receipt?.scoreDelta === score.scoreDelta) return { accepted: true, duplicate: true };
        throw fail(409, 'Score conflicted with another update. Please retry.');
      }
      throw error;
    }
    return { accepted: true, xpGain: score.xpGain };
  }

  if (path === '/leaderboard' && method === 'GET') {
    return (await query({ IndexName: 'Leaderboard', KeyConditionExpression: 'rankPk = :p', ExpressionAttributeValues: { ':p': 'PLAYERS' }, ScanIndexForward: false, Limit: 50 })).map(publicProfile);
  }
  if (path === '/users' && method === 'GET') {
    const search = (event.queryStringParameters?.search || '').toLowerCase();
    if (!/^[a-z0-9_]{0,20}$/.test(search)) throw fail(400, 'Search by username prefix (letters, numbers, underscores).');
    const values = { ':p': 'PLAYERS', ...(search ? { ':s': search } : {}) };
    const players = await query({ IndexName: 'Directory', KeyConditionExpression: `directoryPk = :p${search ? ' AND begins_with(directorySk, :s)' : ''}`, ExpressionAttributeValues: values, Limit: 50 });
    const friends = await query({ KeyConditionExpression: 'pk = :p AND begins_with(sk, :s)', ExpressionAttributeValues: { ':p': `USER#${id}`, ':s': 'FRIEND#' }, Limit: 50 });
    return players.filter(p => p.id !== id).map(p => ({ ...publicProfile(p), isFriend: friends.some(f => f.friendId === p.id) }));
  }
  if (path === '/friends' && method === 'GET') {
    const edges = await query({ KeyConditionExpression: 'pk = :p AND begins_with(sk, :s)', ExpressionAttributeValues: { ':p': `USER#${id}`, ':s': 'FRIEND#' }, Limit: 50 });
    const profiles = await Promise.all(edges.map(edge => get(key(edge.friendId))));
    return profiles.filter(Boolean).map(publicProfile);
  }
  if (path === '/friends' && ['POST', 'DELETE'].includes(method)) {
    if (typeof body.username !== 'string' || !/^[a-z][a-z0-9_]{2,19}$/.test(body.username)) throw fail(400, 'A valid friend username is required.');
    const friend = await profileByName(body.username);
    if (friend.id === id) throw fail(400, 'Choose another player.');
    const Key = key(id, `FRIEND#${friend.id}`);
    if (method === 'DELETE') await db.send(new DeleteCommand({ TableName, Key }));
    else await db.send(new PutCommand({ TableName, Item: { ...Key, entity: 'FRIEND', friendId: friend.id } }));
    return { ok: true };
  }
  if (path.startsWith('/profiles/') && method === 'GET') {
    const profile = await profileByName(decodeURIComponent(path.slice('/profiles/'.length)));
    await canView(id, profile.id);
    return publicProfile(profile);
  }
  const match = path.match(/^\/players\/([^/]+)\/(scores|achievements)$/);
  if (match && method === 'GET') {
    const target = decodeURIComponent(match[1]);
    await canView(id, target);
    const rows = await query({ KeyConditionExpression: 'pk = :p AND begins_with(sk, :s)', ExpressionAttributeValues: { ':p': `USER#${target}`, ':s': match[2] === 'scores' ? 'SCORE#' : 'BADGE#' }, Limit: 50 });
    return rows.map(row => match[2] === 'scores' ? { game: row.game, score: row.score } : { id: row.badgeId, title: row.title, description: row.description, earnedAt: row.earnedAt });
  }
  throw fail(404, 'Endpoint not found.');
}

export async function handler(event) {
  try {
    return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(await route(event)) };
  } catch (error) {
    const statusCode = error.status || (error.name === 'ProvisionedThroughputExceededException' || error.name === 'ThrottlingException' ? 429 : 500);
    // Do not log tokens, email addresses, request bodies or player identifiers.
    console.error(JSON.stringify({ requestId: event.requestContext?.requestId, statusCode, errorType: error.name }));
    return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ message: statusCode === 500 ? 'The server could not complete this request.' : error.message }) };
  }
}
