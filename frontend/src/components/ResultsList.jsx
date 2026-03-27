import HotelCard from "./HotelCard";

function ResultsList({ hotels, destination }) {
  if (!hotels || hotels.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        {hotels.length} hotel{hotels.length !== 1 ? "s" : ""} found
        {destination && (
          <span className="text-gray-500 font-normal"> in {destination}</span>
        )}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {hotels.map((hotel, index) => (
          <HotelCard
            key={hotel.accommodation_id || hotel.id || index}
            hotel={hotel}
          />
        ))}
      </div>
    </div>
  );
}

export default ResultsList;
