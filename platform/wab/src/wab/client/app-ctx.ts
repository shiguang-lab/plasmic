import { loadCacheKey } from "@/wab/client/LocalStorageKey";
import { Api, setUser } from "@/wab/client/api";
import { Router, isHostFrame } from "@/wab/client/cli-routes";
import { getClientDevFlagOverrides } from "@/wab/client/client-dev-flags";
import { StarterGroupProps } from "@/wab/client/components/StarterGroup";
import { App } from "@/wab/client/components/top-view";
import { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import {
  EditorBootstrapResponse,
  ApiPermission,
  ApiTeam,
  ApiUser,
  ApiWorkspace,
  AppCtxResponse,
  PersonalApiToken,
} from "@/wab/shared/ApiSchema";
import { FastBundler } from "@/wab/shared/bundler";
import { parseBundle } from "@/wab/shared/bundles";
import { ensure, swallowAsync } from "@/wab/shared/common";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import {
  DEVFLAGS,
  DevFlagsType,
  applyDevFlagOverrides,
  applyDevFlagOverridesToTarget,
  applyPlasmicUserDevFlagOverrides,
} from "@/wab/shared/devflags";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { message } from "antd";
import { History } from "history";
import $ from "jquery";
import L from "lodash";
import { observable } from "mobx";
import * as React from "react";
import { useContext } from "react";

export class NonAuthCtx {
  /** PromisifyMethods so that `api` behaves the same in both the top frame and host frame. */
  api: PromisifyMethods<Api>;
  /** This is only set when in the host frame. */
  topFrameApi: PromisifyMethods<TopFrameApi> | null;
  app?: App;
  history: History;
  router: Router;
  change: (f: () => void) => void;
  bundler: FastBundler;
  initialProjectInfo?: EditorBootstrapResponse;
  initialProjectModel?: { projectId: string; branchId?: import("@/wab/shared/ApiSchema").BranchId; data: ReturnType<Api["getSiteInfo"]> };
  readonly lastBundleVersion: string;

  constructor(args: NonAuthCtx) {
    Object.assign(
      this,
      L.pick(
        args,
        "api",
        "topFrameApi",
        "app",
        "history",
        "router",
        "change",
        "bundler",
        "lastBundleVersion",
        "initialProjectInfo",
        "initialProjectModel",
      ),
    );
  }
}

export const NonAuthCtxContext = React.createContext<NonAuthCtx | undefined>(
  undefined,
);

export const useNonAuthCtx = () =>
  ensure(useContext(NonAuthCtxContext), "No NonAuthCtxContext provided");

export interface NonAuthComponentProps {
  nonAuthCtx: NonAuthCtx;
}

export abstract class NonAuthComponentBase<
  P = {},
  S = {},
> extends React.Component<P, S> {
  abstract nonAuthCtx(): NonAuthCtx;
  api() {
    return this.nonAuthCtx().api;
  }
  app() {
    return this.nonAuthCtx().app;
  }
  router() {
    return this.nonAuthCtx().router;
  }
  change(f) {
    return this.nonAuthCtx().change(f);
  }
  routeTo(u) {
    return this.router().routeTo(u);
  }
  bundler() {
    return this.nonAuthCtx().bundler;
  }
}

export class NonAuthComponent<
  P extends NonAuthComponentProps = NonAuthComponentProps,
  S = {},
> extends NonAuthComponentBase<P, S> {
  nonAuthCtx() {
    return this.props.nonAuthCtx;
  }
}

interface SelfInfo extends ApiUser {
  isObserver?: boolean;
  isAdmin?: boolean;
}

interface AppCtxArgs {
  api: PromisifyMethods<Api>;
  topFrameApi: PromisifyMethods<TopFrameApi> | null;
  app: App;
  history: History;
  router: Router;
  change: (f: () => void) => void;
  bundler: FastBundler;
  selfInfo: SelfInfo | null;
  teams: ApiTeam[];
  workspaces: ApiWorkspace[];
  perms: ApiPermission[];
  starters: Starters;
  reloadAll: () => Promise<void>;
  reloadAppCtx: () => Promise<void>;
  ops: AppOps | null;
  appConfig: typeof DEVFLAGS;
  initialProjectInfo?: EditorBootstrapResponse;
  initialProjectModel?: { projectId: string; branchId?: import("@/wab/shared/ApiSchema").BranchId; data: ReturnType<Api["getSiteInfo"]> };
  readonly lastBundleVersion: string;
}

export class AppCtx {
  api: PromisifyMethods<Api>;
  topFrameApi: TopFrameApi | null;
  app: App;
  history: History;
  router: Router;
  change: (f: () => void) => void;
  bundler: FastBundler;
  selfInfo: SelfInfo | null;
  teams: ApiTeam[];
  workspaces: ApiWorkspace[];
  perms: ApiPermission[];
  starters: Starters;
  reloadAll: () => Promise<void>;
  reloadAppCtx: () => Promise<void>;
  ops: AppOps | null;
  /** Final app config with overrides applied already. */
  appConfig: typeof DEVFLAGS;
  /** App config overrides only. */
  appConfigOverrides: Partial<typeof DEVFLAGS>;

  initialProjectInfo?: EditorBootstrapResponse;
  initialProjectModel?: { projectId: string; branchId?: import("@/wab/shared/ApiSchema").BranchId; data: ReturnType<Api["getSiteInfo"]> };
  readonly lastBundleVersion: string;

  private _personalApiTokens = observable.box<PersonalApiToken[] | null>(null);
  get personalApiTokens() {
    return this._personalApiTokens.get();
  }
  set personalApiTokens(tokens: PersonalApiToken[] | null) {
    this._personalApiTokens.set(tokens);
  }

  constructor(args: AppCtxArgs) {
    Object.assign(this, args);
  }

  getAllTeams() {
    return L.sortBy(
      L.uniqBy(
        [...this.teams, ...this.workspaces.map((w) => w.team)],
        (t) => t.id,
      ),
      (t) => t.name,
    ).filter((it) => !it.personalTeamOwnerId);
  }

  get personalTeam() {
    return this.teams.find((it) => it.personalTeamOwnerId);
  }

  get personalWorkspace() {
    return this.workspaces.find((it) => it.team.personalTeamOwnerId);
  }

  async logout() {
    if (this.selfInfo) {
      await this.api.logout();
    }
    this.selfInfo = null;
    // Explicitly setting window.location.href, instead of
    // using router, to make sure we completely clear in-page
    // js state
    window.location.href = APP_ROUTES.login.fill({});
  }
}

interface AppComponentProps {
  appCtx: AppCtx;
  children?: React.ReactNode;
}

export class AppComponent<
  P extends AppComponentProps = AppComponentProps,
  S = {},
> extends React.Component<P, S> {
  appCtx() {
    return this.props.appCtx;
  }
  api() {
    return this.appCtx().api;
  }
  app() {
    return this.appCtx().app;
  }
  bundler() {
    return this.appCtx().bundler;
  }
  router() {
    return this.appCtx().router;
  }
  change(f) {
    return this.appCtx().change(f);
  }
  routeTo(u) {
    return this.router().routeTo(u);
  }
  async logout() {
    await this.appCtx().logout();
  }
  selfInfo() {
    return this.appCtx().selfInfo;
  }
  reloadAll() {
    return this.appCtx().reloadAll();
  }
  ops() {
    return ensure(this.appCtx().ops, "appCtx has no ops");
  }
}

export class AppOps extends AppComponent {
  async renameSite(siteId: string, name: string) {
    // Lazy since PricingModal reaches the whole pricing UI, and this the only use in app-ctx.
    const { maybeShowPaywall } =
      await import("@/wab/client/components/modals/PricingModal");
    await maybeShowPaywall(
      this.appCtx(),
      async () => await this.api().setSiteInfo(siteId, { name }),
    );
    await this.reloadAll();
  }
  async deleteSite(siteId: string) {
    await this.api().deleteSite(siteId);
    await this.reloadAll();
    void message.success({ content: translate(getUiLocale(), "Project deleted") });
  }
  async createPersonalApiToken() {
    const token = await this.api().createPersonalApiToken();
    this.appCtx().personalApiTokens = null;
    return token;
  }
  async revokePersonalApiToken(token: string) {
    await this.api().revokePersonalApiToken(token);
    this.appCtx().personalApiTokens = null;
    return token;
  }
  async emitPersonalApiToken(initToken: string) {
    const token = await this.api().emitPersonalApiToken(initToken);
    this.appCtx().personalApiTokens = null;
    return token;
  }
  private lastDownloadUrl: string | null = null;
  async download(projectId: string, opts?: { dontMigrateProject?: boolean }) {
    const { project, rev, depPkgs } = await this.api().getSiteInfo(projectId, {
      revisionNum: DEVFLAGS.revisionNum ? DEVFLAGS.revisionNum : undefined,
      dontMigrateProject: !!opts?.dontMigrateProject,
    });

    const $link = $(".hidden-file-download");
    const blob = new Blob(
      [
        JSON.stringify([
          ...depPkgs.map((info) => {
            return [info.id, info.model];
          }),
          // Not using `getBundle` as it would throw an error if the project
          // is not migrated
          [project.id, parseBundle(rev)],
        ]),
      ],
      {
        type: "text/plain;charset=utf-8",
      },
    );

    if (this.lastDownloadUrl) {
      // Note that the URL created by URL.createObjectURL(blob) won't be
      // released until the document is unloaded or the URL is explicitly
      // released. So here we release it explicitly.
      URL.revokeObjectURL(this.lastDownloadUrl);
    }
    // Data URL has a size limit. However, object url doesn't.
    this.lastDownloadUrl = URL.createObjectURL(blob);
    $link.attr("href", this.lastDownloadUrl);
    $link.attr("download", `${L.kebabCase(project.name)}_${rev.revision}.json`);
    $link[0].click();
  }

  async downloadFullProjectData(projectId: string, branchIds: string[]) {
    const data = await this.api().getFullProjectData(projectId, branchIds);

    const $link = $(".hidden-file-download");
    const blob = new Blob([JSON.stringify(data)], {
      type: "text/plain;charset=utf-8",
    });

    if (this.lastDownloadUrl) {
      // Note that the URL created by URL.createObjectURL(blob) won't be
      // released until the document is unloaded or the URL is explicitly
      // released. So here we release it explicitly.
      URL.revokeObjectURL(this.lastDownloadUrl);
    }
    // Data URL has a size limit. However, object url doesn't.
    this.lastDownloadUrl = URL.createObjectURL(blob);
    $link.attr("href", this.lastDownloadUrl);
    $link.attr(
      "download",
      `${L.kebabCase(data.project.name)}_${new Date().toISOString()}.json`,
    );
    $link[0].click();
  }
}

// Constant used to determine what starter sections are shown
//   e.g. https://studio.plasmic.app/?starters=general,sitebuilder
const DEFAULT_STARTER_TAG = "general";
const DEFAULT_APP_TAG = "app";

interface Starters {
  templateAndExampleSections: StarterGroupProps[];
  appSections: StarterGroupProps[];
}

export function loadStarters(
  api: PromisifyMethods<Api>,
  user: ApiUser | null,
  appConfig: DevFlagsType,
): Starters {
  if (isHostFrame() || !user) {
    return {
      templateAndExampleSections: [],
      appSections: [],
    };
  }

  const showAdminTeamOnlySections = isAdminTeamEmail(user.email, appConfig);

  const blankProjectSection: StarterGroupProps = {
    title: translate(getUiLocale(), "Blank"),
    // An undefined project will be interpreted as a blank project.  This is only
    // used for dev servers; in production, we always create blank projects from
    // a template as well.
    projects: [
      {
        name: "Blank project",
        tag: "",
        description: "",
        withImage: true,
      },
    ],
    tag: "",
  };

  const templateAndExampleSections = [
    ...(appConfig.hideBlankStarter ? [] : [blankProjectSection]),
    ...appConfig.starterSections.filter(
      (s) =>
        s.tag === DEFAULT_STARTER_TAG &&
        s.title !== "" && // TODO: remove after prod devflag update
        (!s.isPlasmicOnly || showAdminTeamOnlySections),
    ),
  ];

  const appSections = appConfig.starterSections.filter(
    (s) => s.tag === DEFAULT_APP_TAG,
  );

  return {
    templateAndExampleSections,
    appSections,
  };
}

export async function withHostFrameCache<T>(
  key: string,
  useCaching: boolean,
  baseApi: PromisifyMethods<Api>,
  f: () => Promise<T>,
): Promise<T> {
  const realKey = loadCacheKey(key);
  if (isHostFrame()) {
    if (useCaching) {
      const cached = await baseApi.getStorageItem(realKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  }
  const result = await f();
  if (result) {
    await baseApi.addStorageItem(realKey, JSON.stringify(result));
  } else {
    await baseApi.removeStorageItem(realKey);
  }
  return result;
}

async function getAppCtxData(
  ctx: Pick<NonAuthCtx, "api" | "topFrameApi">,
): Promise<AppCtxResponse> {
  if (isHostFrame()) {
    const team = await ctx.topFrameApi?.getCurrentTeam();
    return { workspaces: [], teams: team ? [team] : [], perms: [] };
  }
  return ctx.api.getAppCtx();
}

/** Fetch startup data without applying config or constructing an AppCtx. */
export async function loadAppCtxData(
  ctx: Pick<NonAuthCtx, "api" | "topFrameApi">,
  useCaching: boolean,
) {
  return Promise.all([
    withHostFrameCache("selfInfo", useCaching, ctx.api, () =>
      swallowAsync(ctx.api.getSelfInfo()),
    ),
    withHostFrameCache("appConfig", useCaching, ctx.api, () =>
      ctx.api.getAppConfig(),
    ),
    getAppCtxData(ctx),
  ]);
}

export async function loadAppCtx(
  nonAuthCtx: NonAuthCtx,
  useCaching: boolean = false,
  initialData?: Awaited<ReturnType<typeof loadAppCtxData>>,
) {
  const baseApi = nonAuthCtx.api;

  async function load(data?: Awaited<ReturnType<typeof loadAppCtxData>>) {
    const [
      selfInfo,
      { config: dbConfigOverrides },
      { teams, workspaces, perms },
    ] = data ?? (await loadAppCtxData(nonAuthCtx, useCaching));

    const user = selfInfo?.user || null;
    if (isHostFrame() && user) {
      setUser(user);
    }

    const appConfigOverrides = dbConfigOverrides;

    // First apply default Plasmic overrides
    if (selfInfo?.isAdmin) {
      applyPlasmicUserDevFlagOverrides(appConfigOverrides);
    }

    // Next apply client-specified overrides, via url params and
    // localStorage
    const clientConfigOverrides = getClientDevFlagOverrides();
    applyDevFlagOverridesToTarget(appConfigOverrides, clientConfigOverrides);

    // Apply to DEVFLAGS
    applyDevFlagOverrides(appConfigOverrides);

    const starters = loadStarters(baseApi, user, dbConfigOverrides);

    return {
      selfInfo: user
        ? {
            ...user,
            isObserver: selfInfo?.observer,
            isAdmin: selfInfo?.isAdmin,
          }
        : null,
      appConfig: DEVFLAGS,
      appConfigOverrides,
      starters,
      teams,
      workspaces,
      perms,
    };
  }

  async function reloadAll() {
    Object.assign(appCtx, await load());
    return nonAuthCtx.change(() => {});
  }

  async function reloadAppCtx() {
    Object.assign(appCtx, await getAppCtxData(nonAuthCtx));
    return nonAuthCtx.change(() => {});
  }

  const loaded = await load(initialData);

  const appCtx = new AppCtx({
    api: baseApi,
    topFrameApi: nonAuthCtx.topFrameApi,
    app: ensure(nonAuthCtx.app, "nonAuthCtx has no app"),
    bundler: nonAuthCtx.bundler,
    change: nonAuthCtx.change,
    history: nonAuthCtx.history,
    router: nonAuthCtx.router,
    ...loaded,
    reloadAll,
    reloadAppCtx,
    ops: null,
    lastBundleVersion: nonAuthCtx.lastBundleVersion,
    initialProjectInfo: nonAuthCtx.initialProjectInfo,
    initialProjectModel: nonAuthCtx.initialProjectModel,
  });
  nonAuthCtx.initialProjectInfo = undefined;
  nonAuthCtx.initialProjectModel = undefined;
  appCtx.ops = new AppOps({ appCtx });
  return appCtx;
}
