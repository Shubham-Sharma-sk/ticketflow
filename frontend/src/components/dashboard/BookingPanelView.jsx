import { useEffect, useMemo, useState } from "react";
import "./BookingPanelView.css";
import DropdownSelect from "../common/DropdownSelect";
import busSeatPhoto from "../../assets/seat-photo.svg";
import cinemaSeatPhoto from "../../assets/seat-photo-cinema.svg";
import flightSeatPhoto from "../../assets/seat-photo-flight.svg";

const THEME_IMAGE_MAP = {
  bus: busSeatPhoto,
  cinema: cinemaSeatPhoto,
  flight: flightSeatPhoto,
};

const BOOKING_PANEL_VIEW_KEY = "ticketflow.bookingPanelView";

const getSeatVisualTheme = (seatNumber) => {
  const normalized = String(seatNumber || "").toUpperCase();
  const prefix = (normalized.match(/^[A-Z-]+/)?.[0] || "").replace(/-+$/, "");

  if (prefix.startsWith("VIP") || prefix.startsWith("F") || prefix.startsWith("AIR")) {
    return "flight";
  }
  if (prefix.startsWith("C") || prefix.startsWith("MOV") || prefix.startsWith("THE")) {
    return "cinema";
  }
  return "bus";
};

export default function BookingPanelView({
  seats,
  currentUsername,
  currentUserId,
  activeSeatId,
  isActionLoading,
  onHoldSeat,
  onBookSeat,
  onCancelSeat,
}) {
  const isMobileViewport =
    typeof window !== "undefined" ? window.matchMedia("(max-width: 720px)").matches : false;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("seat-asc");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(BOOKING_PANEL_VIEW_KEY) || (isMobileViewport ? "list" : "grid"));

  useEffect(() => {
    localStorage.setItem(BOOKING_PANEL_VIEW_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const handleViewportChange = (event) => {
      if (event.matches) {
        setViewMode((prev) => (prev === "grid" ? "list" : prev));
      }
    };

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  const filteredSeats = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = seats.filter((seat) => {
      const matchesQuery = !q || seat.seatNumber.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && !seat.isBooked) ||
        (statusFilter === "booked" && seat.isBooked);
      return matchesQuery && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "seat-desc") return b.seatNumber.localeCompare(a.seatNumber);
      if (sortBy === "status") return Number(a.isBooked) - Number(b.isBooked);
      return a.seatNumber.localeCompare(b.seatNumber);
    });

    return list;
  }, [seats, searchTerm, statusFilter, sortBy]);

  const availableCount = filteredSeats.filter((seat) => !seat.isBooked).length;
  const bookedCount = filteredSeats.length - availableCount;

  return (
    <>
      <div className="bp-toolbar">
        <input
          type="text"
          className="bp-search"
          placeholder="Search by seat number or username..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <DropdownSelect
          className="bp-dropdown"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All Status" },
            { value: "available", label: "Available" },
            { value: "booked", label: "Booked" },
          ]}
        />
        <DropdownSelect
          className="bp-dropdown"
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: "seat-asc", label: "Seat A-Z" },
            { value: "seat-desc", label: "Seat Z-A" },
            { value: "status", label: "Available First" },
          ]}
        />
        <div className="bp-view-toggle">
          <button
            type="button"
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => setViewMode("grid")}
          >
            Grid
          </button>
          <button
            type="button"
            className={viewMode === "list" ? "active" : ""}
            onClick={() => setViewMode("list")}
          >
            List
          </button>
        </div>
      </div>

      <div className="bp-result-meta">
        <span>{filteredSeats.length} seats</span>
        <span>{availableCount} available</span>
        <span>{bookedCount} booked</span>
      </div>

      {filteredSeats.length === 0 ? (
        <div className="bp-empty-card">
          <h3>No seats found</h3>
          <p>Try changing filters or search text.</p>
        </div>
      ) : (
        <div className={viewMode === "grid" ? "bp-seat-grid" : "bp-seat-list"}>
          {filteredSeats.map((seat) => {
            const isSeatHeld = !seat.isBooked && seat.isHeld;
            const seatTheme = getSeatVisualTheme(seat.seatNumber);
            const seatVisualImage = THEME_IMAGE_MAP[seatTheme];
            return (
              <div
                key={seat.id}
                className={`bp-seat-card ${seat.isBooked ? "booked" : isSeatHeld ? "hold" : "available"}`}
              >
                {(() => {
                const isOwnedByCurrentUser =
                  seat.isBooked &&
                  ((seat.bookedById && currentUserId && seat.bookedById === currentUserId) ||
                    (!seat.bookedById && seat.bookedBy === currentUsername));
                const isHeldByMe =
                  isSeatHeld &&
                  ((seat.heldById && currentUserId && seat.heldById === currentUserId) ||
                    (!seat.heldById && seat.heldBy === currentUsername));
                const isHeldByOther = isSeatHeld && !isHeldByMe;
                const isSeatBusy = isActionLoading && activeSeatId === seat.id;
                const holdExpiryText =
                  seat.holdExpiresAt && seat.isHeld
                    ? `Hold expires at ${new Date(seat.holdExpiresAt).toLocaleTimeString()}`
                    : "";

                return (
                  <>
                    <div className={`bp-seat-visual bp-seat-visual--${seatTheme}`}>
                      <img src={seatVisualImage} alt={`${seatTheme} seat layout`} className="bp-seat-visual-image" />
                      <span className="bp-seat-theme">{seatTheme}</span>
                    </div>
                    <div className="bp-seat-content">
                      <div className="bp-seat-card-head">
                        <h3>{seat.seatNumber}</h3>
                        <span
                          className={`bp-status-badge ${
                            seat.isBooked ? "status-booked" : isSeatHeld ? "status-hold" : "status-available"
                          }`}
                        >
                          {seat.isBooked ? "Booked" : isSeatHeld ? "On Hold" : "Available"}
                        </span>
                      </div>
                      <p className={isHeldByMe || isHeldByOther ? "bp-hold-text" : ""}>
                        {seat.isBooked
                          ? "This seat is already booked"
                          : isHeldByMe
                            ? holdExpiryText || "Seat is on your hold"
                            : isHeldByOther
                              ? "Seat is currently on hold"
                              : "Ready to hold"}
                      </p>
                    </div>
                    <div className="bp-seat-action">
                      {isOwnedByCurrentUser ? (
                        <button
                          type="button"
                          disabled={isSeatBusy}
                          onClick={() => onCancelSeat(seat.id)}
                          className="bp-cancel-btn"
                        >
                          Cancel Booking
                        </button>
                      ) : isHeldByMe ? (
                        <button type="button" disabled={isSeatBusy} onClick={() => onBookSeat(seat.id)} className="bp-book-btn">
                          Confirm Booking
                        </button>
                      ) : (
                        <button
                          disabled={seat.isBooked || isHeldByOther || isSeatBusy}
                          onClick={() => onHoldSeat(seat.id)}
                          className={seat.isBooked || isHeldByOther ? "bp-booked-btn" : "bp-book-btn"}
                        >
                          {seat.isBooked ? "Booked" : isHeldByOther ? "On Hold" : "Hold Seat"}
                        </button>
                      )}
                    </div>
                  </>
                );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
