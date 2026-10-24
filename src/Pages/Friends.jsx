import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../Components/Navbar";
import "./Friends.css";

export default function Friends() {
  const {
    user,
    authLoading,
    addFriend,
    removeFriend,
    fetchUsers,
    fetchFriends,
  } = useAuth();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const loadFriends = async () => {
      setLoading(true);
      try { setFriends(await fetchFriends()); }
      catch (error) { setMessage(error.message); }
      finally { setLoading(false); }
    };

    loadFriends();
  }, [user, fetchFriends]);

  useEffect(() => {
    if (!user) return;

    const fetchAllUsers = async () => {
      try {
        const results = await fetchUsers(search);
        setUsers(results);
      } catch (error) {
        setMessage(error.message);
      }
    };

    fetchAllUsers();
  }, [search, user, fetchUsers]);

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  const refreshUsers = async () => {
    const refreshedUsers = await fetchUsers(search);
    setUsers(refreshedUsers);

    const refreshedFriends = await fetchFriends();
    setFriends(refreshedFriends);
  };

  const handleAdd = async (username) => {
    try {
      await addFriend(username);
      setMessage("Friend added");
      await refreshUsers();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleRemove = async (username) => {
    try {
      await removeFriend(username);
      setMessage("Friend removed");
      await refreshUsers();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleView = (friend) => {
    navigate(`/profile/${encodeURIComponent(friend)}`);
  };

  return (
    <div className="page">
      <Navbar />
      <div className="friends-container">
        <div className="friends-box">
          <h1>Friends</h1>

          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {message && <p className="info">{message}</p>}

          {loading && <p className="info">Loading...</p>}

          <div className="users-list">
            {users.map((u) => (
              <div key={u.username} className="user-row">
                <span>{u.username}</span>
                {u.isFriend ? (
                  <button
                    className="danger-btn"
                    onClick={() => handleRemove(u.username)}
                  >
                    Remove
                  </button>
                ) : (
                  <button onClick={() => handleAdd(u.username)}>Add</button>
                )}
              </div>
            ))}
          </div>

          <h2>Your Friends</h2>
          {loading && <p className="info">Loading...</p>}

          <ul className="friends-list">
            {friends.map((friend) => (
              <li key={friend.id}>
                <span>{friend.username}</span>

                <button
                  className="danger-btn"
                  onClick={() => handleRemove(friend.username)}
                >
                  Remove
                </button>

                <button
                  className="view-btn"
                  onClick={() => handleView(friend.username)}
                >
                  View Profile
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
