import React, { useEffect, useState, useMemo, useRef } from "react";

// --- OAuth + backend config ---
const CLIENT_ID = "9515b94349c74337bd2199ce4cb16f6c";

const REDIRECT_URI =
  import.meta.env.VITE_REDIRECT_URI ||
  "http://127.0.0.1:5173/callback";

const SCOPES =
  "user-top-read user-read-recently-played playlist-read-private playlist-read-collaborative user-read-email user-read-private";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_BASE ||
  "http://127.0.0.1:3001";

// helpers
function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    show_dialog: "true", // Force user to see login screen even if previously approved
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function formatNumber(n) {
  if (n == null) return "-";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function humanDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Token management helpers
function getStoredTokens() {
  const accessToken = localStorage.getItem("spotify_access_token");
  const refreshToken = localStorage.getItem("spotify_refresh_token");
  return { accessToken, refreshToken };
}

function setStoredTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem("spotify_access_token", accessToken);
  if (refreshToken) localStorage.setItem("spotify_refresh_token", refreshToken);
}

function clearStoredTokens() {
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
}

// Token refresh lock to prevent race conditions
let refreshPromise = null;

async function refreshToken(refreshToken) {
  const res = await fetch(`${BACKEND_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    throw new Error("Failed to refresh token");
  }
  return res.json();
}

async function spotifyFetch(token, path, onTokenUpdate) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  // If unauthorized, try to refresh token
  if (res.status === 401 && onTokenUpdate) {
    const { refreshToken: storedRefreshToken } = getStoredTokens();
    if (storedRefreshToken) {
      try {
        // Use existing refresh promise if one is in progress, otherwise create new one
        if (!refreshPromise) {
          refreshPromise = refreshToken(storedRefreshToken);
        }
        const newTokenData = await refreshPromise;
        
        const newAccessToken = newTokenData.access_token;
        const newRefreshToken = newTokenData.refresh_token || storedRefreshToken;
        setStoredTokens(newAccessToken, newRefreshToken);
        onTokenUpdate(newAccessToken);
        
        // Clear refresh promise after successful refresh
        refreshPromise = null;
        
        // Retry the request with new token
        const retryRes = await fetch(`https://api.spotify.com/v1${path}`, {
          headers: { Authorization: `Bearer ${newAccessToken}` },
        });
        if (!retryRes.ok) {
          throw new Error("unauthorized");
        }
        return retryRes.json();
      } catch (refreshErr) {
        refreshPromise = null; // Clear on error so next attempt can retry
        throw new Error("unauthorized");
      }
    }
  }
  
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`spotify error: ${res.status} ${txt}`);
  }
  return res.json();
}

/* ────────────── Login screen ────────────── */

