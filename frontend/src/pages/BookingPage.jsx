import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useDispatch, useSelector } from "react-redux";
import {
  api,
  useBookSeatMutation,
  useHoldSeatMutation,
  useGetMySeatsQuery,
  useGetSeatsQuery,
  useGetAdminUsersQuery,
  useCreateAdminUserMutation,
  useLogoutMutation,
  useUpdateUserRoleMutation,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useResetAllSeatsMutation,
  useCreateSeatsMutation,
  useUnbookSeatMutation,
} from "../services/api";
import { logout } from "../features/auth/authSlice";
import SeatDashboardView from "../components/dashboard/SeatDashboardView";
import BookingPanelView from "../components/dashboard/BookingPanelView";
import ReportsView from "../components/dashboard/ReportsView";
import MyBookingsView from "../components/dashboard/MyBookingsView";
import AdminView from "../components/dashboard/AdminView";

const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
const ACTIVE_VIEW_STORAGE_KEY = "ticketflow.activeView";

function SidebarIcon({ type }) {
  if (type === "dashboard") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="3" width="6" height="6" rx="1.5" />
        <rect x="11" y="3" width="6" height="6" rx="1.5" />
        <rect x="3" y="11" width="6" height="6" rx="1.5" />
        <rect x="11" y="11" width="6" height="6" rx="1.5" />
      </svg>
    );
  }

  if (type === "booking") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 7h12v7H4z" />
        <path d="M7 5v2M13 5v2M4 10h12" />
      </svg>
    );
  }

  if (type === "summary") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="4" y="4" width="12" height="12" rx="2" />
        <path d="M7 8h6M7 11h6M7 14h4" />
      </svg>
    );
  }

  if (type === "reports") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 16h12" />
        <rect x="5" y="10" width="2.5" height="6" rx="0.8" />
        <rect x="9" y="7" width="2.5" height="9" rx="0.8" />
        <rect x="13" y="5" width="2.5" height="11" rx="0.8" />
      </svg>
    );
  }

  if (type === "support") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 11V9a5 5 0 0 1 10 0v2" />
        <rect x="4" y="10.5" width="2.2" height="4" rx="1" />
        <rect x="13.8" y="10.5" width="2.2" height="4" rx="1" />
        <path d="M13.8 14.5c0 1.2-1.3 2-2.8 2H9.7" />
      </svg>
    );
  }

  if (type === "profile") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="7" r="3" />
        <path d="M4.5 16a5.5 5.5 0 0 1 11 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.8 5.5H7.5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h5.3" />
      <path d="M11 10h6M14.5 7.5l2.5 2.5-2.5 2.5" />
    </svg>
  );
}

