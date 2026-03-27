function HotelCard({ hotel }) {
  const name = hotel.accommodation_name || hotel.name || "Hotel";
  const stars = hotel.hotel_rating || null;
  const reviewScore = hotel.review_rating || null;
  const reviewCount = hotel.review_count || null;
  const pricePerNight = hotel.price_per_night || null;
  const pricePerStay = hotel.price_per_stay || null;
  const currency = hotel.currency || "EUR";
  const image = hotel.main_image || null;
  const bookingUrl = hotel.booking_url || null;
  const trivagoUrl = hotel.accommodation_url || null;
  const location = hotel.country_city || hotel.address || null;
  const distance = hotel.distance || null;
  const distanceToCenter = hotel.distance_to_city_center || null;
  const amenities = hotel.top_amenities || null;
  const advertiser = hotel.advertisers || null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition group flex flex-col">
      {/* Image */}
      <div className="h-48 bg-gray-100 overflow-hidden relative flex-shrink-0">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="w-full h-full items-center justify-center text-gray-300 absolute inset-0"
          style={{ display: image ? "none" : "flex" }}
        >
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        {pricePerNight && (
          <div className="absolute top-3 right-3 bg-trivago-orange text-white px-3 py-1 rounded-full text-sm font-bold shadow">
            {pricePerNight}/night
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-gray-900 text-lg leading-tight line-clamp-2">
          {name}
        </h3>

        {location && (
          <p className="text-sm text-gray-500 mt-1 truncate">{location}</p>
        )}

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {/* Star Rating */}
          {stars && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(Math.round(Number(stars)), 5) }, (_, i) => (
                <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          )}

          {/* Review Score */}
          {reviewScore && (
            <span className="inline-flex items-center bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded">
              {reviewScore}
              {reviewCount != null && (
                <span className="text-green-600 ml-1">
                  ({Number(reviewCount).toLocaleString()} reviews)
                </span>
              )}
            </span>
          )}
        </div>

        {/* Distance */}
        {distanceToCenter && (
          <p className="text-xs text-gray-400 mt-2">
            {distanceToCenter.value} {distanceToCenter.unit} to city center
          </p>
        )}

        {/* Amenities */}
        {amenities && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-1">{amenities}</p>
        )}

        {/* Price & CTA */}
        <div className="mt-auto pt-4">
          {pricePerStay && (
            <p className="text-sm text-gray-600 mb-2">
              Total: <span className="font-semibold text-gray-900">{pricePerStay}</span>
              {advertiser && <span className="text-xs text-gray-400 ml-1">on {advertiser}</span>}
            </p>
          )}

          {bookingUrl ? (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center w-full px-4 py-2.5 bg-trivago-orange hover:bg-trivago-orange-dark text-white font-semibold rounded-lg transition"
            >
              View Deal
            </a>
          ) : trivagoUrl ? (
            <a
              href={trivagoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center w-full px-4 py-2.5 bg-trivago-orange hover:bg-trivago-orange-dark text-white font-semibold rounded-lg transition"
            >
              View on trivago
            </a>
          ) : (
            <div className="block text-center w-full px-4 py-2 bg-gray-100 text-gray-500 font-medium rounded-lg">
              No deal link available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HotelCard;
