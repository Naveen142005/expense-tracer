import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { auth } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_MESSAGES = [
  {
    role: "ai",
    text: "Hi Naveen, ask me about your expenses, balance, items, dates, or saving advice.",
  },
];

const QUICK_QUESTIONS = [
  "My current balance?",
  "How much did I spend till today?",
  "Which item did I spend the most on?",
  "Give me saving advice based on my expenses.",
];


const MARKDOWN_COMPONENTS = {
  p: ({ children }) => <p>{children}</p>,
  strong: ({ children }) => <strong>{children}</strong>,
  ul: ({ children }) => <ul>{children}</ul>,
  ol: ({ children }) => <ol>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h3>{children}</h3>,
  code: ({ children }) => <code>{children}</code>,
};

function MessageBubble({ message }) {
  if (message.role === "ai") {
    return (
      <div className="ai-chatbot__markdown">
        <ReactMarkdown components={MARKDOWN_COMPONENTS}>{message.text}</ReactMarkdown>
      </div>
    );
  }

  return <p>{message.text}</p>;
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3C6.48 3 2 6.92 2 11.75c0 2.76 1.47 5.22 3.76 6.82V22l3.44-1.72c.88.15 1.81.22 2.8.22 5.52 0 10-3.92 10-8.75S17.52 3 12 3Zm-4.25 9.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4.25 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4.25 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.42L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4Z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.4 20.4 22 12 3.4 3.6 3 10.1l11 1.9-11 1.9.4 6.5Z" />
    </svg>
  );
}

function isMobileView() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 650px)").matches;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function AiChatbotWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState(null);
  const [buttonPosition, setButtonPosition] = useState(null);
  const messagesEndRef = useRef(null);
  const dragStateRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, isOpen]);

  useEffect(() => {
    function handleResize() {
      if (!isMobileView()) {
        setButtonPosition(null);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!user) return null;

  const buttonStyle = buttonPosition
    ? {
        left: `${buttonPosition.x}px`,
        top: `${buttonPosition.y}px`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;

  function handlePointerDown(event) {
    if (!isMobileView() || isOpen) return;

    const rect = event.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const dragState = dragStateRef.current;
    if (!dragState || !isMobileView() || isOpen) return;

    const movedX = Math.abs(event.clientX - dragState.startX);
    const movedY = Math.abs(event.clientY - dragState.startY);
    if (movedX > 4 || movedY > 4) {
      dragState.moved = true;
    }

    const buttonSize = 58;
    const padding = 10;
    const nextX = clamp(
      event.clientX - dragState.offsetX,
      padding,
      window.innerWidth - buttonSize - padding
    );
    const nextY = clamp(
      event.clientY - dragState.offsetY,
      padding,
      window.innerHeight - buttonSize - padding
    );

    setButtonPosition({ x: nextX, y: nextY });
  }

  function handlePointerUp() {
    window.setTimeout(() => {
      dragStateRef.current = null;
    }, 0);
  }

  function handleFloatingButtonClick() {
    if (dragStateRef.current?.moved) return;
    setIsOpen(true);
  }

  async function sendMessage(customMessage) {
    const cleanMessage = String(customMessage ?? input).trim();
    if (!cleanMessage || loading) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", text: cleanMessage },
    ]);
    setInput("");
    setLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("User token not available.");
      }

      const apiUrl = import.meta.env.VITE_AI_API_URL || "/api/chat";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: cleanMessage,
          context: conversationContext,
          history: messages.slice(-6).map((message) => ({
            role: message.role,
            text: message.text,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "AI request failed.");
      }

      if (data.context) {
        setConversationContext(data.context);
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "ai",
          text: data.reply || "I could not generate a response now.",
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "ai",
          text:
            "I could not connect to the AI service. Please check the API setup and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  return (
    <div className="ai-chatbot" aria-live="polite">
      {!isOpen && (
        <button
          type="button"
          className="ai-chatbot__floating-btn"
          style={buttonStyle}
          onClick={handleFloatingButtonClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Open AI expense adviser"
        >
          <ChatIcon />
        </button>
      )}

      {isOpen && (
        <section className="ai-chatbot__panel" aria-label="AI expense adviser">
          <header className="ai-chatbot__header">
            <div className="ai-chatbot__mobile-handle" aria-hidden="true" />
            <div>
              <h2>AI Expense Adviser</h2>
              <p>Ask about totals, dates, types, GPay, cash, and savings.</p>
            </div>
            <button
              type="button"
              className="ai-chatbot__close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close AI expense adviser"
            >
              <CloseIcon />
            </button>
          </header>

          <div className="ai-chatbot__messages">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`ai-chatbot__message ai-chatbot__message--${message.role}`}
              >
                <MessageBubble message={message} />
              </div>
            ))}

            {loading && (
              <div className="ai-chatbot__message ai-chatbot__message--ai">
                <div className="ai-chatbot__markdown"><p>Thinking...</p></div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {messages.length === DEFAULT_MESSAGES.length && (
            <div className="ai-chatbot__quick-questions" aria-label="Quick questions">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  type="button"
                  key={question}
                  onClick={() => sendMessage(question)}
                  disabled={loading}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <form className="ai-chatbot__form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your spending..."
              disabled={loading}
              autoComplete="off"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Send message">
              <SendIcon />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

export default AiChatbotWidget;
