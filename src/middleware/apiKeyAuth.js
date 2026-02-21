function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY || "dev-key-12345";

  // Accept either X-API-Key OR Authorization: Bearer <key>
  const headerKey = req.header("X-API-Key");
  const auth = req.header("Authorization");
  const bearerKey = auth && auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

  const provided = headerKey || bearerKey;

  if (!provided) {
    return res
      .status(401)
      .json({ error: "Missing API key. Use X-API-Key or Authorization: Bearer <key>." });
  }

  if (provided !== expected) {
    return res.status(403).json({ error: "Invalid API key." });
  }

  next();
}

module.exports = { requireApiKey };