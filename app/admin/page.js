"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const emptyData = {
  users: [],
  offers: [],
  bookings: [],
  payments: [],
  rideRequests: [],
  ratings: [],
  activity: { count: 0, recent: [] },
  popularRoutes: [],
  analyticsError: null,
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const loadDashboard = useCallback(async () => {
    const response = await fetch("/api/admin");
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to load dashboard");
    setData(result);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const sessionResponse = await fetch("/api/auth/me");
        if (sessionResponse.status === 401) {
          window.location.replace("/login");
          return;
        }
        const session = await sessionResponse.json();
        if (!sessionResponse.ok) throw new Error(session.message || "Unable to verify session");
        if (!active) return;
        setUser(session.user);
        if (session.user.role !== "ADMIN") {
          setError("Administrator access is required.");
          return;
        }
        await loadDashboard();
      } catch (dashboardError) {
        if (active) setError(dashboardError.message || "Unable to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    initialize();
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  async function updateUser(account) {
    setUpdatingUserId(account.user_id);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${account.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: account.role,
          isActive: Boolean(account.is_active),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to update user");
      await loadDashboard();
    } catch (updateError) {
      setError(updateError.message || "Unable to update user access");
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return <main className="page-shell"><p className="booking-status">Loading admin dashboard...</p></main>;
  }

  return (
    <main className="page-shell admin-shell">
      <header className="topbar">
        <Link className="brand" href="/admin">
          <span className="brand-mark">R</span>
          <span>RideShare</span>
        </Link>
        <span className="topbar-label">ADMIN DASHBOARD</span>
        {user && (
          <div className="account-actions">
            <span>{user.name} · {user.role}</span>
            <button type="button" className="secondary-button" onClick={logout}>Log out</button>
          </div>
        )}
      </header>

      <section className="hero admin-hero">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>System overview.</h1>
      </section>

      {error && <p className="error-note" role="alert">{error}</p>}
      {user?.role === "ADMIN" && (
        <>
          {data.analyticsError && (
            <p className="error-note" role="status">{data.analyticsError}</p>
          )}
          <section className="admin-grid">
            <div className="admin-stat"><span>USERS</span><strong>{data.users.length}</strong></div>
            <div className="admin-stat"><span>RIDE OFFERS</span><strong>{data.offers.length}</strong></div>
            <div className="admin-stat"><span>BOOKINGS</span><strong>{data.bookings.length}</strong></div>
            <div className="admin-stat"><span>PAYMENTS</span><strong>{data.payments.length}</strong></div>
          </section>

          <AdminTable title="Users" headers={["Name", "Email", "Role", "Active", "Access"]}>
            {data.users.map((account) => (
              <tr key={account.user_id}>
                <td>{account.name}</td>
                <td>{account.email}</td>
                <td>
                  <select
                    value={account.role}
                    disabled={account.user_id === user.user_id}
                    onChange={(event) => {
                      const role = event.target.value;
                      setData((current) => ({
                        ...current,
                        users: current.users.map((row) =>
                          row.user_id === account.user_id ? { ...row, role } : row
                        ),
                      }));
                    }}
                  >
                    <option value="PASSENGER">PASSENGER</option>
                    <option value="DRIVER">DRIVER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(account.is_active)}
                    disabled={account.user_id === user.user_id}
                    aria-label={`Active status for ${account.name}`}
                    onChange={(event) => {
                      const is_active = event.target.checked;
                      setData((current) => ({
                        ...current,
                        users: current.users.map((row) =>
                          row.user_id === account.user_id ? { ...row, is_active } : row
                        ),
                      }));
                    }}
                  />
                </td>
                <td>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={updatingUserId === account.user_id}
                    onClick={() => updateUser(account)}
                  >
                    {updatingUserId === account.user_id ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>

          <AdminTable title="Ride offers" headers={["Driver", "Route", "Departure", "Seats", "Status"]}>
            {data.offers.map((offer) => (
              <tr key={offer.ride_offer_id}>
                <td>{offer.driver_name}</td>
                <td>{offer.pickup} → {offer.drop_location}</td>
                <td>{new Date(offer.departure_time).toLocaleString()}</td>
                <td>{offer.available_seats}</td>
                <td>{offer.status}</td>
              </tr>
            ))}
          </AdminTable>

          <AdminTable title="Bookings" headers={["Booking", "Passenger", "Driver", "Route", "Status"]}>
            {data.bookings.map((booking) => (
              <tr key={booking.booking_id}>
                <td>#{booking.booking_id}</td>
                <td>{booking.passenger_name}</td>
                <td>{booking.driver_name}</td>
                <td>{booking.pickup} → {booking.drop_location}</td>
                <td>{booking.status}</td>
              </tr>
            ))}
          </AdminTable>

          <AdminTable title="Payments" headers={["Payment", "Booking", "Payer", "Amount", "Status"]}>
            {data.payments.map((payment) => (
              <tr key={payment.payment_id}>
                <td>#{payment.payment_id}</td>
                <td>#{payment.booking_id}</td>
                <td>{payment.payer_name}</td>
                <td>₹{Number(payment.amount).toFixed(2)}</td>
                <td>{payment.payment_status}</td>
              </tr>
            ))}
          </AdminTable>

          <AdminTable title="Ride requests" headers={["Passenger", "Route", "Requested", "Seats", "Status"]}>
            {data.rideRequests.map((rideRequest) => (
              <tr key={rideRequest.ride_request_id}>
                <td>{rideRequest.passenger_name}</td>
                <td>{rideRequest.pickup} → {rideRequest.drop_location}</td>
                <td>{new Date(rideRequest.requested_time).toLocaleString()}</td>
                <td>{rideRequest.seats_required}</td>
                <td>{rideRequest.status}</td>
              </tr>
            ))}
          </AdminTable>

          <AdminTable title="Ratings" headers={["Trip", "From", "To", "Rating", "Review"]}>
            {data.ratings.map((rating) => (
              <tr key={rating.rating_id}>
                <td>#{rating.trip_id}</td>
                <td>{rating.author_name}</td>
                <td>{rating.recipient_name}</td>
                <td>{rating.rating_value}/5</td>
                <td>{rating.review || "—"}</td>
              </tr>
            ))}
          </AdminTable>

          <AdminTable title="Popular routes" headers={["Route", "Searches"]}>
            {data.popularRoutes.map((route, index) => (
              <tr key={`${route._id.pickup}-${route._id.drop}-${index}`}>
                <td>{route._id.pickup} → {route._id.drop}</td>
                <td>{route.searchCount}</td>
              </tr>
            ))}
          </AdminTable>

          <AdminTable
            title={`Recent activity (${data.activity.count} total)`}
            headers={["Type", "Route", "User ID", "Created"]}
          >
            {data.activity.recent.map((activity, index) => (
              <tr key={`${activity.createdAt}-${index}`}>
                <td>{activity.activityType}</td>
                <td>{activity.pickup || "—"}{activity.drop ? ` → ${activity.drop}` : ""}</td>
                <td>{activity.userId || "—"}</td>
                <td>{activity.createdAt ? new Date(activity.createdAt).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </AdminTable>
        </>
      )}
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
