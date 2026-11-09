import { isUserProjectEditor, type StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isDataTokenPanelReadOnly, isTokenPanelReadOnly } from "@/wab/client/components/sidebar/token-utils";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { PublicStyleSection, MainBranchId, type BranchId } from "@/wab/shared/ApiSchema";
import { type LeftTabUiKey, type UiAccess, type UiConfig, canCreateAlias, canEditStyleSection, canOverrideImportedTokens, canOverrideRegisteredTokens } from "@/wab/shared/ui-config-utils";
import { captureComponentSectionPermissions, type ComponentSectionPermissions, captureLeftTabPermissions } from "@/wab/client/studio-ctx/studio-ui-permissions";
import { isEqual } from "lodash";
import { shallow } from "zustand/shallow";
import { createStore, type StoreApi } from "zustand/vanilla";

export type StudioInsertMenuConfig = Readonly<Pick<UiConfig, "insertableTemplates" | "canInsertHostless" | "canInsertBuiltinComponent" | "canInsertBasics">>;
function captureInsertMenuConfig(config: UiConfig): StudioInsertMenuConfig {
  const templates = config.insertableTemplates?.map((template) => Object.freeze({ ...template }));
  if (templates) { Object.freeze(templates); }
  return Object.freeze({
    insertableTemplates: templates,
    canInsertHostless: typeof config.canInsertHostless === "object" ? Object.freeze({ ...config.canInsertHostless }) : config.canInsertHostless,
    canInsertBuiltinComponent: typeof config.canInsertBuiltinComponent === "object" ? Object.freeze({ ...config.canInsertBuiltinComponent }) : config.canInsertBuiltinComponent,
    canInsertBasics: typeof config.canInsertBasics === "object" ? Object.freeze({ ...config.canInsertBasics }) : config.canInsertBasics,
  });
}

export interface StudioUiEnvironmentState {
  readonly hostUrl: string;
  readonly insertMenuConfig: StudioInsertMenuConfig;
  readonly brand: Readonly<NonNullable<UiConfig["brand"]>> | undefined;
  readonly showBranching: boolean;
  readonly branchName: string;
  readonly branchId: BranchId | null;
  readonly hasAppAuth: boolean;
  readonly hasUserInfo: boolean;
  readonly contentEditorMode: boolean;
  readonly componentSectionPermissions: ComponentSectionPermissions;
  readonly styleSectionVisibilities: Readonly<NonNullable<UiConfig["styleSectionVisibilities"]>> | undefined;
  readonly enableDataQueries: boolean;
  readonly isProjectEditor: boolean;
  readonly canEditProject: boolean;
  readonly canEditTag: boolean;
  readonly canComment: boolean;
  readonly usePlasmicImg: boolean;
  readonly tokenPanelReadOnly: boolean;
  readonly canCreateTokens: boolean;
  readonly canOverrideImportedTokens: boolean;
  readonly canOverrideRegisteredTokens: boolean;
  readonly dataTokenPanelReadOnly: boolean;
  readonly leftTabPermissions: Readonly<Record<LeftTabUiKey, UiAccess>>;
  readonly currentArenaEmpty: boolean;
}

/** One Studio's iframe and header inputs, published by the commands that change
 * project metadata, branches, content-editor mode or account configuration. */
export class StudioUiEnvironment {
  private readonly state: StoreApi<StudioUiEnvironmentState>;
  readonly store: ModelFieldStore<StudioUiEnvironmentState>;
  private readonly stopAppCtx: () => void;
  private snapshot: StudioUiEnvironmentState;
  private publicationDepth = 0;
  private disposed = false;

  constructor(private readonly studio: StudioCtx) {
    this.state = createStore(() => this.capture());
    this.snapshot = this.state.getState();
    this.store = { getState: () => this.snapshot, getInitialState: this.state.getInitialState, subscribe: this.state.subscribe };
    this.stopAppCtx = studio.appCtx.subscribeUiEnvironmentInputs(() => this.sync());
    this.syncArena();
  }