function LoginScreen() {
  return (
    <div className="landing">
      <div className="landing-bg-glow" />
      <div className="landing-inner-simple">
        <div className="landing-copy cardish">
          <h1 className="landing-logo-word">ECHO</h1>
          <h2 className="landing-main-title">see your spotify, simply.</h2>
          <p className="landing-main-sub">
            A minimal Spotify tracker that shows your top tracks, artists,
            playlists, and recent listening – powered by the Spotify Web API.
          </p>
          <button
            className="btn primary"
            onClick={() => {
              window.location.href = buildAuthUrl();
            }}
          >
            log in with spotify
          </button>
          <span className="landing-note">
            for personal use & API experimentation.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ────────────── Callback (token exchange) ────────────── */

function CallbackScreen({ onToken }) {
  const [status, setStatus] = useState("exchanging code for token...");

  useEffect(() => {
    async function run() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (!code) {
          setStatus("no code found in url.");
          return;
        }

        const res = await fetch(`${BACKEND_BASE}/auth/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri: REDIRECT_URI }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("token exchange failed", res.status, text);
          let errorMsg = `Failed to exchange code (${res.status})`;
          try {
            const errorData = JSON.parse(text);
            errorMsg += `: ${errorData.error || text}`;
          } catch {
            errorMsg += `. Check console for details.`;
          }
          setStatus(errorMsg);
          return;
        }

        const data = await res.json();
        if (!data.access_token) {
          console.error("no access token in response", data);
          setStatus("no access token returned.");
          return;
        }

        // Store both access and refresh tokens
        setStoredTokens(data.access_token, data.refresh_token);
        onToken(data.access_token);

        window.history.replaceState({}, "", "/");
      } catch (err) {
        console.error("Callback error:", err);
        setStatus(`Error: ${err.message || "Check console for details"}`);
      }
    }

    run();
  }, [onToken]);

  return (
    <div className="center-screen">
      <div className="card">
        <div className="logo-word small">echo</div>
        <p className="muted">{status}</p>
      </div>
    </div>
  );
}

/* ────────────── Dashboard ────────────── */

function Dashboard({ token, onLogout, onTokenUpdate }) {
  const [timeRange, setTimeRange] = useState("short_term");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [recent, setRecent] = useState([]);
  const [currentToken, setCurrentToken] = useState(token);

  useEffect(() => {
    setCurrentToken(token);
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [me, tracks, artists, playlistsRes, recentRes] = await Promise.all(
          [
            spotifyFetch(currentToken, "/me", (newToken) => {
              if (!cancelled) {
                setCurrentToken(newToken);
                if (onTokenUpdate) onTokenUpdate(newToken);
              }
            }),
            spotifyFetch(
              currentToken,
              `/me/top/tracks?time_range=${timeRange}&limit=15`,
              (newToken) => {
                if (!cancelled) {
                  setCurrentToken(newToken);
                  if (onTokenUpdate) onTokenUpdate(newToken);
                }
              }
            ),
            spotifyFetch(
              currentToken,
              `/me/top/artists?time_range=${timeRange}&limit=15`,
              (newToken) => {
                if (!cancelled) {
                  setCurrentToken(newToken);
                  if (onTokenUpdate) onTokenUpdate(newToken);
                }
              }
            ),
            spotifyFetch(
              currentToken,
              "/me/playlists?limit=20",
              (newToken) => {
                if (!cancelled) {
                  setCurrentToken(newToken);
                  if (onTokenUpdate) onTokenUpdate(newToken);
                }
              }
            ),
            spotifyFetch(
              currentToken,
              "/me/player/recently-played?limit=25",
              (newToken) => {
                if (!cancelled) {
                  setCurrentToken(newToken);
                  if (onTokenUpdate) onTokenUpdate(newToken);
                }
              }
            ),
          ]
        );

        if (cancelled) return;

        setProfile(me);
        setTopTracks(tracks.items || []);
        setTopArtists(artists.items || []);
        setPlaylists(playlistsRes.items || []);
        setRecent(recentRes.items || []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        if (String(err).includes("unauthorized")) {
          onLogout();
          return;
        }
        setError("failed to load data from spotify.");
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentToken, timeRange, onLogout, onTokenUpdate]);

  const displayName =
    profile?.display_name || profile?.id || "spotify user";
  const avatar =
    profile?.images?.[0]?.url ||
    profile?.images?.[1]?.url ||
    profile?.images?.[2]?.url ||
    null;

  const recentMinutesEstimate = useMemo(() => {
    if (!recent || !recent.length) return null;
    return Math.round(recent.length * 3.5);
  }, [recent]);

  const uniqueRecentArtists = useMemo(() => {
    const set = new Set();
    (recent || []).forEach((item) => {
      (item.track?.artists || []).forEach((a) => set.add(a.name));
    });
    return set.size || null;
  }, [recent]);

  // most played album from top tracks
  const mostPlayedAlbum = useMemo(() => {
    if (!topTracks.length) return null;
    const map = new Map();
    topTracks.forEach((t) => {
      const album = t.album;
      if (!album) return;
      const id = album.id || album.name;
      if (!id) return;
      if (!map.has(id)) {
        map.set(id, {
          name: album.name,
          count: 0,
          img:
            album.images?.[1]?.url ||
            album.images?.[0]?.url ||
            album.images?.[2]?.url ||
            null,
          artists: (t.artists || []).map((a) => a.name).join(", "),
        });
      }
      map.get(id).count += 1;
    });
    let best = null;
    map.forEach((val) => {
      if (!best || val.count > best.count) best = val;
    });
    return best;
  }, [topTracks]);

  // core genres (up to 5) from top artists
  const topGenres = useMemo(() => {
    if (!topArtists.length) return [];
    const counts = new Map();
    topArtists.forEach((a) => {
      (a.genres || []).forEach((g) => {
        counts.set(g, (counts.get(g) || 0) + 1);
      });
    });
    const arr = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return arr.map(([g]) => g);
  }, [topArtists]);

  // listening-by-hour histogram from recent plays (for "screen time" style chart)
  const listeningByHour = useMemo(() => {
    const buckets = Array(24).fill(0);
    (recent || []).forEach((item) => {
      if (!item.played_at) return;
      const d = new Date(item.played_at);
      const hour = d.getHours();
      buckets[hour] += 1;
    });
    return buckets;
  }, [recent]);

  const maxBucket = useMemo(
    () => listeningByHour.reduce((m, v) => (v > m ? v : m), 0) || 1,
    [listeningByHour]
  );

  if (loading) {
    return (
      <div className="center-screen">
        <div className="card">
          <div className="logo-word small">echo</div>
          <p className="muted">loading your spotify data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="center-screen">
        <div className="card">
          <p className="muted">{error}</p>
          <button className="btn primary" onClick={onLogout}>
            log in again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* top bar */}
      <header className="app-header">
        <div className="app-header-left">
          <span className="favicon">🎧</span>
          <span className="logo-word">echo</span>
          <span className="muted mini">spotify tracker</span>
        </div>
        <div className="app-header-right">
          <button
            className={`chip ${timeRange === "short_term" ? "active" : ""}`}
            onClick={() => setTimeRange("short_term")}
          >
            last 4 weeks
          </button>
          <button
            className={`chip ${timeRange === "medium_term" ? "active" : ""}`}
            onClick={() => setTimeRange("medium_term")}
          >
            last 6 months
          </button>
          <button
            className={`chip ${timeRange === "long_term" ? "active" : ""}`}
            onClick={() => setTimeRange("long_term")}
          >
            all time
          </button>
          <button className="btn ghost" onClick={onLogout}>
            log out
          </button>
        </div>
      </header>

      <main className="app-main">
        {/* row 1: account + small stats */}
        <section className="row row-top">
          <div className="card profile-card">
            <div className="profile-main">
              {avatar ? (
                <img src={avatar} alt="" className="profile-avatar" />
              ) : (
                <div className="profile-avatar placeholder" />
              )}
              <div>
                <div className="profile-label">account</div>
                <div className="profile-name">{displayName}</div>
                <div className="muted mini">
                  {profile?.product ? `${profile.product} · ` : ""}
                  {profile?.followers?.total != null
                    ? `${formatNumber(profile.followers.total)} followers`
                    : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="card stat-card">
            <div className="stat-label">recent minutes (rough)</div>
            <div className="stat-value">
              {recentMinutesEstimate != null
                ? `${recentMinutesEstimate} min`
                : "–"}
            </div>
            <div className="muted mini">
              based on your last {recent.length || 0} plays
            </div>
          </div>

          <div className="card stat-card">
            <div className="stat-label">unique recent artists</div>
            <div className="stat-value">
              {uniqueRecentArtists != null ? uniqueRecentArtists : "–"}
            </div>
            <div className="muted mini">in your current listening</div>
          </div>

          <div className="card stat-card">
            <div className="stat-label">playlists</div>
            <div className="stat-value">
              {playlists?.length ? playlists.length : "–"}
            </div>
            <div className="muted mini">fetched from your library</div>
          </div>
        </section>

        {/* row 2: playlists + metric cards */}
        <section className="row row-playlists">
          {/* long playlists strip */}
          <div className="card playlists-card">
            <div className="card-header">
              <h3>playlists</h3>
              <span className="muted mini">view-only from your account</span>
            </div>
            <div className="playlist-row">
              {playlists.map((pl) => {
                const img =
                  pl.images?.[0]?.url ||
                  pl.images?.[1]?.url ||
                  pl.images?.[2]?.url ||
                  null;
                return (
                  <div className="playlist-card" key={pl.id}>
                    {img ? (
                      <img src={img} alt="" className="playlist-cover" />
                    ) : (
                      <div className="playlist-cover placeholder" />
                    )}
                    <div className="playlist-name" title={pl.name}>
                      {pl.name}
                    </div>
                    <div className="muted tiny">
                      {pl.tracks?.total != null
                        ? `${pl.tracks.total} tracks`
                        : "playlist"}
                    </div>
                  </div>
                );
              })}
              {!playlists.length && (
                <div className="muted mini">
                  no playlists found – log out and in again if permissions
                  changed.
                </div>
              )}
            </div>
          </div>

          {/* most played album + mini playlists */}
          <div className="card metric-card">
            <div className="metric-label">most played album</div>
            {mostPlayedAlbum ? (
              <>
                <div className="metric-album">
                  {mostPlayedAlbum.img ? (
                    <img
                      src={mostPlayedAlbum.img}
                      alt=""
                      className="metric-album-cover"
                    />
                  ) : (
                    <div className="metric-album-cover placeholder" />
                  )}
                  <div>
                    <div className="metric-main">{mostPlayedAlbum.name}</div>
                    <div className="muted mini">
                      {mostPlayedAlbum.artists}
                    </div>
                    <div className="muted tiny">
                      seen across your top tracks
                    </div>
                  </div>
                </div>
                <div className="metric-mini-title">playlist rotation</div>
                <div className="metric-playlists">
                  {playlists.slice(0, 6).map((pl) => (
                    <div className="metric-playlist-pill" key={pl.id}>
                      <div className="metric-playlist-dot" />
                      <span className="metric-playlist-name">
                        {pl.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="muted mini">not enough data yet.</div>
            )}
          </div>

          {/* listening activity chart */}
          <div className="card metric-card">
            <div className="metric-label">listening activity (recent)</div>
            <div className="activity-chart">
              {listeningByHour.map((count, hour) => {
                const heightPct =
                  maxBucket === 0
                    ? 0
                    : Math.max(6, (count / maxBucket) * 100);
                return (
                  <div className="activity-bar-wrapper" key={hour}>
                    <div
                      className="activity-bar"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="activity-axis">
              <span>0</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
              <span>24</span>
            </div>
            <div className="muted tiny">
              counts based on your last {recent.length || 0} plays
            </div>
          </div>

          {/* core genres as mini chips */}
          <div className="card metric-card">
            <div className="metric-label">core genres</div>
            {topGenres.length ? (
              <>
                <div className="metric-genre-chips">
                  {topGenres.map((g) => (
                    <span key={g} className="genre-chip">
                      {g}
                    </span>
                  ))}
                </div>
                <div className="muted mini">
                  based on your current top artists
                </div>
              </>
            ) : (
              <div className="muted mini">no genre data available.</div>
            )}
          </div>
        </section>

        {/* row 3: top tracks / top artists / recently played */}
        <section className="row row-bottom">
          <div className="card list-card">
            <div className="card-header">
              <h3>top tracks</h3>
              <span className="muted mini">your current rotation</span>
            </div>
            <ul className="list">
              {topTracks.map((t, i) => {
                const img =
                  t.album?.images?.[1]?.url ||
                  t.album?.images?.[0]?.url ||
                  t.album?.images?.[2]?.url ||
                  null;
                return (
                  <li key={t.id || `${t.name}-${i}`} className="list-item">
                    <span className="index">{i + 1}</span>
                    {img ? (
                      <img src={img} alt="" className="thumb" />
                    ) : (
                      <div className="thumb placeholder" />
                    )}
                    <div className="meta">
                      <div className="primary">{t.name}</div>
                      <div className="secondary">
                        {t.artists.map((a) => a.name).join(", ")} ·{" "}
                        {t.album?.name}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card list-card">
            <div className="card-header">
              <h3>top artists</h3>
              <span className="muted mini">who you loop the most</span>
            </div>
            <ul className="list">
              {topArtists.map((a, i) => {
                const img =
                  a.images?.[1]?.url ||
                  a.images?.[0]?.url ||
                  a.images?.[2]?.url ||
                  null;
                const genres = (a.genres || []).slice(0, 2).join(" · ");
                return (
                  <li key={a.id || `${a.name}-${i}`} className="list-item">
                    <span className="index">{i + 1}</span>
                    {img ? (
                      <img src={img} alt="" className="avatar" />
                    ) : (
                      <div className="avatar placeholder" />
                    )}
                    <div className="meta">
                      <div className="primary">{a.name}</div>
                      <div className="secondary">
                        {genres || "no genre tagged"}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card list-card">
            <div className="card-header">
              <h3>recently played</h3>
              <span className="muted mini">
                last {recent.length || 0} plays on your account
              </span>
            </div>
            <ul className="list compact">
              {recent.map((item, i) => {
                const t = item.track;
                const images = t.album?.images || [];
                const img =
                  images[1]?.url || images[0]?.url || images[2]?.url || null;
                return (
                  <li
                    key={`${item.played_at}-${t.id || i}`}
                    className="list-item small"
                  >
                    {img ? (
                      <img src={img} alt="" className="thumb sm" />
                    ) : (
                      <div className="thumb sm placeholder" />
                    )}
                    <div className="meta">
                      <div className="primary">{t.name}</div>
                      <div className="secondary">
                        {t.artists.map((a) => a.name).join(", ")} ·{" "}
                        {humanDate(item.played_at)}
                      </div>
                    </div>
                  </li>
                );
              })}
              {!recent.length && (
                <li className="muted mini">no recent history available.</li>
              )}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ────────────── Root app ────────────── */

export default function App() {
  // Check for logout parameter FIRST, before initializing token state
  const urlParams = new URLSearchParams(window.location.search);
  const isLogout = urlParams.has("logout");
  
  // If logout parameter exists, clear tokens immediately
  if (isLogout) {
    clearStoredTokens();
    // Clean up the URL immediately
    window.history.replaceState({}, "", "/");
  }
  
  const [token, setToken] = useState(
    () => {
      // Don't load token if we just logged out
      if (isLogout) return "";
      return getStoredTokens().accessToken || "";
    }
  );
  const pathname = window.location.pathname;

  const handleLogout = () => {
    // Clear all tokens from localStorage
    clearStoredTokens();
    setToken("");
    // Force a full page reload with cache busting to ensure clean state
    window.location.href = "/?logout=" + Date.now();
  };

  const handleTokenUpdate = (newToken) => {
    setToken(newToken);
  };

  if (pathname === "/callback") {
    return <CallbackScreen onToken={setToken} />;
  }

  if (!token) {
    return <LoginScreen />;
  }

  return <Dashboard token={token} onLogout={handleLogout} onTokenUpdate={handleTokenUpdate} />;
}