/* global process, Buffer */
import http from "node:http"; //create server
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto"; //for password hashing and session ID generation
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "data", "users.json"); //database

const PORT = Number(process.env.PORT) || 4000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map();

async function readUsers() {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeUser) : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hashed = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hashed}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(candidate, "hex"),
  );
}

function sanitizeUser(user) {
  return {
    username: user.username,
    friends: user.friends || [],
    xp: Number(user.xp) || 0,
    scores: user.scores || {},
  };
}

function normalizeUser(user) {
  return {
    ...user,
    friends: Array.isArray(user.friends) ? user.friends : [],
    xp: Number(user.xp) || 0,
    scores:
      user.scores && typeof user.scores === "object" && !Array.isArray(user.scores)
        ? user.scores
        : {},
  };
}

function calculateXpGain(scoreDelta) {
  if (!Number.isFinite(scoreDelta) || scoreDelta <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(scoreDelta * 0.2));
}

function parseCookies(header = "") {
  return header.split(";").reduce((acc, item) => {
    const [rawKey, ...rest] = item.trim().split("=");
    if (!rawKey) {
      return acc;
    }
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function createSession(userId) {
  const sid = crypto.randomBytes(32).toString("hex");
  sessions.set(sid, {
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return sid;
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies["arcade.sid"];
  if (!sid) {
    return null;
  }

  const session = sessions.get(sid);
  if (!session) {
    return null;
  }

  if (session.expiresAt < Date.now()) {
    sessions.delete(sid);
    return null;
  }

  return { sid, ...session };
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "arcade.sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
  );
}

function setSessionCookie(res, sid) {
  res.setHeader(
    "Set-Cookie",
    `arcade.sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`,
  );
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const session = getSession(req);
    if (!session) {
      return sendJson(res, 401, { message: "Not logged in" });
    }

    const users = await readUsers();
    const user = users.find((u) => u.id === session.userId);
    if (!user) {
      sessions.delete(session.sid);
      clearSessionCookie(res);
      return sendJson(res, 401, { message: "Session expired" });
    }

    return sendJson(res, 200, { user: sanitizeUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/signup") {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return sendJson(res, 400, {
        message: "Username and password are required",
      });
    }

    const users = await readUsers();
    if (
      users.some((u) => u.username.toLowerCase() === username.toLowerCase())
    ) {
      return sendJson(res, 409, { message: "Username already exists" });
    }

    const user = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hashPassword(password),
      friends: [],
      xp: 0,
      scores: {},
    };

    users.push(user);
    await writeUsers(users);

    const sid = createSession(user.id);
    setSessionCookie(res, sid);
    return sendJson(res, 201, { user: sanitizeUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return sendJson(res, 400, {
        message: "Username and password are required",
      });
    }

    const users = await readUsers();
    const user = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendJson(res, 401, { message: "Invalid username or password" });
    }

    const sid = createSession(user.id);
    setSessionCookie(res, sid);
    return sendJson(res, 200, { user: sanitizeUser(user) });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const session = getSession(req);
    if (session) {
      sessions.delete(session.sid);
    }

    clearSessionCookie(res);
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    const session = getSession(req);
    if (!session) {
      return sendJson(res, 401, { message: "Unauthorized" });
    }

    const users = await readUsers();
    const currentUser = users.find((u) => u.id === session.userId);

    if (!currentUser) {
      return sendJson(res, 401, { message: "Unauthorized" });
    }

    const search = String(url.searchParams.get("search") || "").toLowerCase();
    const filtered = users
      .filter((u) => u.id !== currentUser.id)
      .filter((u) => u.username.toLowerCase().includes(search))
      .map(sanitizeUser)
      .map((u) => ({
        ...u,
        isFriend: currentUser.friends.includes(u.username),
      }));

    return sendJson(res, 200, { users: filtered });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/users/")) {
    const session = getSession(req);
    if (!session) {
      return sendJson(res, 401, { message: "Unauthorized" });
    }

    const requestedUsername = decodeURIComponent(
      url.pathname.replace("/api/users/", ""),
    ).trim();

    if (!requestedUsername) {
      return sendJson(res, 400, { message: "Username is required" });
    }

    const users = await readUsers();
    const currentUser = users.find((u) => u.id === session.userId);

    if (!currentUser) {
      return sendJson(res, 401, { message: "Unauthorized" });
    }

    if (
      currentUser.username !== requestedUsername &&
      !currentUser.friends.includes(requestedUsername)
    ) {
      return sendJson(res, 403, { message: "You can only view your friends' profiles" });
    }

    const requestedUser = users.find((u) => u.username === requestedUsername);
    if (!requestedUser) {
      return sendJson(res, 404, { message: "User not found" });
    }

    return sendJson(res, 200, { user: sanitizeUser(requestedUser) });
  }


  if (req.method === "GET" && url.pathname === "/api/leaderboard") {
    const session = getSession(req);
    if (!session) {
      return sendJson(res, 401, { message: "Unauthorized" });
    }

    const users = await readUsers();
    const leaderboard = users
      .map(sanitizeUser)
      .sort((a, b) => b.xp - a.xp || a.username.localeCompare(b.username));

    return sendJson(res, 200, { users: leaderboard });
  }

  if (req.method === "POST" && url.pathname === "/api/scores") {
    const session = getSession(req);
    if (!session) {
      return sendJson(res, 401, { message: "Unauthorized" });
    }

    const body = await readBody(req);
    const game = String(body.game || "").trim().toLowerCase();
    const scoreDelta = Number(body.scoreDelta);

    if (!game) {
      return sendJson(res, 400, { message: "Game is required" });
    }

    if (!Number.isFinite(scoreDelta) || scoreDelta <= 0) {
      return sendJson(res, 400, { message: "scoreDelta must be a positive number" });
    }

    const users = await readUsers();
    const currentUser = users.find((u) => u.id === session.userId);

    if (!currentUser) {
      return sendJson(res, 401, { message: "Unauthorized" });
    }

    currentUser.scores = currentUser.scores || {};
    const currentScore = Number(currentUser.scores[game]) || 0;
    const updatedScore = currentScore + scoreDelta;
    currentUser.scores[game] = updatedScore;

    const xpGain = calculateXpGain(scoreDelta);
    currentUser.xp = (Number(currentUser.xp) || 0) + xpGain;

    await writeUsers(users);

    return sendJson(res, 200, {
      user: sanitizeUser(currentUser),
      game,
      scoreDelta,
      xpGain,
      gameScore: updatedScore,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/friends") {
    const session = getSession(req);
    if (!session) {
      return sendJson(res, 401, { message: "Unauthorized" });
    }

    const body = await readBody(req);
    const friendUsername = String(body.friendUsername || "").trim();

    if (!friendUsername) {
      return sendJson(res, 400, { message: "Friend username is required" });
    }

    const users = await readUsers();
    const currentUser = users.find((u) => u.id === session.userId);
    const friendUser = users.find((u) => u.username === friendUsername);

    if (!currentUser || !friendUser) {
      return sendJson(res, 404, { message: "User not found" });
    }

    if (currentUser.username === friendUsername) {
      return sendJson(res, 400, { message: "You cannot add yourself" });
    }

    currentUser.friends = currentUser.friends || [];

    if (currentUser.friends.includes(friendUsername)) {
      return sendJson(res, 409, { message: "Friend already added" });
    }

    currentUser.friends.push(friendUsername);
    await writeUsers(users);

    return sendJson(res, 200, { user: sanitizeUser(currentUser) });
  }

  if (req.method === "DELETE" && url.pathname === "/api/friends") {
    const session = getSession(req);
    if (!session) {
      return sendJson(res, 401, { message: "Unauthorized" });
    }

    const body = await readBody(req);
    const friendUsername = String(body.friendUsername || "").trim();

    if (!friendUsername) {
      return sendJson(res, 400, { message: "Friend username is required" });
    }

    const users = await readUsers();
    const currentUser = users.find((u) => u.id === session.userId);

    if (!currentUser) {
      return sendJson(res, 404, { message: "User not found" });
    }

    currentUser.friends = Array.isArray(currentUser.friends) ? currentUser.friends : [];

    if (!currentUser.friends.includes(friendUsername)) {
      return sendJson(res, 404, { message: "Friend not found" });
    }

    currentUser.friends = currentUser.friends.filter(
      (friend) => friend !== friendUsername,
    );
    await writeUsers(users);

    return sendJson(res, 200, { user: sanitizeUser(currentUser) });
  }

  return sendJson(res, 404, { message: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Arcade Hub backend listening on http://localhost:${PORT}`);
});
