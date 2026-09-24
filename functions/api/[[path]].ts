interface Env {
  DB: D1Database;
}

type User = { id: string; name: string };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

const id = () => crypto.randomUUID();
const bytes = (length: number) => {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
};
const hash = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
};
const body = async (request: Request) => request.json() as Promise<Record<string, unknown>>;
const bearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

async function authenticated(request: Request, env: Env): Promise<User | null> {
  const token = bearer(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT users.id, users.name FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?',
  ).bind(await hash(token), Date.now()).first<User>();
  return row ?? null;
}

async function createSession(env: Env, userId: string, deviceId: string) {
  const token = bytes(32);
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, device_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id(), userId, deviceId, await hash(token), Date.now(), Date.now() + 1000 * 60 * 60 * 24 * 365).run();
  return token;
}

function userResponse(user: User, token: string, code?: string) {
  return { user, token, ...(code ? { linkCode: code } : {}) };
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const route = Array.isArray(params.path) ? params.path.join('/') : String(params.path ?? '');
  try {
    if (request.method === 'POST' && route === 'auth/register') {
      const data = await body(request);
      const name = typeof data.name === 'string' ? data.name.trim().slice(0, 60) : '';
      const deviceId = typeof data.deviceId === 'string' ? data.deviceId : '';
      if (!name || !deviceId) return json({ error: 'Name und Gerätekennung sind erforderlich.' }, 400);
      const userId = id();
      await env.DB.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)').bind(userId, name, Date.now()).run();
      const token = await createSession(env, userId, deviceId);
      return json(userResponse({ id: userId, name }, token));
    }

    if (request.method === 'POST' && route === 'auth/link') {
      const data = await body(request);
      const code = typeof data.code === 'string' ? data.code.replace(/\D/g, '') : '';
      const deviceId = typeof data.deviceId === 'string' ? data.deviceId : '';
      if (code.length !== 8 || !deviceId) return json({ error: 'Bitte einen gültigen 8-stelligen Verbindungscode eingeben.' }, 400);
      const account = await env.DB.prepare('SELECT id, name FROM users WHERE link_code_hash = ? AND link_code_expires_at > ?').bind(await hash(code), Date.now()).first<User>();
      if (!account) return json({ error: 'Der Verbindungscode ist abgelaufen oder ungültig.' }, 401);
      const token = await createSession(env, account.id, deviceId);
      return json(userResponse(account, token));
    }

    const user = await authenticated(request, env);
    if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

    if (request.method === 'GET' && route === 'me') return json({ user });

    if (request.method === 'POST' && route === 'auth/code') {
      const code = String(Math.floor(10000000 + Math.random() * 90000000));
      await env.DB.prepare('UPDATE users SET link_code_hash = ?, link_code_expires_at = ? WHERE id = ?').bind(await hash(code), Date.now() + 1000 * 60 * 10, user.id).run();
      return json({ code, expiresInSeconds: 600 });
    }

    if (request.method === 'GET' && route === 'notes') {
      const result = await env.DB.prepare('SELECT id, title, text, created_at AS createdAt, deadline, completed FROM notes WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all();
      return json({ notes: result.results });
    }

    if (route === 'notes' && request.method === 'POST') {
      const data = await body(request);
      if (typeof data.title !== 'string' || !data.title.trim() || typeof data.text !== 'string' || !data.text.trim()) return json({ error: 'Titel und Text sind erforderlich.' }, 400);
      const noteId = id();
      await env.DB.prepare('INSERT INTO notes (id, user_id, title, text, created_at, deadline, completed) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(noteId, user.id, data.title.trim().slice(0, 160), data.text.trim(), typeof data.createdAt === 'number' ? data.createdAt : Date.now(), typeof data.deadline === 'string' && data.deadline ? data.deadline : null, data.completed ? 1 : 0).run();
      return json({ id: noteId }, 201);
    }

    const noteId = route.startsWith('notes/') ? route.slice(6) : '';
    if (noteId && (request.method === 'PUT' || request.method === 'DELETE')) {
      const existing = await env.DB.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?').bind(noteId, user.id).first();
      if (!existing) return json({ error: 'Notiz nicht gefunden.' }, 404);
      if (request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(noteId, user.id).run();
        return json({ ok: true });
      }
      const data = await body(request);
      await env.DB.prepare('UPDATE notes SET title = ?, text = ?, deadline = ?, completed = ? WHERE id = ? AND user_id = ?').bind(String(data.title ?? '').trim(), String(data.text ?? '').trim(), typeof data.deadline === 'string' && data.deadline ? data.deadline : null, data.completed ? 1 : 0, noteId, user.id).run();
      return json({ ok: true });
    }
    return json({ error: 'Route nicht gefunden.' }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: 'Serverfehler.' }, 500);
  }
};
