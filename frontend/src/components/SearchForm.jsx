import { useState, useEffect, useRef } from "react";

function SearchForm({ onSearch, loading }) {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [adults, setAdults] = useState(2);
  const [validationError, setValidationError] = useState("");

  // Suggestions state (trivago-search-suggestions tool)
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);

  // Search mode toggle
  const [searchMode, setSearchMode] = useState("city"); // "city" or "radius"
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState(5000);

  // Fetch suggestions as user types (calls trivago-search-suggestions via backend)
  useEffect(() => {
    if (searchMode !== "city") return;
    if (destination.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce: wait 300ms after user stops typing
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `/api/suggestions?query=${encodeURIComponent(destination.trim())}`
        );
        const data = await res.json();
        const items = data?.suggestions || [];
        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [destination, searchMode]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelectSuggestion = (suggestion) => {
    const label = suggestion.location_label
      ? `${suggestion.location}, ${suggestion.location_label}`
      : suggestion.location;
    setDestination(label);
    setSelectedSuggestion(suggestion);
    setShowSuggestions(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError("");

    if (!checkIn || !checkOut) {
      setValidationError("Please select check-in and check-out dates.");
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      setValidationError("Check-out date must be after check-in date.");
      return;
    }
    if (new Date(checkIn) < new Date(today)) {
      setValidationError("Check-in date cannot be in the past.");
      return;
    }

    if (searchMode === "city") {
      if (!destination.trim()) {
        setValidationError("Please enter a destination.");
        return;
      }
      onSearch({
        mode: "city",
        destination: destination.trim(),
        checkIn,
        checkOut,
        adults,
        // Pass selected suggestion's id/ns if available
        suggestion: selectedSuggestion,
      });
    } else {
      if (!latitude || !longitude) {
        setValidationError("Please enter latitude and longitude.");
        return;
      }
      onSearch({
        mode: "radius",
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: Number(radius),
        checkIn,
        checkOut,
        adults,
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      {/* Search Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setSearchMode("city")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
            searchMode === "city"
              ? "bg-trivago-orange text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Search by City
        </button>
        <button
          type="button"
          onClick={() => setSearchMode("radius")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
            searchMode === "radius"
              ? "bg-trivago-orange text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Search by Coordinates
        </button>
      </div>

      {/* MCP Tool indicator */}
      <p className="text-xs text-gray-400 mb-3">
        MCP Tool:{" "}
        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
          {searchMode === "city"
            ? "trivago-search-suggestions → trivago-accommodation-search"
            : "trivago-accommodation-radius-search"}
        </span>
      </p>

      {/* Row 1: Location + Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {searchMode === "city" ? (
          /* Destination with autocomplete */
          <div className="sm:col-span-2 relative" ref={suggestionsRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setSelectedSuggestion(null);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="e.g. Paris, London, Tokyo"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trivago-orange focus:border-trivago-orange outline-none transition"
            />
            {loadingSuggestions && (
              <div className="absolute right-3 top-9">
                <div className="w-4 h-4 border-2 border-trivago-orange border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={s.id || i}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-4 py-3 hover:bg-orange-50 transition border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium text-gray-900">
                      {s.location}
                    </span>
                    {s.location_label && (
                      <span className="text-sm text-gray-500 ml-1">
                        — {s.location_label}
                      </span>
                    )}
                    <span className="block text-xs text-gray-400 mt-0.5">
                      {s.location_type}
                      {s.suggestion_type && ` · ${s.suggestion_type}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Coordinates inputs */
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="48.8566"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trivago-orange focus:border-trivago-orange outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="2.3522"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trivago-orange focus:border-trivago-orange outline-none transition"
              />
            </div>
          </>
        )}

        {/* Check-in */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Check-in
          </label>
          <input
            type="date"
            value={checkIn}
            min={today}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trivago-orange focus:border-trivago-orange outline-none transition"
          />
        </div>

        {/* Check-out */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Check-out
          </label>
          <input
            type="date"
            value={checkOut}
            min={checkIn || today}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trivago-orange focus:border-trivago-orange outline-none transition"
          />
        </div>
      </div>

      {/* Row 2: Adults + Radius (if applicable) + Search Button — equal width */}
      <div className={`grid grid-cols-1 gap-4 mt-4 ${searchMode === "radius" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {/* Adults */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Adults
          </label>
          <select
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-trivago-orange focus:border-trivago-orange outline-none transition bg-white"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "Adult" : "Adults"}
              </option>
            ))}
          </select>
        </div>

        {/* Radius — only for coordinate search */}
        {searchMode === "radius" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Radius: {(radius / 1000).toFixed(0)} km
            </label>
            <div className="flex items-center gap-2.5 border border-gray-300 rounded-lg px-4 py-2.5">
              <span className="text-xs text-gray-400">1</span>
              <input
                type="range"
                min={1000}
                max={50000}
                step={1000}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="flex-1 h-1.5 accent-trivago-orange cursor-pointer"
              />
              <span className="text-xs text-gray-400">50</span>
            </div>
          </div>
        )}

        {/* Search Button */}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-transparent mb-1 hidden sm:block" aria-hidden="true">Search</span>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-trivago-orange hover:bg-trivago-orange-dark text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Searching..." : "Search Hotels"}
          </button>
        </div>
      </div>

      {validationError && (
        <p className="text-red-500 text-sm mt-3">{validationError}</p>
      )}
    </form>
  );
}

export default SearchForm;
