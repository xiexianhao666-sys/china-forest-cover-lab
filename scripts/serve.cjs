const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
function createServer(root = path.resolve(__dirname, "../dist")) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };
  return http.createServer((req, res) => {
    try {
      const name = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        "." + (name === "/" ? "/index.html" : name),
      );
      const relative = path.relative(root, file);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        res.writeHead(403).end();
        return;
      }
      fs.readFile(file, (error, body) => {
        if (error) {
          res.writeHead(404).end("Not found");
          return;
        }
        res
          .writeHead(200, {
            "Content-Type":
              types[path.extname(file)] || "application/octet-stream",
            "Cache-Control": "no-store",
          })
          .end(body);
      });
    } catch {
      res.writeHead(400).end("Invalid request");
    }
  });
}
module.exports = { createServer };
if (require.main === module) {
  const server = createServer();
  server.listen(Number(process.env.PORT || 3000), "127.0.0.1", () =>
    console.log("Local: http://127.0.0.1:" + server.address().port),
  );
}
