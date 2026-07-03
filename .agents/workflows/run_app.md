---
description: How to start, build, and run the Baptism Invitation and Album App
---

# Baptism Invitation & Photo Album Application Workflow

Follow these steps to run the application dynamically in development mode, build it for production, or run it as a unified server on a local network.

## 1. Development Mode (Hot Reload)
To run the front-end React code with hot-reloading active:
```bash
npm run dev
```
By default, this spins up the Vite development server on `https://localhost:5173/`. 
*(Note: If the Node Express backend is not running at the same time, the application will automatically enter **Offline Sandbox Mode** and cache uploaded photos locally to the browser's IndexedDB so that the uploading still functions perfectly!)*

## 2. Start the Backend API Server
To start the shared image upload database server:
```bash
npm run server
```
This runs the Node + Express backend API on `http://localhost:5000/`. Vite automatically proxies any uploads or gallery query requests to this server.

## 3. unified Build & Deployment (Unified Server Mode)
If you want to run a single server that serves both the static pages and manages guest photo uploads (ideal for hosting on a local computer during the event):

1. Compile the React assets:
   ```bash
   npm run build
   ```
2. Start the unified production server:
   ```bash
   npm run start
   ```
3. Look up your computer's local IP address on the network (e.g. `192.168.1.100`), and share `http://<your-local-ip>:5000` with the guests via WhatsApp or QR Code. Any guests connecting to your Wi-Fi will be able to write blessings, capture photos, and upload them from their phones directly!
