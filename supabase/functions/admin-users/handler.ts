// Logic of the `admin-users` Edge Function (D1/D3), free of Deno and Supabase
// APIs so it runs under vitest. The Deno entry (index.ts) wires `AdminUsersDeps` to the service-role client, which never leaves the
// function. Every action requires an active (not blocked) admin caller.
//
// Actions:
//   create_account  new client (or existing one without access) + Auth user with
//                   confirmed e-mail; the DB trigger links them. Compensates on failure.
//   set_access      block/unblock a client account: profiles.blocked_at first (RLS denies at once),
//                   then the Auth ban (ends refresh). Never on oneself.
//   reset_access    password-setup link (generateLink, no e-mail sent) for the admin
//                   to forward. Refused for blocked accounts.
//   update_email    Auth e-mail and clients.email together; reverts Auth on failure.
//
// set_access and reset_access only act on client accounts: team accounts are
// managed outside the app.

export interface ClientInput {
  display_name: string;
  business_name: string;
  profession: string;
  phone: string;
  email: string;
}

export interface ClientRow {
  id: string;
  display_name: string;
  email: string;
  user_id: string | null;
}

export interface UserRow {
  id: string;
  email: string;
  role: "admin" | "client";
  blocked: boolean;
}

/** Errors thrown by deps may carry an HTTP-ish status (409 conflict, 404 …). */
export class DepError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface AdminUsersDeps {
  /** Validates the caller's JWT with Auth; null when invalid/expired. */
  getCaller(jwt: string): Promise<{ id: string } | null>;
  /** profiles.role = 'admin' and blocked_at is null. */
  isActiveAdmin(userId: string): Promise<boolean>;
  insertClient(input: ClientInput): Promise<ClientRow>;
  getClient(id: string): Promise<ClientRow | null>;
  deleteClient(id: string): Promise<void>;
  updateClientEmail(id: string, email: string): Promise<void>;
  getUser(id: string): Promise<UserRow | null>;
  /** Auth user with confirmed e-mail and no usable password. */
  createUser(email: string, fullName: string): Promise<{ id: string }>;
  deleteUser(id: string): Promise<void>;
  updateUserEmail(id: string, email: string): Promise<void>;
  setBlocked(userId: string, blocked: boolean): Promise<void>;
  setBanned(userId: string, banned: boolean): Promise<void>;
  recoveryLink(email: string, redirectTo: string | undefined): Promise<string>;
}

export interface AdminUsersRequest {
  method: string;
  authorization: string | null;
  body: unknown;
}

export interface AdminUsersResponse {
  status: number;
  body: Record<string, unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (status: number, error: string): AdminUsersResponse => ({ status, body: { error } });

class BadRequest extends Error {}

function str(obj: Record<string, unknown>, key: string, opts: { optional?: boolean } = {}) {
  const v = obj[key];
  if (v === undefined || v === null) {
    if (opts.optional) return "";
    throw new BadRequest(`Campo obrigatório: ${key}.`);
  }
  if (typeof v !== "string") throw new BadRequest(`Campo inválido: ${key}.`);
  return v.trim();
}

function uuid(obj: Record<string, unknown>, key: string) {
  const v = str(obj, key);
  if (!UUID.test(v)) throw new BadRequest(`Campo inválido: ${key}.`);
  return v;
}

function email(obj: Record<string, unknown>, key = "email") {
  const v = str(obj, key).toLowerCase();
  if (!EMAIL.test(v) || v.length > 254) throw new BadRequest("E-mail inválido.");
  return v;
}

function redirect(obj: Record<string, unknown>) {
  const v = str(obj, "redirect_to", { optional: true });
  if (!v) return undefined;
  // Supabase also enforces the project's Redirect URLs allow-list.
  if (!/^https?:\/\/[^\s]+$/.test(v)) throw new BadRequest("redirect_to inválido.");
  return v;
}

function statusOf(err: unknown, fallback = 500) {
  return err instanceof DepError ? err.status : fallback;
}

export async function handleAdminUsers(
  req: AdminUsersRequest,
  deps: AdminUsersDeps,
): Promise<AdminUsersResponse> {
  if (req.method !== "POST") return fail(405, "Método não permitido.");

  const jwt = req.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!jwt) return fail(401, "Sessão ausente.");
  const caller = await deps.getCaller(jwt);
  if (!caller) return fail(401, "Sessão inválida.");
  if (!(await deps.isActiveAdmin(caller.id)))
    return fail(403, "Apenas a equipe pode gerenciar acessos.");

  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    return fail(400, "Corpo inválido.");
  }
  const body = req.body as Record<string, unknown>;

  try {
    switch (body["action"]) {
      case "create_account":
        return await createAccount(body, deps);
      case "set_access":
        return await setAccess(body, caller.id, deps);
      case "reset_access":
        return await resetAccess(body, deps);
      case "update_email":
        return await updateEmail(body, deps);
      default:
        return fail(400, "Ação desconhecida.");
    }
  } catch (err) {
    if (err instanceof BadRequest) return fail(400, err.message);
    return fail(statusOf(err), "Não foi possível concluir a operação.");
  }
}

