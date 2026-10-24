import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "../Components/Navbar";
import "./Profile.css";
import { useAuth } from "../context/AuthContext";

const RANK_SYMBOLS = ["🥇", "🥈", "🥉"];

export default function Profile() {
  const navigate = useNavigate();
  const { username } = useParams();
  const {
    user,
    authLoading,
    logout,
    fetchUserProfile,
    fetchLeaderboard,
    fetchUserScores,
    fetchAchievements,
  } = useAuth();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [profileUser, setProfileUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [scores, setScores] = useState([]);
  const [achievements, setAchievements] = useState([]);

  const isOwnProfile = !username || username === user?.username;

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  useEffect(() => {
    if (!user) return;

    async function fetchUsers() {
      try {
        const data = await fetchLeaderboard();
        setUsers(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingUsers(false);
      }
    }

    if (isOwnProfile) {
      fetchUsers();
    }
  }, [user, isOwnProfile, fetchLeaderboard]);

  useEffect(() => {
    if (!user) return;

    async function loadProfile() {
      try {
        setLoadingProfile(true);
        setProfileError("");

        const targetUsername = isOwnProfile
          ? user.username
          : username;

        const profile = await fetchUserProfile(targetUsername);
        setProfileUser(profile);

        const userScores = await fetchUserScores(profile.id);
        setScores(userScores);
        setAchievements(await fetchAchievements(profile.id));
      } catch (error) {
        setProfileError(error.message);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [user, isOwnProfile, username, fetchUserProfile, fetchUserScores, fetchAchievements]);

  if (!authLoading && !user) return <Navigate to="/login" replace />;
  if (!user) return null;

  const displayedUser = profileUser || user;
  const avatarLetter = displayedUser?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="profile-page">
      <Navbar />

      <main className="profile-content">
        <section className="profile-card">
          <div className="profile-avatar">{avatarLetter}</div>
          <div className="profile-info">
            <p className="profile-label">
              {isOwnProfile ? "Player" : "Friend"}
            </p>
            <h1 className="profile-name">{displayedUser?.username}</h1>
            <p className="profile-xp">{displayedUser.xp} XP</p>
          </div>

          {isOwnProfile ? (
            <button className="profile-logout" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <button
              className="profile-back"
              onClick={() => navigate("/friends")}
            >
              Back to Friends
            </button>
          )}
        </section>

        <section className="profile-card">
          <div className="profile-card-header">
            <h2>{isOwnProfile ? "Game Scores" : "Games Played"}</h2>
          </div>

          {loadingProfile ? (
            <p className="loading-text">Loading…</p>
          ) : profileError ? (
            <p className="loading-text">{profileError}</p>
          ) : (
            <ul className="leaderboard-list">
              {scores.length ? (
                scores.map((s, index) => (
                  <li key={index}>
                    <span>{s.game}</span>
                    <span>{s.score} pts</span>
                  </li>
                ))
              ) : (
                <li className="empty-state">
                  <span>No games played yet</span>
                </li>
              )}
            </ul>
          )}
        </section>

        <section className="profile-card">
          <div className="profile-card-header"><h2>Achievements</h2></div>
          <ul className="leaderboard-list">
            {achievements.length ? achievements.map(badge => <li key={badge.id}><span>🏆 {badge.title}</span><span>{badge.description}</span></li>) : <li className="empty-state"><span>No badges yet. Save a score, then revisit your profile.</span></li>}
          </ul>
        </section>

        {isOwnProfile && (
          <section className="profile-card">
            <div className="profile-card-header">
              <h2>Leaderboard</h2>
              <span className="profile-pill">All time</span>
            </div>

            {loadingUsers ? (
              <p className="loading-text">Loading…</p>
            ) : (
              <ul className="leaderboard-list">
                {users.map((u, index) => {
                  const rankClass =
                    index === 0
                      ? "rank-1"
                      : index === 1
                        ? "rank-2"
                        : index === 2
                          ? "rank-3"
                          : "";
                  const isMe = u.username === user.username ? "is-me" : "";
                  const rankSymbol =
                    index < 3 ? RANK_SYMBOLS[index] : `${index + 1}.`;

                  return (
                    <li
                      key={u.username}
                      className={`${rankClass} ${isMe}`.trim()}
                    >
                      <span>{rankSymbol}</span>
                      <span>{u.username}</span>
                      <span>{u.xp} XP</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
