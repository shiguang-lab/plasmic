const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const template = fs.readFileSync(path.join(__dirname, "login-result.html"), "utf8");
const openAppScript = 'window.location.assign("plasmic-desktop://login-complete");';
const scriptHash = createHash("sha256").update(openAppScript).digest("base64");

function sendLoginResult(response, success) {
  response.writeHead(success ? 200 : 502, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  });
  return new Promise((resolve) => {
    response.end(template
      .replaceAll("{{title}}", success ? "You're signed in" : "Sign-in could not be completed")
      .replace("{{message}}", success
        ? "Your Shiguang account is connected. Return to Plasmic to continue creating."
        : "Return to Plasmic and try signing in again.")
      .replace("{{status}}", success ? "✓" : "!")
      .replace("{{autoOpen}}", success ? `<script>${openAppScript}</script>` : ""), resolve);
  });
}

module.exports = { sendLoginResult };
