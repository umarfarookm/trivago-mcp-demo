import { useState, useRef, useEffect, useMemo } from "react";
import HotelCard from "./HotelCard";

// Sample prompts use future dates computed from today so they stay valid over
// time. Dates are formatted in natural English (e.g. "20 December 2026") so the
// LLM parses them the same way a real user would phrase a request.
function buildSamplePrompts(now = new Date()) {
  const addDays = (d, n) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + n);
    return nd;
  };
  const addMonths = (d, n) => {
    const nd = new Date(d);
    nd.setMonth(nd.getMonth() + n);
    return nd;
  };
  const longDate = (d) =>
    `${d.getDate()} ${d.toLocaleString("en-US", { month: "long" })} ${d.getFullYear()}`;
  const shortDate = (d) =>
    `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
  const monthYear = (d) =>
    `${d.toLocaleString("en-US", { month: "long" })} ${d.getFullYear()}`;

  const berlinStart = addMonths(now, 2);
  const berlinEnd = addDays(berlinStart, 4);

  const dusseldorfStart = addMonths(now, 4);
  const dusseldorfEnd = addDays(dusseldorfStart, 8);

  const japanMonth = addMonths(now, 6);
  const etihadStart = addMonths(now, 3);

  return [
    `I'm looking for a hotel in Berlin from ${longDate(berlinStart)} to ${longDate(berlinEnd)}.`,
    "Search an accommodation near the Eiffel Tower with 2 rooms for 2 adults and 2 children aged 6 and 10.",
    `I need an accommodation in Dusseldorf with pool and high guest rating, from ${shortDate(dusseldorfStart)} to ${shortDate(dusseldorfEnd)}.`,
    `I'm planning my vacation to Japan in ${monthYear(japanMonth)}. I'd like to stay in Tokyo and Osaka for 2 weeks — find suitable accommodations.`,
    `Find a hotel near the Etihad Stadium, from ${longDate(etihadStart)} for 4 days.`,
  ];
}

function ChatInterface() {
  const [messages, setMessages] = useState([]); // { role, content, hotelsByLabel?, toolsUsed? }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Computed once per mount so dates reflect "today" whenever the user opens
  // the app. Mounts on tab switch, so even a long-lived tab stays fresh.
  const samplePrompts = useMemo(() => buildSamplePrompts(), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.text || "(no response)",
          hotelsByLabel: data.hotelsByLabel || [],
          toolsUsed: data.toolsUsed || [],
        },
      ]);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setMessages(nextMessages);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleReset = () => {
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-[600px]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-sm font-medium text-gray-700">AI Travel Assistant</span>
          <span className="text-xs text-gray-400 ml-1">
            powered by DeepSeek + trivago MCP
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleReset}
            className="text-xs text-gray-500 hover:text-trivago-orange transition"
            type="button"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
        {messages.length === 0 && !loading && (
          <EmptyState prompts={samplePrompts} onPick={(p) => sendMessage(p)} />
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {loading && <LoadingBubble />}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-100 px-3 sm:px-4 py-3 flex gap-2 items-end"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          rows={1}
          placeholder="Ask for a hotel in any city, near a landmark, or plan a multi-city trip..."
          disabled={loading}
          className="flex-1 resize-none px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trivago-orange focus:border-trivago-orange outline-none transition max-h-40 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 bg-trivago-orange hover:bg-trivago-orange-dark text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function EmptyState({ prompts, onPick }) {
  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-orange-50 mb-3">
          <svg className="w-7 h-7 text-trivago-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Ask anything about hotels
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          DeepSeek picks the right trivago MCP tool and answers in natural language.
        </p>
      </div>

      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 text-center">
        Try one of these
      </p>
      <div className="grid gap-2 max-w-2xl mx-auto">
        {prompts.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(p)}
            className="text-left text-sm px-4 py-3 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-lg transition text-gray-700"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-trivago-orange text-white text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-full w-full space-y-3">
        <div className="inline-block max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-gray-100 text-gray-800 text-sm whitespace-pre-wrap">
          {message.content}
        </div>

        {message.toolsUsed?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-gray-400">
            <span>MCP tools called:</span>
            {message.toolsUsed.map((t, i) => (
              <span
                key={i}
                className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {message.hotelsByLabel?.map((group, gi) => (
          <div key={gi} className="mt-2">
            {message.hotelsByLabel.length > 1 && (
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                {group.label} · {group.hotels.length} hotel{group.hotels.length !== 1 ? "s" : ""}
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.hotels.map((hotel, hi) => (
                <HotelCard
                  key={hotel.accommodation_id || hotel.id || hi}
                  hotel={hotel}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Status thresholds in seconds. The current stage is the last one whose
// `at` is <= elapsed. These are calibrated to DeepSeek's typical timing for
// a tool-use loop and are purely indicative — the actual work isn't tracked.
const LOADING_STAGES = [
  { at: 0, label: "Understanding your request" },
  { at: 3, label: "Calling trivago MCP tools" },
  { at: 8, label: "Searching accommodations" },
  { at: 16, label: "Analyzing results" },
  { at: 24, label: "Finalizing response" },
  { at: 35, label: "Almost there — DeepSeek is slow today" },
];

function LoadingBubble() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, []);

  const stage = LOADING_STAGES.reduce(
    (current, s) => (elapsed >= s.at ? s : current),
    LOADING_STAGES[0],
  );

  return (
    <div className="flex justify-start">
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-gray-100 flex items-center gap-3 min-w-[280px]">
        <div className="flex items-center gap-1">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </div>
        <div className="flex-1 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-600">{stage.label}...</span>
          <span className="text-xs font-mono text-gray-400 tabular-nums">
            {elapsed}s
          </span>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }) {
  return (
    <span
      className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}

export default ChatInterface;
