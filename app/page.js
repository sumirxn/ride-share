"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [rides, setRides] = useState([]);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRide, setSelectedRide] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [passengers, setPassengers] = useState([]);
  const [passengerLoading, setPassengerLoading] = useState(false);
  const [passengerError, setPassengerError] = useState("");
  const [selectedPassengerId, setSelectedPassengerId] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingConfirmation, setBookingConfirmation] = useState(null);

  async function fetchRides(pickupValue = pickup, dropValue = drop) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (pickupValue.trim()) params.set("pickup", pickupValue.trim());
      if (dropValue.trim()) params.set("drop", dropValue.trim());

      const response = await fetch(`/api/rides?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to load rides");
      }

      const data = await response.json();
      setRides(data);
    } catch {
      setError("Unable to load rides. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchPopularRoutes() {
    try {
      const response = await fetch("/api/popular-routes");

      if (!response.ok) {
        throw new Error("Failed to load popular routes");
      }

      const data = await response.json();
      setPopularRoutes(data);
    } catch {
      setPopularRoutes([]);
    }
  }

  useEffect(() => {
    fetchRides("", "");
    fetchPopularRoutes();
  }, []);

  async function handleSearch(event) {
    event.preventDefault();

    try {
      await fetch("/api/ride-activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup: pickup.trim(),
          drop: drop.trim(),
          seatsRequired: 1,
        }),
      });
    } catch {
      // Ride search can continue if activity logging is unavailable.
    }

    await fetchRides(pickup, drop);
    await fetchPopularRoutes();
  }

  async function handleReset() {
    setPickup("");
    setDrop("");
    await fetchRides("", "");
  }

  function selectRoute(route) {
    setPickup(route._id.pickup);
    setDrop(route._id.drop);
  }

  async function openRide(ride) {
    setSelectedRide(ride);
    setSelectedSeats(1);
    setPassengers([]);
    setSelectedPassengerId("");
    setPassengerError("");
    setBookingError("");
    setBookingConfirmation(null);
    setPassengerLoading(true);

    try {
      const response = await fetch("/api/passengers");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load passengers");
      }

      setPassengers(data);
      setSelectedPassengerId(data.length ? String(data[0].user_id) : "");
    } catch (passengerLoadError) {
      setPassengerError(
        passengerLoadError.message || "Unable to load active passengers."
      );
    } finally {
      setPassengerLoading(false);
    }
  }

  function closeRideModal() {
    if (bookingLoading) return;
    setSelectedRide(null);
    setBookingConfirmation(null);
    setBookingError("");
  }

  async function handleBooking() {
    if (!selectedRide || !selectedPassengerId) return;

    setBookingLoading(true);
    setBookingError("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passengerId: Number(selectedPassengerId),
          rideOfferId: Number(selectedRide.ride_offer_id),
          seatsBooked: selectedSeats,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to book this ride");
      }

      setBookingConfirmation(data);
      await fetchRides(pickup, drop);
    } catch (bookingRequestError) {
      setBookingError(
        bookingRequestError.message || "Unable to book this ride. Please try again."
      );
    } finally {
      setBookingLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedRide) return;

    function handleEscape(event) {
      if (event.key === "Escape" && !bookingLoading) {
        setSelectedRide(null);
        setBookingConfirmation(null);
        setBookingError("");
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedRide, bookingLoading]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">R</span>
          <span>RideShare</span>
        </a>
        <span className="topbar-label">CARPOOLING &amp; RIDE MATCHING</span>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR JOURNEY STARTS HERE</p>
        <h1>Find a ride.</h1>
        <p className="hero-description">
          Search available rides and find a route that works for you.
        </p>
      </section>

      <section className="search-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SEARCH</p>
            <h2>Where are you going?</h2>
          </div>
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <label className="field">
            <span>Pickup location</span>
            <input
              type="text"
              placeholder="e.g. Indiranagar"
              value={pickup}
              onChange={(event) => setPickup(event.target.value)}
            />
          </label>

          <span className="route-arrow" aria-hidden="true">
            →
          </span>

          <label className="field">
            <span>Drop location</span>
            <input
              type="text"
              placeholder="e.g. Whitefield"
              value={drop}
              onChange={(event) => setDrop(event.target.value)}
            />
          </label>

          <div className="search-actions">
            <button type="submit" className="primary-button">
              Find a ride <span aria-hidden="true">↗</span>
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ROUTES</p>
            <h2>Popular searches</h2>
          </div>
        </div>

        {popularRoutes.length === 0 ? (
          <p className="empty-note">No route activity yet.</p>
        ) : (
          <div className="popular-grid">
            {popularRoutes.map((route, index) => (
              <button
                type="button"
                className="popular-card"
                key={`${route._id.pickup}-${route._id.drop}-${index}`}
                onClick={() => selectRoute(route)}
              >
                <span className="popular-route">
                  {route._id.pickup}
                  <span aria-hidden="true"> → </span>
                  {route._id.drop}
                </span>
                <span className="popular-count">
                  {route.searchCount}{" "}
                  {route.searchCount === 1 ? "search" : "searches"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="content-section rides-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AVAILABLE NOW</p>
            <h2>Available rides</h2>
          </div>
          {!loading && !error && (
            <span className="result-count">
              {rides.length} {rides.length === 1 ? "ride" : "rides"}
            </span>
          )}
        </div>

        {loading && <p className="empty-note">Loading rides...</p>}

        {!loading && error && <p className="error-note">{error}</p>}

        {!loading && !error && rides.length === 0 && (
          <p className="empty-note">
            No available rides found. Try a different location.
          </p>
        )}

        {!loading && !error && rides.length > 0 && (
          <div className="rides-grid">
            {rides.map((ride) => (
              <article
                className="ride-card"
                key={ride.ride_offer_id}
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-label={`View ride from ${ride.pickup} to ${ride.drop_location}`}
                onClick={() => openRide(ride)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openRide(ride);
                  }
                }}
              >
                <div className="ride-card-top">
                  <span className="available-label">
                    <span className="status-dot" />
                    Available
                  </span>
                  <span className="ride-id">
                    RIDE #{ride.ride_offer_id}
                  </span>
                </div>

                <div className="route-display">
                  <div className="route-marker">
                    <span className="route-stop start-stop" />
                    <span className="route-line" />
                    <span className="route-stop end-stop" />
                  </div>

                  <div className="route-locations">
                    <div className="route-location">
                      <span className="location-label">PICKUP</span>
                      <h3>{ride.pickup}</h3>
                    </div>
                    <div className="route-location">
                      <span className="location-label">DROP</span>
                      <h3>{ride.drop_location}</h3>
                    </div>
                  </div>
                </div>

                <div className="ride-divider" />

                <div className="ride-details">
                  <div>
                    <span className="detail-label">DRIVER</span>
                    <p>{ride.driver_name}</p>
                  </div>
                  <div>
                    <span className="detail-label">DEPARTURE</span>
                    <p>
                      {new Date(ride.departure_time).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>

                <div className="ride-card-bottom">
                  <div className="seat-count">
                    <span aria-hidden="true">♙</span>
                    {ride.available_seats}{" "}
                    {ride.available_seats === 1 ? "seat" : "seats"} available
                  </div>
                  <div className="ride-price">
                    <span>PER SEAT</span>
                    <strong>₹{Number(ride.cost_per_seat).toFixed(0)}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="footer">
        <span className="footer-brand">RideShare</span>
        <span>Shared rides. Smarter journeys.</span>
      </footer>

      {selectedRide && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRideModal();
          }}
        >
          <section
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            aria-describedby={bookingError ? "booking-error-message" : undefined}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">RIDE DETAILS</p>
                <h2 id="booking-modal-title">
                  {selectedRide.pickup} <span aria-hidden="true">→</span>{" "}
                  {selectedRide.drop_location}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close ride details"
                autoFocus
                disabled={bookingLoading}
                onClick={closeRideModal}
              >
                ×
              </button>
            </div>

            <div className="modal-ride-details">
              <p>
                <span>DRIVER</span>
                {selectedRide.driver_name}
              </p>
              <p>
                <span>DEPARTURE</span>
                {new Date(selectedRide.departure_time).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p>
                <span>PRICE PER SEAT</span>
                ₹{Number(selectedRide.cost_per_seat).toFixed(0)}
              </p>
            </div>

            <label className="seat-selector-field">
              <span>Number of seats</span>
              <select
                value={selectedSeats}
                disabled={bookingLoading || Boolean(bookingConfirmation)}
                onChange={(event) => setSelectedSeats(Number(event.target.value))}
              >
                {Array.from(
                  { length: Number(selectedRide.available_seats) },
                  (_, index) => index + 1
                ).map((seatCount) => (
                  <option key={seatCount} value={seatCount}>
                    {seatCount} {seatCount === 1 ? "seat" : "seats"}
                  </option>
                ))}
              </select>
            </label>

            {!bookingConfirmation && (
              <>
                <label className="passenger-selector-field">
                  <span>Passenger</span>
                  <select
                    value={selectedPassengerId}
                    disabled={
                      passengerLoading ||
                      bookingLoading ||
                      passengers.length === 0
                    }
                    onChange={(event) =>
                      setSelectedPassengerId(event.target.value)
                    }
                  >
                    {passengers.map((passenger) => (
                      <option key={passenger.user_id} value={passenger.user_id}>
                        {passenger.name}
                      </option>
                    ))}
                  </select>
                </label>

                {passengerLoading && (
                  <p className="booking-status">Loading active passengers...</p>
                )}
                {passengerError && (
                  <p className="booking-error">{passengerError}</p>
                )}
                {!passengerLoading &&
                  !passengerError &&
                  passengers.length === 0 && (
                    <p className="booking-error">
                      No active passengers are available to book this ride.
                    </p>
                  )}

                <div className="modal-total">
                  <span>Total price</span>
                  <strong>
                    ₹
                    {(
                      Number(selectedRide.cost_per_seat) * selectedSeats
                    ).toFixed(0)}
                  </strong>
                </div>

                {bookingError && (
                  <p
                    className="booking-error"
                    id="booking-error-message"
                    role="alert"
                  >
                    {bookingError}
                  </p>
                )}
                <button
                  type="button"
                  className="primary-button modal-book-button"
                  disabled={
                    passengerLoading ||
                    passengers.length === 0 ||
                    !selectedPassengerId ||
                    bookingLoading
                  }
                  onClick={handleBooking}
                >
                  {bookingLoading ? "Booking..." : "Book Ride"}
                </button>
              </>
            )}

            {bookingConfirmation && (
              <div className="booking-confirmation" role="status">
                <p>Ride booked successfully.</p>
                <strong>Booking ID #{bookingConfirmation.bookingId}</strong>
                <button
                  type="button"
                  className="primary-button modal-book-button"
                  onClick={closeRideModal}
                >
                  Done
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}