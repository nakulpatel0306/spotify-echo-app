import React, { useEffect, useState } from "react";

const CLIENT_ID = "9515b94349c74337bd2199ce4cb16f6c"; // your app's client id
const REDIRECT_URI = "https://spotify-echo-app.vercel.app/callback";
const SCOPES = "user-top-read user-read-recently-played";
const BACKEND_BASE = "https://spotify-echo-app.onrender.com";

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function LoginScreen() {
  return (
    <div className="shell">
      <div className="login-panel">
        <div className="logo-mark">echo</div>
        <p className="login-subtitle">spotify listening tracker</p>
        <button
          className="btn primary"
          onClick={() => {
            window.location.href = buildAuthUrl();
          }}
        >
          log in with spotify
        </button>
        <p className="login-footnote">
          see your top tracks, artists, albums, and listening screen time.
        </p>
      </div>
    </div>
  );
}

function CallbackScreen({ onToken }) {
  const [status, setStatus] = useState("Exchanging code for token...");

  useEffect(() => {
    async function run() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (!code) {
          setStatus("No code found in URL.");
          return;
        }

        const res = await fetch(`${BACKEND_BASE}/auth/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri: REDIRECT_URI })
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Token exchange failed", text);
          setStatus("Failed to exchange code. Check console.");
          return;
        }

        const data = await res.json();
        if (!data.access_token) {
          console.error("No access token in response", data);
          setStatus("No access token returned. Check backend logs.");
          return;
        }

        localStorage.setItem("spotify_access_token", data.access_token);
        onToken(data.access_token);

        window.history.replaceState({}, "", "/");
      } catch (err) {
        console.error(err);
        setStatus("Something went wrong. Check console.");
      }
    }

    run();
  }, [onToken]);

  return (
    <div className="shell">
      <div className="login-panel">
        <div className="logo-mark">echo</div>
        <p className="login-subtitle">{status}</p>
      </div>
    </div>
  );
}

function SummaryHeader({ listeningMinutesToday, listeningMinutesLast7Days, sessionCountToday, onLogout }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-mark small">echo</div>
        <div className="header-text">
          <h1>overview</h1>
          <p>your spotify listening, at a glance.</p>
        </div>
      </div>
      <div className="header-right">
        <div className="pill">
          <span>today</span>
          <strong>{listeningMinutesToday} min</strong>
        </div>
        <div className="pill">
          <span>last 7 days</span>
          <strong>{listeningMinutesLast7Days} min</strong>
        </div>
        <div className="pill">
          <span>sessions today</span>
          <strong>{sessionCountToday}</strong>
        </div>
        <button className="btn ghost" onClick={onLogout}>
          log out
        </button>
      </div>
    </header>
  );
}

function HourlyBars({ hourlyListening }) {
  return (
    <div className="bars">
      {Array.from({ length: 24 }).map((_, h) => {
        const value = hourlyListening?.[h] ?? 0;
        const height = Math.min(120, value * 4);
        return (
          <div key={h} className="bar-wrapper">
            <div className="bar" style={{ height: `${height}px` }} />
            {h % 3 === 0 && <span className="bar-label">{h}</span>}
          </div>
        );
      })}
    </div>
  );
}

function TopTracks({ items }) {
  return (
    <ul className="list">
      {items.map((t, i) => {
        const img = t.album?.images?.[2]?.url || t.album?.images?.[1]?.url || t.album?.images?.[0]?.url;
        return (
          <li key={t.id || i} className="list-item">
            <span className="index">{i + 1}</span>
            {img ? <img src={img} alt="" className="thumb" /> : <div className="thumb placeholder" />}
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
  );
}

function TopArtists({ items }) {
  return (
    <ul className="list">
      {items.map((a, i) => {
        const img = a.images?.[2]?.url || a.images?.[1]?.url || a.images?.[0]?.url;
        return (
          <li key={a.id || i} className="list-item">
            <span className="index">{i + 1}</span>
            {img ? <img src={img} alt="" className="avatar" /> : <div className="avatar placeholder" />}
            <div className="meta">
              <div className="primary">{a.name}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TopAlbums({ items }) {
  return (
    <div className="album-grid">
      {items.map((a) => (
        <div key={a.id} className="album-card">
          {a.image ? <img src={a.image} alt={a.name} className="album-cover" /> : <div className="album-cover placeholder" />}
          <div className="album-meta">
            <div className="album-name">{a.name}</div>
            <div className="album-sub">
              {a.playCount} plays · {a.minutes} min
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DailyMiniChart({ dailyListening }) {
  if (!dailyListening || dailyListening.length === 0) {
    return <p className="muted">not enough history yet.</p>;
  }
  const max = Math.max(...dailyListening.map((d) => d.minutes), 1);
  return (
    <div className="daily-row">
      {dailyListening.map((d) => {
        const height = 40 + (d.minutes / max) * 60;
        const label = d.date.slice(5); // MM-DD
        return (
          <div key={d.date} className="daily-col">
            <div className="daily-bar" style={{ height: `${height}px` }} />
            <span className="daily-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`${BACKEND_BASE}/stats/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          const text = await res.text();
          console.error("Stats error", text);
          setError("Failed to load stats.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setSummary(data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Failed to load stats.");
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="shell">
        <div className="login-panel">
          <div className="logo-mark">echo</div>
          <p className="login-subtitle">loading your listening stats...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="shell">
        <div className="login-panel">
          <div className="logo-mark">echo</div>
          <p className="login-subtitle">{error || "No data"}</p>
          <button className="btn primary" onClick={onLogout}>
            try again
          </button>
        </div>
      </div>
    );
  }

  const {
    topTracks,
    topArtists,
    topAlbums,
    listeningMinutesToday,
    listeningMinutesLast7Days,
    hourlyListening,
    dailyListening,
    sessionCountToday
  } = summary;

  return (
    <div className="shell">
      <div className="layout">
        <aside className="sidebar">
          <div className="logo-mark sidebar-logo">echo</div>
          <nav className="sidebar-nav">
            <div className="nav-section">
              <span className="nav-label">overview</span>
              <button className="nav-item active">dashboard</button>
            </div>
            <div className="nav-section">
              <span className="nav-label">breakdowns</span>
              <button className="nav-item">tracks</button>
              <button className="nav-item">artists</button>
              <button className="nav-item">albums</button>
            </div>
          </nav>
          <div className="sidebar-foot">
            <span className="muted">made for personal spotify insight.</span>
          </div>
        </aside>

        <main className="main">
          <SummaryHeader
            listeningMinutesToday={listeningMinutesToday}
            listeningMinutesLast7Days={listeningMinutesLast7Days}
            sessionCountToday={sessionCountToday}
            onLogout={onLogout}
          />

          <div className="grid">
            <section className="card">
              <div className="card-header">
                <span>top tracks</span>
                <small>last 4 weeks</small>
              </div>
              <div className="card-body">
                <TopTracks items={topTracks.items.slice(0, 10)} />
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <span>top artists</span>
                <small>last 4 weeks</small>
              </div>
              <div className="card-body">
                <TopArtists items={topArtists.items.slice(0, 10)} />
              </div>
            </section>

            <section className="card wide">
              <div className="card-header">
                <span>listening screen time</span>
                <small>minutes by hour (today)</small>
              </div>
              <div className="card-body">
                <HourlyBars hourlyListening={hourlyListening} />
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <span>top albums</span>
                <small>based on recent plays</small>
              </div>
              <div className="card-body">
                <TopAlbums items={topAlbums} />
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <span>listening days</span>
                <small>approx. last 7 days</small>
              </div>
              <div className="card-body">
                <DailyMiniChart dailyListening={dailyListening} />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

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
