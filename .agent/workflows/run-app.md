---
description: How to run the Aamba integrated application (Frontend, Backend, and Blockchain)
---

### 1. Synchronize Blockchain Data (First time or after re-deploy)
The sync script ensures that the frontend and backend have the latest contract addresses and ABIs.
// turbo
```powershell
cd blockchain
node scripts/syncBlockchain.js
```

### 2. Start the Backend Server
This runs the Express API and listens for blockchain events (repayment, funding).
// turbo
```powershell
cd backend
npm run dev
```

### 3. Start the Frontend Application
This runs the Vite development server.
// turbo
```powershell
cd frontend
npm run dev
```

### 4. Setup MetaMask / Wallet
1. Open your browser and ensure you are connected to the **Polygon Amoy Testnet**.
2. If you don't have the network added, add it via [Chainlist](https://chainlist.org/?search=amoy).
3. Ensure you have Testnet POL (formerly MATIC) for gas.
