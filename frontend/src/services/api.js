import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { logout, setCredentials } from "../features/auth/authSlice";

const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithRefresh = async (args, apiContext, extraOptions) => {
  let result = await rawBaseQuery(args, apiContext, extraOptions);
  if (result.error?.status !== 401) {
    return result;
  }

  const refreshToken = apiContext.getState().auth.refreshToken;
  if (!refreshToken) {
    apiContext.dispatch(logout());
    return result;
  }

  const refreshResult = await rawBaseQuery(
    {
      url: "/auth/refresh",
      method: "POST",
      body: { refreshToken },
    },
    apiContext,
    extraOptions
  );

  if (refreshResult.data?.token) {
    apiContext.dispatch(setCredentials(refreshResult.data));
    result = await rawBaseQuery(args, apiContext, extraOptions);
    return result;
  }

  apiContext.dispatch(logout());
  return result;
};

export const api = createApi({
  reducerPath: "bookingApi",
  baseQuery: baseQueryWithRefresh,
  tagTypes: ["Seats", "MySeats", "Users"],
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    register: builder.mutation({
      query: (credentials) => ({
        url: "/auth/register",
        method: "POST",
        body: credentials,
      }),
    }),
    logout: builder.mutation({
      query: (refreshToken) => ({
        url: "/auth/logout",
        method: "POST",
        body: { refreshToken },
      }),
    }),
    getSeats: builder.query({
      query: () => "/seats",
      providesTags: ["Seats"],
    }),
    getMySeats: builder.query({
      query: () => "/seats/mine",
      providesTags: ["MySeats"],
    }),
    holdSeat: builder.mutation({
      query: (seatId) => ({
        url: `/seats/${seatId}/hold`,
        method: "POST",
      }),
      invalidatesTags: ["Seats"],
    }),
    bookSeat: builder.mutation({
      query: (seatId) => ({
        url: `/seats/${seatId}/book`,
        method: "POST",
      }),
      invalidatesTags: ["Seats", "MySeats"],
    }),
    unbookSeat: builder.mutation({
      query: (seatId) => ({
        url: `/seats/${seatId}/unbook`,
        method: "POST",
      }),
      invalidatesTags: ["Seats", "MySeats"],
    }),
    getAdminUsers: builder.query({
      query: () => "/admin/users",
      providesTags: ["Users"],
    }),
    createAdminUser: builder.mutation({
      query: (payload) => ({
        url: "/admin/users",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["Users"],
    }),
    updateUserRole: builder.mutation({
      query: ({ userId, role }) => ({
        url: `/admin/users/${userId}/role`,
        method: "PATCH",
        body: { role },
      }),
      invalidatesTags: ["Users"],
    }),
    updateAdminUser: builder.mutation({
      query: ({ userId, ...payload }) => ({
        url: `/admin/users/${userId}`,
        method: "PATCH",
        body: payload,
      }),
      invalidatesTags: ["Users"],
    }),
    deleteAdminUser: builder.mutation({
      query: (userId) => ({
        url: `/admin/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Users", "Seats", "MySeats"],
    }),
    resetAllSeats: builder.mutation({
      query: () => ({
        url: "/admin/seats/reset",
        method: "POST",
      }),
      invalidatesTags: ["Seats", "MySeats"],
    }),
    createSeats: builder.mutation({
      query: (seatNames) => ({
        url: "/admin/seats/create",
        method: "POST",
        body: { seatNames },
      }),
      invalidatesTags: ["Seats", "MySeats"],
    }),
    forgotPassword: builder.mutation({
      query: (username) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body: { username },
      }),
    }),
    resetPassword: builder.mutation({
      query: ({ resetToken, newPassword }) => ({
        url: "/auth/reset-password",
        method: "POST",
        body: { resetToken, newPassword },
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetSeatsQuery,
  useGetMySeatsQuery,
  useHoldSeatMutation,
  useBookSeatMutation,
  useUnbookSeatMutation,
  useGetAdminUsersQuery,
  useCreateAdminUserMutation,
  useUpdateUserRoleMutation,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useResetAllSeatsMutation,
  useCreateSeatsMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = api;