export default function BookingPage() {
  const dispatch = useDispatch();
  const refreshToken = useSelector((state) => state.auth.refreshToken);
  const authUser = useSelector((state) => state.auth.user);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetSeatsQuery();
  const { data: myData, refetch: refetchMySeats } = useGetMySeatsQuery();
  const { data: adminUsersData, isFetching: isAdminUsersFetching, refetch: refetchAdminUsers } = useGetAdminUsersQuery(
    undefined,
    {
      skip: authUser?.role !== "admin",
    }
  );
  const [updateUserRole, { isLoading: isUpdatingRole }] = useUpdateUserRoleMutation();
  const [updateAdminUser, { isLoading: isEditingUser }] = useUpdateAdminUserMutation();
  const [createAdminUser, { isLoading: isCreatingUser }] = useCreateAdminUserMutation();
  const [deleteAdminUser, { isLoading: isDeletingUser }] = useDeleteAdminUserMutation();
  const [resetAllSeats, { isLoading: isResettingSeats }] = useResetAllSeatsMutation();
  const [createSeats, { isLoading: isCreatingSeats }] = useCreateSeatsMutation();
  const [holdSeat, { isLoading: isHolding }] = useHoldSeatMutation();
  const [bookSeat, { isLoading: isBooking }] = useBookSeatMutation();
  const [unbookSeat, { isLoading: isCancelling }] = useUnbookSeatMutation();
  const [logoutApi] = useLogoutMutation();
  const [notice, setNotice] = useState(null);
  const [activeSeatId, setActiveSeatId] = useState(null);
  const [activeView, setActiveView] = useState(() => localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY) || "dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hasMinimumLoaderElapsed, setHasMinimumLoaderElapsed] = useState(false);

  const socket = useMemo(() => io(socketUrl), []);

  useEffect(() => {
    const handleSeatBooked = () => {
      dispatch(api.util.invalidateTags(["Seats"]));
      dispatch(api.util.invalidateTags(["MySeats"]));
      refetch();
      refetchMySeats();
    };

    socket.on("seat:booked", handleSeatBooked);
    socket.on("seat:released", handleSeatBooked);
    socket.on("seat:held", handleSeatBooked);
    socket.on("seat:updated", handleSeatBooked);
    socket.on("seats:reset", handleSeatBooked);

    return () => {
      socket.off("seat:booked", handleSeatBooked);
      socket.off("seat:released", handleSeatBooked);
      socket.off("seat:held", handleSeatBooked);
      socket.off("seat:updated", handleSeatBooked);
      socket.off("seats:reset", handleSeatBooked);
      socket.close();
    };
  }, [dispatch, refetch, refetchMySeats, socket]);

  useEffect(() => {
    if (activeView === "summary") {
      setActiveView("reports");
      return;
    }
    if (activeView === "admin" && authUser?.role !== "admin") {
      setActiveView("dashboard");
      return;
    }
    localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView);
  }, [activeView, authUser?.role]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const timer = setTimeout(() => setHasMinimumLoaderElapsed(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const showNotice = (type, message) => {
    setNotice({ type, message });
  };

  const handleBook = async (seatId) => {
    setNotice(null);
    setActiveSeatId(seatId);

    try {
      const result = await bookSeat(seatId).unwrap();
      showNotice("success", result?.message || "Seat booked successfully");
    } catch (apiError) {
      showNotice("error", apiError?.data?.message || "Unable to book seat");
    } finally {
      setActiveSeatId(null);
    }
  };

  const handleCancelBooking = async (seatId) => {
    setNotice(null);
    setActiveSeatId(seatId);

    try {
      const result = await unbookSeat(seatId).unwrap();
      showNotice("success", result?.message || "Booking cancelled successfully");
    } catch (apiError) {
      showNotice("error", apiError?.data?.message || "Unable to cancel booking");
    } finally {
      setActiveSeatId(null);
    }
  };

  const seats = data?.seats || [];
  const myBookedSeats = myData?.seats || [];
  const isRefreshing = isFetching || (authUser?.role === "admin" && isAdminUsersFetching);
  const showPageLoader = isLoading || !hasMinimumLoaderElapsed;
  const bookedCount = seats.filter((seat) => seat.isBooked).length;
  const availableCount = Math.max(seats.length - bookedCount, 0);

  const viewTitleMap = {
    dashboard: "Seat Dashboard",
    booking: "Booking Panel",
    myBookings: "My Bookings",
    admin: "Admin Controls",
    reports: "Reports",
    support: "Support",
    profile: "Profile",
  };

  const handleMenuClick = (viewKey) => {
    setActiveView(viewKey);
    setIsUserMenuOpen(false);
  };

  const handleHold = async (seatId) => {
    setNotice(null);
    setActiveSeatId(seatId);
    try {
      const result = await holdSeat(seatId).unwrap();
      showNotice("success", result?.message || "Seat hold placed successfully");
    } catch (apiError) {
      showNotice("error", apiError?.data?.message || "Unable to hold seat");
    } finally {
      setActiveSeatId(null);
    }
  };

  const renderMainContent = () => {
    if (activeView === "reports") {
      return <ReportsView seatsCount={seats.length} availableCount={availableCount} bookedCount={bookedCount} />;
    }

    if (activeView === "support") {
      return (
        <div className="info-card">
          <h3>Support</h3>
          <p>For booking help, contact support@ticketflow.local.</p>
        </div>
      );
    }

    if (activeView === "profile") {
      return (
        <div className="info-card">
          <h3>Profile</h3>
          <p>Logged in as: {authUser?.username}</p>
        </div>
      );
    }

    if (activeView === "dashboard") {
      return (
        <SeatDashboardView
          seatsCount={seats.length}
          availableCount={availableCount}
          bookedCount={bookedCount}
          IconComponent={SidebarIcon}
          onQuickAction={handleMenuClick}
        />
      );
    }

    if (activeView === "myBookings") {
      return (
        <MyBookingsView
          seats={myBookedSeats}
          isCancelling={isCancelling}
          onCancelSeat={handleCancelBooking}
        />
      );
    }

    if (activeView === "admin") {
      return (
        <AdminView
          seats={seats}
          users={adminUsersData?.users || []}
          onRoleChange={async (userId, role) => {
            setNotice(null);
            try {
              const result = await updateUserRole({ userId, role }).unwrap();
              showNotice("success", result?.message || "User role updated successfully");
              refetchAdminUsers();
            } catch (apiError) {
              showNotice("error", apiError?.data?.message || "Unable to update role");
            }
          }}
          onCreateUser={async (payload) => {
            setNotice(null);
            try {
              const result = await createAdminUser(payload).unwrap();
              showNotice("success", result?.message || "User created successfully");
              refetchAdminUsers();
            } catch (apiError) {
              showNotice("error", apiError?.data?.message || "Unable to create user");
            }
          }}
          onEditUser={async (payload) => {
            setNotice(null);
            try {
              const result = await updateAdminUser(payload).unwrap();
              showNotice("success", result?.message || "User updated successfully");
              refetchAdminUsers();
              return true;
            } catch (apiError) {
              showNotice("error", apiError?.data?.message || "Unable to update user");
              return false;
            }
          }}
          onDeleteUser={async (userId) => {
            setNotice(null);
            try {
              const result = await deleteAdminUser(userId).unwrap();
              showNotice("success", result?.message || "User deleted successfully");
              refetchAdminUsers();
            } catch (apiError) {
              showNotice("error", apiError?.data?.message || "Unable to delete user");
            }
          }}
          onResetAllSeats={async () => {
            setNotice(null);
            try {
              const result = await resetAllSeats().unwrap();
              showNotice("success", result?.message || "Seats reset successfully");
            } catch (apiError) {
              showNotice("error", apiError?.data?.message || "Unable to reset seats");
            }
          }}
          onCreateSeats={async (seatNames) => {
            setNotice(null);
            try {
              const result = await createSeats(seatNames).unwrap();
              const skipped = result?.skippedExistingSeatNames?.length
                ? ` Skipped existing: ${result.skippedExistingSeatNames.join(", ")}.`
                : "";
              showNotice("success", `${result?.message || "Seats created successfully."}${skipped}`);
            } catch (apiError) {
              showNotice("error", apiError?.data?.message || "Unable to create seats");
            }
          }}
          onNotify={showNotice}
          isUpdatingRole={isUpdatingRole}
          isEditingUser={isEditingUser}
          isCreatingUser={isCreatingUser}
          isDeletingUser={isDeletingUser}
          isResettingSeats={isResettingSeats}
          isCreatingSeats={isCreatingSeats}
        />
      );
    }

    if (activeView === "booking") {
      return (
        <BookingPanelView
          seats={seats}
          currentUsername={authUser?.username}
          currentUserId={authUser?.id}
          activeSeatId={activeSeatId}
          isActionLoading={isHolding || isBooking || isCancelling}
          onHoldSeat={handleHold}
          onBookSeat={handleBook}
          onCancelSeat={handleCancelBooking}
        />
      );
    }

    return null;
  };

  return (
    <div className={`workspace-shell ${isSidebarOpen ? "" : "workspace-shell--collapsed"}`}>
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-inner">
          <div className="workspace-brand">
            <span className="workspace-logo" aria-hidden="true">
              <span>TF</span>
            </span>
            <div>
              <strong>TicketFlow</strong>
              <p>Event management</p>
            </div>
          </div>

          <div className="workspace-nav-group">
            <button
              className={`workspace-nav-item ${activeView === "dashboard" ? "active" : ""}`}
              type="button"
              data-tooltip="Seat Dashboard"
              title="Seat Dashboard"
              onClick={() => handleMenuClick("dashboard")}
            >
              <span className="nav-icon">
                <SidebarIcon type="dashboard" />
              </span>
              <span className="nav-label">Seat Dashboard</span>
            </button>
            <button
              className={`workspace-nav-item ${activeView === "booking" ? "active" : ""}`}
              type="button"
              data-tooltip="Booking Panel"
              title="Booking Panel"
              onClick={() => handleMenuClick("booking")}
            >
              <span className="nav-icon">
                <SidebarIcon type="booking" />
              </span>
              <span className="nav-label">Booking Panel</span>
            </button>
            <button
              className={`workspace-nav-item ${activeView === "myBookings" ? "active" : ""}`}
              type="button"
              data-tooltip="My Bookings"
              title="My Bookings"
              onClick={() => handleMenuClick("myBookings")}
            >
              <span className="nav-icon">
                <SidebarIcon type="profile" />
              </span>
              <span className="nav-label">My Bookings</span>
            </button>
            <button
              className={`workspace-nav-item ${activeView === "reports" ? "active" : ""}`}
              type="button"
              data-tooltip="Reports"
              title="Reports"
              onClick={() => handleMenuClick("reports")}
            >
              <span className="nav-icon">
                <SidebarIcon type="reports" />
              </span>
              <span className="nav-label">Reports</span>
            </button>
            {authUser?.role === "admin" && (
              <button
                className={`workspace-nav-item ${activeView === "admin" ? "active" : ""}`}
                type="button"
                data-tooltip="Admin"
                title="Admin"
                onClick={() => handleMenuClick("admin")}
              >
                <span className="nav-icon">
                  <SidebarIcon type="summary" />
                </span>
                <span className="nav-label">Admin</span>
              </button>
            )}
          </div>

        </div>
        <div className="sidebar-user-section">
          {isUserMenuOpen && (
            <div className="workspace-user-menu workspace-user-menu--floating">
              <button type="button" className="workspace-nav-item" onClick={() => handleMenuClick("support")}>
                <span className="nav-icon">
                  <SidebarIcon type="support" />
                </span>
                <span className="nav-label">Support</span>
              </button>
              <button type="button" className="workspace-nav-item" onClick={() => handleMenuClick("profile")}>
                <span className="nav-icon">
                  <SidebarIcon type="profile" />
                </span>
                <span className="nav-label">Profile</span>
              </button>
              <button
                type="button"
                className="workspace-nav-item sidebar-logout-btn"
                onClick={async () => {
                  if (refreshToken) {
                    try {
                      await logoutApi(refreshToken).unwrap();
                    } catch {
                      // Ignore logout API failures and proceed with local logout.
                    }
                  }
                  dispatch(logout());
                  dispatch(api.util.resetApiState());
                }}
              >
                <span className="nav-icon">
                  <SidebarIcon type="close" />
                </span>
                <span className="nav-label">Logout</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className="workspace-user-toggle"
            data-tooltip="Profile Menu"
            title="Profile Menu"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
          >
            <span className="workspace-avatar">{(authUser?.username || "U").slice(0, 1).toUpperCase()}</span>
            <div>
              <strong className="nav-label">{authUser?.username}</strong>
              <p className="nav-label">Ticket booking user</p>
            </div>
            <span className="workspace-chevron nav-label">{isUserMenuOpen ? "▴" : "▾"}</span>
          </button>
        </div>
        <button
          type="button"
          className="workspace-edge-toggle"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}
          title={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}
        >
          {isSidebarOpen ? "◀" : "▶"}
        </button>
      </aside>

      <section className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <h2>{viewTitleMap[activeView] || "My Tickets"}</h2>
            <p>Manage live seat bookings in one place.</p>
          </div>
        </header>

        <div className="workspace-panel">
          {activeView === "dashboard" && (
            <header className="seat-page-header">
              <div className="header-copy">
                <h1>Welcome, {authUser?.username}</h1>
                <p>Select an available seat to book in real time.</p>
              </div>
            </header>
          )}

          {showPageLoader ? (
            <div className="workspace-loader workspace-loader--page" role="status" aria-live="polite">
              <span className="workspace-loader-spinner" />
              <span>Loading latest data...</span>
            </div>
          ) : (
            <>
              {isRefreshing && (
                <div className="workspace-loader workspace-loader--inline" role="status" aria-live="polite">
                  <span className="workspace-loader-spinner" />
                  <span>Refreshing latest data...</span>
                </div>
              )}
              {isError && <p className="error-text">{error?.data?.message || "Failed to load seats"}</p>}
              {notice && (
                <div className={`workspace-notice workspace-notice--${notice.type}`}>
                  <span className="workspace-notice-icon" aria-hidden="true">
                    {notice.type === "success" ? "✓" : "!"}
                  </span>
                  <span className="workspace-notice-text">{notice.message}</span>
                  <button type="button" className="workspace-notice-close" onClick={() => setNotice(null)}>
                    ×
                  </button>
                </div>
              )}
              {renderMainContent()}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
