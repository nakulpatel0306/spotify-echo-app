# 🎧 echo – Spotify Tracker

A simple, modern web app that uses the **Spotify Web API** to visualize your listening habits.  
View your **top tracks**, **top artists**, **genres**, **audio mood**, and **recent listening history** across adjustable time ranges.

Built with a **Node.js + Express API**, a **React + Vite frontend**, and designed to be deployed easily on **Render** (backend) and **Vercel** (frontend).

---

## ✨ Features
- Top Tracks & Top Artists across 3 Spotify time ranges:
  - last 4 weeks
  - last 6 months
  - all time
- Audio mood summary: **energy**, **danceability**, **tempo**
- Top genres extracted automatically from your top artists
- Listening history from the past 48 hours
- Recently played + total listening minutes + session detection
- Clean, simple UI inspired by Spotify’s modern aesthetic

---

## 🗂 Project Structure
```
.
├── backend/                        # Express server (Spotify auth + stats)
│   ├── server.js                   # Auth handler + stats aggregation
│   ├── package.json
│   └── .env                        # SPOTIFY_CLIENT_ID, SECRET, PORT
├── frontend/                       # React + Vite UI
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx                 # Main UI & views
│       ├── main.jsx                # SPA entrypoint
│       └── styles.css              # Visual design
└── README.md
```

---

## 🚀 Getting Started (Local Development)

### 1) Spotify Developer Setup  
Create an app at:  
https://developer.spotify.com/dashboard

Add this Redirect URI:

```
http://127.0.0.1:5173/callback
```

Copy your **Client ID** and **Client Secret**.

---

## 🛠 Backend Setup (Express)

```bash
cd backend
npm install
```

Create `.env`:

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

---

## 💻 Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open:

```
http://127.0.0.1:5173
```

Log in with Spotify — dashboard loads instantly.

---

# 🌐 Deployment

## Backend → Render
1. Go to https://dashboard.render.com
2. Create a **Web Service**
3. Connect your GitHub repo  
4. Set environment variables:
   ```
   SPOTIFY_CLIENT_ID=xxx
   SPOTIFY_CLIENT_SECRET=xxx
   ```
5. Set build command:
   ```
   npm install
   ```
6. Start command:
   ```
   node server.js
   ```

Your backend will deploy to something like:

```
https://echo-backend.onrender.com
```

---

## Frontend → Vercel
1. Go to https://vercel.com
2. Import your GitHub repo
3. Set `VITE_BACKEND_URL` or update API base URL in App.jsx
4. Set the production Redirect URI in Spotify to:

```
https://your-vercel-domain.vercel.app/callback
```

Deploy → Vercel will give you a live frontend URL.

---

## 📤 Commit & Push

From project root:

```bash
git status
git add .
git commit -m "chore: add README with render/vercel setup"
git push
```

Your project is now ready for local dev **and** cloud deployment.
