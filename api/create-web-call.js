export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // Protección sencilla opcional: exige un token público si lo configuras
  const required = process.env.PUBLIC_TEST_TOKEN;
  const provided = req.headers["x-test-token"] || req.query.token;
  if (required && required !== provided) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const agent_id = process.env.RETELL_AGENT_ID;
  if (!agent_id) return res.status(400).json({ error: "Missing RETELL_AGENT_ID" });

  try {
    const r = await fetch("https://api.retellai.com/create-web-call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RETELL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        agent_id,
        metadata: { source: "web_demo" }
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data.error || JSON.stringify(data) });
    }

    // Devuelve solo lo necesario al frontend
    res.status(200).json({ access_token: data.access_token, call_id: data.call_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
