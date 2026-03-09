import "./SeatSummaryView.css";

export default function SeatSummaryView({ seatsCount, availableCount, bookedCount }) {
  return (
    <div className="ssv-stats-grid">
      <div className="ssv-stat-card">
        <span>Total Seats</span>
        <strong>{seatsCount}</strong>
      </div>
      <div className="ssv-stat-card">
        <span>Available</span>
        <strong>{availableCount}</strong>
      </div>
      <div className="ssv-stat-card">
        <span>Booked</span>
        <strong>{bookedCount}</strong>
      </div>
    </div>
  );
}
