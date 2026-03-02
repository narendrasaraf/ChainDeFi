# PanCred SupportBot Integration Guide

This guide documents the architecture, dependencies, and integration steps for the **PanCred SupportBot**, an AI-powered microfinance assistant capable of multilingual conversational support (including Hinglish) and structured loan data extraction.

## 1. Overview
The SupportBot is a full-stack feature. It provides a floating chat bubble on the bottom-right of the screen globally across the application. It leverages the Groq API with the `llama-3.3-70b-versatile` model to process natural language, assist users, and intentionally extract JSON for structured actions like creating a loan.

---

## 2. Frontend Changes

### `frontend/src/components/SupportBot.jsx`
- **Purpose:** The main React component that renders the chat interface (the floating toggler and the chat window).
- **Features:** 
  - Maintains conversation history `useState([])`.
  - Automatically limits memory to a context window of 10 messages before sending to the backend to conserve tokens.
  - Implements a CSS-animated typing indicator.
  - Handles network failures and escalation (`escalationKeywords` trigger a fallback support email).
  - Automatically scrolls to the newest message.
- **Dependencies:** Uses standard React hooks (`useState`, `useEffect`, `useRef`).

### `frontend/src/components/SupportBot.css`
- **Purpose:** All the stylistic presentation for the bot.
- **Features:**
  - Modern layout (flexbox).
  - Explicit dark text (`#212529`) on white inputs so it doesn't inherit global dark-theme CSS bugs.
  - Mobile responsiveness (`@media screen and (max-width: 480px)`) to expand full-screen on mobile devices safely above the safe-area bounds.

### `frontend/src/App.jsx`
- **Integration:** The `<SupportBot />` component is imported and mounted inside the global layout wrapper (above the `<Router>` or within the main container) so it remains accessible on every page without refreshing its state unnecessarily.

---

## 3. Backend Changes

### `backend/package.json` Dependencies
- We installed the **Groq SDK** to natively connect to Groq's fast inference endpoints.
  - \`npm install groq-sdk\`

### `backend/services/aiService.js`
- **Purpose:** Centralized business logic for communicating with the Groq API.
- **Features:** 
  - Connects using the `GROQ_API_KEY` defined in `.env`.
  - Contains a massive `SYSTEM_PROMPT` instructing the AI:
    - To behave as a microfinance guide.
    - To respond natively in the user's language (**including conversational Hinglish**).
    - To output precise JSON starting with `{"intent": "create_loan"...}` if the user mentions needing a loan, rather than standard markdown.

### `backend/controllers/chatController.js`
- **Purpose:** Processes incoming HTTP requests from the frontend and securely routes them to `aiService`.
- **Features:** 
  - `handleChatMessage(req, res)`: Maps the incoming messages to the correct format and catches any API crashes.
  - Safely parses JSON strings using a `try/catch` block before returning the structured type (`loan_intent` vs `normal_message`).
  - Contains API proxy functionality to forward loan requests strictly to the existing `/api/loans/create` endpoint if a valid JSON structure is confirmed by the user, **preventing the chat route from ever having direct Database access**.

### `backend/routes/chatRoutes.js`
- **Purpose:** Express router defining the API endpoints.
- **Features:**
  - Exposes `POST /api/chat/message` pointing to `chatController.handleChatMessage`.
  - (Legacy) Exposes `POST /api/chat` as a fallback endpoint.
  - Adds the `CRITICAL LANGUAGE INSTRUCTION` prompt dynamically informing the LLM to mirror the user's language immediately.

### `backend/index.js` (or `app.js`)
- **Integration:** Registers the chat routes into the main Express application. 
  - Example: `app.use('/api/chat', require('./routes/chatRoutes'));`

---

## 4. How to Extend / Integrate Further

1. **Adding Knowledge to the Bot:**
   To teach the bot new things, go to `backend/services/aiService.js` and update the `SYSTEM_PROMPT` listing out specific facts (e.g., "7. Max loan limit is ₹50,000").
   
2. **Adding New JSON Intents:**
   If you want the bot to trigger something else (like "Repay Loan"), edit the Prompt in `aiService.js` to look for a `"intent": "repay_loan"` structure. Then go to `backend/controllers/chatController.js` and add another `else if (parsed.intent === "repay_loan")` block to build a custom proxy to the repayment system.

3. **Styling and Theming:**
   All colors are safely isolated in `SupportBot.css` under the `.support-bot-*` class namespace, meaning you can tweak colors without it affecting your Dashboard UI.
