# ChainDeFi Integrated Application

A comprehensive Web3 Microfinance Platform including Frontend, Backend, and Blockchain components.

## 📁 Project Structure

- `frontend/`: React + Vite application for the user interface.
- `backend/`: Node.js + Express API for business logic and data management.
- `blockchain/`: Hardhat environment for smart contracts and deployment.

---

## 🚀 Getting Started

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   **Required Variables:**
   - `MONGO_URI`: Your MongoDB connection string.
   - `REDIS_URL`: Your Redis connection string (used for caching/sessions).
   - `HF_API_KEY`: Hugging Face API key for AI features.
   - `PRIVATE_KEY`: Your wallet private key for blockchain interactions.
   - `RPC_URL`/`SEPOLIA_RPC_URL`: Sepolia RPC endpoint.
   - `EMAIL_USER`/`EMAIL_PASS`: Gmail credentials for sending OTPs.
   - `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`: AWS credentials for Rekognition and Liveness check.
   - `GROQ_API_KEY`: Groq API key for AI features.

4. Start the backend:
   ```bash
   # Development mode with hot-reload
   npm run dev
   
   # Production mode
   npm start
   ```

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   **Required Variables:**
   - `VITE_COGNITO_IDENTITY_POOL_ID`: AWS Cognito Identity Pool ID for authentication.
   - `VITE_AWS_REGION`: AWS region (e.g., us-east-1).

4. Start the frontend:
   ```bash
   npm run dev
   ```

### 3. Blockchain Setup (Optional)

1. Navigate to the blockchain directory:
   ```bash
   cd blockchain
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   **Required Variables:**
   - `SEPOLIA_RPC_URL`: Sepolia RPC endpoint.
   - `PRIVATE_KEY`: Your wallet private key.

4. Compile and deploy contracts:
   ```bash
   npx hardhat compile
   # To deploy (ensure you have Sepolia ETH)
   npx hardhat run scripts/deploy.js --network sepolia
   ```

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, Ethers.js.
- **Backend**: Node.js, Express, MongoDB, Redis, AWS SDK, Groq SDK.
- **Blockchain**: Solidity, Hardhat, Ethers.js, Sepolia Testnet.

## 🛡️ Security

This project implements:
- JWT for session management.
- AWS Rekognition for Liveness verification.
- Secure environment variable handling.
- OTP-based email verification.

---
