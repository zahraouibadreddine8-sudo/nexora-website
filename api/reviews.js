const NEON_REVIEW_FUNCTION = "https://br-round-sound-b5yltn6q-reviews.compute.c-7.us-east-2.aws.neon.tech/";

export default async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  try {
    const target = new URL(NEON_REVIEW_FUNCTION);
    if (req.method === "DELETE" && req.query?.id) {
      target.searchParams.set("id", String(req.query.id));
    }

    const headers = { Accept: "application/json" };
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    if (req.method === "POST") headers["Content-Type"] = "application/json";

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "POST" ? JSON.stringify(req.body || {}) : undefined
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.send(text);
  } catch (error) {
    console.error("Review API proxy error", error);
    return res.status(502).json({ success: false, error: "Review service unavailable." });
  }
}