  private capture(): StudioUiEnvironmentState {
    const { studio } = this;
    const branch = studio.branchInfo();
    const uiConfig = studio.getCurrentUiConfig();
    const brand = uiConfig.brand ??
      studio.appCtx.appConfig.brands?.[studio.siteInfo.teamId ?? ""] ??
      studio.appCtx.appConfig.brands?.[""];
    return Object.freeze({
      hostUrl: studio.getHostUrl(),
      insertMenuConfig: captureInsertMenuConfig(uiConfig),
      brand: brand && Object.freeze({
        logoImgSrc: brand.logoImgSrc,
        logoHref: brand.logoHref,
        logoAlt: brand.logoAlt,
        logoTooltip: brand.logoTooltip,
      }),
      showBranching: !!studio.showBranching(),
      branchName: branch?.name ?? MainBranchId,
      branchId: branch?.id ?? null,
      hasAppAuth: !!studio.siteInfo.hasAppAuth,
      hasUserInfo: !!studio.appCtx.selfInfo,
      contentEditorMode: studio.contentEditorMode,
      componentSectionPermissions: captureComponentSectionPermissions((section) => canEditStyleSection(uiConfig, section, {
        isContentCreator: studio.contentEditorMode, defaultContentEditorVisible: false,
      })),
      styleSectionVisibilities: uiConfig.styleSectionVisibilities && Object.freeze({ ...uiConfig.styleSectionVisibilities }),
      enableDataQueries: !!studio.appCtx.appConfig.enableDataQueries,
      isProjectEditor: isUserProjectEditor(studio.appCtx.selfInfo, studio.siteInfo, studio.siteInfo.perms),
      canEditProject: studio.canEditProject(),
      canComment: studio.showComments(),
      usePlasmicImg: !!studio.appCtx.appConfig.usePlasmicImg,
      canEditTag: canEditStyleSection(uiConfig, PublicStyleSection.Tag, { isContentCreator: studio.contentEditorMode, defaultContentEditorVisible: false }),
      tokenPanelReadOnly: isTokenPanelReadOnly(studio),
      canCreateTokens: canCreateAlias(uiConfig, "token"),
      canOverrideImportedTokens: canOverrideImportedTokens(uiConfig),
      canOverrideRegisteredTokens: canOverrideRegisteredTokens(uiConfig),
      dataTokenPanelReadOnly: isDataTokenPanelReadOnly(studio),
      leftTabPermissions: captureLeftTabPermissions((key) => studio.getLeftTabPermission(key)),
      currentArenaEmpty: studio.currentArenaEmpty,
    });
  }

  sync() {
    if (this.disposed) { return; }
    return this.studio.saveState.deferPublication(() => this.syncInputs());
  }

  private syncInputs() {
    this.studio.syncSaveAccess();
    const next = this.capture();
    const previous = this.snapshot;
    const shared = Object.freeze({ ...next, insertMenuConfig: isEqual(previous.insertMenuConfig, next.insertMenuConfig) ? previous.insertMenuConfig : next.insertMenuConfig, styleSectionVisibilities: shallow(previous.styleSectionVisibilities, next.styleSectionVisibilities) ? previous.styleSectionVisibilities : next.styleSectionVisibilities, brand: isEqual(previous.brand, next.brand) ? previous.brand : next.brand,
        leftTabPermissions: shallow(previous.leftTabPermissions, next.leftTabPermissions) ? previous.leftTabPermissions : next.leftTabPermissions,
        componentSectionPermissions: shallow(previous.componentSectionPermissions, next.componentSectionPermissions) ? previous.componentSectionPermissions : next.componentSectionPermissions });
    this.snapshot = shallow(previous, shared) ? previous : shared;
    this.publishCommit();
  }

  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.publishCommit(); }
  }
  transaction<Result>(command: () => Result): Result {
    return this.deferPublication(() => {
    const snapshot = this.snapshot;
    const models = this.studio.modelSnapshots;
    try { return command(); }
    catch (error) { if (!this.disposed && models === this.studio.modelSnapshots) { this.snapshot = snapshot; } throw error; }
      });
  }

  publishCommit() {
    if (!this.disposed && !this.publicationDepth && this.state.getState() !== this.snapshot) { this.state.setState(this.snapshot, true); }
  }

  /** Arena's canonical owner calls this after installing its complete roster. */
  syncArena() {
    if (this.disposed) { return; }
    const currentArenaEmpty = this.studio.currentArenaEmpty;
    if (this.snapshot.currentArenaEmpty !== currentArenaEmpty) { this.snapshot = Object.freeze({ ...this.snapshot, currentArenaEmpty }); }
    this.publishCommit();
  }

  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.stopAppCtx();
  }
}
