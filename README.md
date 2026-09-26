# echo - Spotify Tracker

A web app that connects to your Spotify account and shows your listening habits: top tracks, top artists, genres, audio mood and recent history.

## At a Glance

- **Frontend:** React, Vite (hosted on Vercel)
- **Backend:** Node.js, Express (hosted on Render)
- **API:** Spotify Web API with OAuth
- **State:** Complete

## Features

- Top tracks and artists over the last 4 weeks, 6 months or all time
- Audio mood summary for energy, danceability and tempo
- Top genres pulled from your top artists
- Last 48 hours of listening, with total minutes and session detection

## Project Structure

```
.
├── backend/
│   ├── server.js       # OAuth token exchange, refresh and stats aggregation
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx     # Views and Spotify login flow
    │   ├── main.jsx    # Entry point
    │   └── styles.css
    └── vercel.json
```

## Running Locally

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add this redirect URI:
   ```
   http://127.0.0.1:5173/callback
   ```
   Then put your Client ID in `CLIENT_ID` at the top of `frontend/src/App.jsx`.
2. Set up and start the backend (port 3001):
   ```bash
   cd backend
   cp .env.example .env   # add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
   npm install
   npm start
   ```
3. In a second terminal, start the frontend and open `http://127.0.0.1:5173`:
   ```bash
   cd frontend
   npm install
   npm run dev -- --host 127.0.0.1
   ```

## Deploying

- **Backend on Render:** create a Web Service from this repo with root `backend`, build command `npm install`, start command `node server.js`, and set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
- **Frontend on Vercel:** import the repo with root `frontend`, then set `VITE_BACKEND_BASE` to the Render URL and `VITE_REDIRECT_URI` to `https://<your-domain>/callback`
- Add the production redirect URI in the Spotify dashboard as well
