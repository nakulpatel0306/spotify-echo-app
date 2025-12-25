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
      console.error("Missing code or redirectUri", { code: !!code, redirectUri: !!redirectUri });
      return res.status(400).json({ error: "Missing code or redirectUri" });
    }
    
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error("Missing Spotify credentials in .env file");
      return res.status(500).json({ error: "Server configuration error: Missing Spotify credentials" });
    }
    
    console.log("Exchanging code for token...");
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    console.log("Token exchange successful");
    res.json(tokenData);
  } catch (err) {
    console.error("Token exchange error:", err.message);
    res.status(500).json({ error: err.message || "Failed to exchange code for token" });
  }
});

async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  params.append("client_id", process.env.SPOTIFY_CLIENT_ID);
  params.append("client_secret", process.env.SPOTIFY_CLIENT_SECRET);

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Token refresh failed", res.status, text);
    throw new Error("Token refresh failed");
  }
  return res.json();
}

app.post("/auth/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: "Missing refresh_token" });
    }
    const tokenData = await refreshAccessToken(refresh_token);
    res.json(tokenData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

async function spotifyGet(accessToken, endpoint) {
  const res = await fetch(`${SPOTIFY_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Spotify API error", res.status, endpoint, text);
    throw new Error("Spotify API error");
  }
  return res.json();
}

// overview stats endpoint
app.get("/stats/summary", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const rawRange = req.query.time_range || "short_term";
    const allowedRanges = ["short_term", "medium_term", "long_term"];
    const timeRange = allowedRanges.includes(rawRange)
      ? rawRange
      : "short_term";

    // profile, top tracks, top artists, recent listening, playlists
    const [profile, topTracks, topArtists, recent, playlists] =
      await Promise.all([
        spotifyGet(token, "/me"),
        spotifyGet(
          token,
          `/me/top/tracks?limit=50&time_range=${encodeURIComponent(timeRange)}`
        ),
        spotifyGet(
          token,
          `/me/top/artists?limit=50&time_range=${encodeURIComponent(timeRange)}`
        ),
        spotifyGet(token, "/me/player/recently-played?limit=50"),
        spotifyGet(token, "/me/playlists?limit=20")
      ]);

    // top genres from artists
    const genreCounts = {};
    (topArtists.items || []).forEach((artist) => {
      (artist.genres || []).forEach((g) => {
        const key = g.toLowerCase();
        genreCounts[key] = (genreCounts[key] || 0) + 1;
      });
    });
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([genre, count]) => ({ genre, count }));

    // audio feature summary for top tracks
    const trackIds = (topTracks.items || [])
      .map((t) => t.id)
      .filter(Boolean);

    let audioFeatureSummary = null;
    if (trackIds.length > 0) {
      const featuresRes = await spotifyGet(
        token,
        `/audio-features?ids=${encodeURIComponent(trackIds.join(","))}`
      );
      const feats = (featuresRes.audio_features || []).filter(Boolean);
      if (feats.length > 0) {
        const sums = feats.reduce(
          (acc, f) => {
            acc.tempo += f.tempo || 0;
            acc.energy += f.energy || 0;
            acc.danceability += f.danceability || 0;
            acc.count += 1;
            return acc;
          },
          { tempo: 0, energy: 0, danceability: 0, count: 0 }
        );
        audioFeatureSummary = {
          avgTempo: sums.count ? Math.round(sums.tempo / sums.count) : null,
          avgEnergy: sums.count
            ? Math.round((sums.energy / sums.count) * 100)
            : null,
          avgDanceability: sums.count
            ? Math.round((sums.danceability / sums.count) * 100)
            : null
        };
      }
    }

    // recent tracks: last 48h, sessions, minutes
    const recentItems = recent.items || [];
    const now = Date.now();
    const twoDaysMs = 48 * 60 * 60 * 1000;

    const recentFiltered = recentItems.filter((item) => {
      const playedAt = new Date(item.played_at).getTime();
      return now - playedAt <= twoDaysMs;
    });

    let totalMsRecent = 0;
    const recentTracks = recentFiltered
      .slice()
      .sort(
        (a, b) =>
          new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
      )
      .map((item) => {
        const track = item.track;
        totalMsRecent += track?.duration_ms || 0;
        return {
          played_at: item.played_at,
          track
        };
      });

    const listeningMinutesRecent = Math.round(totalMsRecent / 1000 / 60);

    // sessions: gap > 30min = new session
    let sessionsCount = 0;
    let lastTs = null;
    recentTracks
      .slice()
      .sort(
        (a, b) =>
          new Date(a.played_at).getTime() - new Date(b.played_at).getTime()
      )
      .forEach((item) => {
        const ts = new Date(item.played_at).getTime();
        if (lastTs === null || ts - lastTs > 30 * 60 * 1000) {
          sessionsCount += 1;
        }
        lastTs = ts;
      });

    // simple estimate: 48h -> daily average -> yearly minutes
    let estimatedYearlyMinutes = null;
    if (listeningMinutesRecent > 0) {
      const daily = listeningMinutesRecent / 2;
      estimatedYearlyMinutes = Math.round(daily * 365);
    }

    res.json({
      profile,
      timeRange,
      topTracks,
      topArtists,
      playlists,
      recentTracks,
      listeningMinutesRecent,
      estimatedYearlyMinutes,
      sessionsCount,
      audioFeatureSummary,
      topGenres
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