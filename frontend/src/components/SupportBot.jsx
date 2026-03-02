import React, { useState, useRef, useEffect } from "react";
import "./SupportBot.css";

const SupportBot = () => {
    const [isOpen, setIsOpen] = useState(false);

    // Translations for UI elements (Default to English)
    const translations = {
        title: "Support",
        placeholder: "Type a message...",
        sendBtn: "Send",
        initialBotMsg: "Hi! How can I help you today?",
        botResponseDelay: "I am a support bot. How else may I assist you?",
        errorMsg: "Sorry, I am having trouble connecting to the server right now.",
    };

    // Conversation state management
    const [mode, setMode] = useState("faq");
    const [collectedData, setCollectedData] = useState({});
    const [escalated, setEscalated] = useState(false);

    // Hardcoded escalation trigger words
    const escalationKeywords = [
        "complaint",
        "fraud",
        "problem",
        "issue",
        "refund",
    ];

    const formatTimestamp = (date) => {
        return new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }).format(date);
    };

    const [messages, setMessages] = useState([
        {
            id: 1,
            text: translations.initialBotMsg,
            sender: "bot",
            timestamp: formatTimestamp(new Date()),
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleReset = () => {
        setMessages([
            {
                id: Date.now(),
                text: translations.initialBotMsg,
                sender: "bot",
                timestamp: formatTimestamp(new Date()),
            },
        ]);
        setMode("faq");
        setCollectedData({});
        setEscalated(false);
    };

    const handleSend = async () => {
        if (!inputValue.trim() || escalated || isTyping) return;

        const rawInput = inputValue.trim();
        const lowerInput = rawInput.toLowerCase();

        // Handle explicit local resets
        if (lowerInput === "reset" || lowerInput === "start over") {
            handleReset();
            setInputValue("");
            return;
        }

        // Local Regex Intercept for Complaints
        const hasComplaint = escalationKeywords.some((keyword) =>
            lowerInput.includes(keyword),
        );
        if (hasComplaint) {
            const newUserMessage = {
                id: Date.now(),
                text: rawInput,
                sender: "user",
                timestamp: formatTimestamp(new Date()),
            };
            const escalationResponse = {
                id: Date.now() + 1,
                text: "I'm transferring this to human support. Please email us at pancred.support@gmail.com with your details.",
                sender: "bot",
                timestamp: formatTimestamp(new Date()),
            };

            setMessages((prev) => [...prev, newUserMessage, escalationResponse]);
            setInputValue("");
            setEscalated(true);
            return; // Halt AI logic entirely
        }

        const newUserMessage = {
            id: Date.now(),
            text: rawInput,
            sender: "user",
            timestamp: formatTimestamp(new Date()),
        };

        setMessages((prev) => {
            const updatedMessages = [...prev, newUserMessage];
            // Keep memory bounded to the last 10 messages
            if (updatedMessages.length > 10) {
                return updatedMessages.slice(updatedMessages.length - 10);
            }
            return updatedMessages;
        });
        // Clear input early to improve perceive speed
        setInputValue("");
        setIsTyping(true);

        // Get current message thread spanning max length 10
        const currentThread =
            messages.length > 9 ? messages.slice(messages.length - 9) : messages;

        try {
            // Forward conversation history, mode, data to Backend (Language is auto-detected by LLM)
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: [...currentThread, newUserMessage],
                    mode: mode,
                    collectedData: collectedData,
                }),
            });

            if (!response.ok) {
                throw new Error("Network response was not ok");
            }

            const data = await response.json();

            // Intercept structured memory updates from backend if present
            if (data.mode) setMode(data.mode);
            if (data.collectedData)
                setCollectedData((prev) => ({ ...prev, ...data.collectedData }));

            setIsTyping(false);
            const botResponse = {
                id: Date.now() + 1,
                text: data.reply,
                sender: "bot",
                timestamp: formatTimestamp(new Date()),
            };

            setMessages((prev) => {
                const updatedMessages = [...prev, botResponse];
                // Check memory boundaries again after bot reply
                if (updatedMessages.length > 10) {
                    return updatedMessages.slice(updatedMessages.length - 10);
                }
                return updatedMessages;
            });
        } catch (error) {
            console.error("Failed to fetch bot response:", error);
            setIsTyping(false);
            const errorResponse = {
                id: Date.now() + 1,
                text: translations.errorMsg,
                sender: "bot",
                timestamp: formatTimestamp(new Date()),
            };
            setMessages((prev) => [...prev, errorResponse]);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            handleSend();
        }
    };

    return (
        <div className="support-bot-container">
            {isOpen ? (
                <div className="support-bot-window">
                    <div className="support-bot-header">
                        <h4>{translations.title}</h4>
                        <div className="support-bot-header-controls">
                            <button
                                className="support-bot-close"
                                onClick={() => setIsOpen(false)}
                                aria-label="Close Chat"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    <div className="support-bot-messages">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`support-bot-message-wrapper ${msg.sender}`}
                            >
                                <div className={`support-bot-message ${msg.sender}`}>
                                    {msg.text}
                                </div>
                                {msg.timestamp && (
                                    <span className="support-bot-timestamp">{msg.timestamp}</span>
                                )}
                            </div>
                        ))}
                        {isTyping && (
                            <div className="support-bot-message-wrapper bot">
                                <div className="support-bot-message bot typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="support-bot-input-area">
                        <input
                            type="text"
                            placeholder={
                                escalated
                                    ? "Chat closed. Please email support."
                                    : translations.placeholder
                            }
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={escalated || isTyping}
                            className="support-bot-input"
                        />
                        <button
                            className="support-bot-send"
                            onClick={handleSend}
                            disabled={escalated || isTyping || !inputValue.trim()}
                        >
                            {translations.sendBtn}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    className="support-bot-toggle"
                    onClick={() => setIsOpen(true)}
                    aria-label="Open support chat"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>
            )}
        </div>
    );
};

export default SupportBot;
