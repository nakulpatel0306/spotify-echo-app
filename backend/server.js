import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";

async function exchangeCodeForToken(code, redirectUri) {
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUri);
  params.append("client_id", process.env.SPOTIFY_CLIENT_ID);
  params.append("client_secret", process.env.SPOTIFY_CLIENT_SECRET);

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Token exchange failed", res.status, text);
    throw new Error("Token exchange failed");
  }
  return res.json();
}

app.post("/auth/callback", async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
      return res.status(400).json({ error: "Missing code or redirectUri" });
    }
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    res.json(tokenData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to exchange code for token" });
  }
});

async function spotifyGet(accessToken, endpoint) {
  const res = await fetch(`${SPOTIFY_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Spotify API error", res.status, text);
    throw new Error("Spotify API error");
  }
  return res.json();
}

function groupTopAlbumsFromRecent(items) {
  const map = new Map();
  for (const item of items) {
    const album = item.track?.album;
    if (!album?.id) continue;
    const existing = map.get(album.id) || {
      id: album.id,
      name: album.name,
      image: album.images?.[0]?.url || null,
      playCount: 0,
      minutes: 0
    };
    existing.playCount += 1;
    existing.minutes += (item.track?.duration_ms || 0) / 1000 / 60;
    map.set(album.id, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 12);
}

// Summary stats: top tracks, artists, albums, and listening metrics
app.get("/stats/summary", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const [topTracks, topArtists, recent] = await Promise.all([
      spotifyGet(token, "/me/top/tracks?limit=20&time_range=short_term"),
      spotifyGet(token, "/me/top/artists?limit=20&time_range=short_term"),
      spotifyGet(token, "/me/player/recently-played?limit=50")
    ]);

    const items = recent.items || [];

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const sinceTodayMs = today.getTime();

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const since7DaysMs = sevenDaysAgo.getTime();

    let totalMsToday = 0;
    let totalMsLast7 = 0;
    const hourly = {};
    for (let h = 0; h < 24; h++) hourly[h] = 0;

    const dailyMap = new Map(); // dateStr -> minutes
    let sessionCountToday = 0;
    let lastPlayTodayMs = null;
    const SESSION_GAP_MIN = 30;

    for (const item of items) {
      const playedAt = new Date(item.played_at);
      const playedMs = playedAt.getTime();
      const durMs = item.track?.duration_ms || 0;

      if (playedMs >= since7DaysMs) {
        totalMsLast7 += durMs;
      }

      const dateKey = playedAt.toISOString().slice(0, 10);
      const prev = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, prev + durMs / 1000 / 60);

      if (playedMs >= sinceTodayMs) {
        totalMsToday += durMs;
        const hour = playedAt.getHours();
        hourly[hour] += durMs / 1000 / 60;
        if (lastPlayTodayMs === null || (playedMs - lastPlayTodayMs) / 60000 > SESSION_GAP_MIN) {
          sessionCountToday += 1;
        }
        lastPlayTodayMs = playedMs;
      }
    }

    const listeningMinutesToday = Math.round(totalMsToday / 1000 / 60);
    const listeningMinutesLast7Days = Math.round(totalMsLast7 / 1000 / 60);

    const dailyListening = Array.from(dailyMap.entries())
      .map(([date, minutes]) => ({ date, minutes: Math.round(minutes) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-7);

    const topAlbums = groupTopAlbumsFromRecent(items);

    res.json({
      topTracks,
      topArtists,
      topAlbums,
      listeningMinutesToday,
      listeningMinutesLast7Days,
      hourlyListening: hourly,
      dailyListening,
      sessionCountToday
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
