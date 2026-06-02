/**
 * Dropbox OAuth2 Helper
 * Run this once to get your refresh token:
 *   npx tsx scripts/get-dropbox-refresh-token.ts
 *
 * Prerequisites:
 * 1. Create app at https://www.dropbox.com/developers/apps
 * 2. Set redirect URI to http://localhost:3001/callback in the app settings
 * 3. Enable "files.content.write" and "files.content.read" permissions
 * 4. Set these env vars (or pass via command line):
 *    - DROPBOX_APP_KEY
 *    - DROPBOX_APP_SECRET
 */

import * as http from "http";
import * as url from "url";

const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;
const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

if (!APP_KEY || !APP_SECRET) {
  console.error("Set DROPBOX_APP_KEY and DROPBOX_APP_SECRET first.");
  console.error("Example:");
  console.error("  $env:DROPBOX_APP_KEY='your_key'");
  console.error("  $env:DROPBOX_APP_SECRET='your_secret'");
  process.exit(1);
}

const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&token_access_type=offline`;

console.log("\n1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n2. Authorize the app, then copy the 'code' from the redirect URL.");
console.log("   (It will look like: http://localhost:3001/callback?code=XXXXX)\n");

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (parsed.pathname === "/callback") {
    const code = parsed.query.code as string;

    if (!code) {
      res.writeHead(400);
      res.end("No code found in URL");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Token received! You can close this tab.</h1>");

    server.close();

    try {
      const response = await fetch("https://api.dropbox.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: APP_KEY!,
          client_secret: APP_SECRET!,
          redirect_uri: REDIRECT_URI,
        }),
      });

      const data = await response.json();

      if (data.refresh_token) {
        console.log("\n=== Success! Add these to your .env ===\n");
        console.log(`DROPBOX_APP_KEY=${APP_KEY}`);
        console.log(`DROPBOX_APP_SECRET=${APP_SECRET}`);
        console.log(`DROPBOX_REFRESH_TOKEN=${data.refresh_token}`);
        console.log(`STORAGE_BACKEND=dropbox`);
        console.log("\n========================================\n");
      } else {
        console.error("No refresh_token in response:", data);
      }
    } catch (err) {
      console.error("Token exchange failed:", err);
    }
  }
});

server.listen(PORT, () => {
  console.log(`Waiting for redirect on http://localhost:${PORT}/callback ...\n`);
});
