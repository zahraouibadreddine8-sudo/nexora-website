const NEON_REVIEW_FUNCTION = "https://br-round-sound-b5yltn6q-reviews.compute.c-7.us-east-2.aws.neon.tech/";

const MAX_BODY_BYTES = 16_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_POSTS = 5;
const rateLimit = globalThis.__nexoraReviewRateLimit || new Map();
globalThis.__nexoraReviewRateLimit = rateLimit;

const ALLOWED_RELATIONSHIPS = new Set([
  "Brand",
  "Creator",
  "Agency / partner",
  "Other"
]);

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const real = String(req.headers["x-real-ip"] || "").trim();
  return (forwarded || real || "unknown").slice(0, 100);
}

function sameOriginPost(req) {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return true;
  const host = String(req.headers.host || "").trim();
  return Boolean(host) && origin === `https://${host}`;
}

function isRateLimited(ip) {
  const now = Date.now();
  const existing = rateLimit.get(ip) || [];
  const recent = existing.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_POSTS) {
    rateLimit.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateLimit.set(ip, recent);

  // Keep warm serverless instances from accumulating stale entries forever.
  if (rateLimit.size > 5000) {
    for (const [key, timestamps] of rateLimit) {
      const live = timestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
      if (live.length) rateLimit.set(key, live);
      else rateLimit.delete(key);
    }
  }
  return false;
}

function validateSubmission(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid review submission." };
  }

  if (body.botcheck) {
    return { bot: true };
  }

  const name = cleanText(body.name, 250);
  const email = cleanEmail(body.email);
  const relationship = cleanText(body.relationship, 80);
  const company_or_channel = cleanText(body.company_or_channel, 250);
  const review = cleanText(body.review, 5000);
  const rating = Number(body.rating);
  const legal_acknowledgement = body.legal_acknowledgement === "accepted" ? "accepted" : "";

  if (!name) return { error: "Please provide your name." };
  if (!email) return { error: "Please provide a valid email address." };
  if (!ALLOWED_RELATIONSHIPS.has(relationship)) return { error: "Please choose how you worked with Nexora." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Please choose a rating from 1 to 5." };
  if (!review) return { error: "Please write your review." };
  if (!legal_acknowledgement) return { error: "Please confirm the review statement and legal terms." };

  return {
    value: {
      name,
      email,
      relationship,
      company_or_channel,
      rating,
      review,
      legal_acknowledgement
    }
  };
}

function publicReview(item) {
  if (!item || typeof item !== "object") return null;

  const rating = Number(item.rating);
  const name = cleanText(item.name, 250);
  const relationship = cleanText(item.relationship, 80);
  const company_or_channel = cleanText(item.company_or_channel, 250);
  const review = cleanText(item.review, 5000);
  const created_at = cleanText(item.created_at, 64);
  const rawId = item.id;

  if (!name || !review || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }

  return {
    id: typeof rawId === "number" || typeof rawId === "string" ? rawId : "",
    name,
    relationship,
    company_or_channel,
    rating,
    review,
    created_at
  };
}

async function fetchUpstream(options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(NEON_REVIEW_FUNCTION, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  try {
    if (req.method === "GET") {
      const upstream = await fetchUpstream({
        method: "GET",
        headers: { Accept: "application/json" }
      });

      const payload = await upstream.json().catch(() => null);
      if (!upstream.ok || !payload) {
        return res.status(502).json({ success: false, error: "Review service unavailable." });
      }

      const rawReviews = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.reviews)
          ? payload.reviews
          : [];

      const reviews = rawReviews.map(publicReview).filter(Boolean);
      return res.status(200).json({ success: true, reviews });
    }

    if (!sameOriginPost(req)) {
      return res.status(403).json({ success: false, error: "Cross-site review submissions are not allowed." });
    }

    if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
      return res.status(415).json({ success: false, error: "Review submissions must use JSON." });
    }

    const bodyBytes = Buffer.byteLength(JSON.stringify(req.body || {}), "utf8");
    if (bodyBytes > MAX_BODY_BYTES) {
      return res.status(413).json({ success: false, error: "Review submission is too large." });
    }

    const validation = validateSubmission(req.body);
    if (validation.bot) {
      // Quietly accept honeypot submissions so automated spam gets no useful signal.
      return res.status(200).json({ success: true });
    }
    if (validation.error) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const ip = clientIp(req);
    if (isRateLimited(ip)) {
      res.setHeader("Retry-After", "3600");
      return res.status(429).json({
        success: false,
        error: "Too many review attempts. Please try again later."
      });
    }

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };
    if (ip !== "unknown") {
      headers["X-Forwarded-For"] = ip;
      headers["X-Real-IP"] = ip;
    }

    const upstream = await fetchUpstream({
      method: "POST",
      headers,
      body: JSON.stringify(validation.value)
    });

    if (!upstream.ok) {
      return res.status(502).json({ success: false, error: "Review could not be published." });
    }

    // Never proxy the upstream POST response to the browser. It may contain
    // internal or private fields that must remain server-side.
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Review API proxy error", error);
    return res.status(502).json({ success: false, error: "Review service unavailable." });
  }
}
