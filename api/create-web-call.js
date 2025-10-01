function sendJson(res, status, obj) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

async function createWebCall({ apiKey, agent_id, endpoint }) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      agent_id,
      // agent_version: 1, // (opcional) si usas versiones
      metadata: { source: "web_demo" }
    })
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* deja 'data' vacío */ }

  return { ok: r.ok, status: r.status, data, raw: text };
}

export default async function handler(req, res) {
  const apiKey  = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID;

  if (!apiKey)  return sendJson(res, 500, { error: "Missing RETELL_API_KEY" });
  if (!agentId) return sendJson(res, 500, { error: "Missing RETELL_AGENT_ID" });

  // Protección opcional por token público
  const required = process.env.PUBLIC_TEST_TOKEN;
  const provided = req.headers["x-test-token"] || req.query.token;
  if (required && required !== provided) {
    return sendJson(res, 403, { error: "Forbidden (bad token)" });
  }

  if (req.method === "GET") {
    // test rápido desde el navegador
    return sendJson(res, 200, { ok: true, hint: "Use POST to create web call", agent_id_present: !!agentId });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  try {
    // 1) Intento con API V2 (2025)
    let resp = await createWebCall({
      apiKey,
      agent_id: agentId,
      endpoint: "https://api.retellai.com/v2/create-web-call"
    });

    // 2) Si V2 no existe en tu cuenta (por ejemplo 404), intenta V1
    if (!resp.ok && (resp.status === 404 || resp.status === 400) ) {
      const fallback = await createWebCall({
        apiKey,
        agent_id: agentId,
        endpoint: "https://api.retellai.com/create-web-call"
      });
      resp = fallback;
    }

    if (!resp.ok) {
      const msg =
        resp.status === 401 ? "Unauthorized: revisa RETELL_API_KEY"
      : resp.status === 403 ? "Forbidden: plan/permiso/token"
      : resp.status === 404 ? "Not Found: endpoint/agent_id"
      : resp.status === 429 ? "Rate limited: intenta más tarde"
      : resp.data?.error || resp.data?.message || "Retell API error";
      return sendJson(res, resp.status, { error: msg, details: resp.data || resp.raw });
    }

    const { access_token, call_id } = resp.data || {};
    if (!access_token) {
      return sendJson(res, 502, { error: "Respuesta sin access_token", details: resp.data || resp.raw });
    }
    return sendJson(res, 200, { access_token, call_id });
  } catch (e) {
    return sendJson(res, 500, { error: e.message || String(e) });
  }
}
