
"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [rides, setRides] = useState([]);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


async function fetchRides() {
  setLoading(true);
  setError("");

  try {
    const params = new URLSearchParams({
      pickup: pickup,
      drop: drop,
    });

    const response = await fetch(`/api/rides?${params}`);

    if (!response.ok) {
      throw new Error("Failed to load rides");
    }

    const data = await response.json();
    setRides(data);
  } catch (error) {
    setError("Unable to load rides. Please try again.");
  } finally {
    setLoading(false);
  }
}


  async function fetchPopularRoutes() {
    const response = await fetch("/api/popular-routes");
    const data = await response.json();
    setPopularRoutes(data);
  }

  useEffect(() => {
    fetchRides();
    fetchPopularRoutes();
  }, []);

  async function handleSearch(event) {
    event.preventDefault();

    await fetch("/api/ride-activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pickup,
        drop,
        seatsRequired: 1,
      }),
    });

    await fetchRides();
    await fetchPopularRoutes();
  }

  function handleReset() {
    setPickup("");
    setDrop("");

    fetch("/api/rides")
      .then((response) => response.json())
      .then((data) => setRides(data));
  }

  return (
    <main style={{ padding: "30px", fontFamily: "Arial" }}>
      <h1>Carpooling System</h1>

      <h2>Search Available Rides</h2>

      <form onSubmit={handleSearch} style={{ marginBottom: "25px" }}>
        <input
          placeholder="Pickup location"
          value={pickup}
          onChange={(event) => setPickup(event.target.value)}
          style={{ padding: "10px", marginRight: "10px" }}
        />

        <input
          placeholder="Drop location"
          value={drop}
          onChange={(event) => setDrop(event.target.value)}
          style={{ padding: "10px", marginRight: "10px" }}
        />

        <button type="submit" style={{ padding: "10px" }}>
          Search
        </button>

        <button
          type="button"
          onClick={handleReset}
          style={{ padding: "10px", marginLeft: "10px" }}
        >
          Reset
        </button>
      </form>

      <h2>Popular Routes</h2>

      {popularRoutes.length === 0 && <p>No route activity yet.</p>}

      {popularRoutes.map((route, index) => (
        <p key={index}>
          {route._id.pickup} → {route._id.drop} (
          {route.searchCount} searches)
        </p>
      ))}

      <h2>Available Rides</h2>

      
{loading && <p>Loading rides...</p>}

{!loading && error && (
  <p style={{ color: "red" }}>{error}</p>
)}

{!loading && !error && rides.length === 0 && (
  <p>No available rides found.</p>
)}

{!loading &&
  !error &&
  rides.map((ride) => (
    <div
      key={ride.ride_offer_id}
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "15px",
        maxWidth: "500px",
      }}
    >
      <h3>
        {ride.pickup} → {ride.drop_location}
      </h3>
      <p>Driver: {ride.driver_name}</p>
      <p>
        Departure: {new Date(ride.departure_time).toLocaleString()}
      </p>
      <p>Available seats: {ride.available_seats}</p>
      <p>Cost per seat: ₹{ride.cost_per_seat}</p>
    </div>
  ))}

    </main>
  );
}
