import { useState } from "react";
import SearchForm from "./components/SearchForm";
import ResultsList from "./components/ResultsList";
import ChatInterface from "./components/ChatInterface";

const TABS = [
  { id: "chat", label: "AI Chat", badge: "NEW" },
  { id: "city", label: "Search by City" },
  { id: "radius", label: "Search by Coordinates" },
];

function App() {
  const [activeTab, setActiveTab] = useState("chat");
  const [results, setResults] = useState(null);
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toolsUsed, setToolsUsed] = useState([]);

  const handleSearch = async (params) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setDestination("");
    setToolsUsed([]);

    try {
      let res, data;

      if (params.mode === "radius") {
        setToolsUsed(["trivago-accommodation-radius-search"]);
        res = await fetch("/api/radius-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: params.latitude,
            longitude: params.longitude,
            radius: params.radius,
            checkIn: params.checkIn,
            checkOut: params.checkOut,
            adults: Number(params.adults),
          }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        if (data.error) throw new Error(data.error);

        const hotels = data.accommodations || [];
        setDestination(`${params.latitude}, ${params.longitude}`);
        if (hotels.length === 0) {
          setError("No hotels found near these coordinates. Try a larger radius.");
        } else {
          setResults(hotels);
        }
      } else {
        setToolsUsed([
          "trivago-search-suggestions",
          "trivago-accommodation-search",
        ]);
        res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: params.destination,
            checkIn: params.checkIn,
            checkOut: params.checkOut,
            adults: Number(params.adults),
          }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        if (data.error) throw new Error(data.error);

        const hotels = data.accommodations || [];
        setDestination(data.destination || params.destination);
        if (hotels.length === 0) {
          setError("No hotels found for this destination. Try a different search.");
        } else {
          setResults(hotels);
        }
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Reset manual-search results when switching tabs so stale data doesn't bleed in.
  const switchTab = (tabId) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    setResults(null);
    setDestination("");
    setError(null);
    setToolsUsed([]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-extrabold">
            <span style={{ color: "#E31E2D" }}>tri</span>
            <span style={{ color: "#FF6B00" }}>va</span>
            <span style={{ color: "#0054A6" }}>go</span>
            <span className="text-gray-900 font-bold"> Hotel Finder</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Powered by{" "}
            <span className="font-semibold">
              <span style={{ color: "#0054A6" }}>tri</span>
              <span style={{ color: "#FF6B00" }}>va</span>
              <span style={{ color: "#E31E2D" }}>go</span>
            </span>{" "}
            MCP
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Top-level Tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
                  active
                    ? "bg-trivago-orange text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-trivago-orange hover:text-trivago-orange"
                }`}
              >
                {tab.label}
                {tab.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      active
                        ? "bg-white text-trivago-orange"
                        : "bg-trivago-orange text-white"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Chat tab */}
        {activeTab === "chat" && <ChatInterface />}

        {/* Manual-search tabs */}
        {activeTab !== "chat" && (
          <>
            <SearchForm
              onSearch={handleSearch}
              loading={loading}
              searchMode={activeTab}
            />

            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-trivago-orange border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-500">Searching for the best deals...</p>
                {toolsUsed.length > 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    Calling:{" "}
                    {toolsUsed.map((t) => (
                      <span
                        key={t}
                        className="font-mono bg-gray-100 px-1.5 py-0.5 rounded mx-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}

            {error && !loading && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mt-6">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {results && !loading && toolsUsed.length > 0 && (
              <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
                <span>MCP tools used:</span>
                {toolsUsed.map((t, i) => (
                  <span key={t} className="flex items-center gap-1">
                    {i > 0 && <span className="text-trivago-orange">→</span>}
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                      {t}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {results && !loading && (
              <ResultsList hotels={results} destination={destination} />
            )}

            {!results && !loading && !error && (
              <div className="text-center py-16 text-gray-400">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-lg">Search for hotels in any destination</p>
                <p className="text-sm mt-1">
                  {activeTab === "city"
                    ? "Enter a city, pick dates, and start exploring"
                    : "Enter coordinates, pick dates, and start exploring"}
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-12">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-gray-400">
          Built by{" "}
          <span className="font-bold">
            <span style={{ color: "#E31E2D" }}>Umar</span>{" "}
            <span style={{ color: "#FF6B00" }}>Farook</span>{" "}
            <span style={{ color: "#0054A6" }}>M</span>
          </span>
          {" "}&middot; Powered by{" "}
          <a
            href="https://mcp.trivago.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:underline"
          >
            <span style={{ color: "#E31E2D" }}>tri</span>
            <span style={{ color: "#FF6B00" }}>va</span>
            <span style={{ color: "#0054A6" }}>go</span>
            <span className="text-gray-500"> MCP Server</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
