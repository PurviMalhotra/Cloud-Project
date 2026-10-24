const region = import.meta.env.VITE_AWS_REGION;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const apiUrl = import.meta.env.VITE_API_URL;
export const awsConfigured = Boolean(region && clientId && apiUrl);
const SESSION_KEY = 'arcade.aws.session';
let refreshInFlight;
function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { sessionStorage.removeItem(SESSION_KEY); return null; }
}
function saveSession(result, refreshToken) {
  const session = { accessToken: result.AccessToken, refreshToken: result.RefreshToken || refreshToken, expiresAt: Date.now() + result.ExpiresIn * 1000 };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
export async function cognito(action, body) {
  if (!awsConfigured) throw new Error('Player accounts are not configured yet. You can still play as a guest.');
  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST', headers: { 'content-type': 'application/x-amz-json-1.1', 'x-amz-target': `AWSCognitoIdentityProviderService.${action}` }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || 'Authentication failed.');
    error.code = result.__type?.split('#').pop();
    throw error;
  }
  return result;
}
export async function getAccessToken() {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + 60000) return session.accessToken;
  if (!refreshInFlight) {
    refreshInFlight = cognito('InitiateAuth', { ClientId: clientId, AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: session.refreshToken } })
      .then(result => saveSession(result.AuthenticationResult, session.refreshToken).accessToken)
      .catch(error => { sessionStorage.removeItem(SESSION_KEY); throw error; })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}
export async function signIn(username, password) {
  const result = await cognito('InitiateAuth', { ClientId: clientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: username.toLowerCase().trim(), PASSWORD: password } });
  if (!result.AuthenticationResult) throw new Error('An additional sign-in step is required.');
  saveSession(result.AuthenticationResult);
}
export const signUp = (username, password, email) => cognito('SignUp', { ClientId: clientId, Username: username.trim().toLowerCase(), Password: password, UserAttributes: [{ Name: 'email', Value: email.trim().toLowerCase() }] });
export const confirmSignUp = (username, code) => cognito('ConfirmSignUp', { ClientId: clientId, Username: username.trim().toLowerCase(), ConfirmationCode: code.trim() });
export const resendCode = username => cognito('ResendConfirmationCode', { ClientId: clientId, Username: username.trim().toLowerCase() });
export async function signOut() {
  const session = readSession();
  try { if (session) await cognito('GlobalSignOut', { AccessToken: session.accessToken }); }
  finally { sessionStorage.removeItem(SESSION_KEY); }
}
export async function api(path, { method = 'GET', body, token } = {}) {
  const accessToken = token || await getAccessToken();
  if (!accessToken) throw new Error('Sign in to continue.');
  const send = () => fetch(`${apiUrl.replace(/\/$/, '')}${path}`, { method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let response = await send();
  // Preserve the score request ID when retrying a throttled or failed request.
  if (response.status === 429 || response.status >= 500) {
    await new Promise(resolve => setTimeout(resolve, 700)); response = await send();
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Request failed.');
  return result;
}
