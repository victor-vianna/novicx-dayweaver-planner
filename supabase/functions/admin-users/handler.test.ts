import { beforeEach, describe, expect, it } from "vitest";

import {
  type AdminUsersDeps,
  type ClientRow,
  DepError,
  handleAdminUsers,
  type UserRow,
} from "./handler.ts";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER_ADMIN = "aaaaaaaa-0000-4000-8000-000000000002";
const CLIENT_USER = "cccccccc-0000-4000-8000-000000000001";
const CLIENT = "dddddddd-0000-4000-8000-000000000001";
const FREE_CLIENT = "dddddddd-0000-4000-8000-000000000002";
const NEW_ID = "eeeeeeee-0000-4000-8000-000000000001";

/** In-memory Auth + tables; `fail` makes one dep throw; `calls` records order. */
function fakeDeps() {
  const clients = new Map<string, ClientRow>();
  const users = new Map<string, UserRow>();
  const calls: string[] = [];
  const fail: Partial<Record<keyof AdminUsersDeps, DepError>> = {};
  let linkOnCreate = true;

  const guard = (name: keyof AdminUsersDeps) => {
    calls.push(name);
    if (fail[name]) throw fail[name];
  };

  users.set(ADMIN, { id: ADMIN, email: "admin@example.com", role: "admin", blocked: false });
  users.set(OTHER_ADMIN, {
    id: OTHER_ADMIN,
    email: "a2@example.com",
    role: "admin",
    blocked: false,
  });
  users.set(CLIENT_USER, {
    id: CLIENT_USER,
    email: "ana@example.com",
    role: "client",
    blocked: false,
  });
  clients.set(CLIENT, {
    id: CLIENT,
    display_name: "Ana",
    email: "ana@example.com",
    user_id: CLIENT_USER,
  });
  clients.set(FREE_CLIENT, {
    id: FREE_CLIENT,
    display_name: "Bia",
    email: "bia@example.com",
    user_id: null,
  });

  const deps: AdminUsersDeps = {
    async getCaller(jwt) {
      guard("getCaller");
      return jwt.startsWith("jwt-") ? { id: jwt.slice(4) } : null;
    },
    async isActiveAdmin(id) {
      guard("isActiveAdmin");
      const u = users.get(id);
      return u?.role === "admin" && !u.blocked;
    },
    async insertClient(input) {
      guard("insertClient");
      if ([...clients.values()].some((c) => c.email === input.email))
        throw new DepError("dup", 409);
      const row = {
        id: NEW_ID,
        display_name: input.display_name,
        email: input.email,
        user_id: null,
      };
      clients.set(row.id, row);
      return { ...row };
    },
    async getClient(id) {
      guard("getClient");
      const c = clients.get(id);
      return c ? { ...c } : null;
    },
    async deleteClient(id) {
      guard("deleteClient");
      clients.delete(id);
    },
    async updateClientEmail(id, email) {
      guard("updateClientEmail");
      clients.get(id)!.email = email;
    },
    async getUser(id) {
      guard("getUser");
      const u = users.get(id);
      return u ? { ...u } : null;
    },
    async createUser(email) {
      guard("createUser");
      if ([...users.values()].some((u) => u.email === email)) throw new DepError("dup", 409);
      const id = "ffffffff-0000-4000-8000-000000000001";
      users.set(id, { id, email, role: "client", blocked: false });
      // Simulates the DB trigger linking the confirmed user to the client.
      if (linkOnCreate) {
        for (const c of clients.values()) if (c.email === email && !c.user_id) c.user_id = id;
      }
      return { id };
    },
    async deleteUser(id) {
      guard("deleteUser");
      users.delete(id);
      for (const c of clients.values()) if (c.user_id === id) c.user_id = null;
    },
    async updateUserEmail(id, email) {
      guard("updateUserEmail");
      users.get(id)!.email = email;
    },
    async setBlocked(id, blocked) {
      guard("setBlocked");
      users.get(id)!.blocked = blocked;
    },
    async setBanned() {
      guard("setBanned");
    },
    async recoveryLink(email, redirectTo) {
      guard("recoveryLink");
      return `https://auth.example/recover?email=${email}&to=${redirectTo ?? ""}`;
    },
  };
  return {
    deps,
    clients,
    users,
    calls,
    fail,
    noLink: () => {
      linkOnCreate = false;
    },
  };
}

