import { createSlice } from "@reduxjs/toolkit";

const storedToken = localStorage.getItem("token");
const storedUser = localStorage.getItem("user");
const storedRefreshToken = localStorage.getItem("refreshToken");
const parsedStoredUser = storedUser ? JSON.parse(storedUser) : null;

const initialState = {
  token: storedToken || null,
  refreshToken: storedRefreshToken || null,
  user: parsedStoredUser ? { ...parsedStoredUser, role: parsedStoredUser.role || "user" } : null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken || null;
      state.user = { ...action.payload.user, role: action.payload.user?.role || "user" };
      localStorage.setItem("token", action.payload.token);
      if (action.payload.refreshToken) {
        localStorage.setItem("refreshToken", action.payload.refreshToken);
      }
      localStorage.setItem("user", JSON.stringify(state.user));
    },
    logout: (state) => {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
