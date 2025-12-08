import React, { useEffect, useState, useMemo } from "react";

// LOCAL DEV VALUES – change to prod URLs when you deploy
const CLIENT_ID = "9515b94349c74337bd2199ce4cb16f6c";
const REDIRECT_URI = "http://127.0.0.1:5173/callback";
const SCOPES = "user-top-read user-read-recently-played";
const BACKEND_BASE = "http://127.0.0.1:3001";

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/* ---------- small helpers ---------- */

function humanDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatNumber(n) {
  if (n == null) return "-";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

/* ---------- auth screens ---------- */

function LoginScreen() {
  return (
    <div className="app-shell center">
      <div className="auth-card">
        <div className="logo">echo</div>
        <p className="auth-subtitle">
          a modern spotify tracker for your listening habits.
        </p>
        <button
          className="btn primary"
          onClick={() => {
            window.location.href = buildAuthUrl();
          }}
        >
          log in with spotify
        </button>
        <p className="auth-footnote">
          see your top tracks, artists, genres and recent sessions in one clean
          place.
        </p>
      </div>
    </div>
  );
}

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
          body: JSON.stringify({ code, redirectUri: REDIRECT_URI })
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("token exchange failed", text);
          setStatus("failed to exchange code. check console.");
          return;
        }

        const data = await res.json();
        if (!data.access_token) {
          console.error("no access token in response", data);
          setStatus("no access token returned.");
          return;
        }

        localStorage.setItem("spotify_access_token", data.access_token);
        onToken(data.access_token);

        window.history.replaceState({}, "", "/");
      } catch (err) {
        console.error(err);
        setStatus("something went wrong. check console.");
      }
    }

    run();
  }, [onToken]);

  return (
    <div className="app-shell center">
      <div className="auth-card">
        <div className="logo">echo</div>
        <p className="auth-subtitle">{status}</p>
      </div>
    </div>
  );
}

/* ---------- layout components ---------- */

function Sidebar({ activeView, setActiveView }) {
  const items = [
    { id: "overview", label: "Overview" },
    { id: "tracks", label: "Top Tracks" },
    { id: "artists", label: "Top Artists" },
    { id: "history", label: "Listening History" }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">echo</div>
      <div className="sidebar-sub">spotify tracker</div>
      <nav className="nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={
              "nav-item" + (activeView === item.id ? " nav-item-active" : "")
            }
            onClick={() => setActiveView(item.id)}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-footer-label">built on spotify api</span>
      </div>
    </aside>
  );
}

function TimeRangeChips({ timeRange, setTimeRange }) {
  return (
    <div className="chips-row">
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
    </div>
  );
}

/* ---------- views ---------- */

