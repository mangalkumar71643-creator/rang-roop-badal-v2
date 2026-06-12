const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5000;
const staticBuildDir = path.join(__dirname, "..", "static-build");

const MIME_TYPES = {
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".html": "text/html",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getLatestTimestamp() {
  if (!fs.existsSync(staticBuildDir)) return null;
  const entries = fs.readdirSync(staticBuildDir).filter((e) => /^\d+-\d+$/.test(e));
  if (entries.length === 0) return null;
  return entries.sort((a, b) => Number(b.split("-")[0]) - Number(a.split("-")[0]))[0];
}

function readManifest(platform) {
  const manifestPath = path.join(staticBuildDir, platform, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    return null;
  }
}

function serveLandingPage(res) {
  const iosManifest = readManifest("ios");
  const androidManifest = readManifest("android");

  const iosUrl = iosManifest
    ? `exp+rangroopbadal://expo-development-client/?url=${encodeURIComponent(
        iosManifest.launchAsset?.url || ""
      )}`
    : null;

  const androidUrl = androidManifest
    ? `exp+rangroopbadal://expo-development-client/?url=${encodeURIComponent(
        androidManifest.launchAsset?.url || ""
      )}`
    : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rang Roop Badal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #070714;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
    }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, #a78bfa, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { color: #a0aec0; margin-bottom: 2rem; font-size: 1.1rem; }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 2rem;
      max-width: 420px;
      width: 100%;
    }
    .card h2 { font-size: 1.2rem; margin-bottom: 1rem; color: #e2e8f0; }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed, #db2777);
      color: #fff;
      padding: 0.75rem 2rem;
      border-radius: 50px;
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      margin: 0.5rem;
      transition: opacity 0.2s;
    }
    .badge:hover { opacity: 0.85; }
    .subtitle { font-size: 0.85rem; color: #718096; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <h1>रंग रूप बदल</h1>
  <p>Rang Roop Badal — Color & Shape Matching Game</p>
  <div class="card">
    <h2>Open on your device</h2>
    ${iosUrl ? `<a class="badge" href="${iosUrl}">Open on iOS</a>` : ""}
    ${androidUrl ? `<a class="badge" href="${androidUrl}">Open on Android</a>` : ""}
    ${!iosUrl && !androidUrl ? `<p style="color:#f687b3">No build found. Run <code>pnpm build</code> first.</p>` : ""}
    <p class="subtitle">Requires Expo Go or a custom dev client on your device.</p>
  </div>
</body>
</html>`;

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === "/" || pathname === "/index.html") {
    return serveLandingPage(res);
  }

  if (pathname.startsWith("/manifest")) {
    const platform = req.headers["expo-platform"] || "ios";
    const manifest = readManifest(platform);
    if (!manifest) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Manifest not found. Run pnpm build first." }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(manifest));
  }

  const timestamp = getLatestTimestamp();
  if (timestamp) {
    const filePath = path.join(staticBuildDir, timestamp, pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  const assetPath = path.join(staticBuildDir, pathname);
  if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    const ext = path.extname(assetPath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    return fs.createReadStream(assetPath).pipe(res);
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