async function createAccount(body: Record<string, unknown>, deps: AdminUsersDeps) {
  let client: ClientRow;
  let createdClient = false;
  const existingId = body["client_id"];
  if (existingId !== undefined) {
    const found = await deps.getClient(uuid(body, "client_id"));
    if (!found) return fail(404, "Cliente não encontrada.");
    if (found.user_id) return fail(409, "Esta cliente já tem acesso.");
    client = found;
  } else {
    const c = body["client"];
    if (typeof c !== "object" || c === null) throw new BadRequest("Campo obrigatório: client.");
    const input: ClientInput = {
      display_name: str(c as Record<string, unknown>, "display_name"),
      business_name: str(c as Record<string, unknown>, "business_name"),
      profession: str(c as Record<string, unknown>, "profession", { optional: true }),
      phone: str(c as Record<string, unknown>, "phone", { optional: true }),
      email: email(c as Record<string, unknown>),
    };
    if (!input.display_name || !input.business_name) throw new BadRequest("Nome obrigatório.");
    try {
      client = await deps.insertClient(input);
    } catch (err) {
      if (statusOf(err) === 409) return fail(409, "Já existe uma cliente com este e-mail.");
      throw err;
    }
    createdClient = true;
  }
  const redirectTo = redirect(body);

  let user: { id: string };
  try {
    user = await deps.createUser(client.email, client.display_name);
  } catch (err) {
    if (createdClient) await deps.deleteClient(client.id);
    if (statusOf(err) === 409) return fail(409, "Já existe uma conta com este e-mail.");
    throw err;
  }

  // The trigger links the confirmed user to the client with the same e-mail.
  const linked = await deps.getClient(client.id);
  if (linked?.user_id !== user.id) {
    await deps.deleteUser(user.id);
    if (createdClient) await deps.deleteClient(client.id);
    return fail(500, "Não foi possível vincular a conta à cliente.");
  }

  let actionLink: string | null = null;
  try {
    actionLink = await deps.recoveryLink(client.email, redirectTo);
  } catch {
    // The account exists; the admin can ask for a new link (reset_access).
  }
  return { status: 201, body: { client_id: client.id, user_id: user.id, action_link: actionLink } };
}

async function setAccess(body: Record<string, unknown>, callerId: string, deps: AdminUsersDeps) {
  const userId = uuid(body, "user_id");
  const blocked = body["blocked"];
  if (typeof blocked !== "boolean") throw new BadRequest("Campo inválido: blocked.");
  if (userId === callerId) return fail(400, "Você não pode alterar o próprio acesso.");
  const target = await deps.getUser(userId);
  if (!target) return fail(404, "Conta não encontrada.");
  if (target.role !== "client") return fail(403, "Só contas de clientes são gerenciadas aqui.");

  await deps.setBlocked(userId, blocked);
  try {
    await deps.setBanned(userId, blocked);
  } catch {
    // Blocking: the DB already denies every read, which is the safe state.
    // Unblocking: the account stays banned in Auth until retried — also safe.
    return fail(502, "Acesso atualizado no banco, mas a sessão não foi atualizada. Tente de novo.");
  }
  return { status: 200, body: { user_id: userId, blocked } };
}

async function resetAccess(body: Record<string, unknown>, deps: AdminUsersDeps) {
  const user = await deps.getUser(uuid(body, "user_id"));
  if (!user) return fail(404, "Conta não encontrada.");
  if (user.role !== "client") return fail(403, "Só contas de clientes são gerenciadas aqui.");
  if (user.blocked) return fail(409, "Desbloqueie a conta antes de gerar um novo link.");
  const link = await deps.recoveryLink(user.email, redirect(body));
  return { status: 200, body: { user_id: user.id, action_link: link } };
}

async function updateEmail(body: Record<string, unknown>, deps: AdminUsersDeps) {
  const client = await deps.getClient(uuid(body, "client_id"));
  if (!client) return fail(404, "Cliente não encontrada.");
  const next = email(body);
  if (next === client.email) return { status: 200, body: { client_id: client.id, email: next } };

  if (client.user_id) {
    try {
      await deps.updateUserEmail(client.user_id, next);
    } catch (err) {
      if (statusOf(err) === 409) return fail(409, "Já existe uma conta com este e-mail.");
      throw err;
    }
  }
  try {
    await deps.updateClientEmail(client.id, next);
  } catch (err) {
    if (client.user_id) await deps.updateUserEmail(client.user_id, client.email);
    if (statusOf(err) === 409) return fail(409, "Já existe uma cliente com este e-mail.");
    throw err;
  }
  return { status: 200, body: { client_id: client.id, email: next } };
}
