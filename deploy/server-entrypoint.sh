#!/bin/sh
set -eu
node -e 'const fs=require("fs");const u=new URL(process.env.DATABASE_URI);const p="ormconfig.json";const c=JSON.parse(fs.readFileSync(p));Object.assign(c,{host:u.hostname,port:Number(u.port||5432),username:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)});fs.writeFileSync(p,JSON.stringify(c));'
exec bash tools/run.bash "$@"
