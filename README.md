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

## ⚙️ Setup & Installation

### Local Development
1. **Clone the Repo**: 
   `git clone https://github.com/aryanpanwar307/tictactoe-online.git`
2. **Start Backend (Docker)**: 
   `docker-compose up -d`
3. **Build Backend Logic**: 
   `cd backend && npm install && npm run build` (This bundles the Goja TypeScript code).
4. **Start Frontend**: 
   `cd frontend && npm install && npm run dev`

### Project Structure
- **/frontend**: React + Vite application (The Game UI).
- **/backend**: TypeScript code for custom Nakama Match Handlers and Logic.
- **docker-compose.yml**: The unified infrastructure definition.

---

## 🏗️ Architecture & Design Decisions

### **Server-Authoritative Matchmaking & Logic**
I chose a **server-authoritative** model to ensure game integrity. All move validations and win-state calculations are written in **TypeScript** using the **Nakama Goja runtime**. This prevent clients from spoofing moves or claiming false victories.

### **Unified Docker Infrastructure**
To simplify deployment, I containerized the **React frontend** into an **Nginx image** and bundled it alongside the Nakama and Postgres services. This "Unified Stack" allows the entire application to be deployed to a single cloud instance with one `docker compose` command, completely bypassing cross-origin (CORS) and mixed-content security issues.

### **State-Based Match Handling**
The backend uses a **Match Handler** pattern that manages turn-based timers, move opcodes, and player synchronization. This ensures that even if a player refreshes their browser, the server perfectly restores the concurrent game state.

---

## 🚀 Deployment Process
The project is optimized for deployment on **AWS EC2 (Free Tier)**. Detailed step-by-step instructions for server provisioning, firewall configuration, and installation can be found in the [DEPLOYMENT.md](DEPLOYMENT.md) file.

**Live Endpoints**:
- **Game Website**: `http://<YOUR_IP>`
- **Nakama API**: `http://<YOUR_IP>:7350`
- **Developer Admin Console**: `http://<YOUR_IP>:7351` (Login: `admin` / `password`)

---

## 🛠️ API & Server Configuration

### **Port Mappings**
- `80`: Standard Web Traffic (React Frontend).
- `7350`: Nakama API (Socket and Client communication).
- `7351`: Nakama Console (Dashboard and Administrator tools).

### **Game Opcodes**
- `1` (Move): Used by the client to send board positions `0-8`.
- `2` (State Update): Broadcast by the server whenever the board changes.

---

## 🧪 How to Test Multiplayer
To verify the real-time functionality is working correctly:

1. **Open the Game**: Visit your live IP (e.g. `18.221.164.78`) in two different browser windows or tabs.
2. **Authentication**: Enter a unique name in each tab (e.g., "Player A" and "Player B").
3. **Select Mode**: Ensure **both** tabs select the same game mode (Classic or Timed).
4. **Matchmaking**: Click "Find Random Match" in both tabs simultaneously.
5. **Gameplay**: You will see a "Match Found" notification. Verify that placing a mark in one tab instantly appears in the other with high-fidelity animations.
6. **Leaderboards**: After a match ends, check the "Global Leaderboard" to see your stats (Wins, Losses, Streaks) updated in real-time.
