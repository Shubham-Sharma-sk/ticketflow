import "./SeatDashboardView.css";

export default function SeatDashboardView({
  seatsCount,
  availableCount,
  bookedCount,
  IconComponent,
  onQuickAction,
}) {
  return (
    <>
      <div className="sdv-overview-row">
        <div className="sdv-overview-card">
          <div className="sdv-overview-icon">
            <IconComponent type="dashboard" />
          </div>
          <div>
            <p>Total Seats</p>
            <h3>{seatsCount}</h3>
          </div>
        </div>
        <div className="sdv-overview-card">
          <div className="sdv-overview-icon">
            <IconComponent type="summary" />
          </div>
          <div>
            <p>Available Now</p>
            <h3>{availableCount}</h3>
          </div>
        </div>
        <div className="sdv-overview-card">
          <div className="sdv-overview-icon">
            <IconComponent type="reports" />
          </div>
          <div>
            <p>Booked</p>
            <h3>{bookedCount}</h3>
          </div>
        </div>
      </div>

      <div className="sdv-live-strip">
        <span className="sdv-live-dot" />
        Real-time updates are active
      </div>

      <div className="sdv-quick-actions-card">
        <h3>Quick Actions</h3>
        <div className="sdv-quick-actions-grid">
          <button
            className="sdv-quick-action-item sdv-quick-action-item--booking"
            type="button"
            onClick={() => onQuickAction("booking")}
          >
            <span className="sdv-quick-action-icon">
              <IconComponent type="booking" />
            </span>
            <p>Book Seat</p>
          </button>
          <button
            className="sdv-quick-action-item sdv-quick-action-item--summary"
            type="button"
            onClick={() => onQuickAction("reports")}
          >
            <span className="sdv-quick-action-icon">
              <IconComponent type="summary" />
            </span>
            <p>Seat Summary</p>
          </button>
          <button
            className="sdv-quick-action-item sdv-quick-action-item--reports"
            type="button"
            onClick={() => onQuickAction("reports")}
          >
            <span className="sdv-quick-action-icon">
              <IconComponent type="reports" />
            </span>
            <p>Check Reports</p>
          </button>
          <button
            className="sdv-quick-action-item sdv-quick-action-item--support"
            type="button"
            onClick={() => onQuickAction("myBookings")}
          >
            <span className="sdv-quick-action-icon">
              <IconComponent type="profile" />
            </span>
            <p>My Bookings</p>
          </button>
        </div>
      </div>

      <div className="sdv-stats-grid">
        <div className="sdv-stat-card">
          <span>Total Seats</span>
          <strong>{seatsCount}</strong>
        </div>
        <div className="sdv-stat-card">
          <span>Available</span>
          <strong>{availableCount}</strong>
        </div>
        <div className="sdv-stat-card">
          <span>Booked</span>
          <strong>{bookedCount}</strong>
        </div>
      </div>
    </>
  );
}
