import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nasConfig } from "./nas-config.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = await nasConfig();
const nginx = await readFile(path.join(root, "../deploy/nginx.conf"), "utf8");
const block = nginx.slice(nginx.indexOf("  # Update manifests"), nginx.indexOf("  location /api/"));
if (!block.includes("/desktop-updates/")) throw new Error("Missing update server configuration");
const setup = `import base64,sys
from pathlib import Path
root=Path(sys.argv[1]); block=base64.b64decode(sys.argv[2]).decode()
for name in ['compose.yml','nginx.conf']:
 p=root/name; text=p.read_text()
 if name=='nginx.conf' and block in text: continue
 if name=='compose.yml' and 'name: plasmic-desktop-updates' in text: continue
 backup=root/(name+'.before-desktop-updates')
 if not backup.exists(): backup.write_text(text)
 if name=='compose.yml':
  needle='      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro'
  assert text.count(needle)==1, 'Cannot locate web volume'
  if '      - ./desktop-updates:/srv/desktop-updates:ro' in text:
   text=text.replace('      - ./desktop-updates:/srv/desktop-updates:ro','      - desktop-updates:/srv/desktop-updates:ro')
  else: text=text.replace(needle,needle+'\\n      - desktop-updates:/srv/desktop-updates:ro')
  assert text.count('\\nvolumes:\\n')==1, 'Cannot locate Compose volumes'
  text=text.replace('\\nvolumes:\\n','\\nvolumes:\\n  desktop-updates:\\n    name: plasmic-desktop-updates\\n')
 else:
  needle='  location /api/ {'
  assert text.count(needle)==1, 'Cannot locate Studio server'
  if '  # Update manifests' in text:
   start=text.index('  # Update manifests'); end=text.index(needle,start)
   text=text[:start]+block+text[end:]
  else: text=text.replace(needle,block+needle)
 p.write_text(text)
`;
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
execFileSync("ssh", [...config.sshArgs, `python3 -c ${quote(setup)} ${quote(config.nasDeployDir)} ${quote(Buffer.from(block).toString("base64"))}`], { stdio: "inherit" });
execFileSync("ssh", [...config.sshArgs, `cd '${config.nasDeployDir}' && docker compose exec -T web nginx -t && docker compose up -d --no-deps --wait --wait-timeout 60 web && docker compose exec -T web nginx -t && docker compose exec -T web nginx -s reload`], { stdio: "inherit" });
console.log("NAS desktop update hosting configured; existing server and data are preserved.");
