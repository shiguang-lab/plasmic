// Exact saved-project replay backend, shared by startup and native UI tests.
const { createHash } = require("node:crypto");
exports.createProjectBackend = ({ opening, startup, models, codes, plume, report, phase, functional = false }) => {
  const hash = value => createHash("sha256").update(value).digest("hex");
  const canonical = value => { const url = new URL(value);url.searchParams.sort();return url.pathname+url.search; };
  const headers = {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"};
  const json = value => new Response(JSON.stringify(value), {headers});
  return async request => {
    const u = new URL(request.url), s = u.pathname;
    if (request.method === "OPTIONS") return new Response(null, {headers:{...headers,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"*"}});
    if (functional && request.method==='POST' && s.startsWith('/api/v1/projects/'+startup.projectId+'/revisions/')) {
      const body=await request.json(), bundle=JSON.parse(body.data);
      if (body.incremental || !bundle.map || !bundle.root) throw Error('Diagnostic requires a complete saved bundle');
      opening.rev={...opening.rev,data:body.data,revision:Number(s.split('/').at(-1))};
      report.saves ??= [];report.saves.push({revision:opening.rev.revision,sha256:hash(body.data)});
      return json({});
    }
    if (!["GET","HEAD"].includes(request.method)) {
      report.blocked.push({phase:phase(),method:request.method,path:s});
      return new Response("Diagnostic blocks writes", {status:405,headers});
    }
    if (models[s]) return new Response(models[s].body,{headers:{...headers,...models[s].headers}});
    const code = codes.get(canonical(request.url));
    if (code) return new Response(Buffer.from(code.body,"base64"),{headers:{...headers,...code.headers}});
    if (/dependency-models|hostless-libraries/.test(s)) throw Error("Missing immutable fixture: " + canonical(request.url));
    if (s === `/api/v1/projects/${startup.projectId}`) {
      if (u.searchParams.get("includeStartup") === "true") return json(opening);
      const {startup: unused, ...withoutStartup} = opening;
      return json(withoutStartup);
    }
    if (s === "/api/v1/auth/self") return json(startup.selfInfo);
    if (s === "/api/v1/app-config") return json(startup.appConfig);
    if (s === "/api/v1/app-ctx") return json(startup.appCtx);
    if (s === "/api/v1/latest-bundle-version") return json({latestBundleVersion:startup.latestBundleVersion});
    if (s === "/api/v1/hosts") return json(startup.hosts);
    if (s === "/api/v1/projects") return json(startup.projectData);
    if (s.endsWith("/branches")) return json({branches:startup.branches});
    if (s.endsWith("/revs/unpublished")) return json({revisions:[]});
    if (s.endsWith("/revision-without-data")) { const {data, ...rev} = opening.rev; return json({rev}); }
    if (s.endsWith("/roles")) return json([]);
    if (s === "/api/v1/plume-pkg") return json(plume);
    if (s.startsWith("/api/v1/pkgs/")) {
      const pkg = opening.depPkgs.find(p => s.endsWith(p.pkgId));
      if (pkg) return json({pkg,depPkgs:opening.depPkgs.filter(p=>p.id!==pkg.id)});
    }
    if (s.startsWith("/api/v1/comments/")) return json({threads:[],reactions:[],users:[]});
    if (/\/app-user$|\/ai\/edit\/status$|\/pkg$/.test(s)) return json({});
    if (s.includes("socket.io")) return new Response("",{status:503,headers});
    if (u.hostname === "fonts.googleapis.com" || s === "/dahlia/stripe.js") return new Response("",{headers:{...headers,"Content-Type":s.endsWith(".js")?"application/javascript":"text/css"}});
    report.unknown ??= [];
    if (!report.unknown.includes(s)) report.unknown.push(s);
    return json({});
  };
};
