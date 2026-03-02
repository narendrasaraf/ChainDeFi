const aiService = require("../services/aiService");
const axios = require("axios");

exports.handleChatMessage = async (req, res) => {
  try {
    const { message, language, sessionId, confirmLoan, loanData } = req.body;

    // If this is a direct confirmation request from the bot UI, bypass AI
    if (confirmLoan && loanData) {
      try {
        // Determine port from environment or fallback to 5000
        const port = process.env.PORT || 5000;

        // Fire request to strictly existing loan creation API
        const loanCreateResponse = await axios.post(
          `http://localhost:${port}/api/loans/create`,
          loanData,
          {
            headers: {
              // Assuming you might need to pass down the auth header from the current request if one existed
              ...(req.headers.authorization && {
                Authorization: req.headers.authorization,
              }),
            },
          },
        );

        return res.status(200).json({
          success: true,
          type: "loan_created",
          message: "Loan request submitted successfully.",
          data: loanCreateResponse.data,
        });
      } catch (apiError) {
        // Safeguard: Forward exact API validation error safely without crashing.
        // We NEVER bypass loan validation or create it directly.
        const errorMessage =
          apiError.response?.data?.error ||
          apiError.response?.data?.message ||
          apiError.message ||
          "Failed to submit loan request.";
        console.error("Loan API Proxy Error:", errorMessage);

        return res.status(200).json({
          success: false,
          type: "normal_message",
          data: `There was an issue processing your loan: ${errorMessage}`,
        });
      }
    }

    if (!message) {
      return res
        .status(400)
        .json({ success: false, error: "Message is required" });
    }

    let aiResponse;

    // Dynamically locate the askAI service by exported name
    // (handling previous implementations that exported getChatCompletion)
    if (typeof aiService.askAI === "function") {
      aiResponse = await aiService.askAI(message, language, sessionId);
    } else if (typeof aiService.getChatCompletion === "function") {
      // Fallback for my existing implementation
      const messagesPayload = [{ role: "user", content: message }];
      aiResponse = await aiService.getChatCompletion(messagesPayload);
    } else {
      throw new Error("AI service method not found.");
    }

    try {
      const parsed = JSON.parse(aiResponse);

      if (parsed.intent === "create_loan") {
        return res.status(200).json({
          success: true,
          type: "loan_intent",
          data: parsed,
        });
      }
    } catch (error) {
      // Not structured JSON or parsing failed
    }

    // If not structured JSON, return normal message
    return res.status(200).json({
      success: true,
      type: "normal_message",
      data: aiResponse,
    });
  } catch (error) {
    console.error("Chat Controller Error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};
