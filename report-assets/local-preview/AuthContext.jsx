// Local report preview only. These records are illustrative and never sent to AWS.
const player = { id: 'sample-purvi', username: 'purvi_demo', xp: 120 };
const preview = {
  user: player, authLoading: false, configured: true, authError: '', scoreError: '',
  fetchUserProfile: async () => player,
  fetchLeaderboard: async () => [
    { id: 'sample-arcade', username: 'arcade_demo', xp: 180 },
    player,
    { id: 'sample-player', username: 'player_demo', xp: 60 },
  ],
  fetchUserScores: async () => [{ game: 'snake', score: 400 }, { game: 'tictactoe', score: 200 }],
  fetchAchievements: async () => [{ id: 'first', title: 'First points', description: 'Saved a first score' }],
  fetchFriends: async () => [], fetchUsers: async () => [],
  logout: async () => {}, reportScore: async () => ({ preview: true }),
};
export const useAuth = () => preview;
export const AuthProvider = ({ children }) => children;
