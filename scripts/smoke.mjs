// Live integration check: creates two disposable players without sending emails,
// tests the API, then removes only the players/data created by this run.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, InitiateAuthCommand, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
const out = JSON.parse(await readFile('.deploy/outputs.json', 'utf8'));
const region = out.Region;
const pool = new CognitoIdentityProviderClient({region});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({region}));
const players = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function call(path, player, method = 'GET', body) {
  await pause(650);
  let result;
  for (let i=0;i<4;i++) {
    result = await fetch(`${out.ApiUrl}${path}`, { method, headers: { ...(player ? {Authorization: `Bearer ${player.token}`} : {}), ...(body ? {'content-type':'application/json'} : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (result.status !== 429 && result.status !== 503) break;
    await pause(1500);
  }
  const data = await result.json();
  return {status: result.status,data};
}
async function player(suffix) {
  const username = `demo_${Date.now().toString(36)}_${suffix}`;
  const password = `Demo!Aa9${randomBytes(15).toString('hex')}`;
  const created = {username}; players.push(created);
  await pool.send(new AdminCreateUserCommand({UserPoolId:out.UserPoolId,Username:username,MessageAction:'SUPPRESS',UserAttributes:[{Name:'email',Value:`${username}@example.invalid`},{Name:'email_verified',Value:'true'}]}));
  await pool.send(new AdminSetUserPasswordCommand({UserPoolId:out.UserPoolId,Username:username,Password:password,Permanent:true}));
  const login = await pool.send(new InitiateAuthCommand({ClientId:out.ClientId,AuthFlow:'USER_PASSWORD_AUTH',AuthParameters:{USERNAME:username,PASSWORD:password}}));
  created.token = login.AuthenticationResult.AccessToken;
  const me = await call('/me',created);
  assert.equal(me.status,200,JSON.stringify(me));
  created.id = me.data.id;
  return created;
}
try {
  const anonymous = await call('/me'); assert.equal(anonymous.status,401); console.log('PASS: unauthenticated API request rejected');
  const a = await player('a'); const b = await player('b'); console.log('PASS: Cognito login and profile creation');
  const payload = {game:'snake',scoreDelta:100,requestId:randomUUID()};
  const score = await call('/scores',a,'POST',payload); assert.equal(score.status,200,JSON.stringify(score));
  const replay = await call('/scores',a,'POST',payload); assert.equal(replay.data.duplicate,true,JSON.stringify(replay));
  const scores = await call(`/players/${a.id}/scores`,a); assert.equal(scores.data.find(s=>s.game==='snake').score,100);
  const me = await call('/me',a); assert.equal(me.data.xp,20); console.log('PASS: score persisted and replay awarded no extra XP');
  const denied = await call(`/players/${a.id}/scores`,b); assert.equal(denied.status,403); console.log('PASS: non-friend private scores rejected');
  await pause(2500);
  const friend = await call('/friends',b,'POST',{username:a.username}); assert.equal(friend.status,200,JSON.stringify(friend));
  const view = await call(`/profiles/${a.username}`,b); assert.equal(view.status,200,JSON.stringify(view)); console.log('PASS: friend relationship grants profile access');
  let badges;
  for(let i=0;i<12;i++) { badges=await call(`/players/${a.id}/achievements`,a); if(badges.status===200 && badges.data.length===2)break; await pause(1500); }
  assert.equal(badges.data.length,2,JSON.stringify(badges)); console.log('PASS: DynamoDB stream awarded First points and Century club');
  const leaderboard = await call('/leaderboard',a); assert.ok(leaderboard.data.some(p=>p.id===a.id&&p.xp===20)); console.log('PASS: all-time leaderboard updated');
  const bucket = await fetch(`https://${out.AssetBucket}.s3.${region}.amazonaws.com/index.html`); assert.equal(bucket.status,403); console.log('PASS: S3 denies direct public access');
  const website = await fetch(out.WebsiteUrl); assert.equal(website.status,200); assert.ok((await website.text()).includes('root')); console.log('PASS: CloudFront serves the React app');
  const directRoute = await fetch(`${out.WebsiteUrl}/profile`); assert.equal(directRoute.status,200); console.log('PASS: direct SPA route refresh');
  const cf = new CloudFormationClient({region}); const stack = (await cf.send(new DescribeStacksCommand({StackName:'arcade-hub'}))).Stacks[0]; assert.ok(['CREATE_COMPLETE','UPDATE_COMPLETE'].includes(stack.StackStatus));
  console.log('All live smoke checks passed. Signup email delivery still requires a real user check.');
} finally {
  // Tokens/passwords are never written to disk or printed.
  for (const p of players) {
    if (p.id) {
      // Stream events may still be finishing; allow the worker to drain first.
      await pause(2000);
      const rows = await db.send(new QueryCommand({TableName:out.TableName,KeyConditionExpression:'pk = :p',ExpressionAttributeValues:{':p':`USER#${p.id}`},ConsistentRead:true}));
      for(const row of rows.Items||[])await db.send(new DeleteCommand({TableName:out.TableName,Key:{pk:row.pk,sk:row.sk}}));
    }
    try { await pool.send(new AdminDeleteUserCommand({UserPoolId:out.UserPoolId,Username:p.username})); }
    catch (error) { console.error('Disposable Cognito player cleanup:',error.name); }
  }
  console.log('Disposable test players cleaned up.');
}
