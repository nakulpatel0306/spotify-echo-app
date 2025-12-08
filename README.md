# 🎧 echo – Spotify Tracker

A simple, modern web app that uses the **Spotify Web API** to explore your listening habits.  
View your **top tracks**, **top artists**, **genres**, **audio mood**, and **recent listening history** across multiple time ranges.

Built with a **Node.js + Express** backend and a **React + Vite** frontend.

---

## ✨ Features
- View top tracks & top artists across:
  - last 4 weeks
  - last 6 months
  - all time
- Audio mood summary:
  - energy, danceability, tempo
- Top genres extracted from your top artists
- Recent listening history (last 48 hours)
- Tracks total minutes listened + listening sessions
- Clean, modern UI inspired by Spotify aesthetic

---

## 🗂 Project Structure
```
.
├── backend/                        # Express server (Spotify auth + stats)
│   ├── server.js                   # Handles auth + summary aggregation
│   ├── package.json
│   └── .env                        # SPOTIFY_CLIENT_ID, SECRET, PORT
├── frontend/                       # React + Vite UI
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx                 # Main UI + views + auth handler
│       ├── main.jsx                # Vite entrypoint
│       └── styles.css              # App styling
└── README.md
```

---

## 🚀 Getting Started

### 1) Backend (Express)
```bash
cd backend
npm install
```

Create a `.env` file:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
PORT=3001
```

Start the backend:

```bash
npm start
# Backend running on port 3001
```

Your Spotify app must include this Redirect URI:

```
http://127.0.0.1:5173/callback
```

---

### 2) Frontend (React + Vite)
```bash
cd frontend
npm install
```

Run the dev server (bind to 127.0.0.1 so redirects work):

```bash
npm run dev -- --host 127.0.0.1
```

Open the app:

```
http://127.0.0.1:5173
```

Log in with Spotify and the dashboard will load.

---

## 📤 Commit & Push

From the project root:

```bash
git status
git add .
git commit -m "chore: add echo readme and setup instructions"
git push
```
