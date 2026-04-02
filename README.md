# 🎲 Cyberpunk Multiplayer Tic-Tac-Toe (Nakama Powered)

A high-fidelity, server-authoritative multiplayer Tic-Tac-Toe game built with **React**, **TypeScript**, and the **Nakama Game Server**. This project features real-time matchmaking, competitive leaderboards, and an immersive neon aesthetic.

---

## 🌟 Key Features
- **Modern Cyberpunk UI**: Full-screen glassmorphism, responsive grid animations, and a futuristic font stack.
- **Server-Authoritative Logic**: No cheating possible—all move validation, win-state detection, and turn management happen on the Nakama backend.
- **Timer Modes**: Support for "Timed" games (30s per turn) with automatic timeout forfeiture.
- **Global Leaderboard**: Competitive ranking tracking wins, losses, and win-streaks across all players globally.
- **Unified Docker Architecture**: Single-command deployment that packages Nginx, Nakama, and Postgres into one seamless stack.

---

## 🏗️ Project Structure
- **/frontend**: React + Vite application (The Game UI).
- **/backend**: TypeScript code for custom Nakama Match Handlers and Logic.
- **docker-compose.yml**: The unified infrastructure definition.

---

## 🌐 Live Deployment & Monitoring
If you have already deployed the stack (see [DEPLOYMENT.md](DEPLOYMENT.md) for instructions), you can access these urls:

- **Game Website**: `http://<YOUR_IP>` (Port 80)
- **Nakama API**: `http://<YOUR_IP>:7350`
- **Developer Admin Console**: `http://<YOUR_IP>:7351` (Default: `admin` / `password`)

> [!TIP]
> Use the **Developer Console** to monitor player accounts, manage live matches, and view raw storage data in real-time.

---

## 🛠️ Local Development
To run this project on your local machine:

1. **Start Backend**: 
   `docker-compose up -d`
2. **Build Logic** (optional if changing code): 
   `cd backend && npm run build`
3. **Start Frontend**: 
   `cd frontend && npm run dev`
