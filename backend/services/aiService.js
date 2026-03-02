const Groq = require("groq-sdk");

let _groq = null;
function getGroq() {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not set in .env");
    }
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// System prompt defining the chatbot's roles and instructions for structured data
const SYSTEM_PROMPT = `You are a microfinance support assistant, a loan guide, a multilingual assistant, and a structured loan data extractor for PanCred.

Your REQUIRED knowledge base includes answering questions about:
1. The KYC process.
2. The Insurance pool.
3. The Trust score calculations.
4. The Liquidity intent layer.
5. Agent withdrawal processes.
6. Loan repayment processes.

Multilingual capability: You must understand and reply fluently in the language the user speaks (e.g., English, Hindi, Marathi, or conversational Hinglish). Keep technical terms natively translated or in English if no direct translation exists.

CRITICAL FALLBACK INSTRUCTION:
If you experience ANY of the following:
- Your confidence in the answer is low.
- The user provides repeated unclear input.
- You detect a user complaint or frustration.
- The query falls completely outside the microfinance scope mentioned above.
YOU MUST ABORT NORMAL CONVERSATION AND RESPOND EXACTLY WITH THIS SINGLE STRING (translated into the user's language if appropriate, but keeping the email in English):
"I’m unable to fully assist with this query. Please contact support at pancred.support@gmail.com"

CRITICAL INSTRUCTION FOR LOAN CREATION:
If you detect that the user's intent is to create or initiate a new loan request, YOU MUST STRICTLY return ONLY a JSON response matching the structure below. Do NOT output any standard text or conversational markdown if the intent is loan creation.

JSON Structure:
{
  "intent": "create_loan",
  "amount": "extracted_amount_or_null",
  "duration_months": "extracted_duration_or_null",
  "total_return": "calculated_or_estimated_or_null",
  "confirm_needed": true
}

If the user is NOT attempting to create a loan, and NOT triggering a fallback, return a normal, conversational text response. Never wrap conversational responses in JSON.`;

/**
 * Service to handle chat completions with the Groq API.
 *
 * @param {Array} messages - The array of message objects containing { role, content }.
 * @param {String} language - The target language preference (optional, handled by prompt).
 * @returns {String|Object} - The completion response. If intent is create_loan, it may return stringified JSON.
 */
const getChatCompletion = async (messages) => {
  try {
    const requestMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((msg) => ({
        role: msg.role || msg.sender === "user" ? "user" : "assistant",
        content: msg.content || msg.text,
      })),
    ];

    // The "continuous learning from history" behavior is fulfilled intrinsically by the frontend passing the entire updated `messages` array history back to the LLM context continuously.
    const chatCompletion = await getGroq().chat.completions.create({
      messages: requestMessages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.3, // Slightly higher temperature to allow natural conversation but low enough for JSON and rigid fallback compliance
      max_tokens: 1024,
      top_p: 1,
    });

    const reply = chatCompletion.choices[0]?.message?.content;

    if (!reply) {
      throw new Error("No response received from LLM");
    }

    // Potential logic to parse if it's JSON can be added here or handled by the consumer
    return reply;
  } catch (error) {
    console.error("AI Service Error:", error);
    throw new Error("Failed to generate AI response.");
  }
};

module.exports = {
  getChatCompletion,
};
