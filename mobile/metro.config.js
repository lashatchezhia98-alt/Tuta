/* eslint-disable @typescript-eslint/no-require-imports -- Metro loads this config as CommonJS. */
const { getDefaultConfig } = require("expo/metro-config");
const https = require("node:https");
const path = require("node:path");
const config = getDefaultConfig(__dirname);
// Native and Next.js share the same services catalog and feature IDs.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), path.resolve(__dirname, "../lib")])];
// Local browser QA uses the real member API without changing production CORS.
// No admin routes, cookies, arbitrary hosts, or secrets are exposed by this proxy.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  if (
    !/^\/api\/(site-features|library|care|partners|market\/(products|orders|checkout)|payments\/flitt\/(status|checkout))([?]|$)/.test(
      req.url || "",
    )
  )
    return middleware(req, res, next);
  if (!["GET", "POST"].includes(req.method)) {
    res.writeHead(405);
    return res.end();
  }
  const headers = {
    "content-type": "application/json",
    ...(req.headers.authorization
      ? { authorization: req.headers.authorization }
      : {}),
  };
  const upstream = https.request(
    "https://tutahealth.ge" + req.url,
    { method: req.method, headers, timeout: 20000 },
    (response) => {
      res.writeHead(response.statusCode || 502, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.pipe(res);
    },
  );
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => {
    if (!res.headersSent)
      res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "API connection unavailable" }));
  });
  req.pipe(upstream);
};
module.exports = config;