function OverviewView({ summary }) {
  const { profile, topTracks, topArtists, topGenres, audioFeatureSummary } =
    summary;

  const displayName = profile?.display_name || "spotify user";
  const avatar =
    profile?.images?.[0]?.url || profile?.images?.[1]?.url || null;

  const topTrack = topTracks.items?.[0];
  const topArtist = topArtists.items?.[0];
  const mainGenre = topGenres?.[0]?.genre || "no genre data";

  const avgTempo = audioFeatureSummary?.avgTempo;
  const avgEnergy = audioFeatureSummary?.avgEnergy;
  const avgDance = audioFeatureSummary?.avgDanceability;

  return (
    <div className="view-root">
      <section className="hero">
        <div className="hero-left">
          {avatar ? (
            <img src={avatar} alt="" className="hero-avatar" />
          ) : (
            <div className="hero-avatar placeholder" />
          )}
          <div>
            <div className="hero-label">listening overview</div>
            <div className="hero-title">{displayName}</div>
            <div className="hero-subtitle">
              your current soundtrack, summarized.
            </div>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-pill">
            <span>top track right now</span>
            <strong>{topTrack ? topTrack.name : "–"}</strong>
          </div>
          <div className="hero-pill">
            <span>most played artist</span>
            <strong>{topArtist ? topArtist.name : "–"}</strong>
          </div>
          <div className="hero-pill">
            <span>dominant genre</span>
            <strong>{mainGenre}</strong>
          </div>
        </div>
      </section>

      <section className="cards-row">
        <div className="stat-card">
          <span className="stat-label">recent minutes (48h)</span>
          <span className="stat-value">
            {summary.listeningMinutesRecent ?? "–"}
          </span>
          <span className="stat-sub">total time in the last 2 days</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">sessions (48h)</span>
          <span className="stat-value">{summary.sessionsCount ?? "–"}</span>
          <span className="stat-sub">
            new session when a 30 min gap appears
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">top genres</span>
          <span className="stat-value small">
            {topGenres && topGenres.length > 0
              ? topGenres
                  .slice(0, 3)
                  .map((g) => g.genre)
                  .join(" · ")
              : "no data"}
          </span>
          <span className="stat-sub">based on your top artists</span>
        </div>
      </section>

      <section className="audio-mood">
        <div className="section-header">
          <h3>your listening mood</h3>
          <span className="section-sub">
            based on audio features of your top tracks
          </span>
        </div>
        <div className="mood-grid">
          <div className="mood-item">
            <div className="mood-label">energy</div>
            <div className="mood-bar">
              <div
                className="mood-bar-fill"
                style={{ width: `${avgEnergy ?? 0}%` }}
              />
            </div>
            <div className="mood-value">
              {avgEnergy != null ? `${avgEnergy}%` : "–"}
            </div>
          </div>
          <div className="mood-item">
            <div className="mood-label">danceability</div>
            <div className="mood-bar">
              <div
                className="mood-bar-fill"
                style={{ width: `${avgDance ?? 0}%` }}
              />
            </div>
            <div className="mood-value">
              {avgDance != null ? `${avgDance}%` : "–"}
            </div>
          </div>
          <div className="mood-item">
            <div className="mood-label">tempo</div>
            <div className="mood-bar">
              <div
                className="mood-bar-fill"
                style={{
                  width:
                    avgTempo != null
                      ? `${Math.min(Math.max((avgTempo / 200) * 100, 0), 100)}%`
                      : "0%"
                }}
              />
            </div>
            <div className="mood-value">
              {avgTempo != null ? `${avgTempo} bpm` : "–"}
            </div>
          </div>
        </div>
      </section>

      <section className="two-col">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">top tracks snapshot</span>
            <span className="panel-subtitle">your current 10 most played</span>
          </div>
          <ul className="list">
            {(topTracks.items || []).slice(0, 10).map((t, i) => {
              const img =
                t.album?.images?.[1]?.url ||
                t.album?.images?.[0]?.url ||
                t.album?.images?.[2]?.url;
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
                      {t.artists.map((a) => a.name).join(", ")}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">top artists snapshot</span>
            <span className="panel-subtitle">your core rotation</span>
          </div>
          <ul className="list">
            {(topArtists.items || []).slice(0, 10).map((a, i) => {
              const img =
                a.images?.[1]?.url || a.images?.[0]?.url || a.images?.[2]?.url;
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
      </section>
    </div>
  );
}

function TracksView({ summary }) {
  const tracks = summary.topTracks.items || [];

  return (
    <div className="view-root">
      <div className="section-header">
        <h3>top tracks</h3>
        <span className="section-sub">
          ordered by how much you&apos;ve been looping them
        </span>
      </div>
      <div className="two-col uneven">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">full list</span>
            <span className="panel-subtitle">{tracks.length} tracks</span>
          </div>
          <ul className="list">
            {tracks.map((t, i) => {
              const img =
                t.album?.images?.[1]?.url ||
                t.album?.images?.[0]?.url ||
                t.album?.images?.[2]?.url;
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
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">quick highlights</span>
          </div>
          <div className="highlights">
            <div className="highlight-row">
              <span className="highlight-label">most replayed track</span>
              <span className="highlight-value">
                {tracks[0]?.name || "–"}
              </span>
            </div>
            <div className="highlight-row">
              <span className="highlight-label">opens your sessions often</span>
              <span className="highlight-value">
                {tracks[1]?.name || tracks[0]?.name || "–"}
              </span>
            </div>
            <div className="highlight-row">
              <span className="highlight-label">deep cut in top 10</span>
              <span className="highlight-value">
                {tracks[9]?.name || "–"}
              </span>
            </div>
          </div>
          <div className="hint-text">
            highlights are simple heuristics on your ordered top list.
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtistsView({ summary }) {
  const artists = summary.topArtists.items || [];

  return (
    <div className="view-root">
      <div className="section-header">
        <h3>top artists</h3>
        <span className="section-sub">
          the people you keep going back to
        </span>
      </div>
      <div className="artist-grid">
        {artists.map((a, i) => {
          const img =
            a.images?.[1]?.url || a.images?.[0]?.url || a.images?.[2]?.url;
          const genres = (a.genres || []).slice(0, 2).join(" · ");
          return (
            <div key={a.id || `${a.name}-${i}`} className="artist-card">
              {img ? (
                <img src={img} alt="" className="artist-img" />
              ) : (
                <div className="artist-img placeholder" />
              )}
              <div className="artist-body">
                <div className="artist-name">{a.name}</div>
                <div className="artist-genres">
                  {genres || "no genre tagged"}
                </div>
                <div className="artist-meta">
                  <span>{formatNumber(a.followers?.total)} followers</span>
                  <span>popularity {a.popularity ?? "-"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryView({ summary }) {
  const recent = summary.recentTracks || [];

  const grouped = useMemo(() => {
    const map = new Map();
    recent.forEach((item) => {
      const d = new Date(item.played_at);
      const key = d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [recent]);

  return (
    <div className="view-root">
      <div className="section-header">
        <h3>listening history</h3>
        <span className="section-sub">
          last 48 hours of what you actually played
        </span>
      </div>
      <div className="history-columns">
        {grouped.map(([dateLabel, items]) => (
          <div key={dateLabel} className="history-day">
            <div className="history-date">{dateLabel}</div>
            <ul className="list">
              {items.map((item, i) => {
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
            </ul>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="hint-text">
            no recent history in the last 48 hours.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- main dashboard shell ---------- */

function Dashboard({ token, onLogout }) {
  const [timeRange, setTimeRange] = useState("short_term");
  const [activeView, setActiveView] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(
          `${BACKEND_BASE}/stats/summary?time_range=${encodeURIComponent(
            timeRange
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (!res.ok) {
          const text = await res.text();
          console.error("stats error", text);
          setError("failed to load stats.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setSummary(data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("failed to load stats.");
        setLoading(false);
      }
    }
    load();
  }, [token, timeRange]);

  if (loading) {
    return (
      <div className="app-shell center">
        <div className="auth-card">
          <div className="logo">echo</div>
          <p className="auth-subtitle">loading your listening stats...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="app-shell center">
        <div className="auth-card">
          <div className="logo">echo</div>
          <p className="auth-subtitle">{error || "no data"}</p>
          <button className="btn primary" onClick={onLogout}>
            log out
          </button>
        </div>
      </div>
    );
  }

  const profileName = summary.profile?.display_name || "spotify user";

  return (
    <div className="app-shell">
      <div className="layout">
        <Sidebar activeView={activeView} setActiveView={setActiveView} />
        <div className="main">
          <header className="topbar">
            <div className="topbar-left">
              <div className="topbar-title">{profileName}</div>
              <div className="topbar-subtitle">
                your spotify stats dashboard
              </div>
            </div>
            <div className="topbar-center">
              <TimeRangeChips
                timeRange={timeRange}
                setTimeRange={setTimeRange}
              />
            </div>
            <div className="topbar-right">
              <button className="btn ghost" onClick={onLogout}>
                log out
              </button>
            </div>
          </header>

          <main className="main-content">
            {activeView === "overview" && <OverviewView summary={summary} />}
            {activeView === "tracks" && <TracksView summary={summary} />}
            {activeView === "artists" && <ArtistsView summary={summary} />}
            {activeView === "history" && <HistoryView summary={summary} />}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ---------- root ---------- */

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("spotify_access_token") || ""
  );

  const pathname = window.location.pathname;

  const handleLogout = () => {
    localStorage.removeItem("spotify_access_token");
    setToken("");
    window.location.href = "/";
  };

  if (pathname === "/callback") {
    return <CallbackScreen onToken={setToken} />;
  }

  if (!token) {
    return <LoginScreen />;
  }

  return <Dashboard token={token} onLogout={handleLogout} />;
}