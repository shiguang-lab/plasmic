import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { nasConfig } from "./nas-config.mjs";
const config = await nasConfig();
const tag = process.argv[2];
if (!/^desktop-v\d+\.\d+\.\d+$/.test(tag || ""))
  throw new Error("Use a stable desktop-vX.Y.Z image tag");
const compose = await readFile(
  new URL("../../deploy/compose.yml", import.meta.url),
  "utf8",
);
const service = compose.slice(
  compose.indexOf("  desktop-releases:\n"),
  compose.indexOf("  web:\n"),
);
const nginx = await readFile(
  new URL("../../deploy/nginx.conf", import.meta.url),
  "utf8",
);
const block = nginx.slice(
  nginx.indexOf("  # Update manifests"),
  nginx.indexOf("  location /api/"),
);
const setup = `import base64,sys,re
from pathlib import Path
root=Path(sys.argv[1]); tag=sys.argv[2]
service=base64.b64decode(sys.argv[3]).decode(); block=base64.b64decode(sys.argv[4]).decode()
for name in ['compose.yml','nginx.conf','.env']:
 p=root/name; text=p.read_text()
 backup=root/(name+'.before-desktop-release-images')
 if not backup.exists():
  backup.write_text(text); backup.chmod(p.stat().st_mode & 0o777)
 if name=='compose.yml':
  if '  desktop-releases:\\n' not in text:
   assert text.count('  web:\\n')==1, 'Cannot locate web service'
   text=text.replace('  web:\\n',service+'  web:\\n')
 elif name=='nginx.conf':
  start=text.index('  # Update manifests'); end=text.index('  location /api/',start)
  text=text[:start]+block+text[end:]
 else:
  if re.search(r'^DESKTOP_RELEASE_TAG=',text,re.M):
   text=re.sub(r'^DESKTOP_RELEASE_TAG=.*$', 'DESKTOP_RELEASE_TAG='+tag,text,flags=re.M)
  else: text=text.rstrip()+'\\nDESKTOP_RELEASE_TAG='+tag+'\\n'
 p.write_text(text)
`;
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
execFileSync(
  "ssh",
  [
    ...config.sshArgs,
    `python3 -c ${quote(setup)} ${quote(config.nasDeployDir)} ${quote(tag)} ${quote(Buffer.from(service).toString("base64"))} ${quote(Buffer.from(block).toString("base64"))}`,
  ],
  { stdio: "inherit" },
);
execFileSync(
  "ssh",
  [
    ...config.sshArgs,
    `cd ${quote(config.nasDeployDir)} && docker compose up -d --no-deps --wait --wait-timeout 60 desktop-releases && docker compose exec -T web nginx -t && docker compose exec -T web nginx -s reload`,
  ],
  { stdio: "inherit" },
);
