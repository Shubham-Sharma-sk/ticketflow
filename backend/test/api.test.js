import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
process.env.SEAT_HOLD_TTL_SECONDS = "60";
process.env.LOGIN_RATE_MAX = "10";
process.env.LOGIN_RATE_WINDOW_MS = String(10 * 60 * 1000);

const mongoServer = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongoServer.getUri();

const { createApp } = await import("../src/app.js");
const { resetForTests, closeDb } = await import("../src/db.js");

const app = createApp({ allowedOrigin: "http://localhost:5173" });

const register = async (username, password) => {
  const response = await request(app).post("/api/auth/register").send({ username, password });
  return response.body;
};

test.beforeEach(async () => {
  await resetForTests();
});

test.after(async () => {
  await closeDb();
  await mongoServer.stop();
});

test("register returns access + refresh token and role", async () => {
  const payload = await register("adminUser", "admin123");
  assert.ok(payload.token);
  assert.ok(payload.refreshToken);
  assert.equal(payload.user.role, "user");
});

test("seat hold then confirm booking flow works", async () => {
  await register("firstAdmin", "admin123");
  const user = await register("alice", "alice123");
  const seatsResponse = await request(app).get("/api/seats").set("Authorization", `Bearer ${user.token}`);
  const seatId = seatsResponse.body.seats[0].id;

  const holdResponse = await request(app)
    .post(`/api/seats/${seatId}/hold`)
    .set("Authorization", `Bearer ${user.token}`);
  assert.equal(holdResponse.status, 200);
  assert.equal(holdResponse.body.seat.isHeld, true);

  const bookResponse = await request(app)
    .post(`/api/seats/${seatId}/book`)
    .set("Authorization", `Bearer ${user.token}`);
  assert.equal(bookResponse.status, 200);
  assert.equal(bookResponse.body.seat.isBooked, true);
});

test("admin controls are protected and functional", async () => {
  const adminResponse = await request(app).post("/api/auth/login").send({ username: "admin", password: "admin@123" });
  const admin = adminResponse.body;
  const user = await register("member", "member123");

  const nonAdminUsersResponse = await request(app)
    .get("/api/admin/users")
    .set("Authorization", `Bearer ${user.token}`);
  assert.equal(nonAdminUsersResponse.status, 403);

  const adminUsersResponse = await request(app)
    .get("/api/admin/users")
    .set("Authorization", `Bearer ${admin.token}`);
  assert.equal(adminUsersResponse.status, 200);
  assert.ok(Array.isArray(adminUsersResponse.body.users));

  const createSeatsResponse = await request(app)
    .post("/api/admin/seats/create")
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ seatNames: ["VIP-1", "VIP-2", "A7"] });
  assert.equal(createSeatsResponse.status, 201);
  assert.equal(createSeatsResponse.body.seatNumbers.length, 3);

  const createUserResponse = await request(app)
    .post("/api/admin/users")
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ username: "new_user", password: "newuser123", role: "user" });
  assert.equal(createUserResponse.status, 201);
  assert.equal(createUserResponse.body.user.username, "new_user");

  const updateUserResponse = await request(app)
    .patch(`/api/admin/users/${createUserResponse.body.user.id}`)
    .set("Authorization", `Bearer ${admin.token}`)
    .send({ username: "new_user_2", role: "admin", password: "updated123" });
  assert.equal(updateUserResponse.status, 200);

  const deleteUserResponse = await request(app)
    .delete(`/api/admin/users/${createUserResponse.body.user.id}`)
    .set("Authorization", `Bearer ${admin.token}`);
  assert.equal(deleteUserResponse.status, 200);

  const resetResponse = await request(app)
    .post("/api/admin/seats/reset")
    .set("Authorization", `Bearer ${admin.token}`);
  assert.equal(resetResponse.status, 200);
});

test("password reset token allows setting a new password", async () => {
  await register("resetme", "before123");

  const forgotResponse = await request(app).post("/api/auth/forgot-password").send({ username: "resetme" });
  assert.equal(forgotResponse.status, 200);
  assert.ok(forgotResponse.body.resetToken);

  const resetResponse = await request(app)
    .post("/api/auth/reset-password")
    .send({ resetToken: forgotResponse.body.resetToken, newPassword: "after123" });
  assert.equal(resetResponse.status, 200);

  const loginResponse = await request(app).post("/api/auth/login").send({ username: "resetme", password: "after123" });
  assert.equal(loginResponse.status, 200);
  assert.ok(loginResponse.body.token);
});

test("login rate limiter blocks repeated attempts", async () => {
  for (let i = 0; i < 12; i += 1) {
    await request(app).post("/api/auth/login").send({ username: "ghost", password: "wrong123" });
  }

  const blockedResponse = await request(app).post("/api/auth/login").send({ username: "ghost", password: "wrong123" });
  assert.equal(blockedResponse.status, 429);
});
