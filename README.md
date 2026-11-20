# Echo - Explore Your Spotify Listening Stats

A web app that connects to your Spotify account and turns it into a one-page dashboard: top tracks and artists, core genres, your most played album, when in the day you listen, and what you played recently.

**Live at [spotify-echo-app.vercel.app](https://spotify-echo-app.vercel.app)**

## At a Glance

- **Stack:** React 18 and Vite (frontend), Node.js and Express (backend), Spotify Web API
- **Hosting:** Frontend on Vercel, backend on Render
- **State:** Complete

## Features

- **Top tracks and artists** over the last 4 weeks, 6 months or all time
- **Listening snapshot:** estimated minutes and unique artists from your recent plays, plus your playlist count
- **Most played album** among your top tracks
- **Listening activity** as a 24-hour chart built from your recent plays
- **Core genres** pulled from your top artists
- **Recently played** list with album art and play times
- **Secure login** with Spotify's Authorization Code flow; the client secret stays on the backend, and expired tokens refresh automatically

## Project Structure

```
.
├── backend/
│   ├── server.js       # OAuth code exchange and token refresh (plus a /stats/summary endpoint the UI doesn't use)
│   ├── package.json
│   └── .env.example    # SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, PORT
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── vercel.json     # SPA rewrite so /callback loads the app
    ├── public/
    │   └── favicon.svg
    └── src/
        ├── App.jsx     # Login flow, Spotify API calls and the dashboard
        ├── main.jsx    # Entry point
        └── styles.css
```

## Running Locally

1. Clone the repo:
   ```bash
   git clone https://github.com/nakulpatel0306/spotify-echo-app.git
   cd spotify-echo-app
   ```
2. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add this redirect URI:
   ```
   http://127.0.0.1:5173/callback
   ```
   Then put your Client ID in `CLIENT_ID` at the top of `frontend/src/App.jsx`.
3. Set up and start the backend (port 3001):
   ```bash
   cd backend
   cp .env.example .env   # add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
   npm install
   npm start
   ```
4. In a second terminal, start the frontend and open `http://127.0.0.1:5173`:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Deploying

- **Backend on Render:** create a Web Service from this repo with root `backend`, build command `npm install`, start command `node server.js`, and set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
- **Frontend on Vercel:** import the repo with root `frontend`, then set `VITE_BACKEND_BASE` to the Render URL and `VITE_REDIRECT_URI` to `https://<your-domain>/callback`
- Add the production redirect URI in the Spotify dashboard as well
