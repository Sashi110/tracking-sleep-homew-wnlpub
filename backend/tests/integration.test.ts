import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, connectWebSocket, connectAuthenticatedWebSocket, waitForMessage } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests (e.g., created resource IDs, auth tokens)
  let authToken: string;
  let sleepLogId: string;
  let homeworkId: string;
  let choreId: string;

  test("Sign up test user", async () => {
    const { token } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
  });

  // ============ Sleep Log Tests ============
  test("Create sleep log", async () => {
    const res = await authenticatedApi("/api/sleep", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bedtime: "2026-03-29T22:00:00Z",
        notes: "Good sleep night",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    sleepLogId = data.id;
    expect(data.id).toBeDefined();
    expect(data.bedtime).toBeDefined();
  });

  test("Get sleep logs", async () => {
    const res = await authenticatedApi("/api/sleep", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.logs).toBeDefined();
    expect(Array.isArray(data.logs)).toBe(true);
  });

  test("Get sleep logs with limit query", async () => {
    const res = await authenticatedApi("/api/sleep?limit=5", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.logs)).toBe(true);
  });

  test("Update sleep log with wake time", async () => {
    const res = await authenticatedApi(`/api/sleep/${sleepLogId}`, authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wakeTime: "2026-03-30T08:00:00Z",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(sleepLogId);
  });

  test("Delete sleep log", async () => {
    const res = await authenticatedApi(`/api/sleep/${sleepLogId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Patch non-existent sleep log returns 404", async () => {
    const res = await authenticatedApi(
      "/api/sleep/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wakeTime: "2026-03-30T08:00:00Z" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete non-existent sleep log returns 404", async () => {
    const res = await authenticatedApi(
      "/api/sleep/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Get sleep logs without auth returns 401", async () => {
    const res = await api("/api/sleep");
    await expectStatus(res, 401);
  });

  // ============ Homework Tests ============
  test("Create homework item", async () => {
    const res = await authenticatedApi("/api/homework", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Mathematics",
        title: "Chapter 5 exercises",
        dueDate: "2026-04-05",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    homeworkId = data.id;
    expect(data.id).toBeDefined();
    expect(data.subject).toBe("Mathematics");
    expect(data.completed).toBe(false);
  });

  test("Get homework items", async () => {
    const res = await authenticatedApi("/api/homework", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
  });

  test("Get homework items filtered by completed status", async () => {
    const res = await authenticatedApi("/api/homework?completed=false", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
  });

  test("Update homework item - mark as completed", async () => {
    const res = await authenticatedApi(`/api/homework/${homeworkId}`, authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completed: true,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(homeworkId);
  });

  test("Update homework item - change details", async () => {
    const res = await authenticatedApi(`/api/homework/${homeworkId}`, authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Chapter 5",
        dueDate: "2026-04-10",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Delete homework item", async () => {
    const res = await authenticatedApi(`/api/homework/${homeworkId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Patch non-existent homework item returns 404", async () => {
    const res = await authenticatedApi(
      "/api/homework/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete non-existent homework item returns 404", async () => {
    const res = await authenticatedApi(
      "/api/homework/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Get homework items without auth returns 401", async () => {
    const res = await api("/api/homework");
    await expectStatus(res, 401);
  });

  // ============ Chores Tests ============
  test("Create chore", async () => {
    const res = await authenticatedApi("/api/chores", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Clean bedroom",
        emoji: "🧹",
        frequency: "daily",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    choreId = data.id;
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Clean bedroom");
    expect(data.frequency).toBe("daily");
  });

  test("Get chores", async () => {
    const res = await authenticatedApi("/api/chores", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.chores).toBeDefined();
    expect(Array.isArray(data.chores)).toBe(true);
  });

  test("Create another chore with weekly frequency", async () => {
    const res = await authenticatedApi("/api/chores", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Vacuum floors",
        emoji: "🧺",
        frequency: "weekly",
      }),
    });
    await expectStatus(res, 201);
  });

  test("Update chore - mark as completed today", async () => {
    const res = await authenticatedApi(`/api/chores/${choreId}`, authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completedToday: true,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(choreId);
  });

  test("Update chore - change details", async () => {
    const res = await authenticatedApi(`/api/chores/${choreId}`, authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Clean living room",
        emoji: "🧽",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Delete chore", async () => {
    const res = await authenticatedApi(`/api/chores/${choreId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Patch non-existent chore returns 404", async () => {
    const res = await authenticatedApi(
      "/api/chores/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedToday: true }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete non-existent chore returns 404", async () => {
    const res = await authenticatedApi(
      "/api/chores/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Get chores without auth returns 401", async () => {
    const res = await api("/api/chores");
    await expectStatus(res, 401);
  });
});
