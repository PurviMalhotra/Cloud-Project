import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
const ref = name => ({ Ref: name });
const attr = (name, property) => ({ 'Fn::GetAtt': [name, property] });
const sub = text => ({ 'Fn::Sub': text });
const resource = (Type, Properties, extra = {}) => ({ Type, Properties, ...extra });
const throughput = { ReadCapacityUnits: 1, WriteCapacityUnits: 1 };
const schema = (hash, range) => [{ AttributeName: hash, KeyType: 'HASH' }, { AttributeName: range, KeyType: 'RANGE' }];
const inline = async file => (await build({ entryPoints: [`aws/${file}.mjs`], bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['@aws-sdk/*'], write: false })).outputFiles[0].text;
const trust = { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] };
const allow = (Action, Resource) => ({ Effect: 'Allow', Action, Resource });
const logPolicy = name => allow(['logs:CreateLogStream', 'logs:PutLogEvents'], sub(`arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/lambda/\${AWS::StackName}-${name}:*`));
export async function makeTemplate() {
  const Resources = {
    Assets: resource('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
      BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] },
      OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] },
      Tags: [{ Key: 'Project', Value: 'ArcadeHub' }],
    }),
    OriginAccess: resource('AWS::CloudFront::OriginAccessControl', { OriginAccessControlConfig: { Name: sub('${AWS::StackName}-s3'), OriginAccessControlOriginType: 's3', SigningBehavior: 'always', SigningProtocol: 'sigv4' } }),
    SecurityHeaders: resource('AWS::CloudFront::ResponseHeadersPolicy', { ResponseHeadersPolicyConfig: {
      Name: sub('${AWS::StackName}-headers'),
      SecurityHeadersConfig: { ContentTypeOptions: { Override: true }, FrameOptions: { FrameOption: 'DENY', Override: true }, ReferrerPolicy: { ReferrerPolicy: 'strict-origin-when-cross-origin', Override: true },
        StrictTransportSecurity: { AccessControlMaxAgeSec: 31536000, Override: true },
        ContentSecurityPolicy: { Override: true, ContentSecurityPolicy: sub("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self' https://cognito-idp.${AWS::Region}.amazonaws.com https://${HttpApi}.execute-api.${AWS::Region}.amazonaws.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'") } },
    } }),
    Distribution: resource('AWS::CloudFront::Distribution', { DistributionConfig: {
      Enabled: true, DefaultRootObject: 'index.html', HttpVersion: 'http2', PriceClass: 'PriceClass_100',
      Origins: [{ Id: 'assets', DomainName: attr('Assets', 'RegionalDomainName'), S3OriginConfig: { OriginAccessIdentity: '' }, OriginAccessControlId: attr('OriginAccess', 'Id') }],
      DefaultCacheBehavior: { TargetOriginId: 'assets', ViewerProtocolPolicy: 'redirect-to-https', Compress: true,
        AllowedMethods: ['GET', 'HEAD'], CachedMethods: ['GET', 'HEAD'],
        CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', ResponseHeadersPolicyId: ref('SecurityHeaders') },
      CustomErrorResponses: [403, 404].map(ErrorCode => ({ ErrorCode, ResponseCode: 200, ResponsePagePath: '/index.html', ErrorCachingMinTTL: 0 })),
      ViewerCertificate: { CloudFrontDefaultCertificate: true },
    } }),
    AssetsPolicy: resource('AWS::S3::BucketPolicy', { Bucket: ref('Assets'), PolicyDocument: { Version: '2012-10-17', Statement: [
      { Effect: 'Allow', Principal: { Service: 'cloudfront.amazonaws.com' }, Action: 's3:GetObject', Resource: sub('${Assets.Arn}/*'), Condition: { StringEquals: { 'AWS:SourceArn': sub('arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${Distribution}') } } },
      { Effect: 'Deny', Principal: '*', Action: 's3:*', Resource: [attr('Assets', 'Arn'), sub('${Assets.Arn}/*')], Condition: { Bool: { 'aws:SecureTransport': false } } },
    ] } }),
    Players: resource('AWS::DynamoDB::Table', {
      BillingMode: 'PROVISIONED', ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      AttributeDefinitions: ['pk', 'sk', 'directoryPk', 'directorySk', 'rankPk', 'xp'].map(AttributeName => ({ AttributeName, AttributeType: AttributeName === 'xp' ? 'N' : 'S' })),
      KeySchema: schema('pk', 'sk'),
      GlobalSecondaryIndexes: [
        { IndexName: 'Directory', KeySchema: schema('directoryPk', 'directorySk'), Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: ['id', 'username', 'xp'] }, ProvisionedThroughput: throughput },
        { IndexName: 'Leaderboard', KeySchema: schema('rankPk', 'xp'), Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: ['id', 'username'] }, ProvisionedThroughput: throughput },
      ],
      StreamSpecification: { StreamViewType: 'NEW_IMAGE' }, TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
      SSESpecification: { SSEEnabled: true }, Tags: [{ Key: 'Project', Value: 'ArcadeHub' }],
    }),
    UserPool: resource('AWS::Cognito::UserPool', {
      UserPoolName: sub('${AWS::StackName}-players'), UserPoolTier: 'LITE', AutoVerifiedAttributes: ['email'],
      UsernameConfiguration: { CaseSensitive: false },
      Policies: { PasswordPolicy: { MinimumLength: 12, RequireLowercase: true, RequireUppercase: true, RequireNumbers: true, RequireSymbols: true } },
      Schema: [{ Name: 'email', Required: true, Mutable: true }],
      EmailConfiguration: { EmailSendingAccount: 'COGNITO_DEFAULT' }, MfaConfiguration: 'OFF',
      AccountRecoverySetting: { RecoveryMechanisms: [{ Name: 'verified_email', Priority: 1 }] },
    }),
    UserClient: resource('AWS::Cognito::UserPoolClient', {
      UserPoolId: ref('UserPool'), GenerateSecret: false, PreventUserExistenceErrors: 'ENABLED',
      ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      AccessTokenValidity: 15, IdTokenValidity: 15, RefreshTokenValidity: 1,
      TokenValidityUnits: { AccessToken: 'minutes', IdToken: 'minutes', RefreshToken: 'days' }, EnableTokenRevocation: true,
    }),
    HttpApi: resource('AWS::ApiGatewayV2::Api', { Name: sub('${AWS::StackName}-api'), ProtocolType: 'HTTP' }),
    Authorizer: resource('AWS::ApiGatewayV2::Authorizer', { ApiId: ref('HttpApi'), Name: 'Players', AuthorizerType: 'JWT', IdentitySource: ['$request.header.Authorization'],
      JwtConfiguration: { Audience: [ref('UserClient')], Issuer: sub('https://cognito-idp.${AWS::Region}.amazonaws.com/${UserPool}') } }),
    Stage: resource('AWS::ApiGatewayV2::Stage', { ApiId: ref('HttpApi'), StageName: '$default', AutoDeploy: true,
      DefaultRouteSettings: { ThrottlingBurstLimit: 5, ThrottlingRateLimit: 2 } }),
    Integration: resource('AWS::ApiGatewayV2::Integration', { ApiId: ref('HttpApi'), IntegrationType: 'AWS_PROXY', IntegrationUri: attr('ApiFunction', 'Arn'), PayloadFormatVersion: '2.0' }),
    ApiRole: resource('AWS::IAM::Role', { AssumeRolePolicyDocument: trust, Policies: [{ PolicyName: 'ArcadeApi', PolicyDocument: { Version: '2012-10-17', Statement: [
      allow(['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:ConditionCheckItem'], [attr('Players', 'Arn'), sub('${Players.Arn}/index/*')]), logPolicy('api'),
    ] } }] }),
    AchievementRole: resource('AWS::IAM::Role', { AssumeRolePolicyDocument: trust, Policies: [{ PolicyName: 'ArcadeAchievements', PolicyDocument: { Version: '2012-10-17', Statement: [
      allow(['dynamodb:DescribeStream', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator'], attr('Players', 'StreamArn')),
      allow(['dynamodb:ListStreams'], '*'), allow(['dynamodb:PutItem'], attr('Players', 'Arn')), logPolicy('achievements'),
    ] } }] }),
    ApiLogs: resource('AWS::Logs::LogGroup', { LogGroupName: sub('/aws/lambda/${AWS::StackName}-api'), RetentionInDays: 3 }),
    AchievementLogs: resource('AWS::Logs::LogGroup', { LogGroupName: sub('/aws/lambda/${AWS::StackName}-achievements'), RetentionInDays: 3 }),
    ApiFunction: resource('AWS::Lambda::Function', { FunctionName: sub('${AWS::StackName}-api'), Runtime: 'nodejs22.x', Handler: 'index.handler', Role: attr('ApiRole', 'Arn'),
      MemorySize: 128, Timeout: 10, Environment: { Variables: { TABLE_NAME: ref('Players') } }, Code: { ZipFile: await inline('api') } }, { DependsOn: ['ApiLogs'] }),
    AchievementFunction: resource('AWS::Lambda::Function', { FunctionName: sub('${AWS::StackName}-achievements'), Runtime: 'nodejs22.x', Handler: 'index.handler', Role: attr('AchievementRole', 'Arn'),
      MemorySize: 128, Timeout: 10, Environment: { Variables: { TABLE_NAME: ref('Players') } }, Code: { ZipFile: await inline('achievements') } }, { DependsOn: ['AchievementLogs'] }),
    InvokePermission: resource('AWS::Lambda::Permission', { FunctionName: ref('ApiFunction'), Action: 'lambda:InvokeFunction', Principal: 'apigateway.amazonaws.com', SourceArn: sub('arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${HttpApi}/*') }),
    AchievementStream: resource('AWS::Lambda::EventSourceMapping', { FunctionName: ref('AchievementFunction'), EventSourceArn: attr('Players', 'StreamArn'), StartingPosition: 'TRIM_HORIZON', BatchSize: 5,
      MaximumBatchingWindowInSeconds: 1, BisectBatchOnFunctionError: true, MaximumRetryAttempts: 3, MaximumRecordAgeInSeconds: 3600,
      FunctionResponseTypes: ['ReportBatchItemFailures'], FilterCriteria: { Filters: [{ Pattern: JSON.stringify({ eventName: ['INSERT', 'MODIFY'], dynamodb: { NewImage: { entity: { S: ['SCORE'] } } } }) }] } }),
    ApiErrors: resource('AWS::CloudWatch::Alarm', { AlarmDescription: 'Arcade API server errors: inspect the Lambda CloudWatch logs.', Namespace: 'AWS/ApiGateway', MetricName: '5xx',
      Dimensions: [{ Name: 'ApiId', Value: ref('HttpApi') }, { Name: 'Stage', Value: '$default' }], Statistic: 'Sum', Period: 300, EvaluationPeriods: 1, Threshold: 1, ComparisonOperator: 'GreaterThanOrEqualToThreshold', TreatMissingData: 'notBreaching' }),
    AchievementErrors: resource('AWS::CloudWatch::Alarm', { AlarmDescription: 'Achievement processing failures: inspect stream retries and Lambda logs.', Namespace: 'AWS/Lambda', MetricName: 'Errors',
      Dimensions: [{ Name: 'FunctionName', Value: ref('AchievementFunction') }], Statistic: 'Sum', Period: 300, EvaluationPeriods: 1, Threshold: 1, ComparisonOperator: 'GreaterThanOrEqualToThreshold', TreatMissingData: 'notBreaching' }),
  };
  // Demo deletion is explicit; replacements retain player data for manual export/review.
  for (const id of ['Assets', 'Players', 'UserPool']) {
    Resources[id].DeletionPolicy = 'Delete';
    Resources[id].UpdateReplacePolicy = id === 'Assets' ? 'Delete' : 'Retain';
  }
  const context = {
    Assets: ['Static build files only; no public bucket endpoint.', ['Keep all public access blocks enabled; only this CDN may read objects.']],
    AssetsPolicy: ['Restrict asset reads to this distribution and require TLS.', ['Preserve SourceArn restriction and insecure-transport deny.']],
    Distribution: ['AWS domain and certificate avoid domain/certificate purchases.', ['No Lambda@Edge or paid subscription.']],
    Players: ['Small provisioned table plus sparse directory and XP indexes avoid scans.', ['Keep total provisioned units within monthly free allowances; no autoscaling.']],
    UserPool: ['Managed passwords and default email verification for class demo.', ['Keep LITE tier; no SMS or custom paid email configuration.']],
    ApiRole: ['Runtime access limited to app data and its logs.', ['Do not grant permissions on unrelated tables or services.']],
    AchievementRole: ['Read score stream and conditionally insert badges.', ['Limit writes to this table; keep runtime role separate from API.']],
    ApiFunction: ['Validate token identity and save score, XP and receipt atomically.', ['Preserve server-side validation and replay checks.']],
    AchievementStream: ['Process only score changes, with bounded partial retries.', ['Filter SCORE records to prevent badge recursion.']],
  };
  for (const [id, [why, must]] of Object.entries(context)) Resources[id].Metadata = { 'com.aws.cloudformation.Context': { why, must } };
  const paths = ['GET /me', 'GET /users', 'GET /friends', 'POST /friends', 'DELETE /friends', 'GET /leaderboard', 'POST /scores', 'GET /profiles/{username}', 'GET /players/{id}/scores', 'GET /players/{id}/achievements'];
  paths.forEach((RouteKey, i) => { Resources[`Route${i}`] = resource('AWS::ApiGatewayV2::Route', { ApiId: ref('HttpApi'), RouteKey, Target: { 'Fn::Join': ['/', ['integrations', ref('Integration')]] }, AuthorizationType: 'JWT', AuthorizerId: ref('Authorizer'), AuthorizationScopes: ['aws.cognito.signin.user.admin'] }); });
  // Exact origins only. Distribution depends on HttpApi, so put CORS in the deployment's second update to avoid a cycle.
  return { AWSTemplateFormatVersion: '2010-09-09', Description: 'Arcade Hub: small serverless class demo. Deploy only on an active AWS Free plan.',
    Metadata: { AWSToolsMetrics: { AWSAgentToolkit: 'aws-cloudformation@3' }, 'com.aws.cloudformation.Context': { must: ['Deploy only on active Free plan; never activate advanced or paid features.'], ref: [{ at: 'docs/ARCHITECTURE.md', has: 'Design rationale and demo limitations' }] } },
    Parameters: { FrontendOrigin: { Type: 'String', Default: 'http://localhost:5173', AllowedPattern: '^https?://[^/]+$' } },
    Conditions: { IsLocalOrigin: { 'Fn::Equals': [ref('FrontendOrigin'), 'http://localhost:5173'] } },
    Resources: { ...Resources, HttpApi: resource('AWS::ApiGatewayV2::Api', { ...Resources.HttpApi.Properties,
      CorsConfiguration: { AllowOrigins: { 'Fn::If': ['IsLocalOrigin', [ref('FrontendOrigin')], [ref('FrontendOrigin'), 'http://localhost:5173']] }, AllowMethods: ['GET', 'POST', 'DELETE'], AllowHeaders: ['authorization', 'content-type'], MaxAge: 600 } }) },
    Outputs: {
      WebsiteUrl: { Value: sub('https://${Distribution.DomainName}') }, AssetBucket: { Value: ref('Assets') }, DistributionId: { Value: ref('Distribution') },
      ApiUrl: { Value: attr('HttpApi', 'ApiEndpoint') }, UserPoolId: { Value: ref('UserPool') }, ClientId: { Value: ref('UserClient') }, TableName: { Value: ref('Players') }, Region: { Value: ref('AWS::Region') },
    },
  };
}
if (process.argv[1]?.endsWith('template.mjs')) {
  await mkdir('.deploy', { recursive: true });
  await writeFile('.deploy/template.json', JSON.stringify(await makeTemplate(), null, 2));
  console.log('Generated .deploy/template.json');
}
