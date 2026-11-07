import tmp from "tmp";
import {
  NextJsContext,
  setupNextjsServer,
  teardownNextJsServer,
} from "../nextjs/nextjs-setup";
import {
  ReactContext,
  setupReactServer,
  teardownReactServer,
} from "../react/react-setup";
import { apiRequestWithLogin, unreachable, uploadProject } from "../utils";

export interface NextJsEnv {
  type: "nextjs";
  loaderVersion: string;
  nextVersion: string;
  reactVersion?: string;
  removeComponentsPage?: boolean;
  template?: string;
}
export interface ReactEnv {
  type: "react";
  reactVersion?: string;
  loaderReactVersion?: string;
  template?: string;
}

export type LoaderEnv = NextJsEnv | ReactEnv;

export type ServerContext =
  ({ type: "nextjs" } & NextJsContext) | ({ type: "react" } & ReactContext);

export type ProjectConfig =
  | string
  | {
      bundleFile: string;
      transform?: (value: string) => string;
      projectName?: string;
    };

export interface LoaderTestConfig {
  bundle: ProjectConfig;
  env: LoaderEnv;
}

export interface ProjectContext {
  projectId: string;
  projectToken: string;
}

export async function setupBundle(bundle: ProjectConfig) {
  const { projectId, projectToken } = await uploadProject(
    typeof bundle === "string" ? bundle : bundle.bundleFile,
    typeof bundle === "string"
      ? bundle
      : bundle.projectName || bundle.bundleFile,
    {
      bundleTransformation:
        typeof bundle === "string" ? undefined : bundle.transform,
    },
  );

  return { projectId, projectToken };
}

export async function teardownBundle(ctx: ProjectContext) {
  await apiRequestWithLogin("DELETE", `/projects/${ctx.projectId}`);
}

export async function setupServer(
  env: LoaderEnv,
  project: ProjectContext,
): Promise<ServerContext> {
  const { name: tmpdir, removeCallback: tmpdirCleanup } = tmp.dirSync({
    unsafeCleanup: true,
  });
  if (env.type === "nextjs") {
    const ctx = await setupNextjsServer(project, env, tmpdir);
    return {
      type: "nextjs",
      ...ctx,
      ...project,
      tmpdir,
      tmpdirCleanup,
    };
  } else if (env.type === "react") {
    const ctx = await setupReactServer(project, env, tmpdir);
    return {
      type: "react",
      ...ctx,
      ...project,
      tmpdir,
      tmpdirCleanup,
    };
  } else {
    unreachable(env);
  }
}

export async function teardownServer(ctx: ServerContext) {
  if (ctx.type === "nextjs") {
    await teardownNextJsServer(ctx);
  } else if (ctx.type === "react") {
    await teardownReactServer(ctx);
  }
  await ctx.tmpdirCleanup();
}

export function makeEnvName(env: LoaderEnv) {
  if (env.type === "nextjs") {
    const parts: string[] = [];
    if (env.template) {
      parts.push(env.template);
    }
    parts.push(`loader-nextjs@${env.loaderVersion}`, `next@${env.nextVersion}`);
    if (env.reactVersion) {
      parts.push(`react@${env.reactVersion}`);
    }
    return parts.join(", ");
  } else if (env.type === "react") {
    return `create-react-app`;
  } else {
    unreachable(env);
  }
}
