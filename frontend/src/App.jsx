import { useState } from "react";
import SearchForm from "./components/SearchForm";
import ResultsList from "./components/ResultsList";

function App() {
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
        // Uses: trivago-accommodation-radius-search
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
        // Uses: trivago-search-suggestions → trivago-accommodation-search
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
      <main className="max-w-5xl mx-auto px-4 py-8">
        <SearchForm onSearch={handleSearch} loading={loading} />

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-trivago-orange border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500">Searching for the best deals...</p>
            {toolsUsed.length > 0 && (
              <p className="mt-2 text-xs text-gray-400">
                Calling: {toolsUsed.map((t) => (
                  <span key={t} className="font-mono bg-gray-100 px-1.5 py-0.5 rounded mx-0.5">{t}</span>
                ))}
              </p>
            )}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mt-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* MCP Tools Used Badge */}
        {results && !loading && toolsUsed.length > 0 && (
          <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
            <span>MCP tools used:</span>
            {toolsUsed.map((t, i) => (
              <span key={t} className="flex items-center gap-1">
                {i > 0 && <span className="text-trivago-orange">→</span>}
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{t}</span>
              </span>
            ))}
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <ResultsList hotels={results} destination={destination} />
        )}

        {/* Empty initial state */}
        {!results && !loading && !error && (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg">Search for hotels in any destination</p>
            <p className="text-sm mt-1">Enter a city or coordinates, pick dates, and start exploring</p>

            {/* MCP Tools Overview */}
            <div className="mt-8 max-w-lg mx-auto text-left">
              <p className="text-sm font-medium text-gray-500 mb-3 text-center">This app uses 3 trivago MCP tools:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 bg-white rounded-lg p-3 border border-gray-100">
                  <span className="text-trivago-orange font-bold text-lg">1</span>
                  <div>
                    <p className="text-sm font-mono text-gray-700">trivago-search-suggestions</p>
                    <p className="text-xs text-gray-400">Autocomplete as you type — resolves "Paris" into a location ID</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white rounded-lg p-3 border border-gray-100">
                  <span className="text-trivago-orange font-bold text-lg">2</span>
                  <div>
                    <p className="text-sm font-mono text-gray-700">trivago-accommodation-search</p>
                    <p className="text-xs text-gray-400">Searches hotels by resolved location ID + dates + guests</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-white rounded-lg p-3 border border-gray-100">
                  <span className="text-trivago-orange font-bold text-lg">3</span>
                  <div>
                    <p className="text-sm font-mono text-gray-700">trivago-accommodation-radius-search</p>
                    <p className="text-xs text-gray-400">Searches hotels near lat/lng coordinates within a radius</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
