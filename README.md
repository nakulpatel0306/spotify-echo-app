# 🎧 echo – Spotify Tracker

Simple web app to view your Spotify listening stats (top tracks, top artists, and recent listening) using the Spotify Web API.

---

## ⚙️ Prerequisites

- Node.js + npm
- Spotify Developer account + app

In your Spotify app settings, add this Redirect URI and save:

```text
http://127.0.0.1:5173/callback
```

---

## 🛠 Backend Setup (Express)

1. Go to the backend folder:

```bash
cd backend
```

2. Create a `.env` file:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
PORT=3001
```

3. Install dependencies and start the server:

```bash
npm install
npm start
# -> Backend running on port 3001
```

---

## 💻 Frontend Setup (React + Vite)

1. Open a new terminal and go to the frontend folder:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Run the dev server (bind to 127.0.0.1 to match the redirect URI):

```bash
npm run dev -- --host 127.0.0.1
```

4. Open the app in your browser:

```text
http://127.0.0.1:5173
```

Click **“log in with Spotify”**, approve access, and you’ll see your dashboard.

---

## 📤 Commit & Push

From the project root (where `backend/` and `frontend/` live):

```bash
git status
git add .
git commit -m "chore: add echo readme and setup instructions"
git push
```

That’s it — backend on **3001**, frontend on **5173**, both talking to the Spotify API.