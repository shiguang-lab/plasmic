import { ExecaChildProcess } from "execa";
import fs from "fs";
import { copySync } from "fs-extra";
import getPort from "get-port";
import path from "path";
import tmp from "tmp";
import {
  getEnvVar,
  LOADER_REACT_VERSION,
  PNPM_CACHE_DIR,
  REACT_TYPES_VERSION,
  REACT_VERSION,
} from "../env";
import { ProjectContext, ReactEnv } from "../playwright-tests/setup-utils";
import {
  runCommand,
  uploadProject,
  waitUntilServerDown,
  waitUntilServerUp,
} from "../utils";
import { verifyTargetRuntime } from "../verify-runtime";

export interface ReactContext {
  projectId: string;
  projectToken: string;
  tmpdir: string;
  tmpdirCleanup: () => void;
  server: ExecaChildProcess;
  host: string;
}

export async function setupReact(opts: {
  bundleFile: string;
  projectName: string;
  template?: string;
  reactVersion?: string;
  loaderReactVersion?: string;
}): Promise<ReactContext> {
  const { bundleFile, projectName } = opts;
  const { projectId, projectToken } = await uploadProject(
    bundleFile,
    projectName,
  );
  const { name: tmpdir, removeCallback: tmpdirCleanup } = tmp.dirSync({
    unsafeCleanup: true,
  });

  console.log("tmpdir", tmpdir);
  const { server, host } = await setupReactServer(
    { projectId, projectToken },
    {
      type: "react",
      template: opts.template,
      reactVersion: opts.reactVersion,
      loaderReactVersion: opts.loaderReactVersion,
    },
    tmpdir,
  );

  return {
    projectId,
    projectToken,
    tmpdir,
    tmpdirCleanup,
    server,
    host,
  };
}

export async function teardownReact(ctx: ReactContext) {
  const { tmpdirCleanup } = ctx;
  await teardownReactServer(ctx);
  tmpdirCleanup();
}

export async function setupReactServer(
  project: ProjectContext,
  env: ReactEnv,
  tmpdir: string,
) {
  // Limit concurrency to avoid Verdaccio overload. Reducing CI workers is another option.
  const pnpmCiFlags = `--store-dir "${PNPM_CACHE_DIR}" --network-concurrency=8 --fetch-retries=5`;
  const template = env.template ?? "template";
  const reactVersion = env.reactVersion ?? REACT_VERSION;
  const templateDir = path.resolve(path.join(__dirname, template));
  copySync(templateDir, tmpdir, { recursive: true });

  const npmRegistry = getEnvVar("NPM_CONFIG_REGISTRY");
  const pnpmOptions = {
    dir: tmpdir,
    env: { PNPM_HOME: PNPM_CACHE_DIR, npm_config_registry: npmRegistry },
  };

  await runCommand(
    `pnpm install --frozen-lockfile --strict-peer-dependencies --registry=${npmRegistry} ${pnpmCiFlags}`,
    pnpmOptions,
  );

  const updatePackages = [
    `@plasmicapp/loader-react@${env.loaderReactVersion ?? LOADER_REACT_VERSION}`,
  ];
  updatePackages.push(
    `react@${reactVersion}`,
    `react-dom@${reactVersion}`,
    `@types/react@${REACT_TYPES_VERSION}`,
    `@types/react-dom@${REACT_TYPES_VERSION}`,
  );

  await runCommand(
    `pnpm update ${updatePackages.join(" ")} --strict-peer-dependencies --registry=${npmRegistry} ${pnpmCiFlags}`,
    pnpmOptions,
  );
  verifyTargetRuntime(tmpdir, "@plasmicapp/loader-react");

  const codegenHost = getEnvVar("WAB_HOST");
  fs.writeFileSync(
    path.join(tmpdir, "src", "config.json"),
    JSON.stringify({
      projects: [
        {
          id: project.projectId,
          token: project.projectToken,
        },
      ],
      host: codegenHost,
    }),
  );

  const port = await getPort();

  await runCommand(`pnpm run build`, { dir: tmpdir });
  const server = runCommand(
    `pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    {
      dir: tmpdir,
      output: "inherit",
      noExit: true,
    },
  );
  const host = `http://127.0.0.1:${port}`;
  console.log(`Starting React/Vite at ${host} (pid ${server.pid})`);
  await waitUntilServerUp(host, { process: server });
  console.log(`Started React/Vite server at ${host} (pid ${server.pid})`);

  return {
    server,
    host,
  };
}

export async function teardownReactServer(ctx: {
  server: ExecaChildProcess;
  host: string;
}) {
  const { server, host } = ctx;
  console.log(`Tearing down React/Vite at ${host} (pid ${server.pid})...`);
  server.kill("SIGINT");

  try {
    await waitUntilServerDown(host, { maxTimeout: 60000 });
  } catch {
    throw new Error(`Failed to shut down React/Vite server`);
  }
}