let f: ReturnType<typeof fakeDeps>;
beforeEach(() => {
  f = fakeDeps();
});

const call = (
  body: unknown,
  opts: { caller?: string; method?: string; auth?: string | null } = {},
) =>
  handleAdminUsers(
    {
      method: opts.method ?? "POST",
      authorization: opts.auth === undefined ? `Bearer jwt-${opts.caller ?? ADMIN}` : opts.auth,
      body,
    },
    f.deps,
  );

describe("caller checks", () => {
  it("rejects non-POST, missing/invalid session, and non-admins", async () => {
    expect((await call({}, { method: "GET" })).status).toBe(405);
    expect((await call({}, { auth: null })).status).toBe(401);
    expect((await call({}, { auth: "Basic x" })).status).toBe(401);
    expect((await call({}, { auth: "Bearer nope" })).status).toBe(401);
    expect(
      (await call({ action: "reset_access", user_id: CLIENT_USER }, { caller: CLIENT_USER }))
        .status,
    ).toBe(403);
  });

  it("rejects a blocked admin before reading the body", async () => {
    f.users.get(ADMIN)!.blocked = true;
    const res = await call({ action: "set_access", user_id: CLIENT_USER, blocked: true });
    expect(res.status).toBe(403);
    expect(f.calls).not.toContain("setBlocked");
  });

  it("rejects bad bodies and unknown actions with 400", async () => {
    expect((await call(null)).status).toBe(400);
    expect((await call([1])).status).toBe(400);
    expect((await call({ action: "drop_everything" })).status).toBe(400);
    expect((await call({ action: "set_access", user_id: "x", blocked: true })).status).toBe(400);
  });

  it("does not leak dependency messages", async () => {
    f.fail.getUser = new DepError("internal: relation profiles secret detail", 500);
    const res = await call({ action: "reset_access", user_id: CLIENT_USER });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});

describe("create_account", () => {
  const client = {
    display_name: "Carla",
    business_name: "Studio C",
    profession: "Designer",
    phone: "",
    email: " Carla@Example.com ",
  };

  it("creates client + confirmed user, links them and returns a link", async () => {
    const res = await call({
      action: "create_account",
      client,
      redirect_to: "http://localhost:8080/?redefinir-senha=1",
    });
    expect(res.status).toBe(201);
    expect(res.body["client_id"]).toBe(NEW_ID);
    expect(f.clients.get(NEW_ID)!.email).toBe("carla@example.com");
    expect(f.clients.get(NEW_ID)!.user_id).toBe(res.body["user_id"]);
    expect(String(res.body["action_link"])).toContain("redefinir-senha");
  });

  it("gives access to an existing client without one", async () => {
    const res = await call({ action: "create_account", client_id: FREE_CLIENT });
    expect(res.status).toBe(201);
    expect(f.clients.get(FREE_CLIENT)!.user_id).toBe(res.body["user_id"]);
  });

  it("refuses a client that already has access, or a missing one", async () => {
    expect((await call({ action: "create_account", client_id: CLIENT })).status).toBe(409);
    expect((await call({ action: "create_account", client_id: NEW_ID })).status).toBe(404);
  });

  it("maps duplicate client e-mail to 409 without creating a user", async () => {
    const res = await call({
      action: "create_account",
      client: { ...client, email: "ana@example.com" },
    });
    expect(res.status).toBe(409);
    expect(f.calls).not.toContain("createUser");
  });

  it("removes the new client when the Auth user cannot be created", async () => {
    f.users.set("x", { id: "x", email: "carla@example.com", role: "client", blocked: false });
    const res = await call({ action: "create_account", client });
    expect(res.status).toBe(409);
    expect(f.clients.has(NEW_ID)).toBe(false);
  });

  it("keeps a pre-existing client when the Auth user cannot be created", async () => {
    f.fail.createUser = new DepError("down", 500);
    const res = await call({ action: "create_account", client_id: FREE_CLIENT });
    expect(res.status).toBe(500);
    expect(f.clients.has(FREE_CLIENT)).toBe(true);
    expect(f.calls).not.toContain("deleteClient");
  });

  it("undoes user and client when the trigger did not link them", async () => {
    f.noLink();
    const res = await call({ action: "create_account", client });
    expect(res.status).toBe(500);
    expect(f.calls).toContain("deleteUser");
    expect(f.clients.has(NEW_ID)).toBe(false);
  });

  it("still succeeds (link null) when the recovery link fails", async () => {
    f.fail.recoveryLink = new DepError("down", 500);
    const res = await call({ action: "create_account", client });
    expect(res.status).toBe(201);
    expect(res.body["action_link"]).toBeNull();
  });

  it("validates fields and redirect_to", async () => {
    expect(
      (await call({ action: "create_account", client: { ...client, email: "nope" } })).status,
    ).toBe(400);
    expect(
      (await call({ action: "create_account", client: { ...client, display_name: " " } })).status,
    ).toBe(400);
    expect(
      (await call({ action: "create_account", client, redirect_to: "javascript:alert(1)" })).status,
    ).toBe(400);
    expect((await call({ action: "create_account" })).status).toBe(400);
  });
});

describe("set_access", () => {
  it("blocks in the DB before banning in Auth", async () => {
    const res = await call({ action: "set_access", user_id: CLIENT_USER, blocked: true });
    expect(res.status).toBe(200);
    expect(f.users.get(CLIENT_USER)!.blocked).toBe(true);
    expect(f.calls.indexOf("setBlocked")).toBeLessThan(f.calls.indexOf("setBanned"));
  });

  it("refuses oneself, other admins and unknown accounts", async () => {
    expect((await call({ action: "set_access", user_id: ADMIN, blocked: true })).status).toBe(400);
    expect((await call({ action: "set_access", user_id: OTHER_ADMIN, blocked: true })).status).toBe(
      403,
    );
    expect((await call({ action: "set_access", user_id: NEW_ID, blocked: true })).status).toBe(404);
    expect(f.users.get(OTHER_ADMIN)!.blocked).toBe(false);
  });

  it("reports 502 when the Auth ban fails, leaving the DB block in place", async () => {
    f.fail.setBanned = new DepError("down", 500);
    const res = await call({ action: "set_access", user_id: CLIENT_USER, blocked: true });
    expect(res.status).toBe(502);
    expect(f.users.get(CLIENT_USER)!.blocked).toBe(true);
  });

  it("requires a boolean", async () => {
    expect(
      (await call({ action: "set_access", user_id: CLIENT_USER, blocked: "yes" })).status,
    ).toBe(400);
  });
});

describe("reset_access", () => {
  it("returns a recovery link for an active client account", async () => {
    const res = await call({ action: "reset_access", user_id: CLIENT_USER });
    expect(res.status).toBe(200);
    expect(String(res.body["action_link"])).toContain("ana@example.com");
  });

  it("refuses blocked accounts and admins", async () => {
    f.users.get(CLIENT_USER)!.blocked = true;
    expect((await call({ action: "reset_access", user_id: CLIENT_USER })).status).toBe(409);
    expect((await call({ action: "reset_access", user_id: OTHER_ADMIN })).status).toBe(403);
    expect(f.calls).not.toContain("recoveryLink");
  });
});

describe("update_email", () => {
  it("updates Auth and the client together", async () => {
    const res = await call({
      action: "update_email",
      client_id: CLIENT,
      email: "Ana2@Example.com",
    });
    expect(res.status).toBe(200);
    expect(f.users.get(CLIENT_USER)!.email).toBe("ana2@example.com");
    expect(f.clients.get(CLIENT)!.email).toBe("ana2@example.com");
  });

  it("updates only the client when it has no account", async () => {
    const res = await call({
      action: "update_email",
      client_id: FREE_CLIENT,
      email: "bia2@example.com",
    });
    expect(res.status).toBe(200);
    expect(f.calls).not.toContain("updateUserEmail");
  });

  it("maps an Auth conflict to 409 and leaves the client unchanged", async () => {
    f.fail.updateUserEmail = new DepError("dup", 409);
    const res = await call({ action: "update_email", client_id: CLIENT, email: "x@example.com" });
    expect(res.status).toBe(409);
    expect(f.clients.get(CLIENT)!.email).toBe("ana@example.com");
  });

  it("reverts the Auth e-mail when the client update fails", async () => {
    f.fail.updateClientEmail = new DepError("dup", 409);
    const res = await call({ action: "update_email", client_id: CLIENT, email: "x@example.com" });
    expect(res.status).toBe(409);
    expect(f.users.get(CLIENT_USER)!.email).toBe("ana@example.com");
  });
});
