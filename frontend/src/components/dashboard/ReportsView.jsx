import "./ReportsView.css";

export default function ReportsView({ seatsCount, availableCount, bookedCount }) {
  const availablePercent = seatsCount ? Math.round((availableCount / seatsCount) * 100) : 0;
  const bookedPercent = seatsCount ? Math.round((bookedCount / seatsCount) * 100) : 0;

  return (
    <section className="rv-wrap">
      <div className="rv-info-card">
        <h3>Seat Summary</h3>
        <div className="rv-summary-chips">
          <span className="rv-summary-chip">
            Total <strong>{seatsCount}</strong>
          </span>
          <span className="rv-summary-chip rv-summary-chip--booked">
            Booked <strong>{bookedCount}</strong>
          </span>
          <span className="rv-summary-chip rv-summary-chip--available">
            Available <strong>{availableCount}</strong>
          </span>
        </div>
      </div>

      <div className="rv-charts">
        <div className="rv-chart-card">
          <h4>Occupancy (Bar)</h4>
          <div className="rv-bar-row">
            <span>Booked</span>
            <div className="rv-bar-track">
              <div className="rv-bar rv-bar--booked" style={{ width: `${bookedPercent}%` }} />
            </div>
            <strong>{bookedPercent}%</strong>
          </div>
          <div className="rv-bar-row">
            <span>Available</span>
            <div className="rv-bar-track">
              <div className="rv-bar rv-bar--available" style={{ width: `${availablePercent}%` }} />
            </div>
            <strong>{availablePercent}%</strong>
          </div>
        </div>

        <div className="rv-chart-card">
          <h4>Seat Breakdown</h4>
          <div className="rv-donut-wrap">
            <div
              className="rv-donut"
              style={{
                background: `conic-gradient(#ef4444 0% ${bookedPercent}%, #10b981 ${bookedPercent}% 100%)`,
              }}
            >
              <div className="rv-donut-hole">{bookedPercent}%</div>
            </div>
            <div className="rv-legend">
              <p>
                <span className="rv-dot rv-dot--booked" /> Booked ({bookedCount})
              </p>
              <p>
                <span className="rv-dot rv-dot--available" /> Available ({availableCount})
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
