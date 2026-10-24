/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, awsConfigured, getAccessToken, signIn, signOut, signUp, confirmSignUp, resendCode } from '../lib/aws';
const AuthContext = createContext();
const actions = {
  fetchUsers: (search = '') => api(`/users?search=${encodeURIComponent(search)}`),
  fetchUserProfile: username => api(`/profiles/${encodeURIComponent(username)}`),
  fetchFriends: () => api('/friends'),
  addFriend: username => api('/friends', { method: 'POST', body: { username } }),
  removeFriend: username => api('/friends', { method: 'DELETE', body: { username } }),
  fetchLeaderboard: () => api('/leaderboard'),
  fetchUserScores: id => api(`/players/${encodeURIComponent(id)}/scores`),
  fetchAchievements: id => api(`/players/${encodeURIComponent(id)}/achievements`),
  reportScore: (game, scoreDelta) => api('/scores', { method: 'POST', body: { game, scoreDelta, requestId: crypto.randomUUID() } }),
};
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [scoreError, setScoreError] = useState('');
  const reportScore = useCallback(async (game, scoreDelta) => {
    try { const result = await actions.reportScore(game, scoreDelta); setScoreError(''); return result; }
    catch (error) { setScoreError('Your latest points could not be saved. Please check your connection.'); throw error; }
  }, []);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        if (awsConfigured && await getAccessToken()) {
          const profile = await api('/me'); if (active) setUser(profile);
        }
      } catch (error) { if (active) setAuthError(error.message); }
      finally { if (active) setAuthLoading(false); }
    }
    restore(); return () => { active = false; };
  }, []);
  const login = async (username, password) => {
    await signIn(username, password); const profile = await api('/me');
    setUser(profile); setAuthError(''); return profile;
  };
  const logout = async () => { try { await signOut(); } finally { setUser(null); } };
  return <AuthContext.Provider value={{ user, authLoading, authError, configured: awsConfigured, login, logout,
    signup: signUp, confirmSignup: confirmSignUp, resendCode, ...actions, reportScore, scoreError }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
