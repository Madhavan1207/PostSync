const http = require("http");
const https = require("https");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PORT = 3001;

const server = http.createServer((req, res) => {
  const options = {
    hostname: "localhost",
    port: 3000,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `localhost:${PORT}`,
      "x-forwarded-host": `localhost:${PORT}`,
      "x-forwarded-proto": "http",
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Intercept JSON body to rewrite any backend references from https://localhost:3000 to http://localhost:3001
    const chunks = [];

    proxyRes.on("data", (chunk) => chunks.push(chunk));
    proxyRes.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const contentType = proxyRes.headers["content-type"] || "";

      if (contentType.includes("application/json")) {
        try {
          const bodyStr = buffer.toString("utf8");
          const rewrittenStr = bodyStr.replace(/https:\/\/localhost:3000/g, `http://localhost:${PORT}`);
          const rewrittenBuffer = Buffer.from(rewrittenStr);

          const headers = { ...proxyRes.headers };
          headers["content-length"] = String(rewrittenBuffer.length);

          res.writeHead(proxyRes.statusCode || 200, headers);
          res.end(rewrittenBuffer);
          return;
        } catch {
          // Fallthrough if parsing fails
        }
      }

      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      res.end(buffer);
    });
  });

  req.pipe(proxyReq, { end: true });

  proxyReq.on("error", (err) => {
    console.error("[Inngest HTTPS Proxy Error]:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Proxy connection to Next.js HTTPS failed: " + err.message }));
  });
});

server.listen(PORT, () => {
  console.log(`[Inngest HTTPS Proxy] Listening on http://localhost:${PORT} -> https://localhost:3000 (URL Rewriting Active)`);
});
