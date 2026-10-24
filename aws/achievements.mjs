import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { badgesFor } from './domain.mjs';

export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export async function handler(event) {
  const batchItemFailures = [];
  for (const record of event.Records || []) {
    const item = record.dynamodb?.NewImage;
    if (item?.entity?.S !== 'SCORE') continue;
    try {
      for (const badge of badgesFor(item.game.S, Number(item.score.N))) {
        try {
          await db.send(new PutCommand({ TableName: process.env.TABLE_NAME,
            Item: { pk: item.pk.S, sk: `BADGE#${badge.id}`, entity: 'BADGE', badgeId: badge.id, title: badge.title,
              description: badge.description, earnedAt: record.dynamodb.ApproximateCreationDateTime ? new Date(record.dynamodb.ApproximateCreationDateTime * 1000).toISOString() : new Date().toISOString() },
            ConditionExpression: 'attribute_not_exists(pk)' }));
        } catch (error) { if (error.name !== 'ConditionalCheckFailedException') throw error; }
      }
    } catch (error) {
      console.error(JSON.stringify({ event: "achievement_failure", errorType: error.name }));
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }
  return { batchItemFailures };
}
