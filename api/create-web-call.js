export const config = { runtime: "nodejs18.x" };

function json(res, status, obj) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  const agent_id = process.env.RETELL_AGENT_ID;
  const apiKey   = process.env.RETELL_API_KEY;

  if (!apiKey) return json(res, 500, { error: "Missing RETELL_API_KEY" });
  if (!agent_id) return json(res, 500, { error: "Missing RETELL_AGENT_ID" });

  // Protección opcional con token público
  const required = process.env.PUBLIC_TEST_TOKEN;
  const provided = req.headers["x-test-token"] || req.query.token;
  if (required && required !== provided) {
    return json(res, 403, { error: "Forbidden" });
  }

  if (req.method === "GET") {
    // Sanity check desde el navegador: /api/create-web-call?token=...
    return json(res, 200, { ok: true, msg: "Use POST to create web call", agent_id_present: !!agent_id });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method Not Allowed" });
  }

  try {
    // API v2 (2025). Si tu cuenta aún usa v1, cambia el path a /create-web-call
    const r = await fetch("https://api.retellai.com/v2/create-web-call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        agent_id,
        metadata: { source: "web_demo" }
      })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return json(res, r.status, { error: data.error || data.message || "Retell API error", raw: data });
    }
    return json(res, 200, { access_token: data.access_token, call_id: data.call_id });
  } catch (e) {
    return json(res, 500, { error: e.message || String(e) });
  }
}

