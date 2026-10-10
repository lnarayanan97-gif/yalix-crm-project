import { createRemoteJWKSet, jwtVerify } from "jose";

interface Env {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGINS?: string;
}

interface VerifiedUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
}

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_ORIGINS || "https://crm.yalixvalor.com,http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function json(data: unknown, status = 200, origin?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function authenticate(request: Request, env: Env): Promise<VerifiedUser | null> {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], FIREBASE_JWKS, {
      algorithms: ["RS256"],
      audience: env.FIREBASE_PROJECT_ID,
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
    });

    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!uid) return null;

    // Authorization is decided on the server from D1 records, never from frontend state or email alone.
    let row = await env.DB.prepare(
      "SELECT uid, email, display_name, role, active, status FROM authorized_users WHERE uid = ? LIMIT 1"
    ).bind(uid).first<Record<string, unknown>>();

    if (!row) {
      row = await env.DB.prepare(
        "SELECT uid, email, display_name, role, active, status FROM users WHERE uid = ? LIMIT 1"
      ).bind(uid).first<Record<string, unknown>>();
    }
    if (!row) return null;

    const active = row.active === 1 || row.active === true || row.status === "active";
    if (!active) return null;

    return {
      uid,
      email: typeof row.email === "string" ? row.email : (typeof payload.email === "string" ? payload.email : ""),
      displayName: typeof row.display_name === "string" ? row.display_name : "",
      role: typeof row.role === "string" ? row.role.toUpperCase() : "MEMBER",
      active,
    };
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const origins = allowedOrigins(env);
    const corsOrigin = origins.has(origin) ? origin : undefined;

    if (request.method === "OPTIONS") {
      if (!corsOrigin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    const url = new URL(request.url);
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, corsOrigin);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "yalix-crm-api", mode: "staging" }, 200, corsOrigin);
    }

    if (!url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404, corsOrigin);

    const user = await authenticate(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401, corsOrigin);

    if (url.pathname === "/api/me") {
      return json({ user }, 200, corsOrigin);
    }

    if (url.pathname === "/api/products") {
      if (user.role !== "ADMIN") return json({ error: "Forbidden" }, 403, corsOrigin);
      const result = await env.DB.prepare(
        "SELECT product_id, name, description, category, unit, active, created_at, updated_at, payload_json FROM products ORDER BY name"
      ).all();
      const products = (result.results || []).map((row: Record<string, unknown>) => {
        if (typeof row.payload_json === "string") {
          try { return JSON.parse(row.payload_json); } catch { /* return normalized columns below */ }
        }
        return {
          productId: row.product_id,
          id: row.product_id,
          name: row.name,
          description: row.description,
          category: row.category,
          unit: row.unit,
          active: row.active === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
      return json({ products }, 200, corsOrigin);
    }

    return json({ error: "Not found" }, 404, corsOrigin);
  },
};
