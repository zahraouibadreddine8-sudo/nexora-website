const NEON_REVIEW_FUNCTION = "https://br-round-sound-b5yltn6q-reviews.compute.c-7.us-east-2.aws.neon.tech/";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  try {
    const target = new URL(NEON_REVIEW_FUNCTION);
    const headers = { Accept: "application/json" };
    if (req.headers["x-forwarded-for"]) headers["X-Forwarded-For"] = String(req.headers["x-forwarded-for"]);
    if (req.headers["x-real-ip"]) headers["X-Real-IP"] = String(req.headers["x-real-ip"]);
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
