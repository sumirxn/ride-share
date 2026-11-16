"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rides, setRides] = useState([]);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [popularRoutesError, setPopularRoutesError] = useState("");
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRide, setSelectedRide] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingConfirmation, setBookingConfirmation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState("");
  const [ratingOptions, setRatingOptions] = useState([]);
  const [ratingOptionsLoading, setRatingOptionsLoading] = useState(true);
  const [ratingOptionsError, setRatingOptionsError] = useState("");
  const [ratingForm, setRatingForm] = useState({
    optionKey: "",
    ratingValue: "5",
    review: "",
  });
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const [ratingConfirmation, setRatingConfirmation] = useState(null);
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(true);
  const [paymentOptionsError, setPaymentOptionsError] = useState("");
  const [selectedPaymentBookingId, setSelectedPaymentBookingId] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentConfirmation, setPaymentConfirmation] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [rideRequests, setRideRequests] = useState([]);
  const [userDataError, setUserDataError] = useState("");
  const [requestForm, setRequestForm] = useState({
    pickupLocationId: "",
    dropLocationId: "",
    requestedTime: "",
    seatsRequired: "1",
    maxDetourMinutes: "0",
  });
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestConfirmation, setRequestConfirmation] = useState(null);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);
  const [cancellationError, setCancellationError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          window.location.replace("/login");
          return;
        }
        if (!active) return;
        if (data.user.role !== "PASSENGER") {
          window.location.replace(data.user.role === "ADMIN" ? "/admin" : "/driver");
          return;
        }
        setCurrentUser(data.user);
        void fetchPopularRoutes();
        await Promise.all([
          fetchRides("", ""),
          fetchLocations(),
          fetchRatingOptions(),
          fetchPaymentOptions(),
          fetchUserData(),
        ]);
      })
      .catch(() => {
        window.location.replace("/login");
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function fetchRides(pickupValue, dropValue) {
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
    setPopularRoutesError("");
    try {
      const response = await fetch("/api/popular-routes");

      if (!response.ok) {
        throw new Error("Failed to load popular routes");
      }

      const data = await response.json();
      setPopularRoutes(data);
    } catch {
      setPopularRoutes([]);
      setPopularRoutesError("Popular-route analytics are temporarily unavailable.");
    }
  }

  async function fetchLocations() {
    setLocationsLoading(true);
    setLocationsError("");

    try {
      const response = await fetch("/api/locations");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load locations");
      }

      setLocations(data);
    } catch (optionsError) {
      setLocationsError(optionsError.message || "Unable to load locations.");
    } finally {
      setLocationsLoading(false);
    }
  }

  async function fetchRatingOptions() {
    setRatingOptionsLoading(true);
    setRatingOptionsError("");

    try {
      const response = await fetch("/api/ratings");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load rating options");
      }

      setRatingOptions(data);
    } catch (optionsError) {
      setRatingOptionsError(
        optionsError.message || "Unable to load completed trip participants."
      );
    } finally {
      setRatingOptionsLoading(false);
    }
  }

  async function fetchPaymentOptions() {
    setPaymentOptionsLoading(true);
    setPaymentOptionsError("");

    try {
      const response = await fetch("/api/payments");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load eligible bookings");
      }

      setPaymentOptions(data);
      setSelectedPaymentBookingId(
        data.length ? String(data[0].booking_id) : ""
      );
    } catch (optionsError) {
      setPaymentOptionsError(
        optionsError.message || "Unable to load eligible bookings."
      );
    } finally {
      setPaymentOptionsLoading(false);
    }
  }

  async function fetchUserData() {
    setUserDataError("");
    try {
      const [bookingResponse, requestResponse] = await Promise.all([
        fetch("/api/bookings"),
        fetch("/api/ride-requests"),
      ]);
      const [bookingData, requestData] = await Promise.all([
        bookingResponse.json(),
        requestResponse.json(),
      ]);
      if (!bookingResponse.ok || !requestResponse.ok) {
        throw new Error("Unable to load your ride information");
      }
      setBookings(bookingData);
      setRideRequests(requestData);
    } catch (error) {
      setUserDataError(error.message || "Unable to load your ride information.");
    }
  }

  async function handleSearch(event) {
    event.preventDefault();

    void fetch("/api/ride-activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup: pickup.trim(),
          drop: drop.trim(),
          seatsRequired: 1,
        }),
      }).catch(() => {
        // Ride search can continue if activity logging is unavailable.
      });
    await fetchRides(pickup, drop);
    void fetchPopularRoutes();
  }

  async function handleReset() {
    setPickup("");
    setDrop("");
    await fetchRides("", "");
  }

  function getRatingOptionKey(option) {
    return `${option.trip_id}:${option.rated_by_id}:${option.rated_to_id}`;
  }

  function handleRatingFieldChange(event) {
    const { name, value } = event.target;
    setRatingForm((current) => ({ ...current, [name]: value }));
    setRatingError("");
    setRatingConfirmation(null);
  }

  async function handleRatingSubmit(event) {
    event.preventDefault();
    const selectedOption = ratingOptions.find(
      (option) => getRatingOptionKey(option) === ratingForm.optionKey
    );

    if (!selectedOption) {
      setRatingError("Select a completed trip and participant to rate.");
      return;
    }

    setRatingSubmitting(true);
    setRatingError("");
    setRatingConfirmation(null);

    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tripId: Number(selectedOption.trip_id),
          ratedToId: Number(selectedOption.rated_to_id),
          ratingValue: Number(ratingForm.ratingValue),
          review: ratingForm.review,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit rating");
      }

      setRatingConfirmation(data);
      setRatingOptions((current) =>
        current.filter(
          (option) => getRatingOptionKey(option) !== ratingForm.optionKey
        )
      );
      setRatingForm((current) => ({
        ...current,
        optionKey: "",
        review: "",
      }));
    } catch (ratingRequestError) {
      setRatingError(
        ratingRequestError.message || "Unable to submit rating. Please try again."
      );
    } finally {
      setRatingSubmitting(false);
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    if (!selectedPaymentBookingId) return;

    setPaymentSubmitting(true);
    setPaymentError("");
    setPaymentConfirmation(null);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: Number(selectedPaymentBookingId),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to process demo payment");
      }

      const remainingBookings = paymentOptions.filter(
        (option) => String(option.booking_id) !== selectedPaymentBookingId
      );
      setPaymentOptions(remainingBookings);
      setSelectedPaymentBookingId(
        remainingBookings.length ? String(remainingBookings[0].booking_id) : ""
      );
      setPaymentConfirmation(data);
    } catch (paymentRequestError) {
      setPaymentError(
        paymentRequestError.message || "Unable to process payment. Please try again."
      );
    } finally {
      setPaymentSubmitting(false);
    }
  }

  function selectRoute(route) {
    setPickup(route._id.pickup);
    setDrop(route._id.drop);
  }

  async function openRide(ride) {
    setSelectedRide(ride);
    setSelectedSeats(1);
    setBookingError("");
    setBookingConfirmation(null);
  }

  function closeRideModal() {
    if (bookingLoading) return;
    setSelectedRide(null);
    setBookingConfirmation(null);
    setBookingError("");
  }

  async function handleBooking() {
    if (!selectedRide) return;

    setBookingLoading(true);
    setBookingError("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
      await fetchUserData();
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

  const selectedPaymentBooking = paymentOptions.find(
    (option) => String(option.booking_id) === selectedPaymentBookingId
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  async function handleRequestSubmit(event) {
    event.preventDefault();
    setRequestSubmitting(true);
    setRequestError("");
    setRequestConfirmation(null);
    try {
      const response = await fetch("/api/ride-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestForm,
          pickupLocationId: Number(requestForm.pickupLocationId),
          dropLocationId: Number(requestForm.dropLocationId),
          seatsRequired: Number(requestForm.seatsRequired),
          maxDetourMinutes: Number(requestForm.maxDetourMinutes),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to request a ride");
      }

      async function handleCancelBooking(bookingId) {
        setCancellingBookingId(bookingId);
        setCancellationError("");
        try {
          const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Cancelled by passenger" }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Unable to cancel booking");
          await Promise.all([fetchUserData(), fetchPaymentOptions()]);
        } catch (error) {
          setCancellationError(error.message || "Unable to cancel booking");
        } finally {
          setCancellingBookingId(null);
        }
      }
      setRequestConfirmation(data);
      setRequestForm((value) => ({
        ...value,
        pickupLocationId: "",
        dropLocationId: "",
        requestedTime: "",
      }));
      await fetchUserData();
    } catch (error) {
      setRequestError(error.message || "Unable to request a ride");
    } finally {
      setRequestSubmitting(false);
    }
  }

  if (authLoading || !currentUser) {
    return (
      <main className="page-shell">
        <p className="booking-status">Checking your account...</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">R</span>
          <span>RideShare</span>
        </Link>
        <span className="topbar-label">CARPOOLING &amp; RIDE MATCHING</span>
        <div className="account-actions">
          <span>{currentUser.name} · {currentUser.role}</span>
          <button type="button" className="secondary-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
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

      <section className="search-panel request-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PASSENGER</p>
            <h2>Request a ride</h2>
          </div>
        </div>
        {locationsLoading && <p className="booking-status">Loading locations...</p>}
        {locationsError && <p className="error-note">{locationsError}</p>}
        <form className="offer-form" onSubmit={handleRequestSubmit}>
          <label className="field">
            <span>Pickup location</span>
            <select
              required
              value={requestForm.pickupLocationId}
              onChange={(event) =>
                setRequestForm((value) => ({
                  ...value,
                  pickupLocationId: event.target.value,
                }))
              }
            >
              <option value="">Select pickup</option>
              {locations.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {location.name} · {location.city}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Drop location</span>
            <select
              required
              value={requestForm.dropLocationId}
              onChange={(event) =>
                setRequestForm((value) => ({
                  ...value,
                  dropLocationId: event.target.value,
                }))
              }
            >
              <option value="">Select drop</option>
              {locations.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {location.name} · {location.city}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Requested date and time</span>
            <input
              type="datetime-local"
              required
              value={requestForm.requestedTime}
              onChange={(event) =>
                setRequestForm((value) => ({
                  ...value,
                  requestedTime: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Seats required</span>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={requestForm.seatsRequired}
              onChange={(event) =>
                setRequestForm((value) => ({
                  ...value,
                  seatsRequired: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Maximum detour (minutes)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={requestForm.maxDetourMinutes}
              onChange={(event) =>
                setRequestForm((value) => ({
                  ...value,
                  maxDetourMinutes: event.target.value,
                }))
              }
            />
          </label>
          <div className="offer-submit-row">
            {requestError && <p className="booking-error" role="alert">{requestError}</p>}
            {requestConfirmation && (
              <p className="booking-confirmation-note" role="status">
                Ride request #{requestConfirmation.rideRequestId} created.
              </p>
            )}
            <button
              type="submit"
              className="primary-button"
              disabled={requestSubmitting || locations.length < 2}
            >
              {requestSubmitting ? "Submitting request..." : "Request Ride"}
            </button>
          </div>
        </form>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR ACCOUNT</p>
            <h2>Your rides and bookings</h2>
          </div>
        </div>
        {userDataError && <p className="error-note">{userDataError}</p>}
        <div className="account-records">
          <div>
            <h3>Bookings</h3>
            {bookings.length === 0 ? (
              <p className="empty-note">No bookings yet.</p>
            ) : bookings.map((booking) => (
              <div className="record-row" key={booking.booking_id}>
                <p>
                  Booking #{booking.booking_id} · {booking.pickup} →{" "}
                  {booking.drop_location} · {booking.status}
                </p>
                {booking.status === "CONFIRMED" &&
                  booking.trip_status === "SCHEDULED" &&
                  !booking.has_paid && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={cancellingBookingId === booking.booking_id}
                      onClick={() => handleCancelBooking(booking.booking_id)}
                    >
                      {cancellingBookingId === booking.booking_id
                        ? "Cancelling..."
                        : "Cancel booking"}
                    </button>
                  )}
              </div>
            ))}
          </div>
          {cancellationError && (
            <p className="booking-error" role="alert">{cancellationError}</p>
          )}
          <div>
            <h3>Ride requests</h3>
            {rideRequests.length === 0 ? (
              <p className="empty-note">No ride requests yet.</p>
            ) : rideRequests.map((rideRequest) => (
              <p className="record-row" key={rideRequest.ride_request_id}>
                Request #{rideRequest.ride_request_id} · {rideRequest.pickup} →{" "}
                {rideRequest.drop_location} · {rideRequest.status}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ROUTES</p>
            <h2>Popular searches</h2>
          </div>
        </div>

        {popularRoutesError ? (
          <p className="error-note">{popularRoutesError}</p>
        ) : popularRoutes.length === 0 ? (
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

      <section className="search-panel payment-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DEMO CHECKOUT</p>
            <h2>Pay for a booking</h2>
          </div>
        </div>
        <p className="rating-description">
          Simulated payment only. No real payment gateway or charge is used.
        </p>

        {paymentOptionsLoading && (
          <p className="booking-status">Loading eligible bookings...</p>
        )}
        {paymentOptionsError && (
          <p className="error-note">{paymentOptionsError}</p>
        )}
        {paymentConfirmation && (
          <p className="booking-confirmation-note" role="status">
            Demo payment #{paymentConfirmation.paymentId} succeeded for booking #
            {paymentConfirmation.bookingId} (₹
            {Number(paymentConfirmation.amount).toFixed(2)}).
          </p>
        )}
        {!paymentOptionsLoading &&
          !paymentOptionsError &&
          paymentOptions.length === 0 && (
            <p className="empty-note">No unpaid eligible bookings are available.</p>
          )}

        {!paymentOptionsLoading &&
          !paymentOptionsError &&
          paymentOptions.length > 0 && (
            <form className="payment-form" onSubmit={handlePaymentSubmit}>
              <label className="field">
                <span>Eligible booking</span>
                <select
                  required
                  value={selectedPaymentBookingId}
                  disabled={paymentSubmitting}
                  onChange={(event) => {
                    setSelectedPaymentBookingId(event.target.value);
                    setPaymentError("");
                    setPaymentConfirmation(null);
                  }}
                >
                  {paymentOptions.map((option) => (
                    <option key={option.booking_id} value={option.booking_id}>
                      Booking #{option.booking_id} · {option.passenger_name} ·{" "}
                      {option.pickup} → {option.drop_location}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPaymentBooking && (
                <div className="payment-booking-summary">
                  <p>
                    <span>PASSENGER</span>
                    {selectedPaymentBooking.passenger_name}
                  </p>
                  <p>
                    <span>TRIP / SEATS</span>
                    #{selectedPaymentBooking.trip_id} ·{" "}
                    {selectedPaymentBooking.seats_booked}
                  </p>
                  <p>
                    <span>ROUTE</span>
                    {selectedPaymentBooking.pickup} →{" "}
                    {selectedPaymentBooking.drop_location}
                  </p>
                  <p>
                    <span>DEMO AMOUNT</span>
                    <strong>
                      ₹{Number(selectedPaymentBooking.amount).toFixed(2)}
                    </strong>
                  </p>
                </div>
              )}

              {paymentError && (
                <p className="booking-error" role="alert">
                  {paymentError}
                </p>
              )}
              <button
                type="submit"
                className="primary-button"
                disabled={
                  paymentSubmitting ||
                  !selectedPaymentBookingId ||
                  !selectedPaymentBooking
                }
              >
                {paymentSubmitting ? "Processing demo payment..." : "Pay Now"}
              </button>
            </form>
          )}
      </section>

      <section className="search-panel rating-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR FEEDBACK</p>
            <h2>Rate a ride participant</h2>
          </div>
        </div>
        <p className="rating-description">
          Ratings are available for active participants on completed rides.
        </p>

        {ratingOptionsLoading && (
          <p className="booking-status">Loading completed rides...</p>
        )}
        {ratingOptionsError && (
          <p className="error-note">{ratingOptionsError}</p>
        )}
        {ratingConfirmation && (
          <p className="booking-confirmation-note" role="status">
            Rating #{ratingConfirmation.ratingId} submitted successfully.
          </p>
        )}

        {!ratingOptionsLoading &&
          !ratingOptionsError &&
          ratingOptions.length === 0 && (
            <p className="empty-note">
              No unrated completed ride participants are available.
            </p>
          )}

        {!ratingOptionsLoading &&
          !ratingOptionsError &&
          ratingOptions.length > 0 && (
            <form className="rating-form" onSubmit={handleRatingSubmit}>
              <label className="field">
                <span>Completed trip and participant</span>
                <select
                  name="optionKey"
                  required
                  value={ratingForm.optionKey}
                  onChange={handleRatingFieldChange}
                >
                  <option value="">Select a completed trip</option>
                  {ratingOptions.map((option) => (
                    <option
                      key={getRatingOptionKey(option)}
                      value={getRatingOptionKey(option)}
                    >
                      Trip #{option.trip_id} · {option.rated_by_name} rates{" "}
                      {option.rated_to_name} · {option.pickup} →{" "}
                      {option.drop_location}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Rating</span>
                <select
                  name="ratingValue"
                  required
                  value={ratingForm.ratingValue}
                  onChange={handleRatingFieldChange}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} {value === 1 ? "star" : "stars"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field rating-review-field">
                <span>Review (optional)</span>
                <textarea
                  name="review"
                  maxLength={2000}
                  rows={3}
                  value={ratingForm.review}
                  onChange={handleRatingFieldChange}
                  placeholder="Share a few words about the ride"
                />
              </label>

              {ratingError && (
                <p className="booking-error" role="alert">
                  {ratingError}
                </p>
              )}
              <button
                type="submit"
                className="primary-button"
                disabled={ratingSubmitting || !ratingForm.optionKey}
              >
                {ratingSubmitting ? "Submitting rating..." : "Submit Rating"}
              </button>
            </form>
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
                  disabled={bookingLoading}
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