# Unified Deployment Guide: Multiplayer Tic-Tac-Toe

This project is configured for a **Unified Docker Architecture**. This means both the Backend (Nakama & Postgres) and the Frontend (React/Vite) run on the same server, side-by-side. 

This approach completely bypasses "Mixed Content" security errors by serving the entire application over the same standard HTTP protocol.

---

## 🏗️ Architecture Overview
- **Frontend**: React + Vite (Served via Nginx on Port 80)
- **Backend**: Nakama Game Server (Port 7350)
- **Database**: Postgres 12.2 (Internal Only)

---

## 🚀 Step 1: AWS Server Preparation
1. **Launch Instance**: Create a `t2.micro` (Free Tier) instance using **Ubuntu 22.04 LTS**.
2. **Security Group**: Open the following ports in the AWS Console:
   - `80`: Standard Web Traffic (The Game UI)
   - `7350`: Nakama API (The Game Logic)
   - `22`: SSH (For your terminal)
3. **Connect**: SSH into your instance.

---

## 🔧 Step 2: System Installation
Run these commands once to prepare the environment:
```bash
sudo apt update
sudo apt install docker.io docker-compose-v2 -y
sudo usermod -aG docker $USER
```
*(Logout and log back in for the group permissions to take effect)*

---

## 📦 Step 3: Deploying the Game
1. **Clone the Project**:
   ```bash
   git clone https://github.com/aryanpanwar307/tictactoe-online.git
   cd tictactoe-online
   ```

2. **Launch the Stack**:
   Use the modern `docker compose` command (with a space):
   ```bash
   sudo docker compose up -d --build
   ```

3. **Verify Status**:
   ```bash
   sudo docker compose ps
   ```
   All three containers (`frontend`, `nakama`, `postgres`) should show a status of **Up**.

---

## 🌐 Step 4: Accessing the Game
1. Copy your **AWS Public IPv4 Address** (e.g. `http://3.12.34.56`).
2. Paste it into your browser.
3. **Login**: Enter a nickname. The app will automatically generate an anonymous local ID for your device.

> [!IMPORTANT]
> **HTTPS/SSL Connection Note**: 
> Modern browsers (Chrome/Safari) might block background "Crypto" tools on raw IP addresses. If you see a login error:
> 1. Click the **Not Secure** label in the URL bar.
> 2. Go to **Site Settings**.
> 3. Change **Insecure Content** to **Allow**.
> 4. Refresh.

---

## 🛠️ Maintenance Commands
| Task | Command |
| :--- | :--- |
| **Update Code** | `git pull origin main && sudo docker compose up -d --build` |
| **Check Logs** | `sudo docker compose logs -f` |
| **Stop Game** | `sudo docker compose down` |
| **Clean Space** | `sudo docker system prune -af` |
