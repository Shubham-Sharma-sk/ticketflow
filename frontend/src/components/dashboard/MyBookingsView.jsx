import { useEffect, useState } from "react";
import "./MyBookingsView.css";

const VIEW_MODE_STORAGE_KEY = "ticketflow.myBookings.viewMode.v2";

export default function MyBookingsView({ seats, isCancelling, onCancelSeat }) {
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(VIEW_MODE_STORAGE_KEY) || "grid");

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  if (!seats.length) {
    return (
      <div className="mbv-empty-card">
        <h3>No bookings yet</h3>
        <p>You have not booked any seats. Open Booking Panel to reserve one.</p>
      </div>
    );
  }

  return (
    <div className="mbv-wrap">
      <div className="mbv-toolbar">
        <div className="mbv-view-toggle">
          <button
            type="button"
            className={`mbv-toggle-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            List
          </button>
          <button
            type="button"
            className={`mbv-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            Grid
          </button>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="mbv-list-table">
          <div className="mbv-list-head">
            <span>Seat</span>
            <span>Booked At</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {seats.map((seat) => (
            <div key={seat.id} className="mbv-list-row">
              <div className="mbv-cell-primary">
                <strong>{seat.seatNumber}</strong>
                <p>Ticket booking</p>
              </div>
              <span className="mbv-cell-time">{seat.bookedAt ? new Date(seat.bookedAt).toLocaleString() : "N/A"}</span>
              <span className="mbv-badge">Booked</span>
              <button
                type="button"
                className="mbv-cancel-btn mbv-cancel-btn--list"
                disabled={isCancelling}
                onClick={() => onCancelSeat(seat.id)}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mbv-grid">
          {seats.map((seat) => (
            <div key={seat.id} className="mbv-card">
              <div className="mbv-card-head">
                <h3>{seat.seatNumber}</h3>
                <span className="mbv-badge">Booked</span>
              </div>
              <p>Booked at: {seat.bookedAt ? new Date(seat.bookedAt).toLocaleString() : "N/A"}</p>
              <button
                type="button"
                className="mbv-cancel-btn"
                disabled={isCancelling}
                onClick={() => onCancelSeat(seat.id)}
              >
                Cancel Booking
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
