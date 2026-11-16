"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const blankVehicle = {
  licensePlate: "",
  vehicleType: "",
  seatingCapacity: "4",
  fuelType: "",
};
const blankOffer = {
  vehicleId: "",
  pickupLocationId: "",
  dropLocationId: "",
  departureTime: "",
  availableSeats: "1",
  costPerSeat: "",
};

export default function DriverDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [offers, setOffers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [ratingOptions, setRatingOptions] = useState([]);
  const [vehicleForm, setVehicleForm] = useState(blankVehicle);
  const [editingVehicleId, setEditingVehicleId] = useState("");
  const [offerForm, setOfferForm] = useState(blankOffer);
  const [ratingForm, setRatingForm] = useState({ optionKey: "", ratingValue: "5", review: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadDriverData() {
    const responses = await Promise.all([
      fetch("/api/vehicles"),
      fetch("/api/locations"),
      fetch("/api/ride-offers"),
      fetch("/api/bookings"),
      fetch("/api/ratings"),
    ]);
    const results = await Promise.all(responses.map((response) => response.json()));
    const failed = responses.findIndex((response) => !response.ok);
    if (failed >= 0) {
      throw new Error(results[failed].message || "Unable to load driver dashboard");
    }
    setVehicles(results[0]);
    setLocations(results[1]);
    setOffers(results[2].offers);
    setBookings(results[3]);
    setRatingOptions(results[4]);
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }
        if (!response.ok) throw new Error(data.message || "Unable to verify session");
        if (data.user.role !== "DRIVER") {
          window.location.replace(data.user.role === "ADMIN" ? "/admin" : "/");
          return;
        }
        if (active) setUser(data.user);
        await loadDriverData();
      } catch (loadError) {
        if (active) setError(loadError.message || "Unable to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    initialize();
    return () => {
      active = false;
    };
  }, []);

  async function sendMutation(url, method, body, successMessage) {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Request failed");
      setNotice(successMessage || data.message);
      await loadDriverData();
      return true;
    } catch (requestError) {
      setError(requestError.message || "Request failed");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVehicle(event) {
    event.preventDefault();
    const body = {
      ...vehicleForm,
      seatingCapacity: Number(vehicleForm.seatingCapacity),
    };
    const ok = await sendMutation(
      "/api/vehicles",
      editingVehicleId ? "PATCH" : "POST",
      editingVehicleId ? { ...body, vehicleId: Number(editingVehicleId) } : body,
      editingVehicleId ? "Vehicle updated" : "Vehicle registered"
    );
    if (ok) {
      setVehicleForm(blankVehicle);
      setEditingVehicleId("");
    }
  }

  async function submitOffer(event) {
    event.preventDefault();
    const ok = await sendMutation("/api/ride-offers", "POST", {
      ...offerForm,
      vehicleId: Number(offerForm.vehicleId),
      pickupLocationId: Number(offerForm.pickupLocationId),
      dropLocationId: Number(offerForm.dropLocationId),
      availableSeats: Number(offerForm.availableSeats),
    });
    if (ok) setOfferForm(blankOffer);
  }

  async function cancelOffer(rideOfferId) {
    await sendMutation(
      `/api/ride-offers/${rideOfferId}`,
      "PATCH",
      { status: "CANCELLED" },
      "Ride offer cancelled"
    );
  }

  async function removeVehicle(vehicleId) {
    await sendMutation(`/api/vehicles/${vehicleId}`, "DELETE", {});
  }

  function getRatingKey(option) {
    return `${option.trip_id}:${option.rated_to_id}`;
  }

  async function submitRating(event) {
    event.preventDefault();
    const [tripId, ratedToId] = ratingForm.optionKey.split(":").map(Number);
    const ok = await sendMutation("/api/ratings", "POST", {
      tripId,
      ratedToId,
      ratingValue: Number(ratingForm.ratingValue),
      review: ratingForm.review,
    }, "Passenger rating submitted");
    if (ok) setRatingForm({ optionKey: "", ratingValue: "5", review: "" });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return <main className="page-shell"><p className="booking-status">Loading driver dashboard...</p></main>;
  }

  return (
    <main className="page-shell admin-shell">
      <header className="topbar">
        <Link className="brand" href="/driver">
          <span className="brand-mark">R</span><span>RideShare</span>
        </Link>
        <span className="topbar-label">DRIVER DASHBOARD</span>
        {user && (
          <div className="account-actions">
            <span>{user.name} · DRIVER</span>
            <button type="button" className="secondary-button" onClick={logout}>Log out</button>
          </div>
        )}
      </header>

      <section className="hero admin-hero">
        <p className="eyebrow">DRIVER</p>
        <h1>Your rides.</h1>
      </section>
      {error && <p className="error-note" role="alert">{error}</p>}
      {notice && <p className="booking-confirmation-note" role="status">{notice}</p>}

      <section className="search-panel driver-panel">
        <div className="section-heading">
          <div><p className="eyebrow">VEHICLES</p><h2>Manage your vehicles</h2></div>
        </div>
        <form className="offer-form" onSubmit={submitVehicle}>
          <label className="field"><span>License plate</span><input required maxLength={20} value={vehicleForm.licensePlate} onChange={(event) => setVehicleForm({ ...vehicleForm, licensePlate: event.target.value })} /></label>
          <label className="field"><span>Vehicle type</span><input required maxLength={50} value={vehicleForm.vehicleType} onChange={(event) => setVehicleForm({ ...vehicleForm, vehicleType: event.target.value })} /></label>
          <label className="field"><span>Seating capacity</span><input type="number" min="1" max="1000" required value={vehicleForm.seatingCapacity} onChange={(event) => setVehicleForm({ ...vehicleForm, seatingCapacity: event.target.value })} /></label>
          <label className="field"><span>Fuel type</span><input maxLength={30} value={vehicleForm.fuelType} onChange={(event) => setVehicleForm({ ...vehicleForm, fuelType: event.target.value })} /></label>
          <div className="offer-submit-row">
            <button type="submit" className="primary-button" disabled={submitting}>
              {editingVehicleId ? "Update vehicle" : "Register vehicle"}
            </button>
            {editingVehicleId && <button type="button" className="secondary-button" onClick={() => { setEditingVehicleId(""); setVehicleForm(blankVehicle); }}>Stop editing</button>}
          </div>
        </form>
        <div className="driver-list">
          {vehicles.length === 0 ? <p className="empty-note">No vehicles registered.</p> : vehicles.map((vehicle) => (
            <div className="driver-list-row" key={vehicle.vehicle_id}>
              <span>{vehicle.license_plate} · {vehicle.vehicle_type} · {vehicle.seating_capacity} seats · {vehicle.fuel_type || "Fuel unspecified"}</span>
              <div>
                <button type="button" className="secondary-button" onClick={() => {
                  setEditingVehicleId(String(vehicle.vehicle_id));
                  setVehicleForm({
                    licensePlate: vehicle.license_plate,
                    vehicleType: vehicle.vehicle_type,
                    seatingCapacity: String(vehicle.seating_capacity),
                    fuelType: vehicle.fuel_type || "",
                  });
                }}>Edit</button>
                <button type="button" className="secondary-button" disabled={submitting} onClick={() => removeVehicle(vehicle.vehicle_id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="search-panel driver-panel">
        <div className="section-heading">
          <div><p className="eyebrow">RIDE OFFERS</p><h2>Create a ride offer</h2></div>
        </div>
        {vehicles.length === 0 ? <p className="empty-note">Register a vehicle before creating a ride offer.</p> : (
          <form className="offer-form" onSubmit={submitOffer}>
            <label className="field"><span>Vehicle</span><select required value={offerForm.vehicleId} onChange={(event) => setOfferForm({ ...offerForm, vehicleId: event.target.value })}><option value="">Select vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.license_plate} · {vehicle.seating_capacity} seats</option>)}</select></label>
            <label className="field"><span>Pickup location</span><select required value={offerForm.pickupLocationId} onChange={(event) => setOfferForm({ ...offerForm, pickupLocationId: event.target.value })}><option value="">Select pickup</option>{locations.map((location) => <option key={location.location_id} value={location.location_id}>{location.name} · {location.city}</option>)}</select></label>
            <label className="field"><span>Drop location</span><select required value={offerForm.dropLocationId} onChange={(event) => setOfferForm({ ...offerForm, dropLocationId: event.target.value })}><option value="">Select drop</option>{locations.map((location) => <option key={location.location_id} value={location.location_id}>{location.name} · {location.city}</option>)}</select></label>
            <label className="field"><span>Departure</span><input type="datetime-local" required value={offerForm.departureTime} onChange={(event) => setOfferForm({ ...offerForm, departureTime: event.target.value })} /></label>
            <label className="field"><span>Available seats</span><input type="number" min="1" required value={offerForm.availableSeats} onChange={(event) => setOfferForm({ ...offerForm, availableSeats: event.target.value })} /></label>
            <label className="field"><span>Cost per seat (₹)</span><input type="number" min="0" max="99999999.99" step="0.01" required value={offerForm.costPerSeat} onChange={(event) => setOfferForm({ ...offerForm, costPerSeat: event.target.value })} /></label>
            <div className="offer-submit-row"><button type="submit" className="primary-button" disabled={submitting || locations.length < 2}>Create offer</button></div>
          </form>
        )}
      </section>

      <AdminTable title="Your ride offers and trips" headers={["Route", "Departure", "Seats", "Offer status", "Trip", "Actions"]}>
        {offers.map((offer) => (
          <tr key={offer.ride_offer_id}>
            <td>{offer.pickup} → {offer.drop_location}</td>
            <td>{new Date(offer.departure_time).toLocaleString()}</td>
            <td>{offer.available_seats}</td>
            <td>{offer.status}</td>
            <td>#{offer.trip_id} · {offer.trip_status}</td>
            <td>{["OPEN", "FULL"].includes(offer.status) && offer.trip_status === "SCHEDULED" && <button type="button" className="secondary-button" disabled={submitting} onClick={() => cancelOffer(offer.ride_offer_id)}>Cancel offer</button>}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable title="Passengers on your rides" headers={["Booking", "Passenger", "Route", "Seats", "Trip", "Status"]}>
        {bookings.map((booking) => (
          <tr key={booking.booking_id}>
            <td>#{booking.booking_id}</td>
            <td>{booking.passenger_name}</td>
            <td>{booking.pickup} → {booking.drop_location}</td>
            <td>{booking.seats_booked}</td>
            <td>#{booking.trip_id} · {booking.trip_status}</td>
            <td>{booking.status}</td>
          </tr>
        ))}
      </AdminTable>

      <section className="search-panel driver-panel">
        <div className="section-heading">
          <div><p className="eyebrow">FEEDBACK</p><h2>Rate passengers on completed trips</h2></div>
        </div>
        {ratingOptions.length === 0 ? <p className="empty-note">No unrated passengers on completed trips.</p> : (
          <form className="rating-form" onSubmit={submitRating}>
            <label className="field"><span>Trip and passenger</span><select required value={ratingForm.optionKey} onChange={(event) => setRatingForm({ ...ratingForm, optionKey: event.target.value })}><option value="">Select passenger</option>{ratingOptions.map((option) => <option key={getRatingKey(option)} value={getRatingKey(option)}>Trip #{option.trip_id} · {option.rated_to_name}</option>)}</select></label>
            <label className="field"><span>Rating</span><select value={ratingForm.ratingValue} onChange={(event) => setRatingForm({ ...ratingForm, ratingValue: event.target.value })}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select></label>
            <label className="field rating-review-field"><span>Review (optional)</span><textarea maxLength={2000} value={ratingForm.review} onChange={(event) => setRatingForm({ ...ratingForm, review: event.target.value })} /></label>
            <button type="submit" className="primary-button" disabled={submitting || !ratingForm.optionKey}>Submit rating</button>
          </form>
        )}
      </section>
    </main>
  );
}

function AdminTable({ title, headers, children }) {
  return (
    <section className="admin-table-section">
      <h2>{title}</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
