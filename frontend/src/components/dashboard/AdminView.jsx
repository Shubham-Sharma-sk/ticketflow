import { useMemo, useState } from "react";
import "./AdminView.css";
import DropdownSelect from "../common/DropdownSelect";

export default function AdminView({
  seats,
  users,
  onRoleChange,
  onCreateUser,
  onEditUser,
  onDeleteUser,
  onResetAllSeats,
  onCreateSeats,
  onNotify,
  isUpdatingRole,
  isEditingUser,
  isCreatingUser,
  isDeletingUser,
  isResettingSeats,
  isCreatingSeats,
}) {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [seatNamesInput, setSeatNamesInput] = useState("");
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("user");

  const bookedSeats = seats.filter((seat) => seat.isBooked).length;
  const heldSeats = seats.filter((seat) => !seat.isBooked && seat.isHeld).length;
  const availableSeats = Math.max(seats.length - bookedSeats - heldSeats, 0);

  const bookingRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    let list = seats
      .map((seat) => {
        const status = seat.isBooked ? "booked" : seat.isHeld ? "hold" : "available";
        const timeValue = seat.isBooked ? seat.bookedAt : seat.holdExpiresAt;
        return {
          id: seat.id,
          seatNumber: seat.seatNumber,
          status,
          timeValue,
        };
      })
      .filter((row) => {
        const matchesSearch = !q || row.seatNumber.toLowerCase().includes(q);
        const matchesStatus = statusFilter === "all" || row.status === statusFilter;
        return matchesSearch && matchesStatus;
      });

    list = list.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber));
    return list;
  }, [seats, searchText, statusFilter]);

  const userBookingStats = useMemo(
    () =>
      [...users]
        .map((user) => ({
          id: user.id,
          username: user.username,
          bookedCount: Number(user.booked_count || 0),
        }))
        .sort((a, b) => b.bookedCount - a.bookedCount),
    [users]
  );

  const formatStatus = (status) => {
    if (status === "booked") return "Booked";
    if (status === "hold") return "On Hold";
    return "Available";
  };

  const openEditUserModal = (user) => {
    setEditUserId(user.id);
    setEditUsername(user.username);
    setEditPassword("");
    setEditRole(user.role);
    setIsEditUserOpen(true);
  };

  return (
    <div className="av-wrap">
      <div className="av-header">
        <div>
          <h3>Admin Booking Overview</h3>
          <p>Manage bookings, holds, and user access in one place.</p>
        </div>
        <div className="av-header-actions">
          <div className="av-create-seats">
            <button
              type="button"
              className="av-create-btn"
              disabled={isCreatingSeats}
              onClick={() => setIsCreatePanelOpen(true)}
            >
              Add Seats
            </button>
          </div>
          <button type="button" className="av-reset-btn" disabled={isResettingSeats} onClick={onResetAllSeats}>
            Reset All Seats
          </button>
        </div>
      </div>

      <div className="av-summary">
        <div className="av-stat">
          <span>Total Seats</span>
          <strong>{seats.length}</strong>
        </div>
        <div className="av-stat">
          <span>Booked</span>
          <strong>{bookedSeats}</strong>
        </div>
        <div className="av-stat">
          <span>On Hold</span>
          <strong>{heldSeats}</strong>
        </div>
        <div className="av-stat">
          <span>Available</span>
          <strong>{availableSeats}</strong>
        </div>
      </div>

      <div className="av-main-grid">
        <div className="av-bookings-card">
          <div className="av-bookings-toolbar">
            <input
              type="text"
              placeholder="Search by seat..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <DropdownSelect
              className="av-status-dropdown"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Status" },
                { value: "booked", label: "Booked" },
                { value: "hold", label: "On Hold" },
                { value: "available", label: "Available" },
              ]}
            />
          </div>

          <div className="av-bookings-table">
            <div className="av-bookings-head">
              <span>Seat</span>
              <span>Status</span>
              <span>Time</span>
            </div>
            {bookingRows.map((row) => (
              <div key={row.id} className="av-bookings-row">
                <strong>{row.seatNumber}</strong>
                <span className={`av-status av-status--${row.status}`}>{formatStatus(row.status)}</span>
                <span>{row.timeValue ? new Date(row.timeValue).toLocaleString() : "-"}</span>
              </div>
            ))}
            {bookingRows.length === 0 && <p className="av-empty">No booking data found for current filters.</p>}
          </div>
        </div>

        <div className="av-side-stack">
          <div className="av-users-card">
            <h3>Bookings By User</h3>
            <div
              className="av-pie-chart"
              style={{
                background: (() => {
                  const palette = ["#0ea5e9", "#14b8a6", "#a855f7", "#f59e0b", "#ef4444", "#22c55e"];
                  let acc = 0;
                  const total = userBookingStats.reduce((sum, item) => sum + item.bookedCount, 0);
                  if (!total) return "conic-gradient(#e2e8f0 0 100%)";
                  const parts = userBookingStats.map((item, idx) => {
                    const start = acc;
                    acc += (item.bookedCount / total) * 100;
                    return `${palette[idx % palette.length]} ${start}% ${acc}%`;
                  });
                  return `conic-gradient(${parts.join(", ")})`;
                })(),
              }}
            >
              <div className="av-pie-hole">{userBookingStats.reduce((sum, item) => sum + item.bookedCount, 0)}</div>
            </div>
            <div className="av-pie-legend">
              {userBookingStats.map((user, idx) => (
                <p key={user.id}>
                  <span
                    style={{
                      background: ["#0ea5e9", "#14b8a6", "#a855f7", "#f59e0b", "#ef4444", "#22c55e"][idx % 6],
                    }}
                  />
                  {user.username} ({user.bookedCount})
                </p>
              ))}
              {userBookingStats.length === 0 && <p className="av-empty">No user data found.</p>}
            </div>
          </div>

          <div className="av-users-card">
            <div className="av-users-header">
              <h3>Users Management</h3>
              <button type="button" className="av-create-btn" onClick={() => setIsCreateUserOpen(true)}>
                Add User
              </button>
            </div>
            <div className="av-users-grid">
              {users.map((user) => (
                <div key={user.id} className="av-user-row">
                  <div>
                    <strong>{user.username}</strong>
                    <p>
                      Role: {user.role} | Booked seats: {user.booked_count}
                    </p>
                  </div>
                  <DropdownSelect
                    size="sm"
                    className="av-role-dropdown"
                    value={user.role}
                    disabled={isUpdatingRole}
                    onChange={(role) => onRoleChange(user.id, role)}
                    options={[
                      { value: "user", label: "user" },
                      { value: "admin", label: "admin" },
                    ]}
                  />
                  <button type="button" className="av-edit-btn" onClick={() => openEditUserModal(user)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="av-delete-btn"
                    disabled={isDeletingUser}
                    onClick={() => onDeleteUser(user.id)}
                    aria-label={`Delete ${user.username}`}
                    title={`Delete ${user.username}`}
                  >
                    Delete User
                  </button>
                </div>
              ))}
              {users.length === 0 && <p className="av-empty">No users found.</p>}
            </div>
          </div>
        </div>
      </div>

      {isCreatePanelOpen && (
        <div className="av-modal-backdrop" role="presentation" onClick={() => setIsCreatePanelOpen(false)}>
          <div className="av-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h4>Create Seats</h4>
            <p>Enter seat names separated by comma. Example: A7, A8, VIP-1</p>
            <textarea
              value={seatNamesInput}
              onChange={(event) => setSeatNamesInput(event.target.value)}
              placeholder="A7, A8, VIP-1"
              rows={4}
            />
            <div className="av-create-panel-actions">
              <button type="button" className="av-cancel-btn" onClick={() => setIsCreatePanelOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="av-create-btn"
                disabled={isCreatingSeats}
                onClick={() => {
                  const seatNames = seatNamesInput
                    .split(",")
                    .map((name) => name.trim())
                    .filter(Boolean);
                  if (!seatNames.length) {
                    onNotify?.("error", "Enter at least one valid seat name");
                    return;
                  }
                  onCreateSeats(seatNames);
                  setSeatNamesInput("");
                  setIsCreatePanelOpen(false);
                }}
              >
                Create Seats
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditUserOpen && (
        <div className="av-modal-backdrop" role="presentation" onClick={() => setIsEditUserOpen(false)}>
          <div className="av-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h4>Edit User</h4>
            <p>Update user details and save changes.</p>
            <div className="av-user-modal-form">
              <input
                type="text"
                placeholder="Username"
                value={editUsername}
                onChange={(event) => setEditUsername(event.target.value)}
              />
              <input
                type="password"
                placeholder="New password (optional)"
                value={editPassword}
                onChange={(event) => setEditPassword(event.target.value)}
              />
              <DropdownSelect
                className="av-role-dropdown"
                value={editRole}
                onChange={setEditRole}
                options={[
                  { value: "user", label: "user" },
                  { value: "admin", label: "admin" },
                ]}
              />
            </div>
            <div className="av-create-panel-actions">
              <button type="button" className="av-cancel-btn" onClick={() => setIsEditUserOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="av-create-btn"
                disabled={isEditingUser}
                onClick={async () => {
                  if (!editUsername.trim()) {
                    onNotify?.("error", "Username is required");
                    return;
                  }
                  if (editPassword && editPassword.trim().length < 6) {
                    onNotify?.("error", "Password must be at least 6 characters");
                    return;
                  }
                  const didUpdate = await onEditUser?.({
                    userId: editUserId,
                    username: editUsername.trim(),
                    role: editRole,
                    ...(editPassword.trim() ? { password: editPassword } : {}),
                  });
                  if (didUpdate) {
                    setIsEditUserOpen(false);
                  }
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateUserOpen && (
        <div className="av-modal-backdrop" role="presentation" onClick={() => setIsCreateUserOpen(false)}>
          <div className="av-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h4>Create User</h4>
            <p>Add a new user account with role access.</p>
            <div className="av-user-modal-form">
              <input
                type="text"
                placeholder="Username"
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <DropdownSelect
                className="av-role-dropdown"
                value={newRole}
                onChange={setNewRole}
                options={[
                  { value: "user", label: "user" },
                  { value: "admin", label: "admin" },
                ]}
              />
            </div>
            <div className="av-create-panel-actions">
              <button type="button" className="av-cancel-btn" onClick={() => setIsCreateUserOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="av-create-btn"
                disabled={isCreatingUser}
                onClick={() => {
                  if (!newUsername.trim() || !newPassword.trim()) {
                    onNotify?.("error", "Username and password are required");
                    return;
                  }
                  if (newPassword.trim().length < 6) {
                    onNotify?.("error", "Password must be at least 6 characters");
                    return;
                  }
                  onCreateUser({
                    username: newUsername.trim(),
                    password: newPassword,
                    role: newRole,
                  });
                  setNewUsername("");
                  setNewPassword("");
                  setNewRole("user");
                  setIsCreateUserOpen(false);
                }}
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
