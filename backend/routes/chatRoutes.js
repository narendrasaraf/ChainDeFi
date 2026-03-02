require("dotenv").config();
const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");
const chatController = require("../controllers/chatController");

let _groq = null;
function getGroq() {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// System prompt encapsulating bot instructions
const SYSTEM_PROMPT = `You are a helpful and knowledgeable SupportBot for PanCred, a microfinance platform.
Your responsibilities and domain knowledge include:
1. Answering microfinance queries.
2. Helping users create loan requests.
3. Explaining insurance options available.
4. Explaining how the user's trust score is calculated.
5. Guiding users step-by-step through the loan application process.

Keep your responses concise, professional, friendly, and directly relevant to microfinance and PanCred platform features.
If asked about topics completely unrelated to your domain, politely steer the conversation back to microfinance and platform support.
Your responses should be formatted clearly without using aggressive Markdown headers unless necessary for structure.
Respond in the language the user is speaking to you.`;

// --- NEW ROUTE FOR USER REQUIREMENT ---
router.post("/message", chatController.handleChatMessage);

// --- PREVIOUS ROUTE TO KEEP FRONTEND WORKING ---
router.post("/", async (req, res) => {
  try {
    const { messages, mode, collectedData } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ error: "Valid messages array is required." });
    }

    // Enhance system prompt dynamically
    const dynamicSystemPrompt = `${SYSTEM_PROMPT}

CRITICAL LANGUAGE INSTRUCTION:
- You must automatically detect the language the user is speaking in the messages, including conversational Hinglish.
- You must strictly reply in the SAME language the user is using (e.g. if they use Hinglish, reply in Hinglish).
- Ensure all technical terms related to microfinance are natively translated or kept in English if no direct translation exists.`;

    // Format messages for Groq completion
    const requestMessages = [
      { role: "system", content: dynamicSystemPrompt },
      // Filter incoming messages and map them to strictly expected roles and content
      ...messages.map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      })),
    ];

    const chatCompletion = await getGroq().chat.completions.create({
      messages: requestMessages,
      model: "llama-3.3-70b-versatile", // Fast model suitable for support bots
      temperature: 0.5,
      max_tokens: 1024,
      top_p: 1,
    });

    const reply =
      chatCompletion.choices[0]?.message?.content ||
      "I'm sorry, I couldn't process your request at the moment.";

    res.json({ reply, mode, collectedData });
  } catch (error) {
    console.error("Groq API Error:", error);
    res.status(500).json({ error: "Failed to communicate with LLM provider." });
  }
});

module.exports = router;
