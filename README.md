# Settlers of Catan — Real-Time Multiplayer & Offline PWA

A full-featured Settlers of Catan implementation with real-time authoritative multiplayer, 3D physics-based dice rolls, AI bots, sound effects, and zero-internet offline peer-to-peer play.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/abhinaypodugu/game-v2)

---

## 🌐 Deploy the Online Server (Best Options)

The server is built with Node.js + Express + Socket.IO and serves **both** the game frontend and the authoritative WebSocket backend on a single port and single URL.

### 🌟 Option 1: Render.com (Recommended — 100% Free)

Render provides a completely free web service with native WebSocket support.

1. Click the **[Deploy to Render](https://render.com/deploy?repo=https://github.com/abhinaypodugu/game-v2)** button above.
2. Sign in with GitHub and select your repository (`abhinaypodugu/game-v2`).
3. Render will automatically read `render.yaml` (Blueprint):
   - **Environment**: Node 22
   - **Build Command**: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
   - **Start Command**: `corepack enable && pnpm start`
   - **Health Check**: `/api/health`
4. Click **Apply / Create Web Service**.
5. Once deployed, Render gives you a free HTTPS URL: `https://<your-service-name>.onrender.com`.

> **💡 Tip for Free Tier (Keep Awake)**:  
> Render's free tier spins down after 15 minutes of inactivity (takes ~30s to wake up on first visit). You can keep it alive 24/7 for free using [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org) to ping your health endpoint `https://<your-service-name>.onrender.com/api/health` every 10 minutes.

---

### ⚡ Option 2: Railway.app (Fastest & No Cold Starts)

Railway runs persistent container instances with zero spin-downs, fast WebSockets, and low latency:

1. Go to [Railway.app](https://railway.app/) and sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo** → select `abhinaypodugu/game-v2`.
3. Railway automatically detects the `Dockerfile` at the root and deploys.
4. Go to **Settings** → **Networking** → Click **Generate Domain**.
5. Your game is live with zero cold starts!

---

### 🌏 Option 3: Fly.io (Ultra-Low Latency in India / Asia)

If your players are located in India or Asia and you want edge proximity with single-digit latency:

1. Install Fly CLI: `powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"` (or `brew install flyctl`).
2. Run `fly launch` in the project root.
3. Select your preferred region (e.g. `bom` for Mumbai or `sin` for Singapore).
4. Run `fly deploy`.

---

### 🐳 Option 4: Self-Hosted Docker

Run the container on any Linux VPS or home server:

```bash
# Build container
docker build -t catan-game .

# Run on port 3001 (or bind to 80/443 with reverse proxy)
docker run -d -p 3001:3001 --name catan catan-game
```

---

## 🎮 How to Play

### Approach A: Play directly on your server URL (Zero Setup)
Simply open your deployed URL (e.g. `https://<your-service>.onrender.com`) in any browser or install it to your home screen (PWA).  
- Everything runs seamlessly on the same origin (no CORS configuration needed).
- Share room codes or links with your friends.

### Approach B: Use GitHub Pages + Custom Server
If you or your friends prefer accessing the GitHub Pages URL (`https://abhinaypodugu.github.io/game-v2/`):
1. **In-App**: Click the ⚙️ (Settings) icon on the home screen, paste your deployed server URL, and click **Connect**.
2. **Automatic**: In your GitHub repository settings, go to **Settings** → **Secrets and variables** → **Actions** → **Variables**, and add:
   - Name: `VITE_SERVER_URL`
   - Value: `https://<your-service>.onrender.com`
   Any new push to `main` will build the GitHub Pages client with your server URL pre-configured!

---

## 📴 Offline Multiplayer (No Internet Needed)

The game includes an offline mode using WebRTC and in-memory game state:
- **Host offline game**: Generates QR codes for joining players.
- **Join offline game**: Scan host QR code using camera.
- Works over local Wi-Fi, phone hotspot, or direct device-to-device connection without internet access.

---

## 🛠️ Local Development

### Prerequisites
- Node.js >= 22.12
- pnpm >= 12.6.0 (`corepack enable`)

### Commands

```bash
# Install dependencies
pnpm install

# Run dev server (client on :5173, server on :3001)
pnpm dev

# Run all unit and integration tests (177+ tests)
pnpm test

# Build client for production
pnpm build

# Start production server
pnpm start
```

---

## 📂 Project Architecture

```
├── client/     # React 19 + Vite + Tailwind 4 + Zustand frontend
├── host/       # Authoritative room & game session management + bots
├── server/     # Express + Socket.IO server & JSONL game logger
├── shared/     # Game state machine, rules engine, hex topology, types
├── Dockerfile  # Multi-stage production container
└── render.yaml # Render Blueprint configuration
```
