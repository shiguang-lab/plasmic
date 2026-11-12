import { memoizeModelQuery } from "@/wab/shared/model-query";
import { CanvasContentEditorIndex } from "@/wab/client/studio-ctx/canvas-content-editor";
import { SingleRsStyleInputs } from "@/wab/client/studio-ctx/style-inputs";
import { FrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { StudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { StudioArenaState, type ArenaStatus, type StudioViewportSnapshot } from "@/wab/client/studio-ctx/studio-arena-state";
import { subscribeStudioSelection, subscribeFocusedViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import { StudioVersionHistory } from "@/wab/client/studio-ctx/studio-version-history";
import { StudioUiEnvironment } from "@/wab/client/studio-ctx/studio-ui-environment";
import type { Site } from "@/wab/shared/model/classes";
import { subscribeStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import { StudioRenderPolicy, type RenderPolicyInputs } from "@/wab/client/studio-ctx/studio-render-policy";
import { StudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { DragInsertManager } from "@/wab/client/Dnd";
import {
  handleError,
  logError,
  reportError,
  showError,
} from "@/wab/client/ErrorNotifications";
import {
  focusPreferenceKey,
  fullPageHeightKey,
  storageViewAsKey,
} from "@/wab/client/LocalStorageKey";
import { ProjectDependencyManager } from "@/wab/client/ProjectDependencyManager";
import { zoomJump } from "@/wab/client/Zoom";
import { invalidationKey } from "@/wab/client/api";
import {
  getProjectReleases,
  listUnpublishedProjectRevisions,
} from "@/wab/client/api-hooks";
import { parseProjectLocation } from "@/wab/client/cli-routes";
import { ReadableClipboard } from "@/wab/client/clipboard/ReadableClipboard";
import { WritableClipboard } from "@/wab/client/clipboard/WritableClipboard";
import { PLASMIC_CLIPBOARD_FORMAT } from "@/wab/client/clipboard/common";
import {
  LocalClipboard,
  LocalClipboardAction,
} from "@/wab/client/clipboard/local";
import { paste } from "@/wab/client/clipboard/paste";
import { syncCodeComponentsAndHandleErrors } from "@/wab/client/code-components/code-components";
import {
  showReloadError,
  showSaveErrorRecoveredNotice,
} from "@/wab/client/components/Messages";
import { getVisibleFrameRect } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import { handleCanvasContentWheel } from "@/wab/client/components/canvas/canvas-scroll";
import { SiteOps } from "@/wab/client/components/canvas/site-ops";
import {
  InsertRelLoc,
  getFocusedInsertAnchor,
  getPreferredInsertLocs,
} from "@/wab/client/components/canvas/view-ops";
import { TplCommentThread } from "@/wab/client/components/comments/utils";
import {
  clearDarkMask,
  createDarkMask,
} from "@/wab/client/components/darkMask";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import {
  PaywallError,
  maybeShowPaywall,
} from "@/wab/client/components/modals/PricingModal";
import {
  DataPickerTypesSchema,
  extraTsFilesSymbol,
} from "@/wab/client/components/sidebar-tabs/DataBinding/DataPicker";
import { TraitRegistry } from "@/wab/client/components/splits/TraitRegistry";
import gridFramesLayoutStyles from "@/wab/client/components/studio/arenas/GridFramesLayout.module.sass";
import {
  getHostLessPkgIdentity,
  getSortedHostLessPkgs,
  getVersionForCanvasPackages,
} from "@/wab/client/components/studio/studio-bundles";
import { adjustGridStyleForCurZoom } from "@/wab/client/components/style-controls/GridEditor";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import {
  AlertData,
  AlertSpec,
} from "@/wab/client/components/widgets/plasmic/AlertBanner";
import { personalProjectPaywallMessage } from "@/wab/client/components/widgets/plasmic/ShareDialogContent";
import { clientToFramePt, frameToScalerRect } from "@/wab/client/coords";
import { CopilotActivity } from "@/wab/client/copilot/activity";
import { startComponentReuse } from "@/wab/client/copilot/component-reuse";
import { DbCtx, WithDbCtx } from "@/wab/client/db";
import {
  AddFakeItem,
  AddTplItem,
  ExtraInfoOpts,
  INSERTABLES_MAP,
} from "@/wab/client/definitions/insertables";
import {
  cachedJQSelector,
  getTextWidth,
  isCanvasIframeEvent,
  setElementStyles,
} from "@/wab/client/dom-utils";
import { fixupChrome, fixupForChanges } from "@/wab/client/fixes-post-change";
import { FontManager } from "@/wab/client/fonts";
import { getHostWindow } from "@/wab/client/frame-ctx/host-window";
import type { SavedEditorView } from "@/wab/client/frame-ctx/top-frame-api";
import {
  getRootSubHostVersion,
  getRootSubReact,
} from "@/wab/client/frame-ctx/windows";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { checkDepPkgHosts } from "@/wab/client/init-ctx";
import {
  getCopyState,
  postInsertableTemplate,
} from "@/wab/client/insertable-templates";
import { PLATFORM } from "@/wab/client/platform";
import { clearIdleCallback, requestIdleCallback } from "@/wab/client/requestidlecallback";
import { plasmicExtensionAvailable } from "@/wab/client/screenshot-util";
import { scriptExec } from "@/wab/client/script-exec";
import { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { CommentsCtx } from "@/wab/client/studio-ctx/comments-ctx";
import { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import { DesktopDraftController } from "@/wab/client/studio-ctx/desktop-drafts";
import { InspectorSelection } from "@/wab/client/studio-ctx/inspector-selection";
import { MultiplayerCtx } from "@/wab/client/studio-ctx/multiplayer-ctx";
import { ModelSnapshots, type ModelRef, type ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import {
  StudioLeftPanelState,
  type LeftPanel,
  type OnboardingTourState,
} from "@/wab/client/studio-ctx/left-panel-state";
import { subscribeViewport } from "@/wab/client/studio-ctx/viewport-state";
import { StudioLoadTimings } from "@/wab/client/studio-ctx/studio-load-timings";
import { UiActionBus } from "@/wab/client/studio-ctx/ui/UiActionBus";
import { UiId, parseUiId } from "@/wab/client/studio-ctx/ui/studio-ui-ids";
import {
  SpotlightAndVariantsInfo,
  ViewCtx,
} from "@/wab/client/studio-ctx/view-ctx";
import {
  StyleMgr,
  UpsertStyleChanges,
  summaryToStyleChanges,
} from "@/wab/client/style-mgr";
import { trackEvent } from "@/wab/client/tracking";
import { UndoLog, UndoRecord, ViewStateSnapshot } from "@/wab/client/undo-log";
import {
  getHostUrl,
  isImmutableHostPage,
  maybeToggleTrailingSlash,
} from "@/wab/client/utils/app-hosting-utils";
import { drainQueue } from "@/wab/commons/asyncutil";
import { safeCallbackify } from "@/wab/commons/control";
import { unwrap } from "@/wab/commons/neverthrow-utils";
import { isLatest, latestTag, lt } from "@/wab/commons/semver";
import { DeepReadonly } from "@/wab/commons/types";
import type { ProjectRevision } from "@/wab/server/entities/Entities";
import { UnauthorizedError } from "@/wab/shared/ApiErrors/errors";
import {
  ApiBranch,
  ApiPermission,
  ApiProject,
  ApiTeam,
  ApiUser,
  ArenaType,
  BranchId,
  CopilotChatOpenOpts,
  CopilotImage,
  CopilotInteractionId,
  MainBranchId,
  TemplateSpec,
  UpdatePlayerViewRequest,
} from "@/wab/shared/ApiSchema";
import {
  AnyArena,
  FrameViewMode,
  cloneArenaFrame,
  doesFrameVariantMatch,
  ensureActivatedScreenVariantsForArena,
  ensureActivatedScreenVariantsForFrameByWidth,
  getArenaContaining,
  getArenaFrames,
  getArenaName,
  getArenaType,
  getArenaUuidOrName,
  getFrameHeight,
  getGridRowLabels,
  isComponentArena,
  isDedicatedArena,
  isHeightAutoDerived,
  isMixedArena,
  isPageArena,
  setFocusedFrame,
  syncArenaFrameSize,
  updateAutoDerivedFrameHeight,
} from "@/wab/shared/Arenas";
import {
  AccessLevel,
  accessLevelRank,
  isPkgVersionInfoMeta,
  isProjectRevision,
  isUnownedProject,
} from "@/wab/shared/EntUtil";
import {
  MinimalRevisionInfo,
  PkgVersionInfo,
  PkgVersionInfoMeta,
  SiteInfo,
} from "@/wab/shared/SharedApi";
import { isSlot, tryGetMainContentSlotTarget } from "@/wab/shared/SlotUtils";
import { addEmptyQuery } from "@/wab/shared/TplMgr";
import {
  VariantCombo,
  isScreenVariant,
  isVariantSettingEmpty,
} from "@/wab/shared/Variants";
import { AddItemKey } from "@/wab/shared/add-item-keys";
import type { ServerToClientEvents } from "@/wab/shared/api/socket";
import { BoundedCache } from "@/wab/shared/bounded-cache";
import {
  Bundle,
  BundledInst,
  FastBundler,
  checkBundleFields,
  checkRefsInBundle,
} from "@/wab/shared/bundler";
import { UnsafeBundle, getBundle, parseBundle } from "@/wab/shared/bundles";
import {
  allCodeLibraries,
  allCustomFunctions,
  computedProjectFlags,
  usedHostLessPkgs,
} from "@/wab/shared/cached-selectors";
import {
  getBuiltinComponentRegistrations,
  isBuiltinCodeComponent,
} from "@/wab/shared/code-components/builtin-code-components";
import {
  CodeComponentsRegistry,
  HighlightInteractionRequest,
  registeredFunctionId,
  syncPlumeComponent,
} from "@/wab/shared/code-components/code-components";
import { arrayRemove, arrayReversed } from "@/wab/shared/collections";
import {
  AsyncCallable,
  arrayEq,
  arrayEqIgnoreOrder,
  asOne,
  assert,
  assertNever,
  asyncMaxAtATime,
  asyncOneAtATime,
  asyncTimeout,
  ensure,
  ensureHTMLElt,
  ensureType,
  isNonNil,
  last,
  maybe,
  mkShortId,
  removeWhere,
  spawn,
  swallow,
  switchType,
  tuple,
  withTimeout,
  withoutNils,
  xDifference,
  xGroupBy,
} from "@/wab/shared/common";
import {
  ensureActivatedScreenVariantsForComponentArenaFrame,
  getComponentArenaBaseFrame,
} from "@/wab/shared/component-arenas";
import { RootComponentVariantFrame } from "@/wab/shared/component-frame";
import type { AiOutputFormat } from "@/wab/shared/copilot/copilot-tool-types";
import { PROTOTYPE_TOOL_META as prototypeToolMeta } from "@/wab/shared/copilot/prototype-tools";
import {
  CodeComponent,
  ComponentType,
  PageComponent,
  allComponentVariants,
  getRealParams,
  isCodeComponent,
  isFrameComponent,
  isPageComponent,
  isPlainComponent,
  tryGetComponentByUuid,
} from "@/wab/shared/core/components";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import { JsonValue } from "@/wab/shared/core/lang";
import {
  ComponentContext,
  ModelChange,
  RecordedChanges,
  emptyRecordedChanges,
  filterPersistentChanges,
  mergeRecordedChanges,
} from "@/wab/shared/core/observable-model";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { customFunctionId } from "@/wab/shared/core/query-ids";
import {
  isSelectable,
  makeSelectableFullKey,
  type Selectable,
} from "@/wab/shared/core/selection";
import {
  allGlobalVariants,
  getArenaByNameOrUuidOrPath,
  getDedicatedArena,
  getSiteArenas,
  isHostLessPackage,
  isTplAttachedToSite,
  siteIsEmpty,
  tryGetGlobalVariantByUuid,
} from "@/wab/shared/core/sites";
import { SlotSelection } from "@/wab/shared/core/slots";
import { SplitStatus } from "@/wab/shared/core/splits";
import {
  taggedUnbundle,
  unbundleProjectDependency,
  unbundleSite,
} from "@/wab/shared/core/tagged-unbundle";
import {
  EventHandlerKeyType,
  ancestorsUp,
  flattenTpls,
  isTplComponent,
  isTplContainer,
  isTplNamable,
  isTplSlot,
  isTplVariantable,
  tplChildren,
  trackComponentRoot,
  trackComponentSite,
  tryGetTplByUuid,
  tryGetTplOwnerComponent,
} from "@/wab/shared/core/tpls";
import { undoChanges } from "@/wab/shared/core/undo-util";
import { ValComponent, ValNode } from "@/wab/shared/core/val-nodes";
import {
  ALL_QUERIES,
  dataSourceTemplateToString,
  mkDataSourceOpExpr,
  mkDataSourceTemplate,
} from "@/wab/shared/data-sources-meta/data-sources";
import { AddItemPrefs, getSimplifiedStyles } from "@/wab/shared/default-styles";
import type { DesktopDraft } from "@/wab/shared/desktop-drafts";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import {
  DEVFLAGS,
  InsertableTemplatesGroup,
  InsertableTemplatesItem,
} from "@/wab/shared/devflags";
import { DataSourceUser } from "@/wab/shared/dynamic-bindings";
import { noopFn } from "@/wab/shared/functions";
import { Box, Pt } from "@/wab/shared/geom";
import { cloneInsertableTemplateComponent } from "@/wab/shared/insertable-templates";
import { InsertableTemplateComponentExtraInfo } from "@/wab/shared/insertable-templates/types";
import { createFindReferencesStore } from "@/wab/client/studio-ctx/find-references-state";
import { createPageSettingsStore } from "@/wab/client/studio-ctx/page-settings-state";
import { createPresetsStore } from "@/wab/client/studio-ctx/presets-state";
import { createCopilotStore } from "@/wab/client/studio-ctx/copilot-state";
import { createStartupStore } from "@/wab/client/studio-ctx/startup-state";
import { createCursorStore, setCursorLocation } from "@/wab/client/studio-ctx/cursor-state";
import { createCanvasLoadStore } from "@/wab/client/studio-ctx/canvas-load-state";
import { createRightPanelStore } from "@/wab/client/studio-ctx/right-panel-state";
import { createCanvasOverviewStore } from "@/wab/client/studio-ctx/canvas-overview-state";
import {
  createStepsCacheStore,
  saveStepsCacheValue,
} from "@/wab/client/studio-ctx/steps-cache-state";
import { createCanvasInsertStore } from "@/wab/client/studio-ctx/canvas-insert-state";
import {
  createContentEditorModeStore,
  setContentEditorMode,
} from "@/wab/client/studio-ctx/content-editor-mode-state";
import {
  addInstalledHostlessPkg,
  clearInstalledHostlessPkgs,
  createHostlessPkgsStore,
  hasInstalledHostlessPkg,
  installedHostlessPkgs,
  removeInstalledHostlessPkg,
} from "@/wab/client/studio-ctx/hostless-pkgs-state";
import {
  createSyntheticSectionsStore,
  showSyntheticSection,
} from "@/wab/client/studio-ctx/synthetic-sections-state";
import { subscribeToSelector } from "@/wab/client/stores/store-kit";
import { shallow } from "zustand/shallow";
import { modelKeysForChanges } from "@/wab/shared/model-change-keys";
import {
  ModelRevisions,
} from "@/wab/shared/model-revisions";
import { instUtil } from "@/wab/shared/model/InstUtil";
import * as classes from "@/wab/shared/model/classes";
import {
  Animation,
  Arena,
  ArenaChild,
  ArenaFrame,
  Component,
  ComponentArena,
  DataSourceTemplate,
  DataToken,
  ObjInst,
  PageArena,
  ProjectDependency,
  StyleToken,
  TemplatedString,
  TplComponent,
  TplNode,
  TplSlot,
  TplTag,
  Variant,
  VariantGroup,
  isKnownArenaFrame,
  isKnownComponentArena,
  isKnownProjectDependency,
  isKnownVariantSetting,
} from "@/wab/shared/model/classes";
import { modelSchemaHash } from "@/wab/shared/model/classes-metas";
import {
  ChangeSummary,
  ChangesType,
  summarizeChanges,
} from "@/wab/shared/model/model-change-util";
import { reorderPageArenaCols } from "@/wab/shared/page-arenas";
import {
  ensurePageOverviewArena,
  findPageOverviewArena,
} from "@/wab/shared/page-overview";
import { getAccessLevelToResource, getUniqueUsersFromApiPermissions } from "@/wab/shared/perms";
import {
  APP_ROUTES,
  SEARCH_PROMPT,
  mkProjectLocation,
} from "@/wab/shared/route/app-routes";
import {
  DeletedAssetsSummary,
  getEmptyDeletedAssetsSummary,
  undoChangesAndResolveConflicts,
  updateSummaryFromDeletedInstances,
} from "@/wab/shared/server-updates-utils";
import {
  INITIAL_VERSION_NUMBER,
  calculateSemVer,
  compareSites,
  extractSplitStatusDiff,
} from "@/wab/shared/site-diffs";
import {
  InvariantError,
  assertSiteInvariants,
} from "@/wab/shared/site-invariants";
import { naturalSort } from "@/wab/shared/sort";
import {
  LeftTabKey,
  LeftTabUiKey,
  UiConfig,
  getLeftTabPermission,
  mergeUiConfigs,
} from "@/wab/shared/ui-config-utils";
import {
  extractParamsFromPagePath,
  isCatchallParam,
} from "@/wab/shared/utils/url-utils";
import {
  DataOp,
  executePlasmicDataOp,
  makeCacheKey,
  makeQueryCacheKey,
} from "@plasmicapp/data-sources";
import * as Sentry from "@sentry/browser";
import { message, notification } from "antd";
import { ArgsProps } from "antd/lib/notification";
import asynclib from "async";
import cn from "classnames";
import stringify from "fast-stringify";
import { Location, createPath } from "history";
import $ from "jquery";
import {
  debounce,
  groupBy,
  head,
  isNil,
  keyBy,
  mapValues,
  maxBy,
  memoize,
  partition,
  throttle,
  uniq,
} from "lodash";
import defer from "lodash/defer";
import isEqual from "lodash/isEqual";
import { Result, err, ok } from "neverthrow";
import React from "react";
import semver from "semver";
import * as Signals from "signals";
import { mutate } from "swr";
import { StoreApi, createStore } from "zustand/vanilla";

(window as any).dbg.classes = classes;

const MAX_SAVE_RETRIES = 300; // Saves every 2 seconds means retry for 10 minutes
const DEFAULT_ZOOM_PADDING = 40;

interface StudioCtxArgs {
  dbCtx: DbCtx;
  loadTimings?: StudioLoadTimings;
  /**
   * Whether to start the timer that periodically saves the project. Tests turn it off
   * since they never persist anything. Defaults to true.
   */
  autoSave?: boolean;
}

interface ZoomState {
  readonly clientPt: Pt;
  readonly scalerPt: Pt;
}

interface WheelZoomState extends ZoomState {
  // These are used for zooming by wheel
  readonly startScreenX: number;
  readonly startScreenY: number;
  lastZoomEventTimestamp: number;
}

interface PanningState {
  readonly initScreenX: number;
  readonly initScreenY: number;
  readonly initScrollX: number;
  readonly initScrollY: number;
  readonly initCanvasPadding: Pt;
  readonly initiatedByMiddleButton: boolean;
}

export class FreestyleState {
  constructor(readonly spec: AddTplItem) {}
}

export type PointerState =
  "move" | "rect" | "hstack" | "vstack" | "text" | "stack";

export class DragInsertState {
  constructor(
    readonly dragMgr: DragInsertManager,
    readonly spec: AddTplItem,
  ) {}
}


export type ProjectMentionUser = Readonly<Pick<ApiUser, "id" | "email" | "displayName">>;
export type ProjectMetadataSnapshot = Readonly<Pick<SiteInfo,
  "id" | "name" | "appAuthProvider" | "projectApiToken" | "isMainBranchProtected"
>> & { readonly mentionUsers: readonly ProjectMentionUser[] };

const emptyMentionUsers: readonly ProjectMentionUser[] = Object.freeze([]);
function captureMentionUsers(perms: SiteInfo["perms"], previous = emptyMentionUsers) {
  const next = getUniqueUsersFromApiPermissions(perms).map((user) => {
    const old = previous.find((candidate) => candidate.id === user.id);
    return old && old.email === user.email && old.displayName === user.displayName
      ? old : Object.freeze({ id: user.id, email: user.email, displayName: user.displayName });
  });
  return next.length === previous.length && next.every((user, index) => user === previous[index])
    ? previous : Object.freeze(next);
}

export type StudioAppUser = Pick<
  DataSourceUser,
  | "email"
  | "externalId"
  | "roleId"
  | "roleIds"
  | "roleName"
  | "roleNames"
  | "isLoggedIn"
  | "properties"
  | "customProperties"
>;

export interface StudioChangeOpts {
  // Agent operations return errors to their caller instead of showing a toast.
  noErrorNotification?: boolean;
  // If you are calling StudioCtx.change() from a React event handler, and you are
  // reading values from the event, you should pass that event in here.  This is
  // because StudioCtx.change() may occur asynchronously, and because React
  // recycles the event objects, by the time your change function is called,
  // the event object may have been freed.  Passing this in means if StudioCtx
  // knows that your change function will be called asynchronously, it will call
  // event.persist() for you so that it will not be reused by React.  This should
  // happen pretty rarely (more likely in Playwright tests than real usage).
  // Note also that you should only need to do this for React events; if you're
  // using jquery events or raw browser events, they don't get reused in this way.
  event?: React.SyntheticEvent;

  // Some changes are internal fixes that shouldn't create a new entry in the
  // undo log. If this flag is true, the model changes will be added to the last
  // entry in the undo log (or ignored if there's no entry yet), and changes to
  // the view state will be ignored.
  // In general, this flag shouldn't be used, except for situation such as:
  // - Some asynchronous fixes, e.g. create vsettings after the frame loads;
  // - Reactions to other changes, such as fixes made by a resize observer;
  // - Fixes made to the data model when initializing Studio.
  noUndoRecord?: boolean;
}

enum SaveResult {
  StopSaving = "StopSaving",
  SkipUpToDate = "SkipUpToDate",
  SkipIsChanging = "SkipIsChanging",
  Throttled = "Throttled",
  Success = "Success",
  GatewayError = "GatewayError",
  UnknownError = "UnknownError",
  TimedOut = "TimedOut",
  TriedEditProtectedMain = "TriedEditProtectedMain",
}

export enum PublishResult {
  SaveFailed = "SaveFailed",
  OutOfDate = "OutOfDate",
  SkipAlreadyPublished = "SkipAlreadyPublished",
  PreFilling = "PreFilling",
  Success = "Success",
  UnknownError = "UnknownError",
  // eslint-disable-next-line @typescript-eslint/no-shadow
  PaywallError = "PaywallError",
}

export interface SaveTplAsPresetState {
  // This is the adapted tpl, i.e. it has only one variant setting.
  tpl: TplComponent;
  vc: ViewCtx;
  dom?: HTMLElement;
}

export interface PresetDrawerState {
  component: Component;
  // unique id of the state. Used to distinguish different drawer.
  uid: number;
}

type ModelChangeRequest =
  | ArbitraryModelChangeRequest
  | UndoModelChangeRequest
  | RedoModelChangeRequest
  | FetchModelUpdatesRequest;

interface ArbitraryModelChangeRequest<T = any> {
  type: "change";
  changeFn: () => Result<T, any>;
  opts?: StudioChangeOpts;
}

interface UndoModelChangeRequest {
  type: "undo";
}

interface RedoModelChangeRequest {
  type: "redo";
}

interface FetchModelUpdatesRequest {
  type: "fetchModelUpdates";
}

let nextPresetDrawerId = 1;
export const genPresetDrawerId = () => {
  return nextPresetDrawerId++;
};

class UnsupportedServerUpdate extends Error {
  name: "UnsupportedServerUpdate";
  constructor(m: string) {
    super(m);
  }
}

export function calculateNextVersionKey(studioCtx: StudioCtx) {
  return invalidationKey(
    "calculateNextPublishVersion",
    studioCtx.branchInfo()?.id,
  );
}

export enum RightTabKey {
  style = "style",
  interactions = "interactions",
  comments = "comments",
  component = "component",
}


export type ModelCommit = { type: "commit"; summary: ChangeSummary } | { type: "site-replaced"; site: Site };

export class StudioCtx extends WithDbCtx {
  //
  // Keep track of modifier keys and space keys as they are pressed
  //

  private static SPACE = 32;
  private static META = 91;
  private static SHIFT = 16;
  private static CTRL = 17;
  private static ALT = 18;
  private disposals: (() => void)[] = [];
  _dbCtx: DbCtx;
  readonly commentsCtx: CommentsCtx;
  readonly modelRevisions = new ModelRevisions();
  modelSnapshots = new ModelSnapshots();
  singleRsStyleInputs = new SingleRsStyleInputs(() => this.modelSnapshots);
  readonly arenaState: StudioArenaState;
  private readonly modelCommitListeners = new Set<(event: ModelCommit) => void>();
  readonly frameHeights = new FrameHeights(this);
  private readonly contentEditors = new CanvasContentEditorIndex(() => this.viewCtxs);
  readonly activeContentEditorStore = this.contentEditors.store;
  subscribeModelChanges(listener: (event: ModelCommit) => void) {
    this.modelCommitListeners.add(listener);
    return () => { this.modelCommitListeners.delete(listener); };
  }
  readonly clipboard = new LocalClipboard();
  fontManager: FontManager;
  readonly renderPolicy: StudioRenderPolicy;
  readonly overlayState = new StudioOverlayState();
  readonly previewOwnerStore = createStore<PreviewCtx | undefined>(() => undefined);
  get previewCtx() { return this.previewOwnerStore.getState(); }
  set previewCtx(value: PreviewCtx | undefined) {
    this.withPreviewLivePolicy(value?.isLive ?? false, () => this.previewOwnerStore.setState(value, true));
  }
  private readonly _viewportCtx = createStore<ViewportCtx | null>(() => null);
  readonly viewportOwnerStore = {
    getState: this._viewportCtx.getState,
    getInitialState: this._viewportCtx.getInitialState,
    subscribe: this._viewportCtx.subscribe,
  };
  get viewportCtx() {
    return this._viewportCtx.getState();
  }
  set viewportCtx(value: ViewportCtx | null) {
    this._viewportCtx.setState(value, true);
  }

  studioIsVisible = false;
  setStudioVisible(value: boolean) { this.studioIsVisible = value; }
  readonly startupStore = createStartupStore();
  get initialRouteReady() {
    return this.startupStore.getState().routeLoaded;
  }
  readonly loadTimings: StudioLoadTimings;
  private initialCanvasFrames: ArenaFrame[] = [];
  private initialEditorView: SavedEditorView | null = null;
  get initialViewportReady() {
    return this.startupStore.getState().viewportLoaded;
  }
  get hasInitialEditorView() {
    return this.initialEditorView !== null;
  }
  readonly latestVariantCreatedStore = createStore<ModelRef<Variant> | undefined>(
    () => undefined,
  );
  get latestVariantCreated(): Variant | undefined {
    const ref = this.latestVariantCreatedStore.getState();
    return ref ? this.modelSnapshots.resolve(ref) : undefined;
  }
  set latestVariantCreated(variant: Variant | undefined) {
    this.latestVariantCreatedStore.setState(
      variant ? this.modelSnapshots.ref(variant) : undefined,
      true,
    );
  }
  readonly variantGroupEditingStore = createStore<ModelRef<VariantGroup> | undefined>(() => undefined);
  private pendingVariantGroupEdit: ModelRef<VariantGroup> | undefined;
  requestVariantGroupEditing(group: VariantGroup) {
    this.pendingVariantGroupEdit = this.modelSnapshots.ref(group);
  }
  consumeVariantGroupEditing(ref: ModelRef<VariantGroup>) {
    if (this.variantGroupEditingStore.getState() === ref) {
      this.variantGroupEditingStore.setState(undefined, true);
    }
  }

  private hostLessRegistry: CodeComponentsRegistry;
  readonly hostlessPkgsStore = createHostlessPkgsStore();
  private hostLessPkgsFrame: HTMLIFrameElement;
  private hostLessPkgsLock = Promise.resolve();

  /**
   * Fetches the host page html for an artboard iframe. Each artboard needs its own document
   * since Next16 keys its React debug channel on the request that produced the html, and
   * hands it to whoever claims it first, so artboards sharing one document would leave all
   * but one waiting forever.
   */
  readonly fetchHostPageHtml: () => Promise<string>;

  constructor(args: StudioCtxArgs) {
    super();


    this.loadTimings = args.loadTimings ?? new StudioLoadTimings();
    ({ dbCtx: this._dbCtx } = args);
    this.renderPolicy = new StudioRenderPolicy({ isLive: () => !!this.isLiveMode, isDragging: () => this.isDraggingObject() });
    this.projectMetadataStore = createStore<ProjectMetadataSnapshot>(() => Object.freeze({ id: this.siteInfo.id, name: this.siteInfo.name, appAuthProvider: this.siteInfo.appAuthProvider, projectApiToken: this.siteInfo.projectApiToken, isMainBranchProtected: this.siteInfo.isMainBranchProtected, mentionUsers: captureMentionUsers(this.siteInfo.perms) }));
    this.syncSaveAccess();
    this.arenaState = new StudioArenaState(this);
    this.uiEnvironment = new StudioUiEnvironment(this);
    this.versionHistory = new StudioVersionHistory(this);

    const hostPageUrl = (toggleTrailingSlash: boolean) =>
      maybeToggleTrailingSlash(
        toggleTrailingSlash,
        this.getHostUrl({ fixHostOrigin: true }),
      );

    const immutableHostPage = isImmutableHostPage(hostPageUrl(false));
    const fetchHostPageHtml = async () => {
      const fetchUrl = async (url: string) => {
        const res = await fetch(url, {
          redirect: "follow",
          headers: this.siteInfo.extraData?.customHostConfig?.headers,
        });
        if (immutableHostPage && !res.ok) {
          throw new Error(`Cannot load built-in Host HTML: ${res.status}`);
        }
        return await res.text();
      };

      try {
        return await fetchUrl(hostPageUrl(false));
      } catch {
        return await fetchUrl(hostPageUrl(true));
      }
    };

    // Start fetching now so the first artboard doesn't wait on it. Nothing may
    // ever consume it, so keep a failure from surfacing as an unhandled
    // rejection; the consumer still sees it.
    let prefetched: Promise<string> | undefined = fetchHostPageHtml();
    prefetched.catch(() => undefined);
    this.fetchHostPageHtml = () => {
      const html = prefetched ?? fetchHostPageHtml();
      prefetched = immutableHostPage ? html : undefined;
      if (immutableHostPage) {
        html.catch(() => {
          if (prefetched === html) {
            prefetched = undefined;
          }
        });
      }
      return html;
    };

    this.commentsCtx = new CommentsCtx(this);

    this.switchRightTab(RightTabKey.style);

    this.setHostLessPkgs();

    this.bundler()
      .allIidsByUuid(this.siteInfo.id)
      .forEach((iid) => this._savedIids.add(iid));

    this.asyncSaver = asyncOneAtATime(
      this.trySave.bind(this),
      SaveResult.Throttled,
    );
    // We keep this timer enabled even if we are in read-only mode, in case the
    // user keeps making changes.
    //
    // Usually, we immediately get a non-error notice.  Then, when we try
    // editing, we get an error.  After that, we don't show any more errors.
    //
    // This could be better (we can keep erroring as the user makes changes) but
    // we should really just move away from this mode of allowing the user to
    // continue making edits.  (And longer term, need real-time collaboration.)
    if (args.autoSave ?? true) {
      this.asyncSaverTimer = window.setInterval(() => {
        if (DEVFLAGS.autoSave && this.canEditProject()) {
          spawn(
            this.asyncSaver().then((r) => {
              console.log("Save result is", r);
              if (r === SaveResult.StopSaving) {
                window.clearInterval(this.asyncSaverTimer);
              }
            }),
          );
        }
      }, 2000);
    }

    this._serverUpdatesSummary = getEmptyDeletedAssetsSummary();
    this.undoLog = new UndoLog(
      this.site,
      this.recorder,
      this._serverUpdatesSummary,
    );

    this.projectDependencyManager = new ProjectDependencyManager(this);

    // styleMgr must be instantiated after ProjectDependencyManager, as
    // it makes use of TPL_COMPONENT_ROOT updates that ProjectDependencyManager
    // will perform
    this.styleMgr = new StyleMgr(this);

    this.fontManager = new FontManager(this.site);
    this.fontManager.installAllUsedFonts([$(document.head)]);
    this.disposals.push(this.fontManager.observeHostFonts(getHostWindow()));

    this.setDocsMode(!!APP_ROUTES.projectDocs.parse(location.pathname, false));
    const initialLoadTimer = setTimeout(() => {
      if (!this.activeCanvasReady || !this.initialViewportReady) {
        this.reportCanvasLoadError(
          new Error("Timed out waiting for the initial artboard to render"),
        );
      }
    }, 180_000);
    this.disposals.push(() => clearTimeout(initialLoadTimer));
    this.runAfterInitialCanvasReady(async () => {
      clearTimeout(initialLoadTimer);
    });

    this.runAfterInitialCanvasReady(() =>
      this.versionHistory.refreshReleases(),
    );

    this.runAfterInitialCanvasReady(() =>
      this.versionHistory.refreshRevisions(),
    );

    this.runAfterInitialCanvasReady(async () => {
      this.disposals.push(startComponentReuse(this));
    });

    this.disposals.push(
      this.appCtx.history.listen(({ location }) => {
        spawn(this.handleRouteChange(location));
      }),
      this.uiActionBus.registerListener((uiId, _type) => {
        const parsed = parseUiId(uiId);
        switch (parsed.type) {
          case "Section":
            switch (parsed.section) {
              case "PageMetaUrl":
              case "PageMetaUrlParams":
                this.switchRightTab(RightTabKey.component);
                break;
              default:
                assertNever(parsed.section);
            }
            break;
          case "Model":
            switch (parsed.typeTag) {
              case "DataToken":
                this.switchLeftTab("dataTokens");
                break;
              case "StyleToken":
                this.switchLeftTab("tokens");
                break;
              case "AnimationSequence":
                this.switchLeftTab("animationSequences");
                break;
              case "Variant": {
                const globalVariant = tryGetGlobalVariantByUuid(
                  this.site,
                  parsed.uuid,
                  { includeDeps: "direct" },
                );
                if (!globalVariant) {
                  // A component variant: focus its owning component so the
                  // variants panel shows it.
                  const owner = this.site.components.find((c) =>
                    allComponentVariants(c).some((v) => v.uuid === parsed.uuid),
                  );
                  if (owner) {
                    this.switchToComponentArena(owner);
                    this.switchRightTab(RightTabKey.component);
                  }
                } else if (isScreenVariant(globalVariant)) {
                  this.switchLeftTab("responsiveness");
                } else {
                  this.switchRightTab(RightTabKey.component);
                }
                break;
              }
              case "ComponentDataQuery":
              case "ComponentServerQuery":
              case "PropParam":
              case "StateParam":
              case "SlotParam":
              case "GlobalVariantGroupParam":
              case "StateChangeHandlerParam":
                this.switchRightTab(RightTabKey.component);
                break;
              case "Component": {
                const component = tryGetComponentByUuid(this.site, parsed.uuid);
                if (component && isPageComponent(component)) {
                  this.switchToComponentArena(component);
                } else {
                  this.switchLeftTab("components");
                }
                break;
              }
              default:
                assertNever(parsed.typeTag);
            }
            break;
          case "Tpl": {
            const component = tryGetComponentByUuid(
              this.site,
              parsed.componentUuid,
            );
            const tpl = component && tryGetTplByUuid(component, parsed.tplUuid);
            if (component && tpl) {
              spawn(this.setStudioFocusOnTpl(component, tpl));
            }
            break;
          }
          default:
            assertNever(parsed);
        }
      }).dispose,
      this.observeArenaCommands(),
      this.observeSaveInputs(),
      this.observeFocusedViewComponent(),
      this.observeHostlessPackages(),
      subscribeViewport(
        this,
        (state) => state.isTransforming,
        () => {
          // Things that should be fixed upon canvas transform
          this.fixRuler();
          this.adjustDevEnv(this.zoom);
        },
      ),
    );
  }

  private observeHostlessPackages() {
    let previous: ReturnType<typeof usedHostLessPkgs> | undefined;
    const sync = () => {
      if (isHostLessPackage(this.site)) { return; }
      const packages = usedHostLessPkgs(this.site);
      if (!isEqual(previous, packages)) { previous = packages; this.updatePkgsList(packages); }
    };
    const stop = this.subscribeModelChanges(sync);
    sync();
    return stop;
  }

  private observeArenaCommands() {
    let active = true;
    let pendingFrames: object | undefined;
    const updateTitle = () => {
      if (!active || this.canvasLoadingDisposed) { return; }
      const projectName = this.projectMetadataStore.getState().name;
      const branch = this.dbCtx().branchInfo;
      const branchName = branch ? branch.name : MainBranchId;
      const version = this.dbCtx().pkgVersionInfoMeta?.version;
      const arenaName = this.arenaState.store.getState().name;
      let title = `${projectName} - Plasmic`;
      if (arenaName) {
        title = version && !isLatest(version)
          ? `${arenaName} (${branchName}@${version}) - ${projectName} - Plasmic`
          : branch ? `${arenaName} (${branchName}) - ${projectName} - Plasmic` : `${arenaName} - ${projectName} - Plasmic`;
      }
      const task = this.appCtx.topFrameApi?.setDocumentTitle(title);
      if (task) { spawn(task); }
    };
    const framesChanged = () => {
      const lifetime = this.arenaState.lifetime();
      if (pendingFrames === lifetime) { return; }
      pendingFrames = lifetime;
      defer(() => {
        if (pendingFrames !== lifetime) { return; }
        pendingFrames = undefined;
        if (active && this.arenaState.isCurrentLifetime(lifetime)) { this.framesChanged.dispatch(); }
      });
    };
    const persistFocus = () => {
      const state = this.arenaState.store.getState();
      if ((state.kind === "component" || state.kind === "page") && this.focusPreference !== state.focusedMode) {
        this.focusPreference = state.focusedMode;
        spawn(this.appCtx.api.addStorageItem(this.mkFocusPreferenceKey(), state.focusedMode ? "true" : "false"));
      }
    };
    const observeComponents = () => {
      const components = this.arenaState.observedComponentsStore.getState();
      if (components.length) { this.dbCtx().maybeObserveComponents(components.map((ref) => this.modelSnapshots.resolve(ref)), ComponentContext.Arena); }
    };
    let branch = this.dbCtx().branchInfo;
    let version = this.dbCtx().pkgVersionInfoMeta?.version;
    const stops = [
      this.arenaState.store.subscribe((next, previous) => {
        if (next.current !== previous.current || next.name !== previous.name) { updateTitle(); }
        if (next.current !== previous.current) { framesChanged(); }
        if (next.kind !== previous.kind || next.focusedMode !== previous.focusedMode) { persistFocus(); }
      }),
      this.arenaState.frameMembershipStore.subscribe(framesChanged),
      this.arenaState.observedComponentsStore.subscribe(observeComponents),
      this.projectMetadataStore.subscribe((next, previous) => { if (next.name !== previous.name) { updateTitle(); } }),
      this.dbCtx().subscribeVersionInputs(() => {
        const nextBranch = this.dbCtx().branchInfo;
        const nextVersion = this.dbCtx().pkgVersionInfoMeta?.version;
        if (nextBranch !== branch || nextVersion !== version) { branch = nextBranch; version = nextVersion; updateTitle(); }
      }),
    ];
    updateTitle(); persistFocus(); observeComponents();
    return () => { active = false; pendingFrames = undefined; stops.forEach((stop) => stop()); };
  }

  private observeFocusedViewComponent() {
    const observe = () => {
      const component = this.focusedViewCtx()?.currentComponent();
      if (component) { this.dbCtx().maybeObserveComponents([component], ComponentContext.View); }
    };
    let stopContext: (() => void) | undefined;
    const follow = () => {
      stopContext?.();
      const view = this.focusedViewCtx();
      stopContext = view?.selectionStore.subscribe((state, previous) => { if (state.context !== previous.context) { observe(); } });
      observe();
    };
    const stopOwner = subscribeStudioSelection(this, (state) => state.view, follow);
    follow();
    return () => { stopOwner(); stopContext?.(); };
  }

  private setHostLessPkgs() {
    this.hostLessPkgsFrame = document.createElement("iframe");
    this.hostLessPkgsFrame.style.display = "none";
    document.body.appendChild(this.hostLessPkgsFrame);
    const hostLessWindow = ensure(
      this.hostLessPkgsFrame.contentWindow,
      "the hostless window must be non null",
    );
    (hostLessWindow as any).__Sub = (window as any).__Sub;
    this.hostLessRegistry = new CodeComponentsRegistry(
      hostLessWindow,
      getBuiltinComponentRegistrations(),
    );
    clearInstalledHostlessPkgs(this);
  }

  async updateCcRegistry(pkgs: string[]) {
    const previousFetch = this.hostLessPkgsLock;
    this.hostLessPkgsLock = previousFetch
      // A failed load rejects its caller, but must not poison later retries.
      .catch(() => undefined)
      .then(async () => {
        const currentPackages = new Set(
          pkgs.map((pkg) => getHostLessPkgIdentity(pkg, this.site)),
        );
        const pkgsData = await getSortedHostLessPkgs(
          ensure(
            this.hostLessPkgsFrame.contentWindow,
            "Missing hostless window",
          ),
          this.appCtx.api,
          pkgs.filter(
            (pkg) =>
              this.site.hostLessPackageInfo?.name === pkg ||
              !hasInstalledHostlessPkg(
                this,
                getHostLessPkgIdentity(pkg, this.site),
              ),
          ),
          getVersionForCanvasPackages(this.hostLessPkgsFrame.contentWindow),
          this.site,
        );
        (() => {
          for (const pkg of installedHostlessPkgs(this)) {
            if (!currentPackages.has(pkg)) {
              removeInstalledHostlessPkg(this, pkg);
            }
          }
          // Install everything before clearing the registry so revision-keyed
          // derivations recompute once, after the whole batch lands.
          for (const [pkg, pkgModule] of pkgsData) {
            if (!hasInstalledHostlessPkg(this, pkg)) {
              const hostLessWindow = ensure(
                this.hostLessPkgsFrame.contentWindow,
                "hostless window must be non null",
              );
              scriptExec(hostLessWindow, pkgModule);
              addInstalledHostlessPkg(this, pkg);
            }
          }
          // Clear the memoized map
          this.hostLessRegistry.clear();
        })();
      });
    await this.hostLessPkgsLock;
  }

  private updatePkgsList(pkgs: string[]) {
    if (
      pkgs.some(
        (pkg) =>
          !hasInstalledHostlessPkg(this, getHostLessPkgIdentity(pkg, this.site)),
      )
    ) {
      spawn(this.updateCcRegistry(pkgs));
    }
  }

  async ensureCodeComponentRegistrations() {
    this.updatePkgsList(usedHostLessPkgs(this.site));
    await this.hostLessPkgsLock;
  }

  getHostLessComponentsMap() {
    return this.hostLessRegistry.getRegisteredCodeComponentsMap();
  }

  getHostLessContextsMap() {
    return this.hostLessRegistry.getRegisteredContextsMap();
  }

  getHostUrl(opts?: { fixHostOrigin?: boolean }) {
    return getHostUrl(
      this.siteInfo,
      this.branchInfo(),
      this.appCtx.appConfig,
      opts?.fixHostOrigin,
    );
  }

  get hoverBoxControlledObj() {
    const vc = this.focusedViewCtx();

    if (this.canvasContentEditor) {
      const selection = vc?.focusedSelectable();
      return selection && vc?.contentEditor.contains(selection)
        ? selection
        : undefined;
    }

    if (!vc) {
      return this.focusedFrame();
    }
    const frame = vc.arenaFrame();
    const obj = vc.focusedSelectable();

    if (!obj) {
      if (vc.focusedTpl()) {
        // We have a focused tpl that is hidden. Don't select the frame!
        return undefined;
      }
      return frame;
    }

    if (
      obj instanceof ValNode &&
      vc.getViewOps().isRootNodeOfStretchFrame(obj.tpl)
    ) {
      // If we're focused on the root node of a stretching frame, then HoverBox is really
      // controlling the position and size of the frame, not the root node
      return frame;
    }

    return obj;
  }

  get canvasContentEditor() {
    return this.activeContentEditorStore.getState();
  }

  get hoverBoxControlledObjs() {
    const vc = this.focusedViewCtx();

    if (this.canvasContentEditor) {
      return (
        vc
          ?.focusedSelectables()
          .filter(
            (selection): selection is Selectable =>
              !!selection && vc.contentEditor.contains(selection),
          ) ?? []
      );
    }

    if (!vc) {
      return [this.focusedFrame()];
    }
    const frame = vc.arenaFrame();
    const obj = vc.focusedSelectables();

    const focusedTpls = vc.focusedTpls();
    assert(
      obj.length === focusedTpls.length,
      "focusedSelectable and focusedTpls should have the same length.",
    );

    if (
      obj.every((sel, i) => sel === undefined && focusedTpls[i] === undefined)
    ) {
      return [frame];
    }

    if (
      obj.length === 1 &&
      obj[0] instanceof ValNode &&
      vc.getViewOps().isRootNodeOfStretchFrame(obj[0].tpl)
    ) {
      // If we're focused on the root node of a stretching frame, then HoverBox is really
      // controlling the position and size of the frame, not the root node
      return [frame];
    }

    return obj;
  }

  /** Default arena to use (e.g. arena not specified in URL, current arena deleted). */
  private firstArena(): AnyArena | undefined {
    // prefer custom/mixed arenas
    if (this.site.arenas.length > 0) {
      return this.site.arenas[0];
    }

    const firstPageOrComponent =
      this.site.components.find((comp) => comp.pageMeta?.path === "/") ||
      this.site.components.find((comp) => isPageComponent(comp)) ||
      this.site.components.find((comp) => isPlainComponent(comp));
    return firstPageOrComponent
      ? this.getDedicatedArena(firstPageOrComponent)
      : undefined;
  }

  switchToFirstArena() {
    this.switchToArena(this.firstArena(), { replace: true });
  }

  finishedLoading() {
    this._dbCtx.recorder.setExtraListener(() =>
      assert(
        (this._isChanging && this.recorder.isRecording) ||
          (this._isUndoing && this.recorder.isRecording) ||
          (this._isRefreshing && this.recorder.isRecording) ||
          this._isRestoring,
        "Invariant Failed: Unexpected model change",
      ),
    );
  }

  dbCtx() {
    return this._dbCtx;
  }

  siteOps() {
    return new SiteOps(this);
  }

  projectFlags() {
    return computedProjectFlags(this.site);
  }

  async refreshSiteInfo() {
    const {
      project,
      perms,
      owner,
      latestRevisionSynced,
      hasAppAuth,
      appAuthProvider,
      isMainBranchProtected,
    } = await this.appCtx.api.getSiteInfo(this.siteInfo.id);
    this.runNativeSaveCommand(() => this.uiEnvironment.deferPublication(() => {
    this.dbCtx().setSiteInfo({
      ...project,
      perms,
      owner,
      latestRevisionSynced,
      hasAppAuth,
      appAuthProvider,
      isMainBranchProtected,
    });
    this.uiEnvironment.sync();
    const settings = this.projectMetadataStore.getState();
    const mentionUsers = captureMentionUsers(this.siteInfo.perms, settings.mentionUsers);
    if (settings.mentionUsers !== mentionUsers || settings.id !== this.siteInfo.id || settings.name !== this.siteInfo.name || settings.appAuthProvider !== this.siteInfo.appAuthProvider || settings.projectApiToken !== this.siteInfo.projectApiToken || settings.isMainBranchProtected !== this.siteInfo.isMainBranchProtected) {
      this.projectMetadataStore.setState(Object.freeze({ id: this.siteInfo.id, name: this.siteInfo.name, appAuthProvider: this.siteInfo.appAuthProvider, projectApiToken: this.siteInfo.projectApiToken, isMainBranchProtected: this.siteInfo.isMainBranchProtected, mentionUsers }), true);
    }
    this.versionHistory.syncContext();
    }));
    return this.siteInfo;
  }

  changeFrameSize({
    frame = this.focusedViewCtx()!.arenaFrame(),
    dim,
    amount,
  }: {
    dim: "width" | "height";
    amount: number;
    frame?: ArenaFrame;
  }) {
    frame[dim] = amount;

    if (dim === "width") {
      if (isComponentArena(this.currentArena) && !this.focusedMode) {
        ensureActivatedScreenVariantsForComponentArenaFrame(
          this.site,
          this.currentArena,
          frame,
        );
      } else {
        ensureActivatedScreenVariantsForFrameByWidth(this.site, frame);
      }
    } else {
      if (isHeightAutoDerived(frame)) {
        updateAutoDerivedFrameHeight(frame, amount);
      }
    }
  }

  spreadNewFrameSize(frame: ArenaFrame) {
    syncArenaFrameSize(
      this.site,
      ensure(this.currentArena, "current arena must exist"),
      frame,
    );
    reorderPageArenaCols(this.site);

    // When we update frame sizes on a component arena,
    // if updating height, all frames starting on the second row,
    // will "move"; if updating width, all frames starting on
    // second column, will "move" too.
    // We need to dispatch a signal to make sure the hover box will
    // have its position updated.
    defer(() => this.framesChanged.dispatch());

    this.tryZoomToFitArena();
  }

  isPositionManagedFrame(frame: ArenaFrame) {
    return this.focusedMode || (frame.left == null && frame.top == null);
  }

  /**
   * @deprecated use {@link getRootSubReact} instead.
   */
  getRootSubReact() {
    return getRootSubReact();
  }

  getPlumeSite() {
    return this.projectDependencyManager.ensurePlumeSite();
  }

  //
  // Change management -- entrypoint for all model and view changes
  //
  private _isChanging = false;
  private _isUndoing = false;
  private _isRestoring = false;
  private _isRefreshing = false;
  private _changeOpts: StudioChangeOpts[] = [];

  isChanging() {
    return this._isChanging;
  }

  readonly inspectorStore = createStore<{ selection: InspectorSelection | undefined; pending: boolean }>(() => Object.freeze({ selection: undefined, pending: false }));
  private inspectorFocus?: { vc: ViewCtx | undefined; frame: ArenaFrame | undefined; tpls: (TplNode | null)[]; keys: (string | null | undefined)[]; clones: (string | undefined)[]; context: ComponentCtx | null | undefined; part: string | undefined };

  /** Explicit editor setters and completed model transactions publish focus. */
  notifyInspectorFocusChanged() {
    if (this.canvasLoadingDisposed) {return;}
    const vc = this.focusedViewCtx();
    const next = { vc, frame: this.focusedFrame(), tpls: vc?.focusedTpls().slice() ?? [], keys: vc?.focusedSelectables().map((selection) => selection && makeSelectableFullKey(selection)) ?? [], clones: vc?.focusedCloneKeys().slice() ?? [], context: vc?.currentComponentCtx(), part: vc?.focusedComponentPart?.name };
    const previous = this.inspectorFocus;
    if (!previous && !vc && !next.frame) { this.inspectorFocus = next; return; }
    if (previous && previous.vc === next.vc && previous.frame === next.frame && previous.context === next.context && previous.part === next.part && arrayEq(previous.tpls, next.tpls) && arrayEq(previous.keys, next.keys) && arrayEq(previous.clones, next.clones)) {return;}
    this.inspectorFocus = next;
    this.scheduleInspectorSelection();
  }
  private inspectorGeneration = 0;
  private selectionPaintFrame?: number;
  private selectionPaintTask?: ReturnType<typeof setTimeout>;

  get isSelectionPending() {
    return this.inspectorStore.getState().pending;
  }

  get inspectorSelection() {
    return this.inspectorStore.getState().selection;
  }

  private scheduleInspectorSelection() {
    if (this.selectionPaintFrame !== undefined) {
      cancelAnimationFrame(this.selectionPaintFrame);
    }
    clearTimeout(this.selectionPaintTask);
    (() => {
      this.inspectorSelection?.pause();
      this.inspectorStore.setState((state) => state.pending ? state : Object.freeze({ ...state, pending: true }), true);
    })();
    this.selectionPaintFrame = requestAnimationFrame(() => {
      this.selectionPaintFrame = undefined;
      this.selectionPaintTask = setTimeout(() => {
        this.selectionPaintTask = undefined;
        (() => {
          const vc = this.focusedViewCtx();
          const previous = this.inspectorSelection;
          this.inspectorStore.setState(Object.freeze({ selection: vc && !vc.isDisposed ? new InspectorSelection(vc, ++this.inspectorGeneration) : undefined, pending: false }), true);
          previous?.dispose();
        })();
      }, 0);
    });
  }

  private runNativeSelectionCommand<Result>(command: () => Result): Result {
    const views = this.viewCtxs.filter((view) => !view.isDisposed);
    const inspectorFocus = this.inspectorFocus;
    const wasPending = this.isSelectionPending;
    const runView = (index: number): Result => index === views.length ? this.runRenderPolicyCommand(command) : views[index].transactionSelectionInputs(() => runView(index + 1));
    const deferViews = (index: number): Result => index === views.length ? this.selection.transaction(() => runView(0)) : views[index].styleInputs.deferPublication(() => views[index].selection.deferPublication(() => views[index].variants.deferPublication(() => deferViews(index + 1))));
    try { return this.contentEditors.deferPublication(() => this.singleRsStyleInputs.deferPublication(() => this.overlayState.deferPublication(() => this.renderPolicy.deferPublication(() => this.selection.deferPublication(() => deferViews(0)))))); }
    catch (error) {
      if (this.canvasLoadingDisposed) { throw error; }
      if (this.selectionPaintFrame !== undefined) { cancelAnimationFrame(this.selectionPaintFrame); this.selectionPaintFrame = undefined; }
      clearTimeout(this.selectionPaintTask);
      this.selectionPaintTask = undefined;
      this.inspectorFocus = inspectorFocus;
      if (wasPending) { this.scheduleInspectorSelection(); }
      else { this.inspectorSelection?.resume(); this.inspectorStore.setState((state) => !state.pending ? state : Object.freeze({ ...state, pending: false }), true); }
      throw error;
    }
  }

  private prepareNativeArenaInputs(changes?: readonly ModelChange[]) {
    const editRequest = this.variantGroupEditingStore.getState();
    if (editRequest) {
      const models = this.modelSnapshots;
      this.renderPolicy.queuePublication(() => {
        if (models !== this.modelSnapshots || this.variantGroupEditingStore.getState() !== editRequest) { return; }
        const group = models.resolve(editRequest);
        if (!this.site.components.some((component) => component.variantGroups.some((candidate) => candidate === group))) {
          this.variantGroupEditingStore.setState(undefined, true);
        }
      });
    }
    if (changes) { this.arenaState.prepareModelCommit(changes); } else { this.arenaState.prepareCommit(); }
    if (changes) { this.frameHeights.prepareCommit(); }
    this.selection.prepareCommit();
    this.singleRsStyleInputs.prepareCommit();
    this.viewCtxs.forEach((view) => {
      if (!view.isDisposed) {
        view.selection.prepareCommit();
        if (changes) { view.variants.prepareModelCommit(changes); } else { view.variants.prepareCommit(); }
        view.styleInputs.prepareCommit();
      }
    });
    this.uiEnvironment.syncArena();
    this.viewportCtx?.syncArenaFrames(changes);
    this.prepareRenderPolicyInputs();
    if (changes) { this.prepareContentEditorOwnership(); }
    this.contentEditors.sync();
  }

  /** Install all policy-dependent outputs before any source can notify. */
  prepareRenderPolicyInputs(input: RenderPolicyInputs = {}) {
    if (this.canvasLoadingDisposed) { return; }
    const policy = this.renderPolicy.prepareInputs(input);
    const views = this.viewCtxs.filter((view) => !view.isDisposed);
    const framePublications = views.map((view) => view.canvasCtx.prepareFrameInfo(view));
    const canvasPublications = views.map((view) => view.canvasRenderOwner.prepareRenderPolicy(policy));
    if (!this.nativeArenaDepth || input.liveOverride === true) { this.prepareContentEditorOwnership(input); }
    framePublications.forEach((publish) => this.renderPolicy.queuePublication(publish));
    canvasPublications.forEach((publish) => this.renderPolicy.queuePublication(publish));
  }

  private prepareContentEditorOwnership(input: RenderPolicyInputs = {}) {
    const interactive = this.renderPolicy.store.getState().interactive;
    const prepare = (view: ViewCtx) => { if (!view.isDisposed) { view.contentEditor.prepareOwnership({ live: input.liveOverride, interactive }); } };
    this.viewCtxs.forEach(prepare);
    this.pendingArenaViewDisposals.forEach(prepare);
  }

  /** Content-session writes share existing viewport, overlay and selection
   * publication barriers. All current outputs/cache paths install before UI. */
  withContentEditorPublication<Result>(command: () => Result): Result {
    const views = this.viewCtxs.filter((view) => !view.isDisposed);
    const deferView = (index: number): Result => index === views.length ? command() : views[index].selection.deferPublication(() => deferView(index + 1));
    const run = () => this.overlayState.deferPublication(() => this.selection.deferPublication(() => deferView(0)));
    return this.contentEditors.deferPublication(() => this.viewportCtx ? this.viewportCtx.deferPublication(run) : run());
  }

  publishContentEditorInputs(publish: () => void) { this.contentEditors.queue(publish); }

  private runRenderPolicyCommand<Result>(command: () => Result): Result {
    return this.renderPolicy.deferPublication(() => {
      const interactive = this.renderPolicy.store.getState().interactive;
      try { return command(); }
      finally {
        this.prepareRenderPolicyInputs();
        if (!interactive && this.renderPolicy.store.getState().interactive) { this.prepareContentEditorOwnership(); }
      }
    });
  }

  /** The Preview source remains canonical; prepare its effective canvas policy
   * before the actual native source publishes the synchronous live change. */
  withPreviewLivePolicy<Result>(live: boolean, command: () => Result): Result {
    return this.renderPolicy.deferPublication(() => {
      this.prepareRenderPolicyInputs({ liveOverride: live });
      try { return command(); }
      finally { this.prepareRenderPolicyInputs(); }
    });
  }

  private nativeArenaDepth = 0;
  private nativeArenaBodyDepth = 0;
  private pendingArenaRoute: (() => void) | undefined;
  private readonly pendingArenaViewDisposals: ViewCtx[] = [];
  private readonly pendingNativeFrameResolutions: [ViewCtx, (view: ViewCtx) => void][] = [];
  private readonly nativeFramePromiseJournal: [ArenaFrame, FrameViewWaiter][] = [];

  private runNativeArenaCommand<Result>(command: () => Result): Result {
    const viewport = this.viewportCtx;
    const views = this.viewCtxs.slice();
    const pendingDisposals = this.pendingArenaViewDisposals.length;
    const promiseSavepoint = this.nativeFramePromiseJournal.length;
    const resolutionSavepoint = this.pendingNativeFrameResolutions.length;
    const routeSavepoint = this.pendingArenaRoute;
    const lifetime = this.arenaState.lifetime();
    this.nativeArenaDepth++;
    const run = () => {
      this.nativeArenaBodyDepth++;
      try {
        const result = command();
        this.prepareNativeArenaInputs();
        if (this.nativeArenaBodyDepth === 1) { this.commitPendingArenaRoute(); }
        return result;
      } catch (error) {
        if (!this.canvasLoadingDisposed && this.arenaState.isCurrentLifetime(lifetime)) {
          this.pendingArenaRoute = routeSavepoint;
          const abandonedViews = this.viewCtxs.filter((view) => !views.includes(view));
          this.pendingNativeFrameResolutions.length = resolutionSavepoint;
          this.pendingArenaViewDisposals.length = pendingDisposals;
          this.pendingArenaViewDisposals.push(...abandonedViews);
          while (this.nativeFramePromiseJournal.length > promiseSavepoint) {
            const [frame, waiter] = ensure(this.nativeFramePromiseJournal.pop(), "Frame waiter savepoint");
            this.frameToViewCtxPromise.set(frame, waiter);
          }
        }
        throw error;
      } finally { this.nativeArenaBodyDepth--; }
    };
    const transactions = () => {
      const result = this.arenaState.transaction(() => this.uiEnvironment.transaction(() => this.commentsCtx.transaction(() => viewport ? viewport.transaction(run) : run())));
      // A nested/prepared switch can still roll back. Retire its DOM session
      // only at the successful outer command fence, before any native publication.
      if (this.nativeArenaDepth === 1) { this.prepareContentEditorOwnership(); }
      return result;
    };
    const comments = () => this.commentsCtx.deferPublication(transactions);
    let succeeded = false;
    try {
      const result = this.arenaState.deferResourceDisposal(() => (() => this.arenaState.deferPublication(() => this.runNativeSelectionCommand(() => this.uiEnvironment.deferPublication(() => viewport ? viewport.deferPublication(comments) : comments()))))());
      succeeded = true;
      return result;
    } finally {
      this.nativeArenaDepth--;
      if (!this.nativeArenaDepth) {
        if (!succeeded) { this.pendingArenaRoute = undefined; }
        this.nativeFramePromiseJournal.length = 0;
        const resolutions = this.pendingNativeFrameResolutions.splice(0);
        if (succeeded) {
          for (const [view, resolve] of resolutions) {
            if (this.arenaState.viewRegistry.forFrame(view.arenaFrame())?.view === view) { resolve(view); }
          }
        }
        // A waiter created while a registration was staged must observe only
        // the final successful or restored registry, never an abandoned view.
        for (const [frame, [, resolve]] of this.frameToViewCtxPromise) {
          const entry = this.arenaState.viewRegistry.forFrame(frame);
          if (entry) { this.frameToViewCtxPromise.delete(frame); resolve(entry.view); }
        }
        for (const view of this.pendingArenaViewDisposals.splice(0)) {
          if (!this.viewCtxs.includes(view) && !view.isDisposed) { view.dispose(); }
        }
      }
    }
  }

  private commitPendingArenaRoute() {
    const route = this.pendingArenaRoute;
    this.pendingArenaRoute = undefined;
    route?.();
  }

  private runNativeArenaResult<T, E>(command: () => Result<T, E>): Result<T, E> {
    const abort = {};
    const pendingEditBefore = this.pendingVariantGroupEdit;
    let rejected: Result<T, E> | undefined;
    try {
      const result = this.runNativeArenaCommand(() => {
        const value = command();
        if (value.isErr()) { rejected = value; throw abort; }
        return value;
      });
      if (this.pendingVariantGroupEdit !== pendingEditBefore) {
        this.variantGroupEditingStore.setState(this.pendingVariantGroupEdit, true);
        this.pendingVariantGroupEdit = pendingEditBefore;
      }
      return result;
    } catch (error) {
      this.pendingVariantGroupEdit = pendingEditBefore;
      if (error !== abort) { throw error; }
      return ensure(rejected, "Aborted native command result");
    }
  }

  /** Selection is editor state. Actual variant/context edits still use change(). */
  changeSelection(f: () => void) {
    if (this.canvasLoadingDisposed) { return; }
    if (this._isChanging) {
      this.runNativeSelectionCommand(f);
      return;
    }
    if (this.hasPendingModelChanges()) {
      this.changeSpawn(() => this.changeSelection(f));
      return;
    }
    const previous = this.viewCtxs.map((vc) => ({
      vc,
      context: vc.currentComponentCtx(),
      info: vc.getSpotlightAndVariantsInfo(),
      selectables: vc.focusedSelectables().slice(),
      tpls: vc.focusedTpls().slice(),
      cloneKeys: vc.focusedCloneKeys().slice(),
    }));
    const previousViewCtx = this.focusedViewCtx();
    const previousFrames = this.focusedFrames();
    let selectionChanged = false;
    (() => this.runNativeSelectionCommand(() => {
        f();
        if (this.canvasLoadingDisposed) { return; }
        const vc = this.focusedViewCtx();
        selectionChanged =
          vc !== previousViewCtx ||
          !arrayEq(previousFrames, this.focusedFrames()) ||
          previous.some(
            ({ vc: view, context, info, selectables, tpls, cloneKeys }) =>
              context !== view.currentComponentCtx() ||
              viewCtxInfoChanged(view.getSpotlightAndVariantsInfo(), info) ||
              !arrayEq(selectables, view.focusedSelectables()) ||
              !arrayEq(tpls, view.focusedTpls()) ||
              !arrayEq(cloneKeys, view.focusedCloneKeys()),
          );
        if (!selectionChanged) {
          return;
        }
        if (this.selectionPaintFrame !== undefined) {
          cancelAnimationFrame(this.selectionPaintFrame);
        }
        clearTimeout(this.selectionPaintTask);
        // The action publishes the new focus and pending state together.
        this.inspectorSelection?.pause();
        this.inspectorStore.setState((state) => state.pending ? state : Object.freeze({ ...state, pending: true }), true);
        const tpl = vc?.focusedTpl();
        if (
          vc &&
          isTplVariantable(tpl) &&
          !vc.variantTplMgr().tryGetTargetVariantSetting(tpl)
        ) {
          this.changeSpawn(() => fixupChrome(this));
        }
        this.createViewStateUndoRecord();
    }))();
    if (!selectionChanged) {
      return;
    }
    for (const { vc, context, info } of previous) {
      if (
        context !== vc.currentComponentCtx() ||
        viewCtxInfoChanged(vc.getSpotlightAndVariantsInfo(), info)
      ) {
        vc.scheduleSync({
          asap: vc === this.focusedViewCtx(),
          eval: true,
          styles: false,
        });
      }
    }
    this.scheduleInspectorSelection();
  }

  /**
   * @deprecated
   * Don't use this function; you should either await or explicitly spawn.
   * This is for old callsites that we didn't decide what to do yet and might
   * require some refactoring.
   * @param f
   * @param opts
   */
  changeSpawn(f: () => void, opts: StudioChangeOpts = {}) {
    spawn(this.changeUnsafe(f, opts));
  }

  /**
   * @deprecated Use {@link change} to deal with typed errors
   * @param f
   * @param opts
   * @returns
   */
  async changeUnsafe<T = void>(f: () => T, opts: StudioChangeOpts = {}) {
    const result = await this.change<any, T>(() => {
      try {
        const res = f();
        if ((res as unknown) instanceof Promise) {
          reportError(
            new Error("Change function cannot be async"),
            "Async changeFn",
          );
        }
        return ok(res);
      } catch (e) {
        return err(e);
      }
    }, opts);
    return result.match(
      (res) => res,
      (e) => {
        throw e;
      },
    );
  }

  async change<E = never, T = void>(
    f: () => Result<T, E>,
    opts: StudioChangeOpts = {},
  ): Promise<Result<T, E>> {
    return this._change(f, opts);
  }

  /**
   * Observes a list of component before applying the changes
   */
  async changeObserved<E = never, T = void>(
    c: () => Component[],
    f: () => Result<T, E>,
    opts: StudioChangeOpts = {},
  ): Promise<Result<T, E>> {
    const changedComponents = c();
    this.dbCtx().maybeObserveComponents(changedComponents);
    return this._change(f, opts);
  }

  async _change<E = never, T = void>(
    f: () => Result<T, E>,
    opts: StudioChangeOpts = {},
  ): Promise<Result<T, E>> {
    if (this._isChanging) {
      /* reportError(
        new Error("There shouldn't be nested calls of .change()"),
        "Nested changeFn"
      ); */
      this._changeOpts.push(opts);
      const res = f();
      await drainQueue(this.modelChangeQueue);
      return res;
    } else {
      if (!this.modelChangeQueue.idle() && opts.event) {
        if (opts.event.persist) {
          console.log("Async change; persisting event", opts.event);
          opts.event.persist();
        } else {
          console.warn(
            "Async change, but no event.persist(); change was wrapped in another async change call.",
          );
        }
      }
      let actualRes: any;
      const res = new Promise<Result<T, E>>((resolve, reject) => {
        this.modelChangeQueue.push<Result<T, E>, Error>(
          {
            type: "change",
            changeFn: () => {
              const result = f();
              if (!result.isErr()) {
                actualRes = result.value;
              }
              return result;
            },
            opts,
          },
          (e, result) => {
            if (e != null) {
              reject(e);
            } else {
              assert(result, "");
              resolve(
                ensure(
                  result.map((_r) => actualRes),
                  "if you don't find a result, it should throw an error",
                ),
              );
            }
          },
        );
      });
      (this.modelChangeQueue as any).process();
      // Observe failures immediately, even while other queued changes drain.
      const [result] = await Promise.all([
        res,
        drainQueue(this.modelChangeQueue),
      ]);
      return result;
    }
  }

  private changeInternal<E>(
    f: () => Result<void, E>,
    opts: StudioChangeOpts = {},
  ): Result<void, E> {
    assert(!this._isChanging, "isChanging should be false");
    // Save some view state about each ViewCtx, so we know which of them
    // will need to be re-evaluated after f().
    const previousComponentCtxs = new Map<ViewCtx, ComponentCtx | null>(
      this.viewCtxs.map((vc) => tuple(vc, vc.currentComponentCtx())),
    );
    const vcToSpotlightAndVariantsInfo = new Map<
      ViewCtx,
      SpotlightAndVariantsInfo
    >(this.viewCtxs.map((vc) => tuple(vc, vc.getSpotlightAndVariantsInfo())));
    const showPlaceholderBeforeChange = this.showSlotPlaceholder();
    const isInteractiveModeBeforeChange = this.isInteractiveMode;

    // Apply the model command together with its associated
    // changes that are mutating the top-level observables (specifically,
    // all the TplNodes and view-level observables, but not the ValNodes)
    const maybeSummary = this.runNativeArenaResult(() => this.runNativeSaveCommand(() => ((): Result<
        {
          summary: ChangeSummary;
          styleChanges: UpsertStyleChanges | undefined;
        },
        E
      > => {
        this._isChanging = true;
        this._changeOpts = [opts];
        try {
          const maybeChanges = this.recorder.withRecording<E>(f);
          if (maybeChanges.isErr()) {
            return err(maybeChanges.error);
          }

          const [newChanges, summary] = fixupForChanges(
            this,
            maybeChanges.value,
          );

          if (newChanges.changes.length > 0) {
            if (!this.isUnlogged()) {
              logChangedNodes("CHANGES:", newChanges.changes, false);
              console.log("Change summary", summary);
            }
          }

          const styleChanges = this.syncAfterChanges(summary, () => {
          // Record the changes to undo log before we kick off the evaluators.
          // That's because evaluators may invoke some postEval() handlers that
          // will create new undo records (for example, viewCtx.selectNewTpl),
          // and those new records may need to be merged with this record here.
          if (this.isUnlogged()) {
            this._queuedUnloggedChanges = mergeRecordedChanges(
              this._queuedUnloggedChanges,
              newChanges,
            );
          } else if (opts.noUndoRecord) {
            if (this.canUndo()) {
              this.undoLog.appendChangesToLastRecord({
                changes: newChanges,
                view: this.currentViewState(),
              });
            }
            this.addToChangeRecords(newChanges);
          } else {
            this.recordAndMarkDirty(newChanges);
          }

          });

          return ok({ summary, styleChanges });
        } finally {
          this._isChanging = false;
        }
      })()));

    if (maybeSummary.isErr()) {
      return err(maybeSummary.error);
    }

    const { summary, styleChanges } = maybeSummary.value;

    // Next, we evaluate the ViewCtxs that need to be evaluated.  By now,
    // After applying the command, its changes have marked
    // the dependencies of evaluation as stale.

    const focusedVC = this.focusedViewCtx();

    const showPlaceholderChanged =
      showPlaceholderBeforeChange !== this.showSlotPlaceholder();
    const interactiveModeChanged =
      isInteractiveModeBeforeChange !== this.isInteractiveMode;

    const shouldEvaluate = (vc: ViewCtx) => {
      return this.shouldEvaluateViewCtx(vc, {
        summary,
        showPlaceholderChanged,
        interactiveModeChanged,
        previousComponentCtx: previousComponentCtxs.get(vc),
        previousVcInfo: vcToSpotlightAndVariantsInfo.get(vc),
      });
    };

    const shouldRestyle = (vc: ViewCtx) => {
      // Should update vc style if it's never had styles before,
      // or if there has been style changes
      return !vc.valState().maybeValSysRoot() || !!styleChanges;
    };

    // give precedence to the focused viewCtx so that the postEvalTasks added
    // to the current viewCtx is not cleared when current viewCtx is being
    // evaluated
    this.viewCtxs.forEach((vc) => {
      const needsEval = shouldEvaluate(vc);
      const needsStyles = shouldRestyle(vc);
      if (needsEval || needsStyles) {
        vc.scheduleSync({
          eval: needsEval,
          styles: needsStyles,
          asap: vc === focusedVC,
        });
      }
    });

    return ok();
  }

  observeComponents(components: Component[]) {
    return this.dbCtx().maybeObserveComponents(components);
  }

  setDocsMode(value: boolean) {
    this.runRenderPolicyCommand(() => { this.renderPolicy.docs = value; });
  }

  get isDocs() {
    return this.renderPolicy.docs;
  }

  private addToChangeRecords(changes: RecordedChanges) {
    if (
      changes.changes.length > 0 ||
      changes.newInsts.length > 0 ||
      changes.removedInsts.length > 0
    ) {
      // Feed the model revision index that replaces MobX's field tracking.
      // No-op until a component subscribes to a key; see shared/model-revisions.
      this.modelRevisions.markModelKeysDirty(
        modelKeysForChanges(changes, (tpl) => {
          // The owner can be unavailable while a change is in flight: the model
          // is allowed to be temporarily invalid inside a transaction.
          try {
            return tryGetTplOwnerComponent(tpl);
          } catch {
            return undefined;
          }
        }),
      );
    }
    if (changes.changes.length > 0) {
      // If there were actual model changes, mark as dirty
      this._changeRecords.push(changes);
      this._changeCounter += 1;
      this.desktopDraft?.changed();
    }
  }

  recordAndMarkDirty(changes: RecordedChanges) {
    return this.runNativeSaveCommand(() => this.recordAndMarkDirtyInternal(changes));
  }

  private recordAndMarkDirtyInternal(changes: RecordedChanges) {
    const allChanges = mergeRecordedChanges(
      this._queuedUnloggedChanges,
      changes,
    );
    this.undoLog.record(this.createUndoRecord(allChanges));
    this._queuedUnloggedChanges = emptyRecordedChanges();
    this.addToChangeRecords(allChanges);

    if (this.blockChanges && !emptyChanges(allChanges)) {
      // Undo all model changes since we are not saving
      this.setBlockChanges(false);
      defer(() => this.undo().then(() => (this.setBlockChanges(true))));
    }
  }

  get _isUnlogged() { return this.saveState.isUnlogged; }
  set _isUnlogged(value: boolean) { this.saveState.isUnlogged = value; }
  private _queuedUnloggedChanges: RecordedChanges = emptyRecordedChanges();
  stopUnlogged() {
    this.runNativeSaveCommand(() => {
    this._isUnlogged = false;
    if (!this._isChanging) {
      // If we're not in a change block, then record the changes that were previoulsy
      // unlogged.  Else we let the outer change block do it.
      this.recordAndMarkDirty(emptyRecordedChanges());
    }
    });
  }

  startUnlogged() {
    this._isUnlogged = true;
  }

  isUnlogged() {
    return this._isUnlogged;
  }

  hasPendingModelChanges() {
    return !this.modelChangeQueue.idle();
  }

  async awaitEval() {
    await drainQueue(this.modelChangeQueue);
    await Promise.all(this.viewCtxs.map((vc) => vc.awaitSync()));
  }

  /** Resolve the actual target even before its ViewCtx has mounted. */
  get activeCanvasFrame(): ArenaFrame | undefined {
    const frames = getArenaFrames(this.currentArena);
    const focused = this.focusedFrame() ?? this.focusedViewCtx()?.arenaFrame();
    return (
      (focused && frames.includes(focused) ? focused : undefined) ?? frames[0]
    );
  }

  get activeCanvasReady() {
    const frame = this.activeCanvasFrame;
    return (
      this.initialRouteReady && this.arenaState.isArenaResolved() &&
      (!frame || !!this.tryGetViewCtxForFrame(frame)?.initialRenderReady)
    );
  }

  private activeCanvasViewCtx(): ViewCtx | undefined {
    return this.tryGetViewCtxForFrame(this.activeCanvasFrame);
  }

  recordCanvasFrameRendered(frame: ArenaFrame) {
    this.loadTimings.mark("frame-rendered", frame.uuid);
    if (
      this.initialRouteReady &&
      this.initialCanvasFrames.every((item) =>
        this.loadTimings.has("frame-rendered", item.uuid),
      )
    ) {
      this.loadTimings.report("all-frames-rendered");
    }
  }

  /**
   * Resolves once the studio and active canvas are ready for tool calls.
   * The active canvas frame must have a ViewCtx with rendered val tree and idle sync queue.
   * Rejects after 60s timeout.
   */
  async awaitStudioReady(): Promise<void> {
    await withTimeout(
      (async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const error = this.canvasLoadStore.getState().error ?? this.canvasFrameError(this.activeCanvasFrame);
          if (error) { throw new Error(error); }
          if (!this.initialViewportReady) {
            await asyncTimeout(100);
            continue;
          }
          const viewCtx = this.activeCanvasViewCtx();
          if (viewCtx) {
            while (viewCtx.isStale() && !viewCtx.isDisposed) {
              await asyncTimeout(50);
              await viewCtx.awaitSync();
              const syncError = this.canvasLoadStore.getState().error ?? this.canvasFrameError(viewCtx.arenaFrame());
              if (syncError) { throw new Error(syncError); }
            }
            if (!viewCtx.isDisposed) {
              return;
            }
          } else if (
            this.currentArena &&
            getArenaFrames(this.currentArena).length === 0
          ) {
            return;
          }
          await asyncTimeout(100);
        }
      })(),
      "Timed out waiting for the studio and active canvas to be ready",
      60_000,
    );
  }

  private modelChangeQueue = (() => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const asyncQueue = asynclib.queue<
      ModelChangeRequest,
      Result<void, Error> | undefined,
      Error
    >(
      safeCallbackify(async (request: ModelChangeRequest) => {
        if (request.type === "change") {
          const result = this.changeInternal(request.changeFn, request.opts);
          if (result.isErr() && !request.opts?.noErrorNotification) {
            showError(result.error);
          }
          return result;
        } else if (request.type === "fetchModelUpdates") {
          await this.fetchUpdatesInternal();
          return undefined;
        } else {
          await this.restoreUndoRecordInternal(request.type);
          return undefined;
        }
      }),
      1,
    );
    asyncQueue.error((error, task) => {
      if (task.type !== "change" || !task.opts?.noErrorNotification) {
        handleError(error);
      }
      // The task callback already rejects its caller. Throwing here interrupts
      // async's completion bookkeeping, leaving drain() and later tasks stuck.
    });
    return asyncQueue;
  })();

  //
  // Managing all ViewCtxs in the current view, one for each artboard
  //

  /** Registered command handles, in their original creation priority. */
  get viewCtxs(): readonly ViewCtx[] { return this.arenaState.viewRegistry.commandViews(); }
  readonly copilotActivity = new CopilotActivity();
  readonly aiSessionId = mkShortId();

  tryGetViewCtxForFrame(frame: ArenaFrame | undefined) {
    return this.arenaState.viewRegistry.forFrame(frame)?.view;
  }

  private frameToViewCtxPromise = new Map<ArenaFrame, FrameViewWaiter>();
  async awaitViewCtxForFrame(frame: ArenaFrame) {
    const error = this.canvasFrameError(frame);
    if (error) { throw new Error(error); }
    const vc = this.tryGetViewCtxForFrame(frame);
    if (vc && !this.nativeArenaDepth) {
      return vc;
    }

    if (this.frameToViewCtxPromise.get(frame)) {
      return ensure(
        this.frameToViewCtxPromise.get(frame),
        "you should find a viewCtx from the frame",
      )[0];
    }

    let resolve: (view: ViewCtx) => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    const promise = new Promise<ViewCtx>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    this.frameToViewCtxPromise.set(frame, [promise, resolve, reject]);
    return promise;
  }

  pruneInvalidViewCtxs() { return this.runNativeArenaCommand(() => this.pruneInvalidViewCtxsInternal()); }

  private pruneInvalidViewCtxsInternal() {
    const allLiveFrames = new Set(
      getSiteArenas(this.site)
        .filter((arena) => this.getArenaStatus(arena) !== "dead")
        .flatMap((arena) => getArenaFrames(arena)),
    );
    const liveVcs = this.viewCtxs.filter((vc) =>
      allLiveFrames.has(vc.arenaFrame()),
    );

    // Clearing selection reads the evaluator; do it before disposing its view.
    const focusedVc = this.focusedViewCtx();
    if (focusedVc && !liveVcs.includes(focusedVc)) {
      this.setStudioFocusOnFrame({ frame: undefined });
    }

    if (liveVcs.length !== this.viewCtxs.length) {
      const disposedVcs = this.viewCtxs.filter((vc) => !liveVcs.includes(vc));
      this.commentsCtx.resetViewSessions(disposedVcs);
      this.pendingArenaViewDisposals.push(...disposedVcs);
      console.log(
        "PRUNING VCs",
        disposedVcs.map((vc) => vc.arenaFrame().uid),
      );
      for (const view of disposedVcs) { this.arenaState.viewRegistry.remove(view); }
    }

    for (const frame of this.frameToViewCtxPromise.keys()) {
      if (!allLiveFrames.has(frame)) {
        this.nativeFramePromiseJournal.push([frame, ensure(this.frameToViewCtxPromise.get(frame), "Departing frame waiter")]);
        this.frameToViewCtxPromise.delete(frame);
      }
    }
  }

  disposeViewCtx(vc: ViewCtx) {
    return this.runNativeArenaCommand(() => {
    this.commentsCtx.resetViewSessions([vc]);
    this.arenaState.viewRegistry.remove(vc);
    const focusedVc = this.focusedViewCtx();
    if (focusedVc && !this.viewCtxs.includes(focusedVc)) {
      this.setStudioFocusOnFrame({ frame: undefined });
    }
    this.pendingArenaViewDisposals.push(vc);
      });
  }

  /** Arena, registered views and per-view readiness are explicit native sources.
   * Startup flags live in `startupStore` and are subscribed below. */
  subscribeActiveCanvasInputs(listener: () => void) {
    let stopped = false;
    let stopReady: () => void = () => undefined;
    let stopLifetime: () => void = () => undefined;
    const bindReady = () => {
      stopReady();
      const view = this.activeCanvasViewCtx();
      stopReady = view ? view.initialRenderReadyStore.subscribe(listener) : () => undefined;
    };
    const changed = () => {
      if (stopped) { return; }
      bindReady(); bindLifetime(); listener();
    };
    const bindLifetime = () => {
      stopLifetime();
      const signal = this.arenaState.lifetime();
      signal.addEventListener("abort", changed, { once: true });
      stopLifetime = () => signal.removeEventListener("abort", changed);
    };
    const stops = [
      this.arenaState.store.subscribe((next, previous) => { if (next.current !== previous.current || next.frames !== previous.frames) { changed(); } }),
      this.arenaState.readinessStore.subscribe(changed),
      this.selectionStore.subscribe((next, previous) => { if (next.view !== previous.view || next.frames !== previous.frames) { changed(); } }),
      this.arenaState.viewRegistry.store.subscribe(changed),
      subscribeToSelector(
        this.startupStore,
        (state) => [state.routeLoaded, state.viewportLoaded],
        listener,
        { equals: shallow },
      ),
      this.subscribeModelChanges((event) => { if (event.type === "site-replaced") { changed(); } }),
    ];
    bindReady(); bindLifetime();
    return () => { stopped = true; stopReady(); stopLifetime(); stops.forEach((stop) => stop()); };
  }

  private async awaitActiveCanvasInputs(predicate: () => boolean, description: string) {
    const lifetime = this.arenaState.lifetime();
    let stopped = false;
    let stop: () => void = () => undefined;
    const waiting = new Promise<void>((resolve) => {
      const finish = () => {
        if (!stopped && (this.canvasLoadingDisposed || !this.arenaState.isCurrentLifetime(lifetime) || predicate())) { stopped = true; stop(); resolve(); }
      };
      stop = this.subscribeActiveCanvasInputs(finish);
      this.disposals.push(() => { if (!stopped) { stopped = true; stop(); resolve(); } });
      finish();
    });
    try { await withTimeout(waiting, description, 60_000); }
    finally { stopped = true; stop(); }
  }

  runAfterInitialCanvasReady(task: () => Promise<unknown>) {
    let complete = false;
    let stop: () => void = () => undefined;
    const check = () => {
      if (complete) { return; }
      if (this.canvasLoadingDisposed) { complete = true; stop(); return; }
      if (this.initialRouteReady && this.initialViewportReady && this.activeCanvasReady) {
        complete = true; stop(); spawn(task());
      }
    };
    stop = this.subscribeActiveCanvasInputs(check);
    this.disposals.push(() => { complete = true; stop(); });
    check();
  }

  /** Publish the loading/closed owner state while every departing model is still
   * readable. Resource destruction happens only after this transaction returns. */
  private exitNativeModelOwner() {
    const departingViews = this.viewCtxs;
    this.runNativeArenaCommand(() => {
      if (this.selectionPaintFrame !== undefined) { cancelAnimationFrame(this.selectionPaintFrame); this.selectionPaintFrame = undefined; }
      clearTimeout(this.selectionPaintTask); this.selectionPaintTask = undefined;
      this.commentsCtx.resetViewSessions();
      this.canvasLoadRequests = [];
      if (this.canvasLoadStore.getState().frameErrors.size) {
        this.canvasLoadStore.setState({ frameErrors: new Map() });
      }
      this.wakeCanvasLoad?.();
      this.pendingArenaRoute = undefined;
      this.withContentEditorPublication(() => departingViews.forEach((view) => view.contentEditor.exit(false)));
      departingViews.forEach((view) => { if (!view.isDisposed) { view.selection.clear(); } });
      this.pendingArenaViewDisposals.push(...departingViews);
      for (const [frame, waiter] of this.frameToViewCtxPromise) {
        this.nativeFramePromiseJournal.push([frame, waiter]);
      }
      this.frameToViewCtxPromise.clear();
      this.arenaState.reset();
      this.viewportCtx?.resetArena();
      this.selection.resetModelOwner();
      this.frameHeights.resetModelOwner();
      this.prepareNativeArenaInputs();
      this.inspectorFocus = undefined;
      this.inspectorSelection?.dispose();
      this.inspectorStore.setState(Object.freeze({ selection: undefined, pending: false }), true);
      this.latestVariantCreated = undefined;
      this.pendingVariantGroupEdit = undefined;
      this.variantGroupEditingStore.setState(undefined, true);
      this.setNewlyAddedQuery(undefined);
      this.setNewlyAddedEventHandlerKey(undefined);
      this.forceOpenSplit = null;
      this.forceOpenProp = null;
      this.hidePresetsModal();
      this.pageSettingsStore.setState((previous) => previous.page === undefined && !previous.open ? previous : { page: undefined, open: false });
      this.findReferencesStore.setState((previous) => previous.component === undefined && previous.styleToken === undefined && previous.dataToken === undefined ? previous : { component: undefined, styleToken: undefined, dataToken: undefined });
      this.canvasOverviewStore.setState((previous) => previous.overview === undefined ? previous : { overview: undefined });
    });
    this.singleRsStyleInputs.dispose();
  }

  dispose() {
    if (this.canvasLoadingDisposed) { return; }
    if (this.selectionPaintFrame !== undefined) {
      cancelAnimationFrame(this.selectionPaintFrame);
    }
    clearTimeout(this.selectionPaintTask);
    this.canvasLoadingDisposed = true;
    this.bindProjectSearchInput(null);
    this.exitNativeModelOwner();
    this.arenaState.dispose();
    // Detach UI observers before destroying evaluators, without committing pending edits.
    (() => {
      this.hoveredViewStore.setState(undefined, true);
      this.selection.dispose();
      this.inspectorSelection?.dispose();
      this.inspectorStore.setState(Object.freeze({ selection: undefined, pending: false }), true);
    })();
    this.copilotActivity.dispose();
    this.saveState.dispose();
    this.renderPolicy.dispose();
    this.frameHeights.dispose();
    this.overlayState.dispose();
    this.disposals.forEach((d) => d());
    this.clearUndoLog();
    this.viewInfoObserverDispose?.();
    this.watchPlayerDispose?.();
    this.versionHistory.dispose();
    this.dbCtx().dispose();
    this.viewCtxs.forEach((vc) => vc.dispose());
    this.contentEditors.dispose();
    this.commentsCtx.dispose();
    this.uiEnvironment.dispose();
    this.latestVariantCreated = undefined;
    this.pendingVariantGroupEdit = undefined;
    this.variantGroupEditingStore.setState(undefined, true);
    this.setNewlyAddedQuery(undefined);
    this.setNewlyAddedEventHandlerKey(undefined);
    this.forceOpenSplit = null;
    this.forceOpenProp = null;
    this.modelSnapshots.dispose();
    this.modelRevisions.dispose();
    this.modelCommitListeners.clear();
    this.fontManager.dispose();
    window.clearInterval(this.asyncSaverTimer);
    this.desktopDraft?.dispose();
    this.desktopDraft = undefined;
    spawn(this.stopListeningForSocketEvents());
  }

  // Does not require running inside `studioCtx.change`
  createViewCtx(frame: ArenaFrame, canvasCtx: CanvasCtx) {
    return this.runNativeArenaCommand(() => {
    const shouldRefocus = frame === this.focusedFrame();
    const existing = this.tryGetViewCtxForFrame(frame);

    if (existing) {
      this.disposeViewCtx(existing);
    }

    const viewCtx = new ViewCtx({
      studioCtx: this,
      viewportCtx: this.viewportCtx!,
      canvasCtx,
      arenaFrame: frame,
    });

    this.arenaState.viewRegistry.register(viewCtx);
    this.contentEditors.sync();

    if (this.frameToViewCtxPromise.has(frame)) {
      const waiter = ensure(this.frameToViewCtxPromise.get(frame), "Pending frame waiter");
      this.nativeFramePromiseJournal.push([frame, waiter]);
      this.frameToViewCtxPromise.delete(frame);
      this.pendingNativeFrameResolutions.push([viewCtx, waiter[1]]);
    }

    // If we're currently focused on the frame but just now created the viewCtx for
    // that frame, then also focus on this viewCtx
    if (shouldRefocus || frame === this.focusedFrame()) {
      this.setStudioFocusOnFrame({ frame: frame, autoZoom: false });

      // As part of initialization, make sure we have the appropriate variant
      // settings created for this viewCtx now in focus.  For example, maybe
      // the user created a new variant while focused on some leaf element, and
      // then reloads the page.  By default, we will focus on the frame, and
      // possibly the root element of the frame if it's a "Stretch" frame; in
      // that case, we'll want to make sure the root element has the right
      // variant setting for the new variant, as that's what we'll be displaying
      // in the right tab.

      // `fixupChrome` might change the data model creating new variant
      // settings. As we might not be running inside studioCtx.change, we call
      // it here.
      spawn(this.changeUnsafe(() => fixupChrome(this), { noUndoRecord: true }));
    }

    viewCtx.scheduleSync({
      styles: true,
      eval: true,
    });
    this.loadTimings.mark("frame-context-created", frame.uuid);
    if (
      this.initialRouteReady &&
      this.initialCanvasFrames.every((item) =>
        this.loadTimings.has("frame-context-created", item.uuid),
      )
    ) {
      this.loadTimings.report("all-frame-contexts-created");
    }
    return viewCtx;
    });
  }

  //
  // Managing arena
  //

  get currentArena() { return this.arenaState.currentArena(); }
  set currentArena(arena: AnyArena | null) {
    this.arenaState.setCurrent(arena);
    this.uiEnvironment.syncArena();
    this.syncHoveredViewCtx();
  }
  get previousArena() {
    const recentLength = this.recentArenas.length;
    return recentLength >= 2 ? this.recentArenas[recentLength - 1] : null;
  }
  get recentArenas() { return this.arenaState.recentArenas(); }
  set recentArenas(arenas: readonly AnyArena[]) { this.arenaState.setRecent(arenas); }

  // Runs background reads one at a time, so they don't thrash each other's arenas.
  private serializeBackgroundRead = asyncMaxAtATime(
    1,
    (run: () => Promise<unknown>) => run(),
  );

  getCurrentStudioViewportSnapshot(): StudioViewportSnapshot {
    return {
      focusedArenaFrame: this.focusedViewCtx()?.arenaFrame(),
      scroll: this.viewportCtx!.scroll(),
      canvasPadding: this.viewportCtx!.canvasPadding(),
      scale: this.viewportCtx!.scale(),
    };
  }

  restoreStudioViewportSnapshot(
    snapshot: StudioViewportSnapshot,
    restoreFrameFocus: boolean,
  ) {
    if (restoreFrameFocus) {
      this.setStudioFocusOnFrame({
        frame: snapshot.focusedArenaFrame,
        autoZoom: false,
      });
    }

    this.viewportCtx!.enqueueTransform(
      snapshot.scale,
      snapshot.scroll.plus(
        this.viewportCtx!.canvasPadding().sub(snapshot.canvasPadding),
      ),
      false,
    );
  }

  canEditComponent(component: Component) {
    return !this.contentEditorMode || component.editableByContentEditor;
  }

  private sortedPageArenas = memoizeModelQuery(
    (site: Site, contentEditorMode: boolean) => {
      return naturalSort(site.pageArenas, (it) => it.component.name).filter(
        (arena) => !contentEditorMode || arena.component.editableByContentEditor,
      );
    },
    { equals: arrayEq },
  );

  getSortedPageArenas = () => this.sortedPageArenas(this.site, this.contentEditorMode);
  private sortedMixedArenas = memoizeModelQuery(
    (site: Site, contentEditorMode: boolean) => {
      return contentEditorMode
        ? []
        : naturalSort(site.arenas, (arena) => arena.name);
    },
    { equals: arrayEq },
  );

  getSortedMixedArenas = () => this.sortedMixedArenas(this.site, this.contentEditorMode);
  private sortedComponentArenas = memoizeModelQuery(
    (site: Site, contentEditorMode: boolean) => {
    const componentArenas: ComponentArena[] = [];
    const addComponentArena = (compArena: ComponentArena) => {
      componentArenas.push(compArena);
      for (const subComp of compArena.component.subComps) {
        const subArena = this.getDedicatedArena(subComp) as
          ComponentArena | undefined;
        if (subArena) {
          addComponentArena(subArena);
        }
      }
    };
    for (const compArena of naturalSort(
      site.componentArenas,
      (it) => it.component.name,
    )) {
      if (compArena.component.superComp) {
        // Sub-components are added when dealing with super components
        continue;
      }

      if (contentEditorMode && !compArena.component.editableByContentEditor) {
        continue;
      }

      addComponentArena(compArena);
    }
    return componentArenas;
    },
    { equals: arrayEq },
  );

  getSortedComponentArenas = () => this.sortedComponentArenas(this.site, this.contentEditorMode);
  /** Switches the branch and version only. */
  switchToBranch(
    branch: ApiBranch | undefined,
    pkgVersionInfoMeta?: PkgVersionInfoMeta,
    opts?: { replace?: boolean },
  ) {
    return this.switchRoute({
      branch,
      pkgVersionInfoMeta,
      arena: this.currentArena,
      ...opts,
    });
  }

  /** Switches the branch version only. */
  switchToBranchVersion(
    pkgVersionInfoMeta: PkgVersionInfoMeta | undefined,
    opts?: { replace?: boolean },
  ) {
    return this.switchToBranch(
      this.dbCtx().branchInfo,
      pkgVersionInfoMeta,
      opts,
    );
  }

  switchToRevision(revisionId: string, opts?: { replace?: boolean }) {
    this.switchRoute({
      branch: this.dbCtx().branchInfo,
      branchRevision: revisionId,
      pkgVersionInfoMeta: undefined,
      arena: this.currentArena,
      ...opts,
    });
  }

  refreshFocusedFrameArena() {
    assert(
      isDedicatedArena(this.currentArena) && this.currentArena._focusedFrame,
      "Can't refresh: not in focus mode",
    );

    this.currentArena._focusedFrame = cloneArenaFrame(
      this.currentArena._focusedFrame,
    );
    this.refreshFetchedDataFromPlasmicQuery();
  }

  /**
   * Switches the arena only, synchronously updating currentArena and the route.
   *
   * This method needs to be synchronous, to ensure the undo log
   * can batch arena and view changes in the same record.
   */
  switchToArena(
    arena: Arena | PageArena | ComponentArena | null | undefined,
    opts?: {
      noFocusedModeChange?: boolean;
      replace?: boolean;
      stopWatching?: boolean;
      threadId?: string;
    },
  ) {
    return this.runNativeArenaCommand(() => this.switchToArenaInternal(arena, opts));
  }

  private switchToArenaInternal(
    arena: Arena | PageArena | ComponentArena | null | undefined,
    opts?: { noFocusedModeChange?: boolean; replace?: boolean; stopWatching?: boolean; threadId?: string },
  ) {
    if (isDedicatedArena(arena) && !this.canEditComponent(arena.component)) {
      const error = new Error(
        `Tried to switch to an component arena as a content editor without access to it`,
      );
      console.error(error);
      Sentry.captureException(error);
      return;
    } else if (isMixedArena(arena) && this.contentEditorMode) {
      const error = new Error(
        `Tried to switch to an mixed arena as a content editor`,
      );
      console.error(error);
      Sentry.captureException(error);
      return;
    }

    if (this.currentArena !== (arena ?? null) || this.watchPlayerId !== null || !this.arenaState.isArenaResolved()) {
      if (this.watchPlayerId !== null && this.isInteractiveMode) {
        this.isInteractiveMode = false;
      }
      this.changeArena(arena ?? null, {
        noFocusedModeChange: opts?.noFocusedModeChange,
      });
    }
    const route = () => this.switchRoute({
      branch: this.dbCtx().branchInfo,
      pkgVersionInfoMeta: this.dbCtx().pkgVersionInfoMeta,
      branchRevision: this.dbCtx().revisionInfo?.id,
      arena: arena ?? null,
      replace: opts?.replace,
      stopWatching: opts?.stopWatching,
      threadId: opts?.threadId,
    });
    if (this.nativeArenaDepth) { this.pendingArenaRoute = route; } else { route(); }
  }

  /**
   * Switches the route, if target location's path is different.
   * @param branch branch to load, undefined for main branch
   * @param pkgVersionInfoMeta pkg version in branch to load, undefined for latest version
   * @param arena arena to load, null for empty projects with no arenas
   * @param replace pushes by default, true to replace
   * @param stopWatching stops watching by default, false to continue watching
   */
  private switchRoute({
    branch,
    pkgVersionInfoMeta,
    branchRevision,
    arena,
    threadId,
    replace,
    stopWatching,
  }: {
    branch: ApiBranch | undefined;
    pkgVersionInfoMeta: PkgVersionInfoMeta | undefined;
    branchRevision?: string | undefined;
    arena: AnyArena | null;
    threadId?: string;
    replace?: boolean;
    stopWatching?: boolean;
  }) {
    const branchName = branch?.name || MainBranchId;
    const branchVersion = pkgVersionInfoMeta?.version || latestTag;
    if (arena) {
      const arenaType = switchType(arena)
        .when(Arena, () => "custom" as const)
        .when([ComponentArena, PageArena], (v) =>
          isKnownComponentArena(v) ? ("component" as const) : ("page" as const),
        )
        .result();
      const arenaUuidOrName = getArenaUuidOrName(arena);
      const arenaName = getArenaName(arena);
      const slug = arenaName
        .replaceAll(/(^\W+|\W+$)/g, "")
        .replaceAll(/\W+/g, "-");
      this.switchRouteRaw({
        branchName,
        branchVersion,
        branchRevision,
        arenaType,
        arenaUuidOrName,
        threadId,
        slug,
        replace,
        stopWatching,
      });
    } else {
      // Arena could be null/undefined if the project has no arenas (i.e. 0 pages/components)
      this.switchRouteRaw({
        branchName,
        branchVersion,
        branchRevision: undefined,
        arenaType: undefined,
        arenaUuidOrName: undefined,
        threadId: undefined,
        slug: undefined,
        replace,
        stopWatching,
      });
    }
  }

  /**
   * Switches the route, using raw string values, if target location's path is different.
   *
   * You probably want to use `switchRoute` or an even higher level alternative like `switchToArena` instead.
   */
  private switchRouteRaw({
    branchName,
    branchVersion,
    branchRevision,
    arenaType,
    arenaUuidOrName,
    threadId,
    slug,
    replace = false,
    stopWatching = true,
  }: {
    branchName: string;
    branchVersion: string;
    branchRevision: string | undefined;
    arenaType: ArenaType | undefined;
    arenaUuidOrName: string | undefined;
    threadId: string | undefined;
    slug: string | undefined;
    replace?: boolean;
    stopWatching?: boolean;
  }) {
    if (stopWatching) {
      this.setWatchPlayerId(null);
    }

    const location = mkProjectLocation({
      projectId: this.siteInfo.id,
      slug,
      branchName,
      branchVersion,
      branchRevision,
      arenaType,
      arenaUuidOrNameOrPath: arenaUuidOrName,
      threadId,
    });

    if (createPath(this.appCtx.history.location) === createPath(location)) {
      return;
    }
    if (replace) {
      this.appCtx.history.replace(location);
    } else {
      this.appCtx.history.push(location);
    }
  }

  /** Start routing after local draft recovery has installed the startup model. */
  startInitialRoute() {
    spawn(this.handleInitialRoute());
  }

  private async handleInitialRoute() {
    let lifetime = this.arenaState.lifetime();
    const routeDone = this.loadTimings.begin("initial-route");
    const viewportDone = this.loadTimings.begin("initial-viewport");
    const desktop = navigator.userAgent.includes("PlasmicDesktop/");
    const [focusPreference, fullPageHeightPreference] = await Promise.all([
      this.appCtx.api.getStorageItem(this.mkFocusPreferenceKey()),
      this.appCtx.api.getStorageItem(this.mkFullPageHeightKey()),
      (async () => {
        if (desktop && this.appCtx.topFrameApi) {
          this.startupStore.setState({ viewportLoaded: false });
          try {
            const saved = await this.appCtx.topFrameApi.getSavedEditorView(
              this.siteInfo.id,
            );
            if (this.canvasLoadingDisposed) { return; }
            const parsed =
              prototypeToolMeta.restoreEditorView.inputSchema.safeParse(saved);
            this.initialEditorView = parsed.success ? parsed.data : null;
          } catch (error) {
            console.warn("Cannot read saved editor viewport", error);
          }
        }
      })(),
    ]);
    if (this.canvasLoadingDisposed) { return; }
    // Initialize the focus preference before handleRouteChange reads it.
    if (!isNil(focusPreference)) {
      this.focusPreference = focusPreference === "true";
    }
    this.runRenderPolicyCommand(() => {
      this.renderPolicy.installStoredFullPageHeight(fullPageHeightPreference === "true");
      if (this.viewCtxs.length) { this.resyncFullPageHeightViews(); }
    });

    const location = this.appCtx.history.location;
    await this.handleRouteChange(location);
    if (this.canvasLoadingDisposed) { return; }
    lifetime = this.arenaState.lifetime();
    this.initialCanvasFrames = getArenaFrames(this.currentArena).slice();
    this.loadTimings.setInitialFrames(
      this.initialCanvasFrames.map((frame) => frame.uuid),
    );
    this.startupStore.setState({ routeLoaded: true });
    routeDone();
    if (this.initialCanvasFrames.length === 0) {
      this.loadTimings.report("all-frame-contexts-created");
      this.loadTimings.report("all-frames-rendered");
    }
    try {
      const saved = this.initialEditorView;
      if (saved) {
        const arena = getArenaByNameOrUuidOrPath(
          this.site,
          saved.arenaId,
          saved.arenaType,
        );
        const frame = saved.frameUuid
          ? getArenaFrames(arena).find((item) => item.uuid === saved.frameUuid)
          : undefined;
        if (
          arena &&
          arena === this.currentArena &&
          (!saved.frameUuid || frame)
        ) {
          this.setStudioFocusOnFrame({ frame, autoZoom: false });
          const targetWaitDone = this.loadTimings.begin("initial-target-wait");
          await this.awaitActiveCanvasInputs(() => !!this.activeCanvasViewCtx() || !this.activeCanvasFrame, "Timed out waiting for the active canvas context");
          if (this.canvasLoadingDisposed || !this.arenaState.isCurrentLifetime(lifetime)) { return; }
          // The saved target may be offscreen until its camera is restored.
          // Resume its queue without holding restoration on later evaluations.
          const targetViewCtx = this.activeCanvasViewCtx();
          if (targetViewCtx) {
            spawn(targetViewCtx.awaitSync());
          }
          targetWaitDone();
          // Let the inspector mount and determine the viewport padding before restoring.
          // Hidden Desktop windows can stop animation frames after navigation even
          // with background throttling disabled and visibilityState === "visible".
          const layoutDone = this.loadTimings.begin("initial-viewport-layout");
          await Promise.race([
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
            asyncTimeout(100),
          ]);
          layoutDone();
          if (this.canvasLoadingDisposed || !this.arenaState.isCurrentLifetime(lifetime)) { return; }
          const commitDone = this.loadTimings.begin("initial-viewport-commit");
          this.restoreStudioViewportSnapshot(
            {
              focusedArenaFrame: frame,
              scale: saved.scale,
              scroll: new Pt(saved.scroll.x, saved.scroll.y),
              canvasPadding: new Pt(
                saved.canvasPadding.x,
                saved.canvasPadding.y,
              ),
            },
            false,
          );
          // The viewport's MobX reaction writes the transform before revealing the canvas.
          await Promise.race([
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            ),
            asyncTimeout(100),
          ]);
          commitDone();
          if (this.canvasLoadingDisposed || !this.arenaState.isCurrentLifetime(lifetime)) { return; }
          const renderWaitDone = this.loadTimings.begin(
            "initial-target-render-wait",
          );
          await this.awaitActiveCanvasInputs(() => this.activeCanvasReady, "Timed out waiting for the active canvas render");
          renderWaitDone();
        } else {
          this.initialEditorView = null;
          this.tryZoomToFitArena();
        }
      }
    } catch (error) {
      if (this.canvasLoadingDisposed || !this.arenaState.isCurrentLifetime(lifetime)) { return; }
      this.initialEditorView = null;
      this.tryZoomToFitArena();
      console.warn("Cannot initialize saved editor viewport", error);
    } finally {
      if (!this.canvasLoadingDisposed) { this.startupStore.setState({ viewportLoaded: true }); }
      this.initialEditorView = null;
      viewportDone();
    }

    // 'prompt' is prefilled from marketing site AI landing page, which opens up
    // Plasmic AI chat and auto-submits the prompt.
    if (this.canvasLoadingDisposed || !this.arenaState.isCurrentLifetime(lifetime)) { return; }
    const prompt = new URLSearchParams(location.search).get(SEARCH_PROMPT);
    if (prompt) {
      this.openCopilotChat({ prompt, mode: "starter" });
    }
  }

  private routeWasPreview = false;

  private async handleRouteChange(location: Location) {
    if (this.canvasLoadingDisposed) { return; }
    const match = parseProjectLocation(location);
    const returningFromPreview = this.routeWasPreview && !match?.isPreview;
    this.routeWasPreview = !!match?.isPreview;
    if (match) {
      const {
        branchName,
        branchVersion,
        arenaType,
        arenaUuidOrNameOrPath,
        isPreview,
        threadId,
        branchRevision,
      } = match;
      await this.handleBranchChange(branchName, branchVersion, branchRevision);
      if (this.canvasLoadingDisposed) { return; }
      if (!isPreview) {
        // We don't want to render the arenas in preview mode, for performance
        // and to avoid setting the zoom level when the arena is not rendered.
        // Preview hides the editor without changing its panel preferences.
        // Replaying the saved comment URL must respect a closed panel.
        const revealComment = !returningFromPreview ||
          (this.showCommentsPanel && !this.panelsHidden && !this.rightPanelStore.getState().collapsed);
        const isHandled =
          (revealComment || !threadId) &&
          (await this.focusCommentThread(threadId));
        if (this.canvasLoadingDisposed) { return; }
        if (!isHandled) {
          await this.handleArenaChange(
            arenaType,
            arenaUuidOrNameOrPath,
            threadId,
          );
        }
      }
    } else {
      // We are in other path such as `projectDocs`. We can skip updating state since we're not being shown right now.
    }
  }

  private async handleBranchChange(
    branchName: string,
    branchVersion: string,
    branchRevision?: string,
  ) {
    const currentBranchName = this.dbCtx().branchInfo?.name ?? MainBranchId;
    const currentBranchVersion =
      this.dbCtx().pkgVersionInfoMeta?.version ?? latestTag;
    const currentRevisionId = this.dbCtx().revisionInfo?.id;

    if (
      branchName === currentBranchName &&
      branchVersion === currentBranchVersion &&
      branchRevision === currentRevisionId
    ) {
      return;
    }

    // Given branch name, look up branch
    let branch: ApiBranch | undefined = undefined;
    if (branchName !== MainBranchId) {
      const branches = await this.appCtx.api.listBranchesForProject(
        this.siteInfo.id,
      );
      branch = branches.branches.find((b) => b.name === branchName);
      if (!branch) {
        this.switchToBranch(undefined, undefined, { replace: true });
        return;
      }
    }

    let versionOrRevision: PkgVersionInfoMeta | ProjectRevision | undefined =
      undefined;
    let editMode = true;

    if (branchRevision) {
      const { rev } = await this.appCtx.api.getProjectRevision(
        this.siteInfo.id,
        branchRevision,
      );
      versionOrRevision = rev;
      editMode = false;
    } else if (branchVersion !== "latest") {
      // Load a specific published version
      const { pkg } = await this.appCtx.api.getPkgByProjectId(this.siteInfo.id);
      if (!pkg) {
        this.switchToBranch(branch, undefined, { replace: true });
        return;
      }
      try {
        const resp = await this.appCtx.api.getPkgVersionMeta(
          pkg.id,
          branchVersion,
          branch?.id,
        );
        versionOrRevision = resp.pkg;
        editMode = false; // cannot edit when viewing previous pkg version
      } catch (e) {
        if (e.name === "NotFoundError") {
          this.switchToBranch(branch, undefined, { replace: true });
          return;
        } else {
          throw e;
        }
      }
    }

    await this.loadVersion(versionOrRevision, editMode, branch);
    this.handleBranchProtectionAlert();
  }

  private async handleArenaChange(
    arenaType: ArenaType | undefined,
    arenaName: string | undefined,
    threadId: string | undefined,
    opts?: StudioChangeOpts,
  ) {
    return this.change(() => {
      if (this.canvasLoadingDisposed) { return ok(); }
      const currentArena = this.currentArena;
      if (!arenaType && !arenaName) {
        // A route without arenaType and arenaName is valid for projects without any arenas.
        //
        // We can't call switchToFirstArena() because it always redirects
        // and would cause an infinite redirect for projects without any arenas.
        // Instead, we only call switchToArena() if the first arena exists.
        const firstArena = this.firstArena();
        if (firstArena) {
          this.switchToArena(firstArena, { replace: true, threadId });
        } else {
          if (currentArena !== null) {
            this.changeArena(null);
          }
        }
      } else if (!arenaName) {
        // User probably typed in the wrong URL. Focus on the first arena.
        this.switchToFirstArena();
      } else {
        // Lookup the target arena.
        const targetArena = getArenaByNameOrUuidOrPath(
          this.site,
          arenaName,
          arenaType,
        );
        if (!targetArena) {
          // Arena is missing/invalid. Focus on the first arena.
          this.switchToFirstArena();
        } else if (currentArena !== targetArena) {
          // Current arena is different. Focus on target arena.
          this.changeArena(targetArena);
        }
      }
      return ok();
    }, opts);
  }

  async focusCommentThread(threadId?: string) {
    if (!threadId) {
      this.commentsCtx.handleCloseThreadDialog();
      return false;
    }

    await this.commentsCtx.waitForInitialCommentsLoad();
    if (this.canvasLoadingDisposed) { return false; }

    const commentThread = this.commentsCtx
      .computedData()
      .allThreads.find((thread) => thread.id === threadId);

    if (!commentThread) {
      this.commentsCtx.closeCommentThreadDialog();
      return false;
    }

    const subjectInfo = commentThread?.subjectInfo;

    const skipZoomOnFocus = this.commentsCtx.getAndResetSkipZoomOnFocus();

    if (!subjectInfo) {
      this.commentsCtx.handleOpenCommentThreadDialog(commentThread.id);
      return false;
    }

    await this.setStudioFocusOnTpl(
      subjectInfo.ownerComponent,
      subjectInfo.subject,
      subjectInfo.variants,
      threadId,
    );
    const focusedViewSet = this.focusedViewCtx();
    if (focusedViewSet) {
      this.commentsCtx.handleOpenCommentThreadDialog(
        commentThread.id,
        focusedViewSet,
      );
      if (!skipZoomOnFocus) {
        await this.tryZoomToFitSelection();
      }
    } else {
      this.commentsCtx.closeCommentThreadDialog();
      return false;
    }
    return true;
  }

  private changeArena(arena: AnyArena | null, opts?: { noFocusedModeChange?: boolean }) {
    return this.runNativeArenaCommand(() => this.changeArenaInternal(arena, opts));
  }

  private changeArenaInternal(
    arena: AnyArena | null,
    opts?: {
      noFocusedModeChange?: boolean;
    },
  ) {
    try {
      // Stop any active animation previews before switching arenas
      this.styleMgr.stopAllAnimationPreviews();

      const prevFocusedViewCtx = this.focusedViewCtx();
      const prevArena = this.currentArena;

      if (prevFocusedViewCtx && prevArena) {
        this.arenaState.rememberViewport(prevArena, this.getCurrentStudioViewportSnapshot(), Date.now());
      }
      if (prevArena !== arena) { this.commentsCtx.resetViewSessions(); }
      this.currentArena = arena;
      this.viewportCtx?.setArena(arena);
      if (this.canvasOverviewStore.getState().overview?.arena !== arena) {
        this.canvasOverviewStore.setState((previous) => previous.overview === undefined ? previous : { overview: undefined });
      }
      if (!arena) {
        return;
      }

      const viewState = this.arenaState.activate(arena, Date.now());

      if (!this.watchPlayerId) {
        if (viewState.lastViewSnapshot) {
          this.restoreStudioViewportSnapshot(viewState.lastViewSnapshot, true);

          // We dispatch a framesChanged event, as new frames are now rendered,
          // so that hoverbox can position itself properly
          const lifetime = this.arenaState.lifetime();
          defer(() => { if (this.arenaState.isCurrentLifetime(lifetime) && this.currentArena === arena) { this.framesChanged.dispatch(); } });
        } else {
          if (isDedicatedArena(arena) && !opts?.noFocusedModeChange) {
            // Dedicated/focused based on the following order of precedence
            // 1. Design mode only for read-only users (see https://app.shortcut.com/plasmic/story/37124)
            // 2. Match the previous arena, if it's a dedicated arena
            // 3. Match the focus preference in local storage
            // 4. Heuristic: app = focused, website = dedicated
            const focusedMode = !this.canEditProject()
              ? false
              : isDedicatedArena(prevArena)
                ? !!prevArena._focusedFrame
                : (this.focusPreference ?? this.siteInfo.hasAppAuth);
            if (focusedMode) {
              const newFocusedFrame = setFocusedFrame(this.site, arena);
              ensureActivatedScreenVariantsForFrameByWidth(
                this.site,
                newFocusedFrame,
              );
            }
          }

          const firstFrame: ArenaFrame | undefined = getArenaFrames(arena)[0];
          this.setStudioFocusOnFrame({
            frame: firstFrame,
            autoZoom: false,
          });

          if (!this.hasInitialEditorView) {
            const lifetime = this.arenaState.lifetime();
            defer(() => {
              if (this.arenaState.isCurrentLifetime(lifetime) && this.currentArena === arena) { this.tryZoomToFitArena(); }
            });
          }
        }
      }

      // If there were still outstanding canvas load requests for this arena,
      // go fulfill them now!
      this.drainCanvasFrameForArena(arena);

      return;
    } finally {
      this.maybeGarbageCollectArenas();
    }
  }

  /**
   * The render state of an arena:
   * - "visible": current arena, shown to the user.
   * - "background": rendered hidden, alive only for background reads.
   * - "cached": alive from a previous visit, rendered display:none
   * - "dead": not rendered at all.
   */
  getArenaStatus = (arena: AnyArena): ArenaStatus => this.arenaState.getStatus(arena);

  addArena(prefix?: string) {
    const arena = this.tplMgr().addArenaWithPrefix(prefix);
    this.switchToArena(arena);
    return arena;
  }

  private maybeGarbageCollectArenas() {
    if (this.arenaState.collect(DEVFLAGS.liveArenas)) { this.pruneInvalidViewCtxs(); }
  }

  get currentArenaEmpty() {
    return getArenaFrames(this.currentArena).length === 0;
  }

  addComponent(
    name: string,
    {
      type,
      plumeTemplateId,
      insertableTemplateInfo,
      noSwitchArena,
    }: {
      type: ComponentType;
      plumeTemplateId?: string;
      insertableTemplateInfo?: InsertableTemplateComponentExtraInfo;
      noSwitchArena?: boolean;
    },
  ) {
    assert(
      type === ComponentType.Plain || type === ComponentType.Page,
      "component should be plain or page",
    );

    const frame =
      type === ComponentType.Plain
        ? AddItemKey.componentFrame
        : AddItemKey.pageFrame;

    const makeComponent = () => {
      if (plumeTemplateId) {
        const comp = this.tplMgr().clonePlumeComponent(
          this.projectDependencyManager.plumeSite,
          plumeTemplateId,
          name,
          true,
        );
        syncPlumeComponent(this, comp).match(
          (x) => x,
          (e) => {
            throw e;
          },
        );
        return comp;
      } else if (insertableTemplateInfo) {
        const { component: comp, seenFonts } = cloneInsertableTemplateComponent(
          this.site,
          insertableTemplateInfo,
          this.projectDependencyManager.plumeSite,
        );
        postInsertableTemplate(this, seenFonts);
        return comp;
      } else {
        return this.tplMgr().addComponent({
          name,
          type,
          styles: getSimplifiedStyles(frame, this.getAddItemPrefs()),
        });
      }
    };

    const component = makeComponent();

    // Segment track
    trackEvent("Create component", {
      projectName: this.siteInfo.name,
      componentName: name,
      type,
      action: "add-component",
      plumeTemplateId,
      plumeType: component.plumeInfo?.type,
      insertableComponent: insertableTemplateInfo?.component.name,
    });

    if (!noSwitchArena) {
      this.switchToComponentArena(component);
    }

    return component;
  }

  //
  // Manage currently-focused frame and element
  //

  readonly selection = new StudioSelection(() => this.modelSnapshots);
  get selectionStore() { return this.selection.store; }
  readonly hoveredViewStore = createStore<ViewCtx | undefined>(() => undefined);
  syncHoveredViewCtx() {
    const frames = getArenaFrames(this.currentArena);
    const view = this.canvasLoadingDisposed ? undefined : this.viewCtxs.find((candidate) => !candidate.isDisposed && !!candidate.$hoveredDomElt() && frames.includes(candidate.arenaFrame()));
    if (this.hoveredViewStore.getState() !== view) { this.hoveredViewStore.setState(view, true); }
  }

  // This only sets the high level focus for the studio, i.e. viewCtx and frame.
  private setHighLevelFocusOnly(
    viewCtx: ViewCtx | undefined,
    frames: ArenaFrame[],
  ) {
    const curFocusedViewCtx = this.focusedViewCtx();
    if (curFocusedViewCtx && (viewCtx !== curFocusedViewCtx || frames.length)) {
      curFocusedViewCtx.clearViewCtxFocus();
    }
    this.selection.set(viewCtx, frames);
    this.notifyInspectorFocusChanged();
  }

  focusedViewCtx() {
    return this.selection.current().view;
  }

  focusedOrFirstViewCtx() {
    if (this.canvasLoadingDisposed) { return undefined; }
    return (
      this.focusedViewCtx() ??
      (isDedicatedArena(this.currentArena)
        ? this.tryGetViewCtxForFrame(getArenaFrames(this.currentArena)[0])
        : undefined)
    );
  }

  // Set the studio focus to focus on the frame object. This clears focus inside
  // the viewCtx too (if something was selected).
  setStudioFocusOnFrame({
    frame,
    autoZoom,
    appendToMultiSelection,
  }: {
    frame: ArenaFrame | undefined;
    autoZoom?: boolean;
    appendToMultiSelection?: boolean;
  }) {
    if (frame && appendToMultiSelection) {
      const selected = this.focusedFrames();
      this.setStudioFocusOnFrames(
        selected.includes(frame)
          ? selected.filter((item) => item !== frame)
          : [...selected, frame],
      );
    } else {
      this.setHighLevelFocusOnly(
        this.tryGetViewCtxForFrame(frame),
        frame ? [frame] : [],
      );
    }

    if (frame && autoZoom) {
      this.tryZoomToFitFrame(frame, this.zoom);
    }
  }

  setStudioFocusOnFrames(frames: ArenaFrame[]) {
    const arenaFrames = this.currentArena
      ? getArenaFrames(this.currentArena)
      : [];
    const selected = uniq(frames).filter((frame) =>
      arenaFrames.includes(frame),
    );
    const frame = selected[0];
    this.setHighLevelFocusOnly(this.tryGetViewCtxForFrame(frame), selected);
  }

  // Set the studio focus to focus only on the frame object, not on the root node.
  setStudioFocusOnlyOnFrame(frame: ArenaFrame | undefined) {
    this.setHighLevelFocusOnly(
      this.tryGetViewCtxForFrame(frame),
      frame ? [frame] : [],
    );
  }

  // In this case, the focus is inside a viewCtx. Set the viewCtx with the
  // focus.
  setStudioFocusOnViewCtxContent(viewCtx: ViewCtx) {
    this.setHighLevelFocusOnly(viewCtx, []);
  }

  /**
   * Set studio focus on the frame contents (but not the frame itself).
   */
  setStudioFocusOnFrameContents(frame: ArenaFrame | undefined) {
    this.setHighLevelFocusOnly(this.tryGetViewCtxForFrame(frame), []);
  }

  /**
   * Navigate to the appropriate arena and frame for a given component and
   * optional variant combo, returning the ViewCtx.
   *
   * Handles frame components, mixed arenas, dedicated arenas, focused mode
   * variant activation, and custom arena variant frames.
   */
  async getViewCtxForComponent(
    component: Component,
    variants?: VariantCombo,
    opts?: { threadId?: string; signal?: AbortSignal },
  ): Promise<ViewCtx> {
    const threadId = opts?.threadId;
    const signal = opts?.signal;
    signal?.throwIfAborted();

    // If the current focused ViewCtx is already on the target component and no variant switching is needed
    const currentViewCtx = this.focusedViewCtx();
    if (currentViewCtx?.component === component && !variants) {
      return currentViewCtx;
    }

    // when component is a frame (artboard) or we're in a custom arena
    if (isFrameComponent(component) || isMixedArena(this.currentArena)) {
      const arenasToSearch = isFrameComponent(component)
        ? this.site.arenas
        : this.currentArena
          ? [this.currentArena]
          : [];

      let match: { arena: AnyArena; frame: ArenaFrame } | undefined;
      for (const arena of arenasToSearch) {
        const baseFrame = getArenaFrames(arena).find(
          (frame) => frame.container.component === component,
        );
        if (baseFrame) {
          const frame = variants?.length
            ? this.getArenaFrameForSetOfVariants(arena, variants)?.frame
            : baseFrame;
          if (frame) {
            match = { arena, frame };
            break;
          }
        }
      }

      if (match) {
        const { arena, frame } = match;

        // If it's an artboard, switch to its arena
        if (isFrameComponent(component) && this.currentArena !== arena) {
          await this.change(() => {
            signal?.throwIfAborted();
            this.switchToArena(arena, { threadId });
            return ok();
          });
        }

        const viewCtx = await this.awaitViewCtxForFrame(frame);
        signal?.throwIfAborted();
        if (viewCtx) {
          return viewCtx;
        }
      }
    }

    const componentArena = this.getDedicatedArena(component);
    const arena =
      componentArena !== this.currentArena
        ? unwrap(
            await this.change<void, AnyArena | null>(() => {
              signal?.throwIfAborted();
              const switchedArena =
                this.switchToComponentArena(component, {
                  threadId,
                }) ?? this.currentArena;
              return ok(switchedArena);
            }),
          )
        : this.currentArena;

    signal?.throwIfAborted();

    if (!arena || !(isPageArena(arena) || isComponentArena(arena))) {
      throw new Error(`No arena found for component "${component.name}".`);
    }

    const baseFrame = getComponentArenaBaseFrame(arena);
    const hasVariants = !!variants?.length;
    const arenaDetails = hasVariants
      ? (this.getArenaFrameForSetOfVariants(arena, variants) ??
        this.getComponentFrameForSetOfVariantsInCustomArenas(
          arena.component,
          variants,
        ))
      : null;
    const frame = arenaDetails?.frame ?? baseFrame;

    let viewCtx: ViewCtx | undefined = undefined;
    if (this.focusedMode) {
      const vcontroller = makeVariantsController(this);
      if (vcontroller && variants?.length) {
        await this.change(
          () => {
            signal?.throwIfAborted();
            vcontroller.onActivateCombo(variants);
            vcontroller.onToggleTargetingOfActiveVariants();
            return ok();
          },
          { noUndoRecord: true },
        );
      }
      // In focus mode, there's guaranteed to be only one visible ViewCtx, so always use that.
      viewCtx = this.focusedOrFirstViewCtx();
    }

    // switch to custom arena, as awaitViewCtxForFrame cannot create viewCtx for non visible custom arena
    if (
      arenaDetails &&
      arenaDetails?.arena !== arena &&
      arenaDetails?.arena !== this.currentArena &&
      isMixedArena(arenaDetails?.arena)
    ) {
      await this.change(() => {
        signal?.throwIfAborted();
        this.switchToArena(arenaDetails?.arena, { threadId });
        return ok();
      });
    }
    viewCtx = viewCtx ?? (await this.awaitViewCtxForFrame(frame));
    signal?.throwIfAborted();

    if (!viewCtx) {
      throw new Error(
        `Could not get ViewCtx for component "${component.name}".`,
      );
    }

    return viewCtx;
  }

  /**
   * Returns an existing live ViewCtx whose frame renders `component` as its root.
   * Searches all live arenas not just the focused one.
   */
  tryGetLiveViewCtxForComponent(component: Component): ViewCtx | undefined {
    return this.viewCtxs.find(
      (vc) => !vc.isDisposed && vc.component === component,
    );
  }

  /**
   * Marks `arena` alive so its frames mount and evaluate without becoming visible.
   * Unlike `changeArena`, this doesn't touch `currentArena`, viewport, focus, undo log, etc.
   */
  ensureArenaAliveInBackground(arena: AnyArena) {
    return this.runNativeArenaCommand(() => {
      this.arenaState.ensureBackground(arena, Date.now());
      this.drainCanvasFrameForArena(arena);
    });
  }

  /** Resolves the arena and frame that render `component` as a root, or undefined
   * if none exists. Frame components live in mixed arenas; others use their
   * dedicated arena. */
  private resolveArenaFrameForComponent(
    component: Component,
  ): { arena: AnyArena; frame: ArenaFrame } | undefined {
    if (isFrameComponent(component)) {
      // Frame components only exist in mixed arenas, find the arena owning its frame.
      for (const mixedArena of this.site.arenas) {
        const match = getArenaFrames(mixedArena).find(
          (f) => f.container.component === component,
        );
        if (match) {
          return { arena: mixedArena, frame: match };
        }
      }
      return undefined;
    }
    // Use the shared resolver rather than this.getDedicatedArena, which
    // gates on edit access, so background reads work for read-only users.
    const dedicatedArena = getDedicatedArena(this.site, component);
    if (!dedicatedArena) {
      return undefined;
    }
    // If the arena was left in focused mode, FocusModeLayout only mounts
    // the focused frame, so await that one instead of the base frame.
    const frame =
      dedicatedArena._focusedFrame ??
      getComponentArenaBaseFrame(dedicatedArena);
    if (!frame) {
      return undefined;
    }
    return { arena: dedicatedArena, frame };
  }

  private getArenaForViewCtx(viewCtx: ViewCtx): AnyArena | undefined {
    return getArenaContaining(this.site, viewCtx.arenaFrame());
  }

  /**
   * Resolves a ViewCtx rendering `component` together with the arena hosting it.
   * Reuses a live ViewCtx when one exists, otherwise marks the component's dedicated
   * arena alive in the background and waits for its frame to mount and load. Returns
   * undefined if no arena can be resolved for the component.
   */
  private async loadBackgroundViewCtxForComponent(
    component: Component,
    opts: { timeoutMs?: number; frameUuid?: string } | undefined,
    lifetime: AbortSignal,
  ): Promise<{ viewCtx: ViewCtx; arena: AnyArena } | undefined> {
    if (lifetime.aborted) { return undefined; }
    const existing = opts?.frameUuid
      ? this.viewCtxs.find(
          (vc) =>
            vc.arenaFrame().uuid === opts.frameUuid &&
            vc.component === component,
        )
      : this.tryGetLiveViewCtxForComponent(component);
    if (existing) {
      const arena = this.getArenaForViewCtx(existing);
      if (arena) {
        return { viewCtx: existing, arena };
      }
    }
    const frameArena = opts?.frameUuid
      ? getSiteArenas(this.site)
          .flatMap((arena) =>
            getArenaFrames(arena).map((frame) => ({ arena, frame })),
          )
          .find(
            ({ frame }) =>
              frame.uuid === opts.frameUuid &&
              frame.container.component === component,
          )
      : undefined;
    const resolved = opts?.frameUuid
      ? frameArena
      : this.resolveArenaFrameForComponent(component);
    if (!resolved) {
      return undefined;
    }
    const { arena, frame } = resolved;
    this.ensureArenaAliveInBackground(arena);
    // awaitViewCtxForFrame has no timeout of its own; time out instead of
    // hanging if e.g. the host never loads.
    const timeoutMs = opts?.timeoutMs ?? 30000;
    let stopAborted: () => void = () => undefined;
    const abandoned = new Promise<undefined>((resolve) => {
      const abort = () => resolve(undefined);
      lifetime.addEventListener("abort", abort, { once: true });
      stopAborted = () => lifetime.removeEventListener("abort", abort);
      if (lifetime.aborted) { abort(); }
    });
    try {
      const viewCtx = await withTimeout(
        Promise.race([this.awaitViewCtxForFrame(frame), abandoned]),
        `Timed out waiting for component "${component.name}" to render`,
        timeoutMs,
      );
      return viewCtx && !lifetime.aborted ? { viewCtx, arena } : undefined;
    } finally { stopAborted(); }
  }

  /**
   * Runs `cb` with a ViewCtx rendering `component`, without changing the visible arena.
   * The ViewCtx's arena is kept alive for the whole call to avoid GC, and reads are
   * serialized so background arenas don't thrash. Returns undefined if no arena resolves.
   */
  withBackgroundViewCtxForComponent<T>(
    component: Component,
    cb: (viewCtx: ViewCtx) => Promise<T>,
    opts?: { timeoutMs?: number; frameUuid?: string },
  ): Promise<T | undefined> {
    const lifetime = this.arenaState.lifetime();
    return this.serializeBackgroundRead(async () => {
      if (!this.arenaState.isCurrentLifetime(lifetime)) { return undefined; }
      const resolved = await this.loadBackgroundViewCtxForComponent(
        component,
        opts,
        lifetime,
      );
      if (!resolved || !this.arenaState.isCurrentLifetime(lifetime) || resolved.viewCtx.isDisposed) {
        return undefined;
      }
      const unpin = this.arenaState.pinBackground(resolved.arena);
      try {
        return await cb(resolved.viewCtx);
      } finally {
        unpin();
        if (this.arenaState.isCurrentLifetime(lifetime)) { this.maybeGarbageCollectArenas(); }
      }
    }) as Promise<T | undefined>;
  }

  async setStudioFocusOnTpl(
    component: Component,
    tpl: TplNode,
    variants?: VariantCombo,
    threadId?: string,
  ) {
    const viewCtx = await this.getViewCtxForComponent(component, variants, {
      threadId,
    });
    viewCtx.setStudioFocusByTpl(tpl);
  }

  getArenaFrameForSetOfVariants(
    arena: AnyArena,
    variants: VariantCombo,
  ): { arena: AnyArena; frame: ArenaFrame } | undefined {
    const frames = getArenaFrames(arena);
    const components = new Set<Component>();
    if (isMixedArena(arena)) {
      for (const frame of frames) {
        components.add(frame.container.component);
      }
    } else {
      components.add(arena.component);
    }
    for (const component of components) {
      const allComponentVariantsMap = keyBy(
        allComponentVariants(component),
        (v) => v.uuid,
      );
      const allGlobalVariantsMap = keyBy(
        allGlobalVariants(this.site, {
          includeDeps: "direct",
          excludeInactiveScreenVariants: true,
        }),
        (v) => v.uuid,
      );

      for (const frame of frames) {
        if (
          doesFrameVariantMatch(
            frame,
            variants,
            allComponentVariantsMap,
            allGlobalVariantsMap,
          )
        ) {
          return { arena, frame };
        }
      }
    }

    return undefined;
  }

  getComponentFrameForSetOfVariantsInCustomArenas(
    component: Component,
    variants: VariantCombo,
  ): { arena: AnyArena; frame: ArenaFrame } | undefined {
    const allComponentVariantsMap = keyBy(
      allComponentVariants(component),
      (v) => v.uuid,
    );
    const allGlobalVariantsMap = keyBy(
      allGlobalVariants(this.site, {
        includeDeps: "direct",
        excludeInactiveScreenVariants: true,
      }),
      (v) => v.uuid,
    );
    const customArenas = this.getSortedMixedArenas();
    for (const customArena of customArenas) {
      const customArenaFrames = getArenaFrames(customArena);
      for (const customArenaFrame of customArenaFrames) {
        if (customArenaFrame.container.component === component) {
          if (
            doesFrameVariantMatch(
              customArenaFrame,
              variants,
              allComponentVariantsMap,
              allGlobalVariantsMap,
            )
          ) {
            return { arena: customArena, frame: customArenaFrame };
          }
        }
      }
    }

    return undefined;
  }

  /** Returns frame the StudioCtx is focused on, if only focused on frame and not selectables */
  focusedFrame() {
    return this.focusedFrames()[0];
  }

  focusedFrames() {
    const arenaFrames = this.currentArena
      ? getArenaFrames(this.currentArena)
      : [];
    return this.selection.frames().filter((frame) => arenaFrames.includes(frame));
  }

  /** Returns frame of whatever content StudioCtx is focused on */
  focusedContentFrame() {
    return this.focusedFrame() ?? this.focusedViewCtx()?.arenaFrame();
  }

  get showCommentsPanel() {
    return this.overlayState.commentsPanel;
  }

  toggleCommentsPanel = (() => {
    const open = !this.showCommentsPanel;
    this.leftPanelState.deferPublication(() => {
      if (open) {
        this.leftPanelState.setPanelsHidden(false);
        this.rightPanelStore.setState({ collapsed: false });
      }
      this.overlayState.commentsPanel = open;
    });
  });

  readonly leftPanelState = new StudioLeftPanelState();

  get leftPanel(): LeftPanel | undefined {
    return this.leftPanelState.leftPanel;
  }

  private setLeftPanel(panel: LeftPanel | undefined) {
    this.leftPanelState.deferPublication(() => {
      if (panel) {
        this.leftPanelState.clearLeftTabGroup();
        this.leftPanelState.setPanelsHidden(false);
      }
      this.leftPanelState.setPanel(panel);
    });
  }

  get isCopilotChatOpen() {
    return this.leftPanelState.isCopilotChatOpen;
  }

  get copilotChatOpenOpts() {
    return this.leftPanelState.copilotChatOpenOpts;
  }

  setCopilotChatOpen(open: boolean) {
    if (open) {
      this.setLeftPanel({ type: "ai" });
    } else if (this.isCopilotChatOpen) {
      this.setLeftPanel(undefined);
    }
  }

  openCopilotChat(opts?: CopilotChatOpenOpts) {
    this.setLeftPanel({ type: "ai", opts });
  }

  toggleCopilotChat() {
    this.setCopilotChatOpen(!this.isCopilotChatOpen);
  }

  private _preferredAiOutputFormat: AiOutputFormat = "json";

  /**
   * Serialization format an AI agent prefers for copilot tool output, declared
   * via `window.PLASMIC_AI_TOOLS.identify`. Defaults to JSON.
   */
  preferredAiOutputFormat(): AiOutputFormat {
    return this._preferredAiOutputFormat;
  }

  setPreferredAiOutputFormat(format: AiOutputFormat) {
    this._preferredAiOutputFormat = format;
  }

  get panelsHidden() {
    return this.leftPanelState.panelsHidden;
  }
  togglePanels = (() => {
    this.leftPanelState.togglePanels();
  });

  get canOpenPageOverview() {
    if (this.contentEditorMode) {
      return false;
    }
    const pages = this.site.components.filter(isPageComponent);
    if (pages.length === 0) {
      return false;
    }
    const existing = findPageOverviewArena(this.site);
    return (
      this.canSave() ||
      (!!existing &&
        pages.every((page) =>
          existing.children.some((frame) => frame.container.component === page),
        ))
    );
  }

  openPageOverview = async () => {
    if (!this.canOpenPageOverview) {
      return;
    }
    const arena = this.canSave()
      ? await this.changeUnsafe(() => ensurePageOverviewArena(this.tplMgr()))
      : findPageOverviewArena(this.site);
    if (arena) {
      this.switchToArena(arena);
      this.returnToCanvasOverview();
      defer(() => this.tryZoomToFitArena());
    }
  };

  readonly canvasOverviewStore = createCanvasOverviewStore();

  get canvasFocusActive() {
    return (
      this.canvasOverviewStore.getState().overview?.arena === this.currentArena
    );
  }

  focusCanvasFrame = ((frame: ArenaFrame) => {
    const arena = this.currentArena;
    if (
      !isMixedArena(arena) ||
      !arena.children.includes(frame) ||
      !this.viewportCtx
    ) {
      return;
    }
    if (!this.canvasFocusActive) {
      this.canvasOverviewStore.setState({ overview: { arena, viewport: this.getCurrentStudioViewportSnapshot() } });
    }
    this.setStudioFocusOnFrame({ frame, autoZoom: false });
    this.tryZoomToFitFrame(frame, 1);
  });

  returnToCanvasOverview = (() => {
    const overview = this.canvasOverviewStore.getState().overview;
    if (overview?.arena === this.currentArena && this.viewportCtx) {
      this.restoreStudioViewportSnapshot(overview.viewport, false);
    }
    this.canvasOverviewStore.setState((previous) => previous.overview === undefined ? previous : { overview: undefined });
  });

  get leftPaneWidth() {
    return this.leftPanelState.leftPaneWidth;
  }
  set leftPaneWidth(width: number) {
    this.leftPanelState.setLeftPaneWidth(width);
  }

  get leftTabKey() {
    return this.leftPanelState.leftTabKey;
  }
  readonly rightPanelStore = createRightPanelStore();
  private lastElementRightTabKey:
    | Extract<RightTabKey, RightTabKey.style | RightTabKey.interactions>
    | undefined;
  get rightTabKey() {
    return this.rightPanelStore.getState().tabKey;
  }

  get leftTabGroup() {
    return this.leftPanelState.leftTabGroup;
  }
  setLeftTabGroup(group: string | undefined) {
    this.leftPanelState.setLeftTabGroup(group);
  }

  switchLeftTab(
    tabKey: LeftTabKey | undefined,
    opts?: { highlight?: boolean },
  ) {
    this.leftPanelState.deferPublication(() => {
      if (tabKey) {
        this.leftPanelState.setLastLeftTab(tabKey);
        this.setLeftPanel({ type: "tab", tab: tabKey });
      } else if (this.leftPanel?.type === "tab") {
        this.setLeftPanel(undefined);
      }
    });
    if (opts?.highlight) {
      this.highlightLeftPanel();
    }
  }

  restoreLastLeftTab() {
    this.switchLeftTab(this.leftPanelState.lastLeftTabKey);
  }

  switchRightTab(tabKey: RightTabKey) {
    this.rightPanelStore.setState((previous) => previous.tabKey === tabKey && !previous.collapsed ? previous : { tabKey, collapsed: false });
    if (tabKey === RightTabKey.style || tabKey === RightTabKey.interactions) {
      this.lastElementRightTabKey = tabKey;
    }
  }

  collapseRightPanel() {
    this.overlayState.commentsPanel = false;
    this.rightPanelStore.setState((previous) => previous.collapsed ? previous : { ...previous, collapsed: true });
  }

  switchToTreeTab() {
    this.switchLeftTab("outline");
  }

  switchToDesignTab() {
    this.switchRightTab(RightTabKey.style);
  }

  restoreLastElementTab() {
    if (
      this.lastElementRightTabKey &&
      this.rightTabKey &&
      ![RightTabKey.style, RightTabKey.interactions].includes(this.rightTabKey)
    ) {
      this.switchRightTab(this.lastElementRightTabKey);
    }
  }

  readonly shortcutsModalStore = createStore<boolean>(() => false);
  isShortcutsModalOpen = () => {
    return this.shortcutsModalStore.getState();
  };
  openShortcutsModal = () => {
    this.shortcutsModalStore.setState(true, true);
  };
  closeShortcutsModal = () => {
    this.shortcutsModalStore.setState(false, true);
  };
  toggleShortcutsModal = () => {
    this.shortcutsModalStore.setState(!this.shortcutsModalStore.getState(), true);
  };

  readonly projectSearchInputRef = React.createRef<HTMLInputElement>();
  private projectSearchFocusPending = false;

  readonly bindProjectSearchInput = (input: HTMLInputElement | null) => {
    if (this.canvasLoadingDisposed) {
      this.projectSearchFocusPending = false;
      this.projectSearchInputRef.current = null;
      return;
    }
    this.projectSearchInputRef.current = input;
    if (!input) { this.projectSearchFocusPending = false; }
    else if (this.projectSearchFocusPending) {
      this.projectSearchFocusPending = false;
      input.focus();
    }
  };

  focusOnProjectSearchInput() {
    if (this.canvasLoadingDisposed) { return; }
    const input = this.projectSearchInputRef.current;
    if (input) { this.projectSearchFocusPending = false; input.focus(); }
    else { this.projectSearchFocusPending = true; }
  }

  //
  // Managing live state
  //
  get showDevControls() {
    return this.isDevMode;
  }
  get isLiveMode() {
    return this.previewCtx?.isLive;
  }
  get isDevMode() {
    return this.renderPolicy.devMode;
  }

  get isInteractiveMode() {
    return this.renderPolicy.interactive;
  }
  set isInteractiveMode(interactive: boolean) {
    this.runRenderPolicyCommand(() => {
      this.renderPolicy.interactive = interactive;
      this.prepareRenderPolicyInputs();
      for (const viewCtx of this.viewCtxs) {
        viewCtx.canvasCtx.setInteractiveMode(interactive);
      }
    });
  }

  toggleInteractiveMode() {
    if (!this.currentArenaEmpty) {
      this.isInteractiveMode = !this.isInteractiveMode;
    }
  }

  get isAutoOpenMode() {
    return this.renderPolicy.autoOpen;
  }
  set isAutoOpenMode(autoOpen: boolean) {
    this.runRenderPolicyCommand(() => { this.renderPolicy.autoOpen = autoOpen; });
  }
  toggleAutoOpenMode() {
    this.runNativeSelectionCommand(() => {
      this.renderPolicy.autoOpen = !this.isAutoOpenMode;
      this.viewCtxs.forEach((vc) => vc.resetAutoOpenState());
    });
  }

  shouldHideUIOverlay(includeResizing = true): boolean {
    return Boolean(
      this.freestyleState() ||
      this.dragInsertState() ||
      !this.showDevControls ||
      this.screenshotting ||
      this.isTransforming() ||
      (includeResizing && this.isResizeDragging),
    );
  }

  get showCommentsOverlay() {
    return this.overlayState.commentsOverlay;
  }
  set showCommentsOverlay(show: boolean) {
    this.overlayState.commentsOverlay = show;
  }
  toggleShowCommentsOverlay() {
    this.showCommentsOverlay = !this.showCommentsOverlay;
  }

  shouldShowArenaFrame = (arenaChild: ArenaChild) => {
    if (!this.isDevMode) {
      return false;
    }

    if (!isKnownArenaFrame(arenaChild)) {
      return false;
    }

    const currentArenaFrames = getArenaFrames(this.currentArena);
    return currentArenaFrames?.includes(arenaChild);
  };

  async getPreviewInitialViewCtx() {
    const arena = ensure(this.currentArena, "current arena must be non null");
    const focusedVc = this.focusedViewCtx();
    if (focusedVc) {
      return focusedVc;
    }
    const children = getArenaFrames(arena);
    return await this.awaitViewCtxForFrame(
      ensure(children[0], "you must have at least one arena frame"),
    );
  }

  toggleDevControls() {
    assert(this.previewCtx, "Cannot toggle live mode without a previewCtx.");
    this.styleMgr.stopAllAnimationPreviews();
    spawn(this.previewCtx.toggleLiveMode());
  }

  /**
   * Cache information for interactions
   */
  readonly stepsCacheStore = createStepsCacheStore();
  private interactionEventArgsCache = new Map<number, any[]>();

  save$stepValue = (interactionUuid: string, stepValue: any) => {
    saveStepsCacheValue(this, interactionUuid, stepValue);
  };

  getCached$stepValue = (interactionUuid: string) => {
    return this.stepsCacheStore.getState().values[interactionUuid];
  };

  hasCached$stepValue = (interactionUuid: string) =>
    this.stepsCacheStore.getState().values[interactionUuid] !== undefined;

  saveInteractionArgs = (eventHandlerUid: number, ...eventArgs: any) => {
    this.interactionEventArgsCache.set(eventHandlerUid, eventArgs);
  };

  getCachedInteractionArgs = (eventHandlerUid: number) => {
    return this.interactionEventArgsCache.get(eventHandlerUid);
  };

  hasCachedInteractionArgs = (eventHandlerUid: number) => {
    return this.interactionEventArgsCache.has(eventHandlerUid);
  };

  private readonly _canvasTool = createStore<"select" | "pan">(() => "select");
  readonly canvasToolStore: Pick<
    StoreApi<"select" | "pan">,
    "getState" | "getInitialState" | "subscribe"
  > = this._canvasTool;
  get canvasTool() {
    return this._canvasTool.getState();
  }
  setCanvasTool = (tool: "select" | "pan") => {
    this._canvasTool.setState(tool, true);
    this.setFreestyleState(undefined);
    if (this.isPanning()) {
      this.endPanning();
    }
    if (this.isPanMode()) {
      this.showPannableCursor();
    } else {
      this.hidePannableCursor();
    }
  };
  isPanMode = () => this.canvasTool === "pan" || !!this.isSpaceDown();

  private keyDown = new Map<number, boolean>();
  markKeydown = (which: number) => {
    this.keyDown[which] = true;
    if (which === StudioCtx.SPACE) {
      this.showPannableCursor();
    }
  };

  markKeyup = (which: number) => {
    this.keyDown[which] = false;
    if (which === StudioCtx.SPACE && this.canvasTool !== "pan") {
      this.hidePannableCursor();
      if (this.panningState && !this.panningState.initiatedByMiddleButton) {
        this.endPanning();
      }
    }
  };
  isSpaceDown = () => this.keyDown[StudioCtx.SPACE];
  isShiftDown = () => this.keyDown[StudioCtx.SHIFT];
  isMetaDown = () => this.keyDown[StudioCtx.META];
  isCtrlDown = () => this.keyDown[StudioCtx.CTRL];
  isAltDown = () => this.keyDown[StudioCtx.ALT];
  isKeyDown = (which: number) => this.keyDown[which];

  tryUpdateKeyboardStatus = (e: MouseEvent) => {
    if (e.ctrlKey) {
      this.markKeydown(StudioCtx.CTRL);
    } else {
      this.markKeyup(StudioCtx.CTRL);
    }
    if (e.metaKey) {
      this.markKeydown(StudioCtx.META);
    } else {
      this.markKeyup(StudioCtx.META);
    }
    if (e.altKey) {
      this.markKeydown(StudioCtx.ALT);
    } else {
      this.markKeyup(StudioCtx.ALT);
    }
  };
  private isCtrlOrMetaDown = () =>
    this.keyDown[StudioCtx.CTRL] || this.keyDown[StudioCtx.META];

  //
  // Managing the component presets modal
  //
  readonly presetsStore = createPresetsStore();
  getPresetsModalComponent(): CodeComponent | undefined {
    return this.presetsStore.getState().modalComponent;
  }
  showPresetsModal(component: CodeComponent): void {
    this.presetsStore.setState((previous) => previous.modalComponent === component ? previous : { modalComponent: component });
  }
  hidePresetsModal(): void {
    this.presetsStore.setState((previous) => previous.modalComponent === undefined ? previous : { modalComponent: undefined });
  }
  getCurrentTeam(): ApiTeam | undefined {
    return this.appCtx.getAllTeams().find((t) => t.id === this.siteInfo.teamId);
  }

  //
  // Copy/paste commands
  //

  // clipboardAction keeps track of last clipboard action. It is used in
  // "paste as sibling" because Clipboard API only lets us know about the
  // existence of "application/vnd.plasmic.clipboardjson" but does not let
  // us read data from it.
  private clipboardAction: LocalClipboardAction = "copy";

  private cursorClientPt?: Pt;

  setCursorClientPt(clientPt: Pt) {
    this.cursorClientPt = clientPt;
  }

  async copy(clipboard: WritableClipboard, viewCtx: ViewCtx) {
    trackEvent("Copy");
    const copyObj = viewCtx.viewOps.copy();
    if (!copyObj) {
      return;
    }
    viewCtx.enforcePastingAsSibling = true;
    const copyState = getCopyState(viewCtx, copyObj);
    spawn(viewCtx.appCtx.api.whitelistProjectIdToCopy(copyState.projectId));
    if (copyState.references.length > 0) {
      clipboard.setData(copyState);
    } else {
      clipboard.setData({ action: "copy" });
    }
    this.clipboardAction = "copy";
  }

  async cut(clipboard: WritableClipboard, viewCtx: ViewCtx) {
    trackEvent("Cut");
    const copyObj = await viewCtx.viewOps.cut();
    if (!copyObj) {
      return;
    }
    const copyState = getCopyState(viewCtx, copyObj);
    spawn(viewCtx.appCtx.api.whitelistProjectIdToCopy(copyState.projectId));
    if (copyState.references.length > 0) {
      clipboard.setData(copyState);
    } else {
      clipboard.setData({ action: "cut" });
    }
    this.clipboardAction = "cut";
  }

  async paste(clipboard: ReadableClipboard, as?: "sibling") {
    trackEvent("Paste");
    await paste({
      clipboard,
      studioCtx: this,
      cursorClientPt: this.cursorClientPt,
      as,
    });
  }

  async pasteAsSibling() {
    const clipboard = await this.readClipboardForPaste();
    await this.paste(clipboard, "sibling");
  }

  /**
   * Read the current clipboard via the navigator API. Fall back to a synthetic marker
   * so the paste router can fall through to the in-process local clipboard.
   */
  async readClipboardForPaste(): Promise<ReadableClipboard> {
    try {
      const clipboardData = await this.appCtx.api.readNavigatorClipboard(
        this.clipboardAction,
      );
      return ReadableClipboard.fromData(clipboardData);
    } catch (e) {
      console.error(e);
      return ReadableClipboard.fromData({
        [PLASMIC_CLIPBOARD_FORMAT]: JSON.stringify({
          action: this.clipboardAction,
        }),
      });
    }
  }

  //
  // Branching
  //
  showBranching() {
    const team = this.getCurrentTeam();
    return (
      this.appCtx.appConfig.branching ||
      (this.siteInfo.teamId &&
        this.appCtx.appConfig.branchingTeamIds.includes(
          this.siteInfo.teamId,
        )) ||
      (team?.parentTeamId &&
        this.appCtx.appConfig.branchingTeamIds.includes(team.parentTeamId))
    );
  }

  //
  // Copilot
  //
  chatCopilotEnabled(): boolean {
    return this.canEditProject() && this.appCtx.appConfig.enableLocalAiEditing;
  }

  queryMigrationCopilotEnabled(): boolean {
    return (
      this.canEditProject() && this.appCtx.appConfig.enableQueryMigrationCopilot
    );
  }

  //
  // Comments
  //
  showComments() {
    const accessLevel = getAccessLevelToResource(
      { type: "project", resource: this.siteInfo },
      this.appCtx.selfInfo,
      this.siteInfo.perms,
    );
    return accessLevelRank(accessLevel) >= accessLevelRank("commenter");
  }

  //
  // Managing the "Add Drawer"
  //
  readonly libraryTabStore = createStore<"store" | "imports">(() => "imports");
  get libraryTab() {
    return this.libraryTabStore.getState();
  }
  setLibraryTab(tab: "store" | "imports") {
    this.libraryTabStore.setState(tab, true);
  }
  openLibraries(tab: "store" | "imports") {
    this.setLibraryTab(tab);
    this.leftPanelState.deferPublication(() => {
      this.setShowAddDrawer(false);
      this.switchLeftTab("libraries");
      if (this.panelsHidden) {
        this.togglePanels();
      }
    });
  }

  showAddDrawer() {
    return this.leftPanelState.showAddDrawer();
  }
  setShowAddDrawer(show: boolean) {
    if (show) {
      this.setLeftPanel({ type: "insert", inline: false });
    } else if (this.showAddDrawer()) {
      this.setLeftPanel(undefined);
    }
  }

  showInlineAddDrawer = () => {
    return this.leftPanelState.showInlineAddDrawer();
  };
  setShowInlineAddDrawer = (show: boolean) => {
    if (show) {
      this.setLeftPanel({ type: "insert", inline: true });
    } else if (this.showInlineAddDrawer()) {
      this.setLeftPanel(undefined);
    }
  };

  //
  // Managing focused mode
  //
  get focusedMode() {
    return (
      isDedicatedArena(this.currentArena) && !!this.currentArena._focusedFrame
    );
  }

  toggleFocusedMode = () => {
    if (!isDedicatedArena(this.currentArena)) {
      return;
    }

    if (this.focusedMode) {
      this.turnFocusedModeOff();
    } else {
      this.turnFocusedModeOn();
    }
  };

  turnFocusedModeOn = () => {
    const currentArena = this.currentArena;
    if (!isDedicatedArena(currentArena) || currentArena._focusedFrame) {
      return;
    }

    this.styleMgr.stopAllAnimationPreviews();

    const newFocusedFrame = setFocusedFrame(
      this.site,
      currentArena,
      this.focusedContentFrame(),
    );
    ensureActivatedScreenVariantsForFrameByWidth(this.site, newFocusedFrame);
    this.setStudioFocusOnFrame({ frame: newFocusedFrame, autoZoom: false });
    setTimeout(() => {
      this.tryZoomToFitArena();
    }, 0);
  };

  turnFocusedModeOff = () => {
    const currentArena = this.currentArena;
    if (!isDedicatedArena(currentArena) || !currentArena._focusedFrame) {
      return;
    }

    this.styleMgr.stopAllAnimationPreviews();
    currentArena._focusedFrame = null;

    ensureActivatedScreenVariantsForArena(this.site, currentArena);

    const firstFrame: ArenaFrame | undefined = getArenaFrames(currentArena)[0];
    this.setStudioFocusOnFrame({ frame: firstFrame, autoZoom: false });
    setTimeout(() => {
      this.tryZoomToFitArena();
    }, 0);
  };

  private mkFocusPreferenceKey = () => {
    return focusPreferenceKey(this.siteInfo.id);
  };

  private mkFullPageHeightKey = () => {
    return fullPageHeightKey(this.siteInfo.id);
  };

  /**
   * Canvas-only view preference: page artboards grow to show their full
   * content instead of their authored viewport height. Stored per user and
   * project; it never changes the site model, previews or exports.
   */
  get fullPageHeight() {
    return this.renderPolicy.fullPageHeight;
  }

  /** User toggle: becomes the persisted preference and clears AI overrides. */
  toggleFullPageHeight = (() => {
    this.runRenderPolicyCommand(() => {
    const next = this.renderPolicy.toggleFullPageHeight();
    spawn(
      this.appCtx.api.addStorageItem(
        this.mkFullPageHeightKey(),
        next ? "true" : "false",
      ),
    );
    this.resyncFullPageHeightViews();
    });
  });

  /**
   * Temporarily show or hide full page height without touching the user's
   * stored preference. Restoring the user's value clears the override.
   */
  setFullPageHeightOverride = ((full: boolean) => {
    this.runRenderPolicyCommand(() => {
      this.renderPolicy.setFullPageHeightOverride(full);
      this.resyncFullPageHeightViews();
    });
  });

  // Code components read the view through their canvas props, which are
  // produced by a render evaluation rather than observed directly.
  private resyncFullPageHeightViews() {
    this.prepareRenderPolicyInputs();
    this.viewCtxs.forEach((vc) => {
      vc.scheduleSync({ eval: true, styles: false, asap: true });
    });
  }

  /**
   * Initially set to the value in local storage of mkFocusPreferenceKey.
   *
   * Note `undefined` is a valid value and means there is no focus preference.
   */
  private focusPreference: boolean | undefined;

  getDataSource = memoize((sourceId: string) =>
    this.appCtx.api.getDataSourceById(sourceId).catch((dataSourceErr) => {
      // Don't cache rejections, so a transient failure can be retried.
      this.getDataSource.cache.delete(sourceId);
      throw dataSourceErr;
    }),
  );

  refreshFetchedDataFromPlasmicQuery = (invalidateKey?: string) => {
    this.mutateDataOp(invalidateKey);
    this.viewCtxs.forEach((vc) =>
      vc?.refreshFetchedDataFromPlasmicQuery(invalidateKey),
    );
    // Also refresh the data for the current window, so we update data from DataSourceOpPicker preview
    const maybeExistingMutateAllKeysFn = (window as any).__SWRMutateAllKeys;
    if (typeof maybeExistingMutateAllKeysFn === "function") {
      maybeExistingMutateAllKeysFn(invalidateKey);
    }
  };

  // Managing Content Editor Mode
  isContentEditor() {
    return isContentEditor(this.appCtx.selfInfo, this.siteInfo);
  }

  getAddItemPrefs() {
    return this.site.activeTheme?.addItemPrefs as AddItemPrefs | undefined;
  }

  readonly contentEditorModeStore = createContentEditorModeStore();

  get contentEditorMode() {
    return (
      this.isContentEditor() ||
      DEVFLAGS.contentEditorMode ||
      this.contentEditorModeStore.getState().mode
    );
  }

  getCurrentUiConfig(): UiConfig {
    if (this.contentEditorMode) {
      return mergeUiConfigs(
        this.siteInfo.uiConfig,
        this.siteInfo.contentCreatorConfig,
      );
    } else {
      return mergeUiConfigs(this.siteInfo.uiConfig);
    }
  }

  getLeftTabPermission(tab: LeftTabUiKey) {
    return getLeftTabPermission(this.getCurrentUiConfig(), tab, {
      isContentCreator: this.contentEditorMode,
    });
  }

  toggleContentEditorMode() {
    if (!this.contentEditorMode) {
      // Turn it on
      setContentEditorMode(this, true);
      if (
        (isDedicatedArena(this.currentArena) &&
          !this.canEditComponent(this.currentArena.component)) ||
        isMixedArena(this.currentArena)
      ) {
        this.switchToFirstArena();
      }
    } else {
      // Turn it off
      setContentEditorMode(this, false);
    }
    this.uiEnvironment.sync();
    this.versionHistory.syncContext();
  }

  //
  // Managing the Variants switcher drawer
  //
  get showVariantsDrawer() {
    return this.overlayState.variantsDrawer;
  }
  setShowVariantsDrawer = (show: boolean) => {
    this.overlayState.variantsDrawer = show;
  };

  //
  // Dealing with studio-wide viewport DOM elements and sizes
  //

  private _$canvasClipper = cachedJQSelector(".canvas-editor__canvas-clipper");
  private _$canvas = cachedJQSelector(".canvas-editor__canvas");
  private _$canvasScaler = cachedJQSelector(".canvas-editor__scaler");

  canvasClipper() {
    return ensureHTMLElt(this.maybeCanvasClipper());
  }

  maybeCanvasClipper() {
    return this._$canvasClipper()[0] as HTMLElement | undefined;
  }

  private canvas() {
    return ensureHTMLElt(this.maybeCanvas());
  }

  private maybeCanvas() {
    return this._$canvas()[0];
  }

  private canvasScaler() {
    return ensureHTMLElt(this.maybeCanvasScaler());
  }

  private maybeCanvasScaler() {
    return this._$canvasScaler()[0];
  }

  currentViewportMidpt() {
    return (this.viewportCtx?.visibleScalerBox() ?? Box.zero()).midpt();
  }

  //
  // Managing viewport
  //

  private _$ruler?: JQuery;
  private $ruler() {
    if (!this._$ruler) {
      this._$ruler = $(".canvas-editor__canvas-clipper-grid");
    }
    return this._$ruler;
  }

  private fixRuler() {
    const $ruler = this.$ruler();
    if (this.isTransforming() || this.zoom < 4) {
      $ruler.hide();
    } else {
      const viewportCtx = this.viewportCtx!;
      const scale = viewportCtx.scale();
      const canvasPadding = viewportCtx.canvasPadding();
      const scroll = viewportCtx.scroll();
      const clipperBox = viewportCtx.clipperBox();

      const remainder = (n: number) => n - Math.trunc(n / scale + 1) * scale;
      const t = canvasPadding.sub(scroll);
      $ruler.show().css({
        backgroundSize: `${scale}px ${scale}px`,
        transform: `translate3d(${remainder(t.x)}px, ${remainder(t.y)}px, 0px)`,
        width: clipperBox.width() + 2 * scale,
        height: clipperBox.height() + 2 * scale,
      });
    }
  }

  centerFocusedFrame(maxZoom?: number) {
    const frame =
      this.focusedFrame() ??
      maybe(this.focusedViewCtx(), (vc) => vc.arenaFrame());
    if (frame) {
      this.tryZoomToFitFrame(frame, maxZoom);
    }
  }

  focusNextFrame() {
    const curFrame = maybe(this.focusedViewCtx(), (vc) => vc.arenaFrame());
    const frames = getArenaFrames(this.currentArena).filter(
      (c): c is ArenaFrame => isKnownArenaFrame(c),
    );
    const curIndex = curFrame ? frames.indexOf(curFrame) : undefined;
    const nextIndex =
      curIndex === undefined ? 0 : (curIndex + 1) % frames.length;
    this.setStudioFocusOnFrame({ frame: frames[nextIndex], autoZoom: true });
    this.centerFocusedFrame();
  }

  focusPrevFrame() {
    const curFrame = maybe(this.focusedViewCtx(), (vc) => vc.arenaFrame());
    const frames = getArenaFrames(this.currentArena).filter(
      (c): c is ArenaFrame => isKnownArenaFrame(c),
    );
    const curIndex = curFrame ? frames.indexOf(curFrame) : undefined;
    const prevIndex =
      curIndex === undefined || curIndex === 0
        ? frames.length - 1
        : curIndex - 1;
    this.setStudioFocusOnFrame({ frame: frames[prevIndex], autoZoom: true });
    this.centerFocusedFrame();
  }

  private adjustDevEnv = (scale: number) => {
    const $devEnv = $(".canvas-editor__hoverbox-scroller");
    // const $hoverbox = $devEnv.find(".hoverbox");
    // if ($hoverbox.length > 0) {
    //   invertTransform($hoverbox, scale);
    // }
    // const $preselectBox = $devEnv.find(".PreselectBox");
    // if ($preselectBox.length > 0) {
    //   invertTransform($preselectBox, scale);
    // }
    adjustGridStyleForCurZoom(scale);
    adjustSpotLightDueToZoom(scale);

    $devEnv.find(".MeasureTool__Line").each((index, elt) => {
      invertTransform($(elt), this.zoom);
    });
  };

  //
  // Manage scrolling and panning
  //
  private panningState?: PanningState;

  endPanning = () => {
    this.panningState = undefined;
    this.hidePanningCursor();
  };

  isPanning = () => {
    return !!this.panningState;
  };

  startPanning = (e: MouseEvent) => {
    const initScroll = this.viewportCtx!.scroll();
    this.panningState = {
      initScreenX: e.screenX,
      initScreenY: e.screenY,
      initScrollX: initScroll.x,
      initScrollY: initScroll.y,
      initCanvasPadding: this.viewportCtx!.canvasPadding(),
      initiatedByMiddleButton: e.button === 1,
    };
    this.showPanningCursor(e);
  };

  tryPanning = (e: MouseEvent) => {
    const s = this.panningState;
    s !== undefined &&
      this.viewportCtx!.panTo(
        new Pt(
          s.initScrollX + s.initScreenX - e.screenX,
          s.initScrollY + s.initScreenY - e.screenY,
        ).plus(this.viewportCtx!.canvasPadding().sub(s.initCanvasPadding)),
      );
    return s !== undefined;
  };

  showPanningCursor = (e: MouseEvent) => {
    // Because it is expensive in recalculating style when we add a class
    // to the root of all artboards right when we start panning, we do
    // so only to the body of whatever received the click event
    const doc = (e.target as HTMLElement).ownerDocument;
    if (doc === document) {
      this.canvasClipper().classList.add("panning-grabbing");
    } else {
      doc.body.classList.add("panning-grabbing");
    }
  };
  hidePanningCursor = () => {
    // After panning, we remove panning-grabbing from all possible
    // bodys that we may have added to 😅
    this.canvasClipper().classList.remove("panning-grabbing");
    for (const vc of this.viewCtxs) {
      vc.canvasCtx.$body()[0].classList.remove("panning-grabbing");
    }
  };

  showPannableCursor = () => {
    this.canvasClipper().classList.add("panning-grabbable");
    for (const vc of this.viewCtxs) {
      vc.canvasCtx.$body()[0].classList.add("panning-grabbable");
    }
  };
  hidePannableCursor = () => {
    this.canvasClipper().classList.remove("panning-grabbable");
    for (const vc of this.viewCtxs) {
      vc.canvasCtx.$body()[0].classList.remove("panning-grabbable");
    }
  };

  private _ccRegistry = new CodeComponentsRegistry(
    getHostWindow(),
    getBuiltinComponentRegistrations(),
  );

  subscribeCodeRegistrations(listener: () => void) {
    const stopHost = this._ccRegistry.revisionStore.subscribe(listener);
    const stopHostless = this.hostLessRegistry.revisionStore.subscribe(listener);
    return () => {stopHost(); stopHostless();};
  }

  getCodeRegistrationRevision = () => `${this._ccRegistry.revisionStore.getState()}:${this.hostLessRegistry.revisionStore.getState()}`;

  get codeComponentsRegistry() {
    return this._ccRegistry;
  }

  getRegisteredContextsMap() {
    return this._ccRegistry.getRegisteredComponentsAndContextsMap();
  }

  getContextsRegistration() {
    return [
      ...(swallow(() => this.codeComponentsRegistry.getRegisteredContexts()) ??
        []),
      ...(swallow(() => this.hostLessRegistry.getRegisteredContexts()) ?? []),
    ];
  }

  getCodeComponentsRegistration() {
    return [
      ...(swallow(() =>
        this.codeComponentsRegistry.getRegisteredCodeComponents(),
      ) ?? []),
      ...(swallow(() => this.hostLessRegistry.getRegisteredCodeComponents()) ??
        []),
    ];
  }

  getCodeComponentsAndContextsRegistration() {
    return [
      ...this.getCodeComponentsRegistration(),
      ...this.getContextsRegistration(),
    ];
  }

  getCodeComponentMeta(comp: Component) {
    return this.getCodeComponentsRegistration().find(
      ({ meta }) => meta.name === comp.name,
    )?.meta;
  }

  getTokenRegistration(token: Pick<classes.StyleToken, "regKey">) {
    if (token.regKey) {
      const key = token.regKey;
      return (
        swallow(() =>
          this.codeComponentsRegistry.getRegisteredTokensMap().get(key),
        ) ||
        swallow(() => this.hostLessRegistry.getRegisteredTokensMap().get(key))
      );
    }
    return undefined;
  }

  getRegisteredFunctions() {
    return [
      ...(swallow(() => this.codeComponentsRegistry.getRegisteredFunctions()) ??
        []),
      ...(swallow(() => this.hostLessRegistry.getRegisteredFunctions()) ?? []),
    ];
  }

  getRegisteredFunctionsMap() {
    const map = new Map([
      ...Array.from(this._ccRegistry.getRegisteredFunctionsMap().entries()),
      ...Array.from(
        this.hostLessRegistry.getRegisteredFunctionsMap().entries(),
      ),
    ]);
    if (DEVFLAGS.fnStubs) {
      for (const f of this.site.customFunctions) {
        map.set(customFunctionId(f), {
          function: noopFn,
          meta: {
            name: f.importName,
            namespace: f.namespace ?? undefined,
            importPath: f.importPath,
          },
        });
      }
    }
    return map;
  }

  getRegisteredFunction(func: classes.CustomFunction) {
    return this.getRegisteredFunctionsMap().get(customFunctionId(func));
  }

  getRegisteredLibraries() {
    return [
      ...(swallow(() => this.codeComponentsRegistry.getRegisteredLibraries()) ??
        []),
      ...(swallow(() => this.hostLessRegistry.getRegisteredLibraries()) ?? []),
    ];
  }

  private _traitRegistry = new TraitRegistry(getHostWindow());
  get traitRegistry() {
    return this._traitRegistry;
  }
  getRegisteredTraits() {
    return this._traitRegistry.getRegisteredTraits();
  }

  isTransforming() {
    return this.viewportCtx?.isTransforming() ?? false;
  }

  //
  // Manage zooming
  //

  get zoom() {
    return this.viewportCtx?.scale() ?? 1;
  }

  // Used when zoom by wheel
  private wheelZoomState?: WheelZoomState;
  handleCanvasWheel = (e: WheelEvent) => {
    // Called when e came from studio and not a canvas iframe
    if (this.canvasClipper().contains(e.target as HTMLElement)) {
      this.handleWheel(e, e.clientX, e.clientY);
    }
  };

  handleWheel = (e: WheelEvent, topClientX: number, topClientY: number) => {
    const isZooming = e.ctrlKey || e.metaKey;
    if (!this.isInteractiveMode && !this.isLiveMode && e.altKey && !isZooming) {
      // Both iframe events and Studio selection/spacing overlays arrive here.
      const clientPt = new Pt(topClientX, topClientY);
      const viewCtx = this.viewCtxs.find((vc) =>
        Box.fromRect(vc.canvasCtx.viewport().getBoundingClientRect()).contains(
          clientPt,
        ),
      );
      if (viewCtx) {
        const framePt = clientToFramePt(clientPt, viewCtx, false);
        const target = viewCtx.canvasCtx.getActualTargetUnderCanvasOverlay(
          framePt.x,
          framePt.y,
        );
        if (handleCanvasContentWheel(e, target)) {
          return;
        }
      }
    }
    if (this.isInteractiveMode && !isZooming) {
      return;
    }
    if (this.isLiveMode && isZooming) {
      // disallow zooming in normal live mode too.
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (getArenaFrames(this.currentArena).length === 0) {
      // No canvas operation when the arena is empty.
      if (isZooming) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    this.setWatchPlayerId(null);

    if (isZooming) {
      this.handleWheelZoom(e, topClientX, topClientY);
    } else {
      this.handleWheelScroll(e, topClientX, topClientY);
    }
  };

  private handleWheelScroll = (
    e: WheelEvent,
    _topClientX: number,
    _topClientY: number,
  ) => {
    const [deltaX, deltaY] =
      PLATFORM === "osx" || !e.shiftKey
        ? [e.deltaX, e.deltaY]
        : // If not on Mac OS and shift is pressed,
          // we swap deltas to scroll horizontally
          [e.deltaY * 0.5, e.deltaX * 0.5];

    this.viewportCtx!.scrollBy(new Pt(deltaX, deltaY));

    const shouldAbsorbMove = () => {
      // We normally do want to absorb the wheel event that we are handling as
      // a canvas move.  This is normally also the case if it came from the canvas,
      // because if the wheel event happened over a scrollable panel, we don't want
      // the browser to actually scroll the panel (as we want to move the canvas
      // instead.)  The ONLY exception is when a wheel event moves the cursor from
      // within the canvas frame to outside the canvas frame! In this case, if we
      // do absorb the event, then the browser will no longer fire any more wheel
      // events after the cursor is outside the canvas frame, leading to a dead stop
      // in panning motion.  There must be some default action the browser is taking
      // that is somehow allowing the wheel event to keep firing after the cursor
      // has left the canvas frame, so we take care to _not_ cancel that specific
      // event.
      if (isCanvasIframeEvent(e)) {
        const frame = e.view?.frameElement as HTMLElement | undefined;
        if (frame) {
          const scaledDeltaX = deltaX / this.zoom;
          const scaledDeltaY = deltaY / this.zoom;
          const newClientX = e.clientX + scaledDeltaX;
          const newClientY = e.clientY + scaledDeltaY;
          // Use a 1-pixel cushion because when newClientX is something like 0.4,
          // browser may regard the event as outside of the iframe as well
          if (
            newClientX <= 1 ||
            newClientX >= frame.offsetWidth - 1 ||
            newClientY <= 1 ||
            newClientY >= frame.offsetHeight - 1
          ) {
            return false;
          }
        }
      }
      return true;
    };

    if (shouldAbsorbMove()) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  private handleWheelZoom = (
    e: WheelEvent,
    topClientX: number,
    topClientY: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const now = new Date().getTime();
    if (
      this.wheelZoomState === undefined ||
      !this.isContinuousWheelZooming(e, now)
    ) {
      const zoomState = this.doComputeZoomState(new Pt(topClientX, topClientY));
      this.wheelZoomState = {
        ...zoomState,
        startScreenX: e.screenX,
        startScreenY: e.screenY,
        lastZoomEventTimestamp: now,
      };
    } else {
      this.wheelZoomState.lastZoomEventTimestamp = now;
    }

    const curScale = this.zoom;
    const isWheelByMouseMiddleButton = this.isCtrlOrMetaDown();

    // When ctrl or meta is pressed, wheel event is generated by the mouse's
    // middle key. In that case, we re-align the minDelta with the device.
    const getMinDeltaY = () => {
      if (PLATFORM === "osx") {
        return isWheelByMouseMiddleButton ? 4 : 0.7;
      } else {
        return isWheelByMouseMiddleButton ? 79.5 : 2.29;
      }
    };
    const normalizedDeltaY = e.deltaY / getMinDeltaY();
    // The factor for one notch operation. The higher, the more scale per notch
    // can make. We make zooming by mouse zoom faster than trackpad.
    const scaleFactor = isWheelByMouseMiddleButton ? 2.5 : 0.5;
    const scaleDelta = (normalizedDeltaY * curScale * scaleFactor) / 100;
    // keep the scale precision to 0.00001
    const newScale = Math.trunc((curScale - scaleDelta) * 100000) / 100000;
    this.tryZoomAtFixedPos(newScale, this.wheelZoomState);
  };

  // Compute zoomState to keep the focus at clientX/clientY in the current
  // topmost window's viewport.
  doComputeZoomState = (clientPt: Pt) => {
    const scalerPt = this.viewportCtx!.clientToScaler(clientPt);
    return { clientPt, scalerPt };
  };

  tryZoomWithScale = (scale: number): void => {
    // Zoom under the center of the canvas viewport
    // TODO zoom under the current position of the cursor?
    this.viewportCtx!.scaleAtMidPt(scale);
  };

  tryZoomWithDirection = (dir: -1 | 1): void => {
    this.tryZoomWithScale(zoomJump(this.zoom, dir));
  };

  private isContinuousWheelZooming = (e: WheelEvent, now: number) => {
    return (
      this.wheelZoomState !== undefined &&
      e.screenX === this.wheelZoomState.startScreenX &&
      e.screenY === this.wheelZoomState.startScreenY &&
      this.wheelZoomState.lastZoomEventTimestamp !== undefined &&
      now - this.wheelZoomState.lastZoomEventTimestamp < 200
    );
  };

  tryZoomAtFixedPos = (scale: number, zoomState: ZoomState): void => {
    this.viewportCtx!.scaleAtFixedPt(
      scale,
      zoomState.scalerPt,
      zoomState.clientPt,
    );
  };

  getArenaFrameScalerRect(frame: ArenaFrame) {
    if (frame.left != null && frame.top != null) {
      // Absolutely laid out, so we always know the scaler rect
      return {
        top: frame.top,
        left: frame.left,
        width: frame.width,
        height: getFrameHeight(frame),
      };
    }

    // Automatically laid out, so we need to query the DOM for
    // the scaler rect
    const frameElt = this.getFrameElement(frame);
    if (!frameElt) {
      return undefined;
    }

    // Check frameElt.offsetParent to make sure it is visible
    // (not display:none) and that the arena is shown (not visibility:hidden),
    // so we can trust its actual bounding box
    const clientRect = frameElt.getBoundingClientRect();
    if (clientRect.height === 0 || clientRect.width === 0) {
      // When we initially switch to an arena, our clientRect will be zero-sized because
      // of the scale(0) transform on the ancestor canvas-editor__frames and the browser
      // hasn't had a chance to re-draw yet
      return undefined;
    }
    const scalerRect = this.viewportCtx!.clientToScaler(
      Box.fromRect(clientRect),
    ).rect();
    return scalerRect;
  }

  /** Returns element of frame if rendered and visible. */
  private getFrameElement(frame: ArenaFrame) {
    const frameElt = document.querySelector(
      `[data-frame-id="${frame.uid}"]`,
    ) as HTMLElement | null;
    if (
      frameElt &&
      frameElt.offsetParent &&
      $(frameElt).parents(".canvas-editor__frames").css("visibility") !==
        "hidden"
    ) {
      return frameElt;
    } else {
      return null;
    }
  }

  canvasZoomPadding() {
    const clipper = ensure(this.viewportCtx, "Canvas viewport is not ready")
      .clipperBox()
      .rect();
    const left = document
      .querySelector<HTMLElement>(".canvas-editor__left-pane")
      ?.getBoundingClientRect();
    const rail = document
      .querySelector<HTMLElement>(
        ".canvas-editor__left-pane-container .editor-tool-rail-group",
      )
      ?.getBoundingClientRect();
    const right = document
      .querySelector<HTMLElement>(".canvas-editor__right-pane")
      ?.getBoundingClientRect();
    const controls = document
      .querySelector<HTMLElement>("[data-test-id=canvas-view-controls]")
      ?.getBoundingClientRect();
    return {
      left: Math.max(
        DEFAULT_ZOOM_PADDING,
        left?.width ? left.right - clipper.left + 20 : 0,
        rail?.width ? rail.right - clipper.left + 20 : 0,
      ),
      right: right?.width
        ? Math.max(DEFAULT_ZOOM_PADDING, clipper.right - right.left + 20)
        : DEFAULT_ZOOM_PADDING,
      top: DEFAULT_ZOOM_PADDING,
      bottom: controls?.height
        ? Math.max(80, clipper.bottom - controls.top + 20)
        : 80,
    };
  }

  tryZoomToFitArena() {
    if (this.hasInitialEditorView) {
      return;
    }
    const arena = this.currentArena;
    if (!arena) {
      return;
    }

    const viewportCtx = this.viewportCtx;
    if (!viewportCtx) {
      // Window hasn't fully initialized yet, try again after 10ms
      setTimeout(() => this.tryZoomToFitArena(), 10);
      return;
    }

    const padding = this.canvasZoomPadding();
    viewportCtx.zoomToScalerBox(
      Box.zero().withSizeOfPt(viewportCtx.arenaScalerSize()),
      {
        maxScale: 1,
        minPadding: {
          ...padding,
          left: padding.left + this.getArenaGridLabelsWidth(),
        },
        ignoreHeight: this.focusedMode,
      },
    );
  }

  async tryZoomToFitSelection() {
    if (this.focusedFrames().length > 1 && this.viewportCtx) {
      const bounds = Box.mergeBBs(
        this.focusedFrames().flatMap((frame) => {
          const rect = this.getArenaFrameScalerRect(frame);
          return rect ? [rect] : [];
        }),
      );
      if (bounds) {
        this.viewportCtx.zoomToScalerBox(bounds, {
          minPadding: this.canvasZoomPadding(),
        });
      }
      return;
    }
    const focusedFrame = this.focusedFrame();
    if (focusedFrame) {
      this.tryZoomToFitFrame(focusedFrame);
      return;
    }

    const vc = this.focusedViewCtx();
    if (!vc) {
      return;
    }

    // Trigger evaluation to ensure hidden elements are auto-shown
    vc.scheduleSync({ eval: true, styles: false, asap: true });
    await vc.awaitSync();

    const $focusedDom = vc.focusedDomElt();
    if (!$focusedDom?.length) {
      return;
    }

    this.tryZoomToFitDomElement($focusedDom[0]);
  }

  tryZoomToFitDomElement(element: HTMLElement, vc = this.focusedViewCtx()) {
    if (!vc) {
      return;
    }

    // Fit the part of the element that is visible in the artboard, matching
    // its selection outline; parts clipped by scroll containers or the
    // artboard would only add empty canvas.
    const scalerRect = frameToScalerRect(
      getVisibleFrameRect(element).rect(),
      vc,
    );
    const padding = this.canvasZoomPadding();
    this.viewportCtx!.zoomToScalerBox(Box.fromRect(scalerRect), {
      minPadding: {
        ...padding,
        right: Math.max(padding.right, DEFAULT_ZOOM_PADDING),
      },
    });
  }

  tryZoomToFitTpl(tpl: TplNode) {
    const vc = this.focusedViewCtx();
    if (!vc) {
      return;
    }
    const [_, doms] = vc.maybeDomsForTpl(tpl, {
      ignoreFocusedCloneKey: true,
    });
    if (doms?.length) {
      this.tryZoomToFitDomElement(doms[0]);
    }
  }

  tryZoomToFitFrame(frame: ArenaFrame, maxZoom?: number) {
    const viewportCtx = this.viewportCtx;
    const scalerRect = this.getArenaFrameScalerRect(frame);
    if (viewportCtx && scalerRect) {
      viewportCtx.zoomToScalerBox(Box.fromRect(scalerRect), {
        maxScale: maxZoom,
        minPadding: this.canvasZoomPadding(),
      });
    } else {
      // Frame hasn't been rendered yet, so try again next tick
      defer(() => this.tryZoomToFitFrame(frame, maxZoom));
    }
  }

  private getArenaGridLabelsWidth() {
    const arenaGridLabels = getGridRowLabels(this.currentArena);

    if (arenaGridLabels.length === 0) {
      return 0;
    }

    const longestLabel = maxBy(arenaGridLabels, (it) => it.length) ?? "";

    const labelClassNames = cn(
      gridFramesLayoutStyles.rowLabel,
      gridFramesLayoutStyles.rowLabelInner,
    );

    return getTextWidth(longestLabel, labelClassNames);
  }

  readonly multiplayerCtx = new MultiplayerCtx(this);

  readonly cursorStore = createCursorStore();

  get watchPlayerId() {
    return this.multiplayerCtx.followStore.getState();
  }

  setWatchPlayerId(v: number | null) {
    this.multiplayerCtx.setFollowedPlayer(v);
  }

  updateCursorLocation(pos: { left: number; top: number } | null) {
    setCursorLocation(this, pos);
  }

  private viewInfoObserverDispose: (() => void) | undefined = undefined;
  private watchPlayerDispose: (() => void) | undefined = undefined;

  private shouldSyncWithOtherPlayers = () => {
    return this.editMode;
  };

  private listeningForSocketEvents = false;

  /**
   * Start listening for changes to this project on the server.
   */
  async startListeningForSocketEvents() {
    const api = this.appCtx.api;

    // Close any socket left over from a previous studio session (e.g. after
    // navigating to a dashboard and back); its state is stale.
    await api.closeSocket();

    const eventListeners: ServerToClientEvents = {
      aiChat: () => undefined,
      connect: async () => {
        // upon connection, subscribe to changes for argument projects
        await api.emit("subscribe", {
          namespace: "projects",
          projectIds: [this.siteInfo.id],
          studio: true,
        });
        // Check still connected after await.
        if (!this.listeningForSocketEvents) {
          return;
        }

        this.viewInfoObserverDispose?.();
        this.viewInfoObserverDispose = undefined;
        this.watchPlayerDispose?.();
        this.watchPlayerDispose = undefined;

        if (this.isAtTip) {
          if (this.canSendMultiplayerInfo()) {
            const syncView = () => {
                const arenaState = this.arenaState.store.getState();
                const arena = arenaState.current && this.modelSnapshots.resolve(arenaState.current);
                const focusedVc = this.focusedViewCtx();
                const frameUuid = focusedVc?.arenaFrame().uuid;
                const selectable = this.hoverBoxControlledObj;
                const selectableKey = isSelectable(selectable)
                  ? makeSelectableFullKey(selectable)
                  : undefined;
                const cursor = this.cursorStore.getState().cursor;
                const position =
                  this.viewportCtx?.visibleScalerBox().rect() ?? null;

                const branchInfo = this.branchInfo();
                const data: UpdatePlayerViewRequest = {
                  projectId: this.siteInfo.id,
                  branchId: branchInfo ? branchInfo.id : null,
                  arena: arena
                    ? {
                        type: getArenaType(arena),
                        uuidOrName: arenaState.kind === "mixed" ? arenaState.name : getArenaUuidOrName(arena),
                        focused: arenaState.focusedMode,
                      }
                    : null,
                  cursor:
                    cursor && this.editMode && !this.isLiveMode
                      ? {
                          left: cursor.left,
                          top: cursor.top,
                        }
                      : null,
                  selection:
                    frameUuid && this.editMode && !this.isLiveMode
                      ? {
                          selectableFrameUuid: frameUuid,
                          selectableKey,
                        }
                      : null,
                  position: position,
                };
                spawn(api.emit("view", data));
              };
            const syncViewportView = throttle(syncView, 200, { leading: false, trailing: true });
            const stopModelView = this.subscribeModelChanges(syncViewportView);
            const stopVersionView = this.dbCtx().subscribeVersionInputs(syncViewportView);
            const stopPolicyView = this.uiEnvironment.store.subscribe(syncViewportView);
            syncView();
            const stopCursorView = subscribeToSelector(
              this.cursorStore,
              (state) => state.cursor,
              syncViewportView,
            );
            const stopViewportView = subscribeViewport(this, (state) => state.visibleScalerBox, syncViewportView);
            const stopArenaView = this.arenaState.store.subscribe((next, previous) => {
              if (next.current !== previous.current || next.kind !== previous.kind || next.name !== previous.name || next.focusedMode !== previous.focusedMode) { syncViewportView(); }
            });
            const stopLiveView = subscribeStudioLiveMode(this, syncViewportView);
            const stopFocusView = subscribeStudioSelection(this, (state) => state.view, syncViewportView);
            const stopFrameView = subscribeStudioSelection(this, (state) => state.frames, syncViewportView);
            const stopTargetView = subscribeFocusedViewSelection(this, (state) => state.targets, syncViewportView);
            this.viewInfoObserverDispose = () => {
              stopLiveView(); stopFocusView(); stopFrameView(); stopTargetView(); stopArenaView();
              stopModelView(); stopVersionView(); stopPolicyView();
              stopViewportView();
              stopCursorView();
              syncViewportView.cancel();
            };
          }
          let unsubscribePosition: (() => void) | undefined;
          const selectPlayer = (playerId: number | null) => {
            unsubscribePosition?.();
            unsubscribePosition = undefined;
            if (playerId === null) {
              return;
            }
            let pending: ReturnType<typeof setTimeout> | undefined;
            const updatePosition = () => {
              if (pending) {
                return;
              }
              // Preserve the prior delayed reaction's bounded cadence, even
              // while the followed player keeps moving continuously.
              pending = setTimeout(() => {
                pending = undefined;
                if (this.watchPlayerId !== playerId) {
                  return;
                }
                const playerData =
                  this.multiplayerCtx.getPlayerDataById(playerId);
                if (!playerData || playerData.viewInfo?.arenaInfo?.focused) {
                  this.setWatchPlayerId(null);
                  return;
                }
                spawn(this.goToPlayer(playerId, true));
              }, 200);
            };
            const unsubscribe = this.multiplayerCtx.subscribePlayerPosition(
              playerId,
              updatePosition,
            );
            unsubscribePosition = () => {
              unsubscribe();
              clearTimeout(pending);
            };
          };
          const stopWatching =
            this.multiplayerCtx.followStore.subscribe(selectPlayer);
          selectPlayer(this.watchPlayerId);
          this.watchPlayerDispose = () => {
            stopWatching();
            unsubscribePosition?.();
          };
        }
      },
      initServerInfo: (data) => {
        const oudatedSchema = modelSchemaHash !== data.modelSchemaHash;
        const outdatedBundle =
          data.bundleVersion !== this.appCtx.lastBundleVersion;
        this.multiplayerCtx.updateSelfId(data.selfPlayerId);
        if (oudatedSchema || outdatedBundle) {
          this.alertBannerState.set(AlertSpec.OutOfDate);
          spawn(this.changeUnsafe(() => (this.isAtTip = false)));
        }
      },
      commentsUpdate: async () => {
        await this.commentsCtx.fetchComments();
      },
      update: async (data) => {
        // Just run syncProjects() for now when any project has been updated
        const revisionNum = data.rev.revision;
        const revisionBranchId = data.rev.branchId;
        const currentBranchId = this.branchInfo()?.id ?? null;

        console.log(
          `Project ${data.projectId} updated to revision ${revisionNum}`,
        );

        // Append revision to the list if it's from the current branch
        if (revisionBranchId === currentBranchId) {
          this.versionHistory.prependRevision(data.rev);
        }

        if (!this.editMode) {
          return;
        }

        if (
          this.pendingSavedRevisionNum === undefined ||
          this.pendingSavedRevisionNum < revisionNum
        ) {
          if (this.shouldSyncWithOtherPlayers()) {
            if (this.isAtTip) {
              await this.fetchUpdates();
            }
          } else {
            if (this.alertBannerState.get() === AlertSpec.Watch) {
              await this.fetchUpdatesWatch();
            } else if (this.isAtTip) {
              console.log(
                `Edit lock stolen.  pendingSavedRevisionNum is ${this.pendingSavedRevisionNum} but got ${revisionNum}`,
              );
              this.alertBannerState.set(AlertSpec.ConcurrentEdit);
              await this.changeUnsafe(() => (this.isAtTip = false));
            }
          }
        } else if (this.pendingSavedRevisionNum === revisionNum) {
          // The ACKs have now caught up to the latest pending save.
          this.pendingSavedRevisionNum = undefined;
        }
      },
      players: (data) => {
        if (this.isAtTip) {
          spawn(this.multiplayerCtx.updateSessions(data.sessions));
        }
      },
      error: (e) => {
        console.log("Error received from socket", e);
      },
      disconnect: async (reason) => {
        // The following events indicate a purposeful disconnect
        // and will not be automatically reconnected.
        // https://socket.io/docs/v4/client-api/#event-disconnect
        if (
          reason === "io server disconnect" ||
          reason === "io client disconnect"
        ) {
          await this.stopListeningForSocketEvents();
        } else {
          await this.multiplayerCtx.updateSessions([]);
        }
      },
      publish: async (data: PkgVersionInfoMeta) => {
        if (this.releases.length === 0 || this.releases[0].id !== data.id) {
          this.versionHistory.prependRelease(data);
        }
        await this.refreshRevisions();
      },
      hostlessDataVersionUpdate: (data: any) => {
        if (data.hostlessDataVersion !== this.dbCtx().hostlessDataVersion) {
          this.saveState.deferPublication(() => {
            this.alertBannerState.set(AlertSpec.OutOfDate);
            this.isAtTip = false;
          });
        }
      },
    };

    const eventNames = Object.keys(
      eventListeners,
    ) as (keyof ServerToClientEvents)[];

    this.listeningForSocketEvents = true;
    while (this.listeningForSocketEvents) {
      const event = await api.listenSocket(eventNames);
      if (event === undefined || !this.listeningForSocketEvents) {
        break;
      }
      await eventListeners[event.eventName](event.data);
    }
  }

  async stopListeningForSocketEvents() {
    this.listeningForSocketEvents = false;
    this.viewInfoObserverDispose?.();
    this.viewInfoObserverDispose = undefined;
    this.watchPlayerDispose?.();
    this.watchPlayerDispose = undefined;
    this.multiplayerCtx.clearSessions();
    await this.appCtx.api.closeSocket();
  }

  /**
   * Returns true if the onwer of the project is a plasmic dev or if this is a normal user.
   * This is used to avoid sending multiplayer info from plasmic devs to other users when
   * debugging an user project.
   */
  canSendMultiplayerInfo() {
    return (
      isAdminTeamEmail(this.siteInfo.owner?.email, this.appCtx.appConfig) ||
      !isAdminTeamEmail(this.appCtx.selfInfo?.email, this.appCtx.appConfig)
    );
  }

  /** Continuously called when player data changes. */
  async goToPlayer(playerId: number, smooth?: boolean) {
    const playerData = this.multiplayerCtx.getPlayerDataById(playerId);
    const branchId = playerData?.viewInfo?.branchId;
    const arenaInfo = playerData?.viewInfo?.arenaInfo;
    const position = playerData?.viewInfo?.positionInfo;
    if (!arenaInfo || !position) {
      return;
    }

    // TODO: https://app.shortcut.com/plasmic/story/37322
    if (arenaInfo.focused) {
      return;
    }

    let branch: ApiBranch | undefined = undefined;
    if (branchId) {
      // Given branchId, lookup branch name

      // Try using the current branch first
      const currentBranch = this.dbCtx().branchInfo;
      if (currentBranch?.id === branchId) {
        branch = currentBranch;
      } else {
        // Else make network call for branches
        const { branches } = await this.appCtx.api.listBranchesForProject(
          this.siteInfo.id,
        );
        branch = branches.find((b) => (b.id = branchId));
        if (!branch) {
          return; // Give up on watching player
        }
      }
    }

    // TODO: support following to previous versions?
    if (branch !== this.dbCtx().branchInfo) {
      await this.loadVersion(
        undefined /* undefined loads latest version */,
        true,
        branch,
      );
    }

    const arena = getArenaByNameOrUuidOrPath(
      this.site,
      arenaInfo.uuidOrName,
      arenaInfo.type,
    );
    if (!arena) {
      return; // Give up on watching player
    }

    // TODO: https://app.shortcut.com/plasmic/story/37322
    if (isDedicatedArena(arena)) {
      arena._focusedFrame = null;
    }

    const changeResult = await this.change(
      () => {
        this.switchToArena(arena, { stopWatching: false });
        return ok();
      },
      {
        noUndoRecord: true,
      },
    );
    if (changeResult.isErr()) {
      return; // Give up on watching player
    }

    this.viewportCtx?.zoomToScalerBox(Box.fromRect(position), {
      smooth,
    });
    const selection = playerData?.viewInfo?.selectionInfo;
    const arenaFrame = selection
      ? getArenaFrames(arena).find(
          (frame) => frame.uuid === selection.selectableFrameUuid,
        )
      : undefined;
    if (!arenaFrame) {
      this.setStudioFocusOnFrameContents(undefined);
      this.focusReset.dispatch();
      return;
    }
    const viewCtx = await this.awaitViewCtxForFrame(arenaFrame);
    if (viewCtx) {
      viewCtx.selectFromSelectionId(selection?.selectableKey);
    }
  }

  private _focusedBottomModalIndex: number | undefined;

  get focusedBottomModalIndex() {
    return this._focusedBottomModalIndex;
  }

  setFocusedBottomModalIndex(v: number | undefined) {
    this._focusedBottomModalIndex = v;
  }

  isBottomModalFocused() {
    return this.focusedBottomModalIndex != null;
  }

  //
  // Manage undo / redo
  //
  readonly undoLogOwnerStore = createStore<UndoLog | undefined>(() => undefined);
  get undoLog() { return ensure(this.undoLogOwnerStore.getState(), "Undo log must be initialized"); }
  set undoLog(undoLog: UndoLog) { this.undoLogOwnerStore.setState(undoLog, true); }

  createViewStateUndoRecord() {
    this.undoLog.record(this.createUndoRecord());
  }

  canUndo() {
    return this.undoLog.canUndo();
  }

  async undo() {
    assert(!this._isChanging, "isChanging should be false");
    if (this.isBottomModalFocused()) {
      // If the bottom modal is open, the user was more likely trying to undo
      // some settings there and not in Studio.
      return;
    }
    if (this.undoLog.canUndo()) {
      await this.modelChangeQueue.push({ type: "undo" });
      defer(() => this.framesChanged.dispatch());
    }
  }

  canRedo() {
    return this.undoLog.canRedo();
  }

  async redo() {
    assert(!this._isChanging, "isChanging should be false");
    if (this.isBottomModalFocused()) {
      return;
    }
    if (this.undoLog.canRedo()) {
      await this.modelChangeQueue.push({ type: "redo" });
      defer(() => this.framesChanged.dispatch());
    }
  }

  private createUndoRecord(changes?: RecordedChanges): UndoRecord {
    return {
      changes: changes || emptyRecordedChanges(),
      view: this.currentViewState(),
    };
  }

  private async restoreUndoRecordInternal(type: "undo" | "redo") {
    const previousComponentCtxs = new Map<ViewCtx, ComponentCtx | null>(
      this.viewCtxs.map((vc) => tuple(vc, vc.currentComponentCtx())),
    );
    const vcToSpotlightAndVariantsInfo = new Map<
      ViewCtx,
      SpotlightAndVariantsInfo
    >(this.viewCtxs.map((vc) => tuple(vc, vc.getSpotlightAndVariantsInfo())));

    const restoreStudioView = (view: ViewStateSnapshot) => {
      const focusedArena = getSiteArenas(this.site).find(
        (it) => it === view.focusedArena,
      );

      if (!focusedArena) {
        return;
      }

      if (this.currentArena !== focusedArena) {
        this.switchToArena(focusedArena, {
          noFocusedModeChange: true, // undo record should have the correct focused mode state
        });
      }

      if (!focusedArena) {
        return;
      }

      if (view.focusedFrame && !view.focusedOnFrame) {
        // If there's a focused object, then we defer for ViewCtx.restoreViewState to restore
        return;
      } else if (view.focusedFrame) {
        // Focused just on the frame
        this.setStudioFocusOnFrames(view.focusedFrames ?? [view.focusedFrame]);
      } else {
        // Focused on nothing
        this.setStudioFocusOnFrame({ frame: undefined, autoZoom: false });
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const sc = this;
    const update = async (): Promise<{
      record?: UndoRecord;
      summary?: ChangeSummary;
      styleChanges?: UpsertStyleChanges;
    }> => {
      if (type === "undo" && !sc.undoLog.canUndo()) {
        notification.error({
          message: translate(getUiLocale(), "Cannot undo anymore."),
        });
        return {};
      }
      if (type === "redo" && !sc.undoLog.canRedo()) {
        notification.error({
          message: translate(getUiLocale(), "Cannot redo anymore."),
        });
        return {};
      }
      if (sc.blockChanges) {
        return {};
      }
      const restored = sc.runNativeArenaCommand(() => sc.runNativeSaveCommand(() => {
        const record = type === "undo" ? sc.undoLog.undo() : sc.undoLog.redo();

        // Retire removed frames and detached selection before publishing the
        // restored model. A recreated canvas mounts from these model inputs.
        sc.pruneInvalidViewCtxs();
        sc.pruneDetachedTpls();
        restoreStudioView(record.view);
        const view = sc.tryGetViewCtxForFrame(record.view.focusedFrame);
        view?.restoreViewState(record.view);

        record.changes = mergeRecordedChanges(
          record.changes,
          sc.recorder.withRecording(() => {
            sc.ensureAllComponentStackFramesHasOnlyValidVariants();
            fixupChrome(sc);
          }),
        );
        sc.addToChangeRecords(record.changes);
        const summary = summarizeChanges(sc, record.changes);
        const styleChanges = sc.syncAfterChanges(summary);
        return { record, summary, styleChanges, view };
      }));
      const { record } = restored;

      // Publish the synchronous model restoration before awaiting DOM work.
      // Otherwise React still sees no page/frame, so it cannot create the very
      // ViewCtx this history task is waiting for and the model queue deadlocks.
      if (record.view.focusedFrame && !restored.view) {
        const frame = record.view.focusedFrame;
        for (let i = 0; i < 10 && !sc.tryGetViewCtxForFrame(frame); i++) {
          // An iframe can remount immediately after its ViewCtx was created.
          await sc.awaitViewCtxForFrame(frame);
        }
        const view = ensure(sc.tryGetViewCtxForFrame(frame), "should find viewctx for this frame");
        sc.runNativeArenaCommand(() => sc.runNativeSaveCommand(() => {
          view.restoreViewState(record.view);
          const fixes = sc.recorder.withRecording(() => {
            sc.ensureAllComponentStackFramesHasOnlyValidVariants();
            fixupChrome(sc);
          });
          if (fixes.changes.length) {
            // Selection may require a variant setting in the recreated view.
            // Keep that repair in the same undo record and saved model.
            record.changes = mergeRecordedChanges(record.changes, fixes);
            sc.addToChangeRecords(fixes);
            restored.styleChanges = sc.syncAfterChanges(summarizeChanges(sc, fixes)) ?? restored.styleChanges;
            restored.summary = summarizeChanges(sc, record.changes);
          }
        }));
      }
      return restored;
    };
    try {
      sc._isUndoing = true;

      // Restore model changes and install the corresponding native snapshots.
      const { record, summary, styleChanges } = await update();

      if (!record || !summary) {
        return;
      }

      // Evaluate affected views only after the restored state is installed.

      const shouldEvaluate = (vc: ViewCtx) => {
        return this.shouldEvaluateViewCtx(vc, {
          summary,
          previousComponentCtx: previousComponentCtxs.get(vc),
          previousVcInfo: vcToSpotlightAndVariantsInfo.get(vc),
        });
      };

      const shouldRestyle = (vc: ViewCtx) => {
        // Should update vc style if it's never had styles before,
        // or if there has been style changes
        return !vc.valState().maybeValSysRoot() || !!styleChanges;
      };

      this.viewCtxs.forEach((vc) => {
        const isFocused = vc.arenaFrame() === record.view.focusedFrame;
        const needsEval = shouldEvaluate(vc);
        vc.scheduleSync({
          eval: needsEval,
          styles: shouldRestyle(vc),
          asap: isFocused,
        });
      });
    } finally {
      sc._isUndoing = false;
    }
  }

  private shouldEvaluateViewCtx(
    vc: ViewCtx,
    opts: {
      summary: ChangeSummary;
      showPlaceholderChanged?: boolean;
      interactiveModeChanged?: boolean;
      previousComponentCtx: ComponentCtx | null | undefined;
      previousVcInfo: SpotlightAndVariantsInfo | null | undefined;
    },
  ) {
    if (!vc.valState().maybeValGlobalRoot()) {
      // If this frame has never been evaluated before, then evaluate.
      return true;
    }

    const {
      summary,
      showPlaceholderChanged,
      interactiveModeChanged,
      previousComponentCtx,
      previousVcInfo,
    } = opts;
    // If theme snapshot, "show placeholders" or "interactive mode" changed,
    // we need to re-evaluate all viewctx.
    if (showPlaceholderChanged || interactiveModeChanged) {
      // If the caller instructed us to force eval, then do so
      return true;
    }
    // If componentCtx changes, we need to re-render it anyway.
    if (previousComponentCtx !== vc.currentComponentCtx()) {
      return true;
    }

    const vcInfo = vc.getSpotlightAndVariantsInfo();
    // If spotlight or the pinned variants change, we also need to re-render
    // the frame.
    if (!previousVcInfo || viewCtxInfoChanged(vcInfo, previousVcInfo)) {
      return true;
    }

    // TODO: also check for grid style changes
    if (
      summary.changesType !== ChangesType.OtherChanges &&
      !summary.styleForcesEval
    ) {
      // If there are only css changes, then fixupForChanges() above has
      // already fixed the css styles for them, so we don't need to
      // re-evaluate.
      //
      // However, certain style changes do require changing the DOM --
      // grid styles and other indicated by summary.styleForcesEval --
      // so we still need to re-evaluate them if they are deeply
      // referenced by this vc's component.
      return false;
    }

    // Else, evaluate this frame if its component has been updated, or is
    // deeply referencing some node that has been updated.
    return vc.component && summary.deepUpdatedComponents.has(vc.component);
  }

  private currentViewState(): ViewStateSnapshot {
    const arena = this.currentArena;
    const vc = this.focusedViewCtx();
    const curFocusedFrame = this.focusedFrame();
    const frame = vc
      ? vc.arenaFrame()
      : arena &&
          curFocusedFrame &&
          getArenaFrames(arena).includes(curFocusedFrame)
        ? curFocusedFrame
        : undefined;
    // If the element is invisible, then retain the focusedTpl.
    const nextFocusedTpl =
      (vc && vc.nextFocusedTpl()) ||
      (vc && !vc.focusedSelectable() ? vc.focusedTpl() : undefined);

    // We keep a clone() of the ComponentStackFrame for our undo record because
    // ComponentStackFrame mutates its state, so just keeping a reference to it
    // is not enough
    const variantsStack = vc
      ? vc
          .componentStackFrames()
          .slice()
          .map((f) => f.clone())
      : frame
        ? [new RootComponentVariantFrame(frame)]
        : undefined;

    return {
      focusedArena: arena,
      focusedFrame: frame,
      focusedFrames: this.focusedFrames().slice(),
      focusedOnFrame: !!this.focusedFrame(),
      focusedSelectable: (vc && vc.focusedSelectable()) || undefined,
      vcComponentStack: variantsStack,
      currentComponentCtx: vc
        ? vc.currentComponentCtx() || undefined
        : undefined,
      nextFocusedTpl: nextFocusedTpl || undefined,
      vcFocusedCloneKey: vc?.focusedCloneKey(),
      vcShowDefaultSlotContents: vc?.showDefaultSlotContents(),
    };
  }

  //
  // Manage free-style drawing -- whether we are in free-drawing mode,
  // what we are free-drawing for
  //
  private _pointerState: PointerState = "move";
  readonly canvasInsertStore = createCanvasInsertStore();
  setFreestyleState(state: FreestyleState | undefined) {
    this.setDragInsertState(undefined);
    this.canvasInsertStore.setState((previous) => previous.freestyle === state ? previous : { freestyle: state });
  }
  freestyleState() {
    return this.canvasInsertStore.getState().freestyle;
  }

  pointerState() {
    return this.freestyleState() === undefined ? "move" : this._pointerState;
  }
  setPointerState(pointerState: PointerState) {
    this._pointerState = pointerState;
    switch (pointerState) {
      case "move":
        return this.setFreestyleState(undefined);
      case "rect":
        return this.setFreestyleState(
          new FreestyleState(INSERTABLES_MAP.box as AddTplItem),
        );
      case "stack":
        return this.setFreestyleState(
          new FreestyleState(INSERTABLES_MAP.stack as AddTplItem),
        );
      case "hstack":
        return this.setFreestyleState(
          new FreestyleState(INSERTABLES_MAP.hstack as AddTplItem),
        );
      case "vstack":
        return this.setFreestyleState(
          new FreestyleState(INSERTABLES_MAP.vstack as AddTplItem),
        );
      case "text":
        return this.setFreestyleState(
          new FreestyleState(INSERTABLES_MAP.text as AddTplItem),
        );
    }
  }

  //
  // Manage drag insertion mode (when we select an item to be inserted and nothing
  // is selected on the canvas)
  //
  setDragInsertState(state: DragInsertState | undefined) {
    if (state) {
      this.setFreestyleState(undefined);
      this.startUnlogged();
    } else {
      this.stopUnlogged();
      this.dragInsertState()?.dragMgr.clear();
    }
    this.canvasInsertStore.setState((previous) => previous.dragInsert === state ? previous : { dragInsert: state });
  }
  dragInsertState() {
    return this.canvasInsertStore.getState().dragInsert;
  }

  //
  // indicate whether we are dragging an element (not dragging the label of the
  // element). This is needed to hide the HoverBox, which doesn't know about
  // the state of ViewEditor when dragging an element otherwise.
  //
  private readonly _isDraggingObject = createStore<boolean>(() => false);
  readonly draggingObjectStore: ModelFieldStore<boolean> = this._isDraggingObject;
  setIsDraggingObject(v: boolean) {
    this.app.setIsDragging(v);
    if (v === this._isDraggingObject.getState()) { return; }
    this.runRenderPolicyCommand(() => {
      this.prepareRenderPolicyInputs({ draggingOverride: v });
      const publications = this.viewCtxs.map((view) =>
        view.canvasRenderOwner.prepareDraggingObject(v),
      );
      publications.forEach((publish) => this.renderPolicy.queuePublication(publish));
      this._isDraggingObject.setState(v, true);
    });
  }
  isDraggingObject() {
    return this._isDraggingObject.getState();
  }
  get isResizeDragging() {
    return this.overlayState.resizeDragging;
  }
  set isResizeDragging(v: boolean) {
    this.app.setIsDragging(v);
    this.overlayState.resizeDragging = v;
  }

  //
  // Indicate whether we are transforming an element, with css transforms.
  // This is needed to hide the HoverBox during the change
  //
  readonly transformingObjectStore = createStore<boolean>(() => false);
  setIsTransformingObject(v: boolean) {
    this.transformingObjectStore.setState(v, true);
  }
  isTransformingObject() {
    return this.transformingObjectStore.getState();
  }

  public splitsStatusChanges = new Map<string, string>();

  //
  // Dealing with generating CSS styles used by all frames
  //
  private styleMgr: StyleMgr;
  animationChanged = new Signals.Signal();
  styleChanged = new Signals.Signal();
  framesChanged = new Signals.Signal();
  focusReset = new Signals.Signal();
  leftPanelHighlightingRequested = new Signals.Signal();
  showNavigationPanelRequested: Signals.Signal<"pages" | "outline"> =
    new Signals.Signal();
  highlightInteractionRequested: Signals.Signal<HighlightInteractionRequest> =
    new Signals.Signal();

  highlightLeftPanel = () => {
    this.leftPanelHighlightingRequested.dispatch();
  };

  readonly navigationPanelStore = createStore<"pages" | "outline">(() => "outline");
  get navigationPanel() {
    return this.navigationPanelStore.getState();
  }
  setNavigationPanel = (panel: "pages" | "outline") =>
    this.navigationPanelStore.setState(panel, true);

  showProjectPanel = () => {
    this.showNavigationPanelRequested.dispatch("pages");
  };

  showLayersPanel = () => this.showNavigationPanelRequested.dispatch("outline");

  styleMgrBcast = {
    syncStyles: () => {
      const focusedVc = this.focusedViewCtx();
      for (const vc of this.viewCtxs) {
        vc.scheduleSync({
          eval: false,
          styles: true,
          asap: vc === focusedVc,
        });
      }
    },
    installDepStyles: (dep: ProjectDependency) => {
      this.styleMgr.upsertStyles({
        updatedDeps: new Set([dep]),
      });
      this.styleMgrBcast.syncStyles();
    },
    removeDepStyles: (dep: ProjectDependency) => {
      this.styleMgr.upsertStyles({
        deletedDeps: new Set([dep]),
      });
      this.styleMgrBcast.syncStyles();
    },
    upsertStyleSheets: (viewCtx: ViewCtx) => {
      const canvasCtx = viewCtx.canvasCtx;
      this.styleMgr.upsertStyleSheets(canvasCtx.$doc()[0], viewCtx.component);
    },
    playAnimationPreview: (tpl: TplNode, animations: Animation[]) => {
      return this.styleMgr.playAnimationPreview(tpl, animations);
    },
    stopAnimationPreview: (tpl: TplNode) => {
      this.styleMgr.stopAnimationPreview(tpl);
    },
    hasActiveAnimationPreview: (tpl: TplNode) => {
      return this.styleMgr.hasActiveAnimationPreview(tpl);
    },
  };

  //
  // Inserting new tpl nodes
  //
  async tryInsertTplItem(
    item: AddTplItem,
    opts?: ExtraInfoOpts,
  ): Promise<TplNode | null> {
    const vc = this.focusedViewCtx();
    if (!vc) {
      if (item.type === "tpl") {
        const dragMgr = await DragInsertManager.build(this, item, opts);
        await this.changeUnsafe(() => {
          this.setDragInsertState(new DragInsertState(dragMgr, item));
        });
      } else {
        notification.error({
          message: translate(
            getUiLocale(),
            "First select an element you want to insert to.",
          ),
        });
      }
      return null;
    }

    // If inserting a template, then insert at innermost main-content-slot, or else root.
    const tryGetInsertableTemplateTarget = ():
      TplNode | SlotSelection | undefined => {
      const tpls = flattenTpls(vc.currentComponent().tplTree).reverse();
      for (const tpl of tpls) {
        if (isTplComponent(tpl)) {
          const slotParam = tpl.component.params.find(
            (p) => p.isMainContentSlot,
          );
          if (slotParam) {
            // Found it!
            return new SlotSelection({
              tpl,
              slotParam,
            });
          }
        }
      }
      // Fallback is inside the page root, but what does that mean?
      // Only allowing inside HTML elements or TplComponent children slot (instead of any arbitrary slot).
      return switchType(last(tpls))
        .when(TplComponent, (t) => {
          const slotParam = t.component.params.find((p) => isSlot(p));
          return slotParam
            ? new SlotSelection({ tpl: t, slotParam })
            : undefined;
        })
        .when(TplTag, (t) => (isTplContainer(t) ? t : undefined))
        .when(TplSlot, (_t) => undefined)
        .result();
    };

    const getTargetLoc = (): [
      TplNode | SlotSelection | undefined,
      InsertRelLoc[],
    ] => {
      const sel = maybe(vc.focusedTpl(), tryGetMainContentSlotTarget);
      if (sel) {
        return [sel, [InsertRelLoc.append]];
      }
      // This is a hacky way to identify that the item is an insertable template.
      if (
        this.appCtx.appConfig.insertTemplatesIntoMainContentSlots &&
        item.key.startsWith("insertable-template-item")
      ) {
        const target = tryGetInsertableTemplateTarget();
        if (target) {
          return [target, [InsertRelLoc.append]];
        }
      }
      // undefined target means insert at selection
      return [
        undefined,
        getPreferredInsertLocs(vc, getFocusedInsertAnchor(vc)),
      ];
    };

    const [target, locs] = getTargetLoc();
    if (locs.length === 0) {
      notification.error({
        message: translate(
          getUiLocale(),
          "Cannot insert this at the current location.",
        ),
      });
      return null;
    }
    const extraInfo = item.asyncExtraInfo
      ? await item.asyncExtraInfo(vc.studioCtx, opts)
      : undefined;
    if (extraInfo === false) {
      return null;
    }
    return await this.changeUnsafe(() =>
      vc.getViewOps().tryInsertInsertableSpec(item, locs[0], extraInfo, target),
    );
  }

  async runFakeItem(item: AddFakeItem): Promise<any> {
    const extraInfo = item.asyncExtraInfo
      ? await item.asyncExtraInfo(this)
      : undefined;
    if (extraInfo !== false) {
      await this.change(() => {
        item.factory(this, extraInfo);
        return ok();
      });
    }
    return extraInfo;
  }

  private customFunctionsSchemaValue: DataPickerTypesSchema | undefined;
  private customFunctionsSchemaMemo = memoizeModelQuery((
    site: Site, _installed: ReadonlySet<string>, _registryRevision: string,
  ): DataPickerTypesSchema => {
    const registeredFunctionsMap = new Map(
      this.getRegisteredFunctions().map((f) => [registeredFunctionId(f), f]),
    );
    const getCustomFunctionDeclaration = (
      customFunction: classes.CustomFunction,
    ) => {
      const registeredTypeToTs = (type: any): string => {
        if (Array.isArray(type)) {
          return type.map((t) => registeredTypeToTs(t)).join(" | ");
        }
        switch (type) {
          case "array":
            return "any[]";
          case "object":
            return "{ [key: string]: any }";
          default:
            return type;
        }
      };
      const meta = registeredFunctionsMap.get(
        customFunctionId(customFunction),
      )?.meta;
      let documentation = "";
      if (meta?.description) {
        documentation += meta.description
          .split("\n")
          .map((l) => ` * ${l}\n`)
          .join("");
      }
      if (meta?.params?.some((p) => !!p.description)) {
        meta.params.forEach((p) => {
          if (p.description) {
            documentation += p.description
              .split("\n")
              .map((l, i) => ` * ${i === 0 ? `@param ${p.name} ` : ""}${l}\n`)
              .join("");
          }
        });
      }
      if (meta?.returnValue?.description) {
        documentation += meta.returnValue.description
          .split("\n")
          .map((l, i) => ` * ${i === 0 ? `@returns ` : ""}${l}\n`)
          .join("");
      }
      const prefix = `${documentation ? `/**\n${documentation}*/` : ""}${
        customFunction.importName
      }`;
      const untypedFn = `(...args: any[]): any`;
      if (!meta) {
        return `${prefix}${untypedFn}`;
      }
      if (meta.typescriptDeclaration) {
        return `${prefix}${meta.typescriptDeclaration}`;
      }
      return `${prefix}(${
        meta.params
          ? meta.params
              .map((p) =>
                typeof p === "string"
                  ? `${p}: any`
                  : `${p.isRestParameter ? "..." : ""}${p.name}${
                      p.isOptional ? "?" : ""
                    }: ${registeredTypeToTs(p.type)}`,
              )
              .join(", ")
          : `...args: any[]`
      }): ${
        meta.returnValue?.type
          ? registeredTypeToTs(meta.returnValue?.type)
          : "any"
      }`;
    };
    const getCodeLibraryDeclaration = (lib: classes.CodeLibrary): string => {
      return `${lib.jsIdentifier}: typeof import("${lib.importPath}")${
        lib.importType === "default"
          ? lib.isSyntheticDefaultImport
            ? ""
            : ".default"
          : lib.importType === "namespace"
            ? ""
            : `.${lib.namedImport}`
      }`;
    };
    const next: DataPickerTypesSchema = {
      $$: `{
        ${withoutNils([
          ...[
            ...allCustomFunctions(site)
              .map(({ customFunction }) => customFunction)
              .filter((f) => !f.namespace),
            ...Object.values(
              groupBy(
                allCustomFunctions(site)
                  .map(({ customFunction }) => customFunction)
                  .filter((f) => !!f.namespace),
                (f) => f.namespace,
              ),
            ),
          ].map((functionOrGroup) =>
            !Array.isArray(functionOrGroup)
              ? getCustomFunctionDeclaration(functionOrGroup)
              : `${functionOrGroup[0].namespace}: {
                ${functionOrGroup
                  .map((customFunction) =>
                    getCustomFunctionDeclaration(customFunction),
                  )
                  .join(";\n")}
              }`,
          ),
          ...allCodeLibraries(site).map(({ codeLibrary }) =>
            getCodeLibraryDeclaration(codeLibrary),
          ),
        ]).join(";\n")}}`,
      [extraTsFilesSymbol]: this.getRegisteredLibraries().flatMap(
        (lib) => lib.meta.files.map(file => ({fileName: file.fileName, contents: file.contents})),
      ),
    };
    if (!this.customFunctionsSchemaValue || !isEqual(this.customFunctionsSchemaValue, next)) { this.customFunctionsSchemaValue = next; }
    return this.customFunctionsSchemaValue;
  });
  customFunctionsSchema = () => this.customFunctionsSchemaMemo(
    this.site, this.hostlessPkgsStore.getState().installed, this.getCodeRegistrationRevision(),
  );

  //
  // Renaming component
  //
  maybeWarnComponentRenaming(givenName: string, actualName: string) {
    if (actualName !== givenName) {
      notification.info({
        message: translate(getUiLocale(), "Component renamed"),
        description: translate(
          getUiLocale(),
          "{part1} is reserved or invalid; renamed to {part2} instead.",
          { part1: givenName, part2: actualName },
        ),
      });
    }
  }

  maybeWarnPathChange(givenPath: string, actualPath: string) {
    if (actualPath !== givenPath) {
      notification.info({
        message: translate(getUiLocale(), "Path changed"),
        description: translate(
          getUiLocale(),
          "{part1} is reserved or invalid; renamed to {part2} instead.",
          { part1: givenPath, part2: actualPath },
        ),
      });
    }
  }

  tryChangePath = (page: PageComponent, newPath: string) => {
    if (!newPath.startsWith("/")) {
      newPath = `/${newPath}`;
    }
    if ((page.pageMeta?.path || "") === newPath) {
      return;
    }
    const params = extractParamsFromPagePath(newPath);
    for (let i = 0; i < params.length; i++) {
      if (isCatchallParam(params[i]) && i !== params.length - 1) {
        notification.error({
          message: translate(
            getUiLocale(),
            "Catch-all path slugs must be the last slug in the path",
          ),
        });
        return;
      }
    }
    if (params.some((p) => isCatchallParam(p))) {
      // catch all routes only supported if host is greater than
      // 1.0.186
      const hostVersion = getRootSubHostVersion();
      if (!hostVersion || lt(hostVersion, "1.0.186")) {
        notification.error({
          message: translate(
            getUiLocale(),
            "Catch-all routes are not supported for your host",
          ),
          description: (
            <>
              <UiText
                message="Please upgrade the {part1} packages in your host app"
                values={{ part1: <code>@plasmicapp/*</code> }}
              />
            </>
          ),
        });
        return;
      }
    }
    return this.changeUnsafe(() => {
      this.tplMgr().changePagePath(page, newPath);
      this.maybeWarnPathChange(
        newPath,
        ensure(page.pageMeta, "page should have pageMeta").path,
      );
    });
  };

  tryChangePageMeta = async (
    page: Component,
    key: "title" | "canonical",
    value: string | classes.TemplatedString | null,
  ) => {
    return this.changeUnsafe(() => {
      if (!page.pageMeta) {
        return;
      }
      page.pageMeta[key] = value;
    });
  };

  tryChangePageMetaDescription = async (
    page: Component,
    value: string | classes.TemplatedString,
  ) => {
    return this.changeUnsafe(() => {
      if (!page.pageMeta) {
        return;
      }
      page.pageMeta.description = value;
    });
  };

  tryChangePageMetaImage = async (
    page: Component,
    value: string | classes.ImageAssetRef | classes.TemplatedString | null,
  ) => {
    return this.changeUnsafe(() => {
      if (!page.pageMeta) {
        return;
      }
      page.pageMeta.openGraphImage = value;
    });
  };

  // When adding a data query from a shortcut (such as from the DataPicker)
  // we set it here so the component query section can auto-open it.
  readonly newlyAddedQueryStore = createStore<ModelRef<classes.ComponentDataQuery> | undefined>(
    () => undefined,
  );

  get newlyAddedQuery() {
    const ref = this.newlyAddedQueryStore.getState();
    return ref ? this.modelSnapshots.resolve(ref) : undefined;
  }

   setNewlyAddedQuery(query: classes.ComponentDataQuery | undefined) {
    this.newlyAddedQueryStore.setState(
      query ? this.modelSnapshots.ref(query) : undefined,
      true,
    );
  }

  // When adding an event handler we set it here so the interaction section modal can auto-open it.
  readonly newlyAddedEventHandlerKeyStore = createStore<
    Readonly<{ attr: string }> |
    Readonly<{ param: ModelRef<classes.Param> }> |
    Readonly<{ funcType: ModelRef<classes.FunctionType> }> |
    undefined
  >(() => undefined);

  get newlyAddedEventHandlerKey(): EventHandlerKeyType | undefined {
    const request = this.newlyAddedEventHandlerKeyStore.getState();
    if (!request || "attr" in request) { return request; }
    if ("param" in request) { return { param: this.modelSnapshots.resolve(request.param) }; }
    return { funcType: this.modelSnapshots.resolve(request.funcType) };
  }

   setNewlyAddedEventHandlerKey(value: EventHandlerKeyType | undefined) {
    if (!value) {
      this.newlyAddedEventHandlerKeyStore.setState(undefined, true);
    } else if ("attr" in value) {
      const { attr } = value;
      this.newlyAddedEventHandlerKeyStore.setState((previous) =>
        previous && "attr" in previous && previous.attr === attr ? previous : Object.freeze({ attr }), true);
    } else if ("param" in value) {
      const param = this.modelSnapshots.ref(value.param);
      this.newlyAddedEventHandlerKeyStore.setState((previous) =>
        previous && "param" in previous && previous.param === param ? previous : Object.freeze({ param }), true);
    } else {
      const funcType = this.modelSnapshots.ref(value.funcType);
      this.newlyAddedEventHandlerKeyStore.setState((previous) =>
        previous && "funcType" in previous && previous.funcType === funcType ? previous : Object.freeze({ funcType }), true);
    }
  }

  //
  // Managing state of saving the project to the database
  //

  /** Throttled function that performs a save. */
  private asyncSaver: AsyncCallable;
  /**
   * Timer ID that regularly checks if we are dirty, and if so, performs a save.
   * Undefined if the StudioCtx was created with `autoSave: false`.
   */
  private asyncSaverTimer: number | undefined;
  /**
   * Change counter, incremented on each meaningful change (change that requires
   * a save).  This is how we can detect if we are dirty and need to save
   */
  readonly saveState = new StudioSaveState();
  get _changeCounter() { return this.saveState.counter; }
  set _changeCounter(value: number) { this.saveState.counter = value; }
  /** This is the _changeCounter that was successfully saved. */
  get _savedChangeCounter() { return this.saveState.savedChangeCounter; }
  set _savedChangeCounter(value: number) { this.saveState.savedChangeCounter = value; }
  /** Changes to be saved. */
  private _changeRecords: RecordedChanges[] = [];
  /** The iids in the last successfully saved revision */
  private _savedIids = new Set<string>();
  /** Indicates whether the next save must be a full save */
  private needsFullSave = false;
  /** Count the number of times saves have failed since last successful save */
  _saveFailedCounter = 0;
  /** Waiting for a save (which may already be in flight). */
  needsSaving() {
    return this.hasUnsavedChanges() && this.canSave();
  }
  /**
   * This is a project that can be edited by current user and is in a valid
   * state to be saved
   */
  canSave() {
    return this.saveState.canSave;
  }

  /** Whether the project is dirty and should be saved */
  hasUnsavedChanges() {
    return this.saveState.hasUnsavedChanges;
  }

  /** Set to false while viewing old versions. */
  get editMode() {
    return this.saveState.editMode;
  }
  set editMode(editMode: boolean) {
    if (this.saveState.editMode === editMode) { return; }
    this.saveState.deferPublication(() => this.uiEnvironment.deferPublication(() => {
      this.saveState.editMode = editMode;
      this.syncSaveAccess();
      this.uiEnvironment.sync();
      this.versionHistory.syncContext();
    }));
  }

  private savePermissionInputs: readonly unknown[] | undefined;
  syncSaveAccess() {
    const projectEditable = this.canEditProject();
    const branchEditable = this.canEditBranch();
    const inputs = [this.editMode, this.editMode ? this.appCtx.selfInfo : undefined,
      this.editMode ? this.siteInfo : undefined,
      projectEditable ? this.branchInfo() : undefined, projectEditable, projectEditable ? branchEditable : undefined];
    const previous = this.savePermissionInputs;
    const changed = !previous || inputs.some((value, index) => value !== previous[index]);
    this.savePermissionInputs = inputs;
    this.saveState.syncAccess(projectEditable, branchEditable, changed);
  }

  private observeSaveInputs() {
    this.saveState.bindTipEffects(() => {
      if (this.alertBannerState.get() !== AlertSpec.Watch) { createDarkMask(this); }
      spawn(this.stopListeningForSocketEvents());
    });
    return this.dbCtx().subscribeVersionInputs(() => this.uiEnvironment.sync());
  }

  /** A synchronous completed segment: never retain a publication fence over I/O. */
  private runNativeSaveCommand<Result>(command: () => Result): Result {
    return this.saveState.deferPublication(() => this.modelSnapshots.deferPublication(() =>
      this.undoLog.deferPublication(() => this.dbCtx().deferVersionInputs(command))));
  }

  canEditProject() {
    return (
      this.editMode && canUserEditProject(this.appCtx.selfInfo, this.siteInfo)
    );
  }

  canEditBranch() {
    return !!(
      this.dbCtx().branchInfo?.id || !this.siteInfo.isMainBranchProtected
    );
  }

  /**
   * Undefined if there are no unacknowledged saves, or the revision number of
   * the most recent unacknowledged save.
   *
   * An "acknowledgement" is a socket.io update notification.  We expect
   * our saves to be eventually echoed back.
   *
   * Note there may be multiple unacknowledged saves at a time.
   */
  private pendingSavedRevisionNum?: number;
  /**
   * Whether we are viewing the latest revision and thus able to save.
   */
  get isAtTip() { return this.saveState.isAtTip; }
  set isAtTip(value: boolean) { this.saveState.isAtTip = value; }

  /**
   * Indicates whether we already have seen an error and the app is in an "error
   * state." This is useful so we don't keep spamming error messages at the user
   * every time we retry saving. We can recover from this state once saves
   * succeed again.
   */
  private get saveErrorState() { return this.saveState.saveErrorState; }
  private set saveErrorState(value: "normal" | "error") { this.saveState.saveErrorState = value; }
  private get isSaving() { return this.saveState.isSaving; }
  private set isSaving(value: boolean) { this.saveState.isSaving = value; }
  private readonly desktopDraftOwner = createStore<
    DesktopDraftController | undefined
  >(() => undefined);
  readonly desktopDraftStore = {
    getState: this.desktopDraftOwner.getState,
    getInitialState: this.desktopDraftOwner.getInitialState,
    subscribe: this.desktopDraftOwner.subscribe,
  };
  get desktopDraft() {
    return this.desktopDraftStore.getState();
  }
  set desktopDraft(controller: DesktopDraftController | undefined) {
    this.desktopDraftOwner.setState(controller, true);
  }
  private desktopSaveConflict = false;

  async restoreRemoteVersion() {
    if (!this.desktopSaveConflict) {
      return;
    }
    await this.loadVersion(undefined, true, this.branchInfo());
    this.saveState.deferPublication(() => (() => {
      this.desktopSaveConflict = false;
      this.setBlockChanges(false);
      this.isAtTip = true;
      this.alertBannerState.set(null);
    })());
    clearDarkMask();
  }

  async initializeDesktopDrafts() {
    this.desktopDraft?.dispose();
    this.desktopDraft = undefined;
    if (
      !this.appCtx.selfInfo?.id ||
      !this.canSave() ||
      !this.appCtx.topFrameApi
    ) {
      return;
    }
    const location = parseProjectLocation(this.appCtx.history.location);
    if (
      location?.isPreview ||
      location?.branchRevision ||
      (location?.branchVersion && location.branchVersion !== latestTag)
    ) {
      return;
    }
    // Imported library versions are immutable, and upgrades replace the
    // ProjectDependency object. Reuse each dependency's bundle so a backup only
    // re-serializes the edited project instead of every library each time.
    const dependencyBundles = new WeakMap<
      ProjectDependency,
      { bundler: FastBundler; id: string; version: string; model: Bundle }
    >();
    const drafts = new DesktopDraftController(
      this.appCtx.topFrameApi,
      () => {
        const bundler = this.bundler();
        const version = this.appCtx.lastBundleVersion;
        const dependencies = walkDependencyTree(this.site, "all").map((dep) => {
          const id = ensure(
            bundler.addrOf(dep),
            "Missing dependency bundle",
          ).uuid;
          const cached = dependencyBundles.get(dep);
          if (
            cached?.bundler === bundler &&
            cached.id === id &&
            cached.version === version
          ) {
            return { id, model: cached.model };
          }
          const model = bundler.bundle(dep, id, version);
          dependencyBundles.set(dep, { bundler, id, version, model });
          return { id, model };
        });
        // Library bundles must be unbundled after their own dependencies.
        const ordered: typeof dependencies = [];
        const visited = new Set<string>();
        const visit = (dep: (typeof dependencies)[number]) => {
          if (visited.has(dep.id)) {
            return;
          }
          visited.add(dep.id);
          for (const id of dep.model.deps) {
            visit(
              ensure(
                dependencies.find((item) => item.id === id),
                "Missing draft dependency",
              ),
            );
          }
          ordered.push(dep);
        };
        dependencies.forEach(visit);
        return {
          projectId: this.siteInfo.id,
          projectName: this.siteInfo.name,
          branchId: this.branchInfo()?.id ?? null,
          baseRevision: this.dbCtx().revisionNum,
          sequence: this._changeCounter,
          modelVersion: this.dbCtx().modelVersion,
          hostlessDataVersion: this.dbCtx().hostlessDataVersion,
          bundle: bundler.bundle(this.site, this.siteInfo.id, version),
          dependencies: ordered,
        };
      },
      () => this.hasUnsavedChanges(),
      () => this._changeCounter,
      () => this.dbCtx().revisionNum,
      async (draft) => {
        await this.loadVersion(undefined, true, this.branchInfo(), draft);
        await this.handleRouteChange(this.appCtx.history.location);
        notification.info({
          message: translate(getUiLocale(), "Recovered local edits"),
          description: translate(
            getUiLocale(),
            "Your local draft has been restored and will sync when the server is available.",
          ),
        });
      },
    );
    this.desktopDraft = drafts;
    await drafts.initialize(
      this.appCtx.selfInfo.id,
      this.siteInfo.id,
      this.branchInfo()?.id ?? null,
    );
  }

  get saveStatus() { return this.saveState.saveStatus; }

  get blockChanges() { return this.saveState.blockChanges; }
  setBlockChanges(value: boolean) { this.saveState.blockChanges = value; }

  aiSaveReceipt?: {
    operationId: string;
    sessionId: string;
    fence: number;
    result?: import("@/wab/shared/copilot/local-edit").LocalEditToolResult;
  };
  async save(opts?: { noErrorNotification?: boolean }) {
    let failure: unknown;
    const result = await this.asyncSaver(true, {
      ...opts,
      onError: opts?.noErrorNotification
        ? (error: unknown) => {
            failure = error;
          }
        : undefined,
    });
    if (failure) {
      throw failure;
    }
    return result;
  }

  private async trySave(
    preferIncremental = true,
    opts?: {
      noErrorNotification?: boolean;
      onError?: (error: unknown) => void;
    },
  ): Promise<SaveResult> {
    const showSaveError = (
      error: unknown,
      options?: Parameters<typeof showError>[1],
    ) => {
      if (!opts?.noErrorNotification) {
        showError(error, options);
      }
    };
    if (this.desktopSaveConflict) {
      return SaveResult.SkipIsChanging;
    }
    if (this.desktopDraft?.store.getState().initializing) {
      return SaveResult.SkipUpToDate;
    }
    if (this.hasUnsavedChanges()) {
      await this.desktopDraft?.flush();
    }
    if (this.aiSaveReceipt && !this.aiSaveReceipt.result) {
      return SaveResult.SkipUpToDate;
    }
    const branchId = this.dbCtx().branchInfo?.id;
    if (!branchId && this.siteInfo.isMainBranchProtected) {
      return SaveResult.TriedEditProtectedMain;
    }

    if (!this.hasUnsavedChanges() && !this.needsFullSave) {
      return SaveResult.SkipUpToDate;
    }

    const incremental = preferIncremental && !this.needsFullSave;

    // Disable saves if we are in read-only mode
    if (!this.editMode) {
      return SaveResult.StopSaving;
    }

    if (!this.isAtTip) {
      if (this.alertBannerState.get() !== AlertSpec.Watch) {
        this.alertBannerState.set(AlertSpec.ConcurrentEdit);
      }
      return SaveResult.StopSaving;
    }

    // Seen unknown errors for MAX_SAVE_RETRIES times
    // Stop trying to save and prompt user to reload.
    if (this._saveFailedCounter >= MAX_SAVE_RETRIES) {
      showReloadError();
      return SaveResult.StopSaving;
    }

    (() => {
      this.isSaving = true;
    })();
    try {
      const changeCounterBeingSaved = this._changeCounter;
      const draftToken = this.desktopDraft?.saveToken();

      const changes: RecordedChanges = mergeRecordedChanges(
        ...this._changeRecords,
        this._queuedUnloggedChanges,
      );
      assert(
        this._changeRecords.length ===
          changeCounterBeingSaved - this._savedChangeCounter,
        "changeRecords should have exactly the amount os changes since it was saved last",
      );
      const { changesBundle, toDeleteIids, allIids, modifiedComponentIids } =
        this.bundleChanges(changes.changes, incremental);

      if (!DEVFLAGS.skipInvariants) {
        try {
          this.checkSiteInvariants({
            incremental,
            changesBundle,
            changes,
          });
        } catch (e) {
          reportError(e);
          this.saveState.deferPublication(() => {
            this.alertBannerState.set(AlertSpec.InvariantError);
            this.setBlockChanges(true);
            this.isAtTip = false;
          });
          return SaveResult.StopSaving;
        }
      }

      this.pendingSavedRevisionNum = 1 + this.dbCtx().revisionNum;

      try {
        await withTimeout(
          this.appCtx.api.saveProjectRevChanges(this.siteInfo.id, {
            revisionNum: this.dbCtx().revisionNum + 1,
            aiReceipt: this.aiSaveReceipt,
            data: JSON.stringify(changesBundle),
            modelVersion: this.dbCtx().modelVersion,
            hostlessDataVersion: this.dbCtx().hostlessDataVersion,
            incremental: incremental,
            toDeleteIids,
            branchId: this.dbCtx().branchInfo?.id,
            modifiedComponentIids,
          }),
          "Saving project revision timed out",
          // Two-minute timeout
          120 * 1000,
        );
        this.runNativeSaveCommand(() => {
        this.dbCtx().revisionNum++;
        // We can clear the change records as they have already been saved
        this._changeRecords.splice(
          0,
          changeCounterBeingSaved - this._savedChangeCounter,
        );
        this._savedIids.clear();
        allIids.forEach((iid) => this._savedIids.add(iid));
        this.needsFullSave = false;
        this._savedChangeCounter = changeCounterBeingSaved;
        if (draftToken) {
          void this.desktopDraft?.acknowledged(draftToken);
        }
        if (this.saveErrorState === "error") {
          showSaveErrorRecoveredNotice();
        }
        (() => {
          this.saveErrorState = "normal";
        })();
        this._saveFailedCounter = 0;
        });
        return SaveResult.Success;
      } catch (e) {
        // Successful recovery should not return a failure to the caller.
        if (
          (e.name !== "ProjectRevisionError" ||
            this.desktopDraft?.store.getState().enabled) &&
          !(incremental && e.name === "UnknownReferencesError")
        ) {
          opts?.onError?.(e);
        }
        if (e.name === "ProjectRevisionError") {
          if (this.desktopDraft?.store.getState().enabled) {
            // A lost save response may already have committed these edits.
            // Keep the current model and draft instead of replaying them twice.
            await this.desktopDraft.markConflict();
            this.saveState.deferPublication(() => (() => {
              this.desktopSaveConflict = true;
              this.setBlockChanges(true);
              this.isAtTip = false;
              this.alertBannerState.set(AlertSpec.ConcurrentEdit);
            })());
            return SaveResult.SkipIsChanging;
          }
          return await withTimeout(
            this.fetchUpdates(),
            "Sync with latest updates timed out",
          ).then(async () => {
            await this.refreshRevisions();
            return this.trySave(preferIncremental, opts);
          });
        } else if (e.name === "ForbiddenError") {
          showSaveError(e);
          this.saveState.deferPublication(() => {
            this.alertBannerState.set(AlertSpec.PermError);
            this.isAtTip = false;
          });
          return SaveResult.StopSaving;
        } else if (e.name === "AuthError") {
          showSaveError(e);
          this.saveState.deferPublication(() => {
            this.alertBannerState.set(AlertSpec.AuthError);
            this.isAtTip = false;
          });
          return SaveResult.StopSaving;
        } else if (e.name === "SchemaMismatchError") {
          showSaveError(e);
          this.saveState.deferPublication(() => {
            this.alertBannerState.set(AlertSpec.OutOfDate);
            this.isAtTip = false;
          });
          return SaveResult.StopSaving;
        } else if (
          e.message.includes("Bad Gateway") ||
          e.message.includes("Gateway Timeout")
        ) {
          reportError(e, "Gateway save error");
          if (this.saveErrorState === "normal") {
            showSaveError(e, {
              title: translate(getUiLocale(), "Unexpected error when saving"),
            });
          }
          (() => {
            this.saveErrorState = "error";
          })();
          return SaveResult.GatewayError;
        } else if (incremental && e.name === "UnknownReferencesError") {
          reportError(e, "Unknown references found in project bundle");

          // Try to save again with incremental save disabled
          return await this.trySave(false, opts);
        } else if (e.name === "PromiseTimeoutError") {
          reportError(e, "PromiseTimeoutError");
          // We don't know at this point whether the save succeeded or not.
          // If it did succeed, we cannot re-apply the local changes as it
          // might result in a broken state - e.g., if it was a `array-splice`
          // adding a `TplNode`, re-applying this change after it's been saved
          // and synced from the server would result in a duplicated element.
          //
          // Even if no save has been committed yet, the request could be
          // fulfilled afterwards, so we will just discard the local changes.
          showSaveError(e, {
            title: translate(getUiLocale(), "Failed to sync project"),
          });
          await this.loadVersion(undefined, true, this.branchInfo());
          return SaveResult.TimedOut;
        } else {
          reportError(e, "Unknown save error");
          if (this.saveErrorState === "normal") {
            showSaveError(e, {
              title: translate(getUiLocale(), "Unexpected error when saving"),
            });
          }
          (() => {
            this.saveErrorState = "error";
          })();
          this._saveFailedCounter += 1;
          return SaveResult.UnknownError;
        }
      }
    } catch (e) {
      opts?.onError?.(e);
      reportError(e, "Unexpected error when saving");
      if (this.saveErrorState === "normal") {
        showSaveError(e, {
          title: translate(getUiLocale(), "Unexpected error when saving"),
        });
      }
      (() => {
        this.saveErrorState = "error";
      })();
      this._saveFailedCounter += 1;
      return SaveResult.UnknownError;
    } finally {
      (() => {
        this.isSaving = false;
      })();
    }
  }

  private checkSiteInvariants(opts: {
    incremental: boolean;
    changesBundle: DeepReadonly<Bundle>;
    changes: RecordedChanges;
  }) {
    const { incremental, changesBundle, changes } = opts;
    if (incremental) {
      const cachedBundle = this.bundler().cachedBundle();
      if (!cachedBundle) {
        // Shouldn't happen
        console.warn("No cached bundle found");
      } else {
        try {
          checkBundleFields(cachedBundle, Object.keys(changesBundle.map));
          checkRefsInBundle(cachedBundle);
        } catch (e) {
          logChangedNodes(
            "Bundle type error! Changed nodes:\n",
            changes.changes,
          );
          throw e;
        }
      }
    } else {
      console.log("Non-incremental save");
    }

    assertSiteInvariants(this.site);

    // We also assert that our site bundle doesn't contain any external
    // bundle reference that we don't expect. Currently we should only see
    // references any imported project's PkgVersion IDs.  If we see extraneous
    // ids, it's likely because of an unclean package upgrade.
    const expectedDepIds = [
      ...walkDependencyTree(this.site, "all").map((p) => (p as any).__bundleId),
    ];
    if (changesBundle.deps.some((depId) => !expectedDepIds.includes(depId))) {
      throw new InvariantError(`Unexpected Bundle dependencies`, {
        siteBundle: changesBundle,
        expectedDepIds,
      });
    }
  }

  private checkIfMatchesSlowBundle(
    bundle: DeepReadonly<Bundle>,
    changes: ModelChange[],
  ) {
    const reportFastBundleError = (e: Error) => {
      logChangedNodes("Fast Bundle Error! Changed Nodes:\n", changes);
      reportError(e);
    };

    const slowBundle = this.bundler().bundle(
      this.site,
      this.siteInfo.id,
      this.appCtx.lastBundleVersion,
    );
    try {
      const printVal = (val: any) => JSON.stringify(val, undefined, 2);
      const missingIids = [...Object.keys(slowBundle.map)].filter(
        (iid) => !(iid in bundle.map),
      );
      if (missingIids.length > 0) {
        console.log(
          missingIids
            .map(
              (iid) =>
                `Missing IID ${iid}, value: ${printVal(slowBundle.map[iid])}`,
            )
            .join("\n"),
        );
      }
      assert(missingIids.length === 0, `Fast Bundle is missing instances`);
      const mismatchingIids = Object.keys(bundle.map).filter(
        (iid) => !isEqual(bundle.map[iid], slowBundle.map[iid]),
      );
      if (mismatchingIids.length > 0) {
        console.log(
          mismatchingIids
            .map(
              (iid) =>
                `Mismatching IID ${iid}. Received: ${printVal(
                  bundle.map[iid],
                )}\nExpected: ${printVal(slowBundle.map[iid])}`,
            )
            .join("\n"),
        );
      }
      assert(
        mismatchingIids.length === 0,
        `Fast Bundle has mismatching instances`,
      );
      assert(
        arrayEqIgnoreOrder(bundle.deps, slowBundle.deps),
        `Different deps array. Received: ${printVal(
          bundle.deps,
        )}\nExpected: ${printVal(slowBundle.deps)}`,
      );
      assert(
        bundle.root === slowBundle.root,
        `Different root! Received: ${bundle.root},` +
          ` Expected: ${slowBundle.root}`,
      );
    } catch (e) {
      reportFastBundleError(
        new Error("FastBundle error - didn't match slow bundle!\n" + e.message),
      );
    }
  }

  bundleSite() {
    return {
      site: this.bundler().bundle(
        this.site,
        this.siteInfo.id,
        this.appCtx.lastBundleVersion,
      ),
    };
  }

  /**
   * Filters only the relevant parts of the project bundle based on the
   * unsaved changes.
   **/
  bundleChanges(
    allChanges: ModelChange[],
    incremental?: boolean,
  ): {
    changesBundle: DeepReadonly<Bundle>;
    toDeleteIids: string[];
    allIids: string[];
    modifiedComponentIids: string[];
  } {
    const persistentChanges = filterPersistentChanges(allChanges);

    const bundle = (() => {
      if (!incremental) {
        return this.bundler().bundle(
          this.site,
          this.siteInfo.id,
          this.appCtx.lastBundleVersion,
        );
      }

      const _bundle: DeepReadonly<Bundle> = this.bundler().fastBundle(
        this.site,
        this.siteInfo.id,
        persistentChanges.map((change) => change.changeNode),
      );

      if (!DEVFLAGS.skipInvariants && Math.random() < 0.1) {
        // Random check to silently see if results match
        this.checkIfMatchesSlowBundle(_bundle, persistentChanges);
      }

      return _bundle;
    })();

    const allIids = [...Object.keys(bundle.map)];

    if (!incremental) {
      return {
        changesBundle: bundle,
        toDeleteIids: [],
        allIids,
        modifiedComponentIids: [],
      };
    }

    const map: { [id: number]: BundledInst } = {};

    // Inserted Iids
    allIids.forEach((iid) => {
      if (!this._savedIids.has(iid)) {
        map[iid] = bundle.map[iid];
      }
    });

    const modifiedComponentIids = new Set<string>();
    // Updated Iids and modified components
    persistentChanges.forEach((change) => {
      const { inst, field } = change.changeNode;
      const addr = this.bundler().addrOf(inst);
      if (addr) {
        assert(
          addr.uuid === this.siteInfo.id,
          "addr uuid should be the same as site info id",
        );
        if (bundle.map[addr.iid]) {
          if (!map[addr.iid]) {
            map[addr.iid] = { __type: bundle.map[addr.iid].__type };
          }
          map[addr.iid][field] = bundle.map[addr.iid][field];
        }
      }
      change.path?.forEach((path) => {
        if (classes.isKnownComponent(path.inst) && path.field === "tplTree") {
          const compAddr = this.bundler().addrOf(path.inst);
          if (compAddr) {
            modifiedComponentIids.add(compAddr.iid);
          }
        }
      });
    });

    // Deleted Iids
    const toDeleteIids = [...this._savedIids.keys()].filter(
      (iid) => !(iid in bundle.map),
    );

    return {
      changesBundle: { ...bundle, map },
      toDeleteIids,
      allIids,
      modifiedComponentIids: Array.from(modifiedComponentIids),
    };
  }

  branchInfo() {
    return this._dbCtx.branchInfo;
  }

  /** Stores any persistent error message to show user, like being in read-only mode */
  readonly alertBannerState = {
    get: (): AlertData | null => this.saveState.getAlert(),
    set: (value: AlertData | null) => this.saveState.setAlert(value),
  };

  //
  // Manage project dependencies and past revisions
  //
  projectDependencyManager: ProjectDependencyManager;
  get releases() { return this.versionHistory.releases; }
  get revisions() { return this.versionHistory.revisions; }

  refreshRevisions(revisionNumGt?: number) {
    return this.versionHistory.refreshRevisions(revisionNumGt);
  }

  /** Reverts the current branch to the given version or revision and switches to the latest. */
  async revertTo(versionOrRevision: PkgVersionInfoMeta | MinimalRevisionInfo) {
    this.setWatchPlayerId(null);

    const branch = this.branchInfo();
    const prevArenaName = this.currentArena
      ? getArenaName(this.currentArena)
      : undefined;
    assert(
      (versionOrRevision.branchId ?? null) === (branch?.id ?? null),
      () => `Can only revert to a version of the same branch`,
    );

    if (isPkgVersionInfoMeta(versionOrRevision)) {
      await this.appCtx.api.revertToVersion(this.siteInfo.id, {
        branchId: branch?.id,
        pkgId: versionOrRevision.pkgId,
        version: versionOrRevision.version,
      });
    } else {
      await this.appCtx.api.revertProjectToRevision(
        this.siteInfo.id,
        versionOrRevision.id,
        branch?.id,
      );
    }

    // Check if we're already viewing latest
    const currentVersionInfo = this.dbCtx().projectVersionInfo;
    if (!currentVersionInfo) {
      // Already viewing latest. Reload and switch arena.
      await this.loadVersion(undefined, true, branch);
      const prevArena = prevArenaName
        ? getArenaByNameOrUuidOrPath(this.site, prevArenaName, undefined)
        : undefined;
      await this.change(
        () => {
          this.switchToArena(prevArena);
          return ok();
        },
        {
          noUndoRecord: true,
        },
      );
    } else {
      // Switch to latest version of branch.
      this.switchToBranchVersion(undefined);
    }
  }

  /**
   * Download, unbundle, and load the Site into the Studio
   *
   * Note just calling this function will not cause the arena to be loaded in the canvas.
   * The arena's view state must be set to `isAlive` via `switchToArena`/`changeArena`.
   *
   * @param versionOrRevision - version/revision to load, or undefined for latest
   * @param editMode - if falsey, stops saves and shows AlertBanner. If truthy,
   *   will autosave as normal
   * @param branch - branch to load
   **/
  private async loadVersion(
    versionOrRevision?: PkgVersionInfoMeta | ProjectRevision,
    editMode?: boolean,
    branch?: ApiBranch,
    draft?: DesktopDraft,
    preserveCheckpoint = false,
  ) {
    if (!draft) {
      await this.desktopDraft?.protect(preserveCheckpoint);
    }
    const hideLoadingMsg = message.loading("Loading...", 0);
    const branchChanged = branch?.id !== this.branchInfo()?.id;
    const previousEditMode = this.editMode;

    try {
      this._isRestoring = true;
      this.saveState.deferPublication(() => (() => {
        // Disable saves while we load
        this.editMode = false;
        this.alertBannerState.set(editMode ? null : AlertSpec.ViewOld);
        this.setHighLevelFocusOnly(undefined, []); // Hide the focused box
      })());
      const {
        rev: _currRev,
        bundle,
        depPkgs,
        revisionNum,
      } = await (async () => {
        if (draft) {
          return {
            bundle: draft.bundle,
            depPkgs: draft.dependencies,
            revisionNum: this.dbCtx().revisionNum,
          };
        }
        if (versionOrRevision && isPkgVersionInfoMeta(versionOrRevision)) {
          const { pkg, depPkgs: _depPkgs } =
            await this.appCtx.api.getPkgVersion(
              versionOrRevision.pkgId,
              versionOrRevision.version,
              branch?.id,
            );
          return {
            bundle: pkg.model,
            depPkgs: _depPkgs,
            revisionNum: undefined,
          };
        } else if (versionOrRevision && isProjectRevision(versionOrRevision)) {
          const { rev, depPkgs: _depPkgs } =
            await this.appCtx.api.getProjectRevision(
              this.siteInfo.id,
              versionOrRevision.id,
            );
          return {
            rev,
            bundle: getBundle(
              rev,
              parseBundle(rev).version ?? this.appCtx.lastBundleVersion,
            ),
            depPkgs: _depPkgs,
            revisionNum: rev.revision,
          };
        } else {
          const { rev, depPkgs: _depPkgs } = await this.appCtx.api.getSiteInfo(
            this.siteInfo.id,
            {
              branchId: branch?.id,
            },
          );
          return {
            bundle: getBundle(rev, this.appCtx.lastBundleVersion),
            depPkgs: _depPkgs,
            revisionNum: rev.revision,
          };
        }
      })();
      if (!draft) {
        await this.desktopDraft?.reconcileRemote(bundle);
      }
      this.runNativeSaveCommand(() => (() => {
        const newBundler = new FastBundler();
        const { site, depPkgs: depPkgVersions } = unbundleSite(
          newBundler,
          this.siteInfo.id,
          bundle,
          depPkgs,
        );
        this.exitNativeModelOwner();
        this.pruneInvalidViewCtxs();
        this.modelSnapshots.dispose();
        this.modelSnapshots = new ModelSnapshots();
        this.singleRsStyleInputs = new SingleRsStyleInputs(() => this.modelSnapshots);
        this.viewCtxs.forEach((view) => view.resetStyleInputs());
        this.appCtx.bundler = newBundler;
        this.runNativeArenaCommand(() => {
        this.dbCtx().setSite(site, branch, versionOrRevision);
        this.runNativeArenaCommand(() => {
          this.arenaState.attachSite();
          this.uiEnvironment.sync();
        });
        this.fontManager.syncSite(site);
        this.commentsCtx.onSiteReplaced();
        spawn(
          checkDepPkgHosts(
            this.appCtx,
            this.siteInfo,
            depPkgVersions.filter((dep): dep is ProjectDependency =>
              isKnownProjectDependency(dep),
            ),
          ),
        );
        this.modelRevisions.replaceModels();
        this.projectDependencyManager.syncDirectDeps();
        this.pruneInvalidViewCtxs();
        this.pruneDetachedTpls();
        this.styleMgr.resetStyles({ resetDeps: true });
        this.recorder.prune();
        for (const vc of this.viewCtxs) {
          vc.scheduleSync({ eval: true, styles: true });
        }

        // Clear undo log
        this.clearUndoLog(() => {

        if (!versionOrRevision && !draft && editMode) {
          this.saveErrorState = "normal";
          this._saveFailedCounter = 0;
          this.needsFullSave = false;
        }

        // Only re-enable saves after we're done loading
        if (editMode) {
          if (versionOrRevision || draft) {
            // Mark for saving
            this._changeCounter += 1;
            this._changeRecords.push(emptyRecordedChanges());

            // We might have loaded a completely different bundle, so we should
            // save all bundle instances as instances with the same iid might have
            // different types
            this.needsFullSave = true;
          }

          this._savedIids.clear();
          newBundler
            .allIidsByUuid(this.siteInfo.id)
            .forEach((iid) => this._savedIids.add(iid));

          if (revisionNum) {
            this.dbCtx().revisionNum = revisionNum;
          }
          this.editMode = true;
        }
        });
        this.versionHistory.syncContext();
        this.runNativeArenaCommand(() => {
          for (const listener of this.modelCommitListeners) {listener({ type: "site-replaced", site });}
        });
        });
      })());
      if (branchChanged) {
        await this.refreshRevisions();
        await this.versionHistory.refreshReleases();
        await this.initializeDesktopDrafts();
      }
    } catch (error) {
      if (draft) {
        (() => {
          this.editMode = previousEditMode;
        })();
      }
      throw error;
    } finally {
      this._isRestoring = false;
      hideLoadingMsg();
    }

    if (editMode) {
      if (this.hasUnsavedChanges()) {
        this.desktopDraft?.changed();
      }
      // No matter which revision we loaded, either via switching
      // branch or reverting to a previous published version,
      // we need to sync with the currently-registered code components
      // We need to do this in a spawn() instead of await because
      // syncCodeComponentsAndHandleErrors calls into
      // StudioCtx.change(), and if we are coming from, say,
      // fetchUpdatesInternal, which is processed in the same
      // this.modelChangesQueue, we will be deadlocked.
      if (!this.appCtx.appConfig.ccStubs && !isHostLessPackage(this.site)) {
        spawn(syncCodeComponentsAndHandleErrors(this));
      }
    }
  }

  readonly forceOpenPropStore = createStore<Readonly<{
    component: ModelRef<classes.Component>;
    prop: string;
  }> | null>(() => null);
  get forceOpenProp(): readonly [classes.Component, string] | null {
    const request = this.forceOpenPropStore.getState();
    return request ? [this.modelSnapshots.resolve(request.component), request.prop] : null;
  }

  set forceOpenProp(value: readonly [classes.Component, string] | null) {
    if (!value) {
      this.forceOpenPropStore.setState(null, true);
      return;
    }
    const component = this.modelSnapshots.ref(value[0]);
    const prop = value[1];
    this.forceOpenPropStore.setState((previous) =>
      previous?.component === component && previous.prop === prop
        ? previous
        : Object.freeze({ component, prop }),
      true,
    );
  }

  readonly uiActionBus = new UiActionBus<UiId>();

  readonly forceOpenSplitStore = createStore<ModelRef<classes.Split> | null>(
    () => null,
  );
  get forceOpenSpit() {
    const ref = this.forceOpenSplitStore.getState();
    return ref ? this.modelSnapshots.resolve(ref) : null;
  }

  set forceOpenSplit(split: classes.Split | null) {
    this.forceOpenSplitStore.setState(
      split ? this.modelSnapshots.ref(split) : null,
      true,
    );
  }

  private _serverUpdatesSummary: DeletedAssetsSummary;

  private clearUndoLog(complete?: () => void) {
    console.log("UNDO: Clear");
    this._savedChangeCounter = this._changeCounter;
    this._changeRecords = [];
    this._serverUpdatesSummary = getEmptyDeletedAssetsSummary();
    complete?.();
    this.undoLog = new UndoLog(
      this.site,
      this.recorder,
      this._serverUpdatesSummary,
    );
    // handleRouteChange will create the first undo record
  }

  /**
   * For this projectId, fetch all available releases from the server,
   * sorted by [latest => oldest]
   *
   * @param opts - if mainBranchOnly is true, only return releases from the main branch
   **/
  async getProjectReleases(
    opts = { mainBranchOnly: false },
  ): Promise<PkgVersionInfoMeta[]> {
    const projectId = this.siteInfo.id;
    const appCtx = this.appCtx;
    const branchId = opts.mainBranchOnly ? undefined : this.branchInfo()?.id;
    return await getProjectReleases(appCtx, projectId, branchId);
  }

  /**
   * For this projectId, fetch unpublished revisions,
   * sorted by [latest => oldest]
   *
   **/
  async listUnpublishedProjectRevisions(
    revisionNumGt?: number,
  ): Promise<ProjectRevision[]> {
    const projectId = this.siteInfo.id;
    const appCtx = this.appCtx;
    const branchId = this.branchInfo()?.id;
    return await listUnpublishedProjectRevisions(
      appCtx,
      projectId,
      branchId,
      revisionNumGt,
    );
  }

  async hasChangesSinceLastPublish() {
    if (this.releases.length <= 0) {
      return true;
    }

    const latestRelease = ensure(
      this.releases[0],
      "should have at least one release",
    );
    const { rev: latestPublishedRev } =
      await this.appCtx.api.getProjectRevWithoutData(
        this.siteInfo.id,
        ensure(
          latestRelease.revisionId,
          "latest release should have revisionId",
        ),
        latestRelease.branch?.id,
      );

    return latestPublishedRev.revision !== this.dbCtx().revisionNum;
  }

  async getLatestVersion(
    latestPublishedRevId: string | undefined,
    branchId: string | undefined,
  ) {
    return latestPublishedRevId
      ? await this.appCtx.api.getProjectRevWithoutData(
          this.siteInfo.id,
          ensure(latestPublishedRevId, "latestPublishedRevId must exist"),
          branchId,
        )
      : { rev: null };
  }
  /**
   * Given the current revision number, calculate the correct next
   * version number based by comparing this.site with the latest release
   **/
  async calculateNextPublishVersion() {
    const releases = await this.getProjectReleases();

    // Defaulting to 0.0.1 as the initial version
    if (releases.length <= 0) {
      return {
        version: INITIAL_VERSION_NUMBER,
        changeLog: extractSplitStatusDiff(this.site, () => SplitStatus.New),
        releaseType: undefined,
      };
    }

    // Get the latest release
    const latestRelease = ensure(asOne(releases), "latestRelease should exist");
    const { rev: latestPublishedRev } =
      await this.appCtx.api.getProjectRevWithoutData(
        this.siteInfo.id,
        ensure(
          latestRelease.revisionId,
          "latestRelease should have revision id",
        ),
        latestRelease.branchId ?? undefined,
      );
    if (latestPublishedRev.revision === this.dbCtx().revisionNum) {
      return undefined;
    }

    if (
      this.appCtx.appConfig.serverPublishProjectIds.includes(this.siteInfo.id)
    ) {
      return this.appCtx.api.computeNextProjectVersion(this.siteInfo.id, {
        revisionNum: this.dbCtx().revisionNum,
        branchId: this.dbCtx().branchInfo?.id,
      });
    }

    const latestPublishedPkg = await this.appCtx.api.getPkgVersion(
      latestRelease.pkgId,
      undefined,
      latestRelease.branchId ?? undefined,
    );

    const bundler = new FastBundler();
    const prevSite = unbundleProjectDependency(
      bundler,
      latestPublishedPkg.pkg,
      latestPublishedPkg.depPkgs,
    ).projectDependency.site;

    // Compare the 2 sites to calculate a new semantic version
    const changeLog = compareSites(prevSite, this.site);
    const releaseType = calculateSemVer(changeLog);
    const version = semver.inc(latestRelease.version, releaseType);
    if (!version) {
      throw new Error("Invalid version number found: " + latestRelease.version);
    }
    return { version, changeLog, releaseType };
  }

  async branchHasUnpublishedChanges({
    branchId,
  }: {
    branchId: BranchId | null;
  }) {
    const branchReleases = await (async () => {
      const { pkg } = await this.appCtx.api.getPkgByProjectId(this.siteInfo.id);
      if (pkg) {
        const pkgVersionResp = await this.appCtx.api.listPkgVersionsWithoutData(
          pkg.id,
          {
            branchId,
          },
        );
        return [...pkgVersionResp.pkgVersions];
      } else {
        return [];
      }
    })();
    const { rev } = await this.appCtx.api.getProjectRevWithoutData(
      this.siteInfo.id,
      // undefined to get the latest revision
      undefined,
      branchId ?? undefined,
    );
    const latestPublishedVersion = head(branchReleases);
    const { rev: latestPublishedRev } = await this.getLatestVersion(
      latestPublishedVersion?.revisionId,
      latestPublishedVersion?.branchId ?? undefined,
    );
    if (
      rev.revision > 1 &&
      (latestPublishedRev?.revision ?? 1) < rev.revision
    ) {
      return true;
    }
    return false;
  }

  /**
   * Entry point for publishing a new version of the project
   **/
  async publish(
    maybeTags?: string[],
    maybeDescription?: string,
    branchId?: BranchId,
    opts?: { hostLessPackage?: boolean },
  ): Promise<PublishResult> {
    // Use empty list as default tags
    const tags = maybeTags || [];
    // Use date as default description
    const description = maybeDescription || new Date().toUTCString();
    // Try to save if we have unsaved changes
    if (this.needsSaving()) {
      const saveResult = await this.asyncSaver();
      if (
        saveResult !== SaveResult.Success &&
        (saveResult !== SaveResult.SkipUpToDate || this.needsSaving())
      ) {
        const e = new Error("Cannot publishing due to a failed save");
        console.error("Error ", e);
        showError(e, {
          title: translate(getUiLocale(), "Unexpected error when publishing"),
          description: translate(getUiLocale(), "Reload to try again."),
        });
        return PublishResult.SaveFailed;
      }
    }

    // Check if we're out of date
    if (!this.isAtTip) {
      if (this.alertBannerState.get() !== AlertSpec.Watch) {
        this.alertBannerState.set(AlertSpec.ConcurrentEdit);
      }
      return PublishResult.OutOfDate;
    }

    try {
      const projectId = this.siteInfo.id;
      const next = await this.calculateNextPublishVersion();
      if (!next) {
        console.log("Skipping publish, no new changes since last published");
        return PublishResult.SkipAlreadyPublished;
      }
      const resp = await maybeShowPaywall(
        this.appCtx,
        async () =>
          await this.appCtx.api.publishProject(
            projectId,
            this.dbCtx().revisionNum,
            next.version,
            tags,
            description,
            opts?.hostLessPackage,
            branchId,
          ),
        {
          title: translate(getUiLocale(), "Publishing is disabled"),
          description: translate(
            getUiLocale(),
            "This project belongs to a team that does not have enough seats. Increase the number of seats to perform this action.",
          ),
        },
        true,
      );
      await mutate(calculateNextVersionKey(this));
      const newPkg = ensure(resp.pkg, "newPkg should exist");
      this.versionHistory.prependRelease(newPkg);
      return PublishResult.PreFilling;
    } catch (e) {
      // TODO
      if (e instanceof PaywallError) {
        if (e.type === "requireTeam") {
          notification.error({
            message: personalProjectPaywallMessage,
            duration: 0,
          });
        }
        return PublishResult.PaywallError;
      }
      console.error("Error publishing: ", e);
      showError(e, {
        title: translate(getUiLocale(), "Unexpected error when publishing"),
        description: translate(getUiLocale(), "Reload to try again."),
      });
      return PublishResult.UnknownError;
    }
  }

  async updatePkgVersion(
    pkgId: string,
    version: string,
    branchId: BranchId | null,
    toMerge: Partial<PkgVersionInfo>,
  ) {
    await this.versionHistory.updatePkgVersion(pkgId, version, branchId, toMerge);
  }

  //
  // Make sure view state is valid after model changes
  //
  ensureComponentStackFramesHasOnlyValidVariants(component: Component) {
    const allVariants = allComponentVariants(component);
    for (const vc of this.viewCtxs) {
      for (const frame of vc.componentStackFrames()) {
        if (frame.tplComponent.component === component) {
          frame.keepOnlyVariants(allVariants);
        }
      }
    }
  }

  ensureGlobalStackFramesHasOnlyValidVariants() {
    const allVariants = allGlobalVariants(this.site, {
      includeDeps: "direct",
      excludeInactiveScreenVariants: true,
    });
    for (const vc of this.viewCtxs) {
      vc.globalFrame.keepOnlyVariants(allVariants);
    }
  }

  ensureAllComponentStackFramesHasOnlyValidVariants() {
    this.ensureGlobalStackFramesHasOnlyValidVariants();
    for (const component of this.site.components) {
      this.ensureComponentStackFramesHasOnlyValidVariants(component);
    }
  }

  private notificationKeyForGlobalContextNotificationStarters =
    "global-context-notification-starters";

  closeGlobalContextNotificationForStarters() {
    notification.destroy(
      this.notificationKeyForGlobalContextNotificationStarters,
    );
  }

  async maybeShowGlobalContextNotificationForStarters() {
    const starterProject = this.appCtx.appConfig.starterSections
      .flatMap((starterSection) => starterSection.projects)
      .find(
        (starter) =>
          starter.baseProjectId === this.siteInfo.clonedFromProjectId,
      );
    if (
      starterProject?.globalContextConfigs?.every((starterGlobalContext) => {
        const tpl = this.site.globalContexts.find(
          (globalContext) =>
            globalContext.component.name === starterGlobalContext.name,
        );
        if (!tpl) {
          return false;
        }
        const params = getRealParams(tpl.component);
        return [...(starterGlobalContext.props ?? [])].every((prop) => {
          const maybeArg = tpl.vsettings[0].args.find(
            (arg) => arg.param.variable.name === prop.name,
          );
          const maybeParam = params.find(
            (param) => param.variable.name === prop.name,
          );
          let value: JsonValue | undefined = undefined;
          if (maybeArg) {
            value = tryExtractJson(maybeArg.expr);
          } else if (maybeParam?.defaultExpr) {
            value = tryExtractJson(maybeParam.defaultExpr);
          }
          return value === (prop.value ?? undefined);
        });
      })
    ) {
      const goToSettings = async () => {
        await this.change(() => {
          this.hidePresetsModal();
          this.switchLeftTab("settings", { highlight: true });
          return ok();
        });
      };

      notification.warning({
        message: translate(
          getUiLocale(),
          "Configure this project's dynamic data source",
        ),
        duration: 0,
        description: (
          <>
            <p>
              <UiText
                message={
                  "This cloned project includes dynamic data from an example data source! But you will probably want to use your own data source instead."
                }
              />
            </p>
            <p>
              <UiText
                message="{settings} to choose your own data source, or explore other sources by clicking the plus button and selecting component packages."
                values={{
                  settings: (
                    <a onClick={goToSettings}>
                      <UiText message={"Go to settings"} />
                    </a>
                  ),
                }}
              />
            </p>
          </>
        ),
        key: this.notificationKeyForGlobalContextNotificationStarters,
      });
    }
  }

  async enterWatchMode() {
    await this.loadVersion();
    this.alertBannerState.set(AlertSpec.Watch);
    clearDarkMask();
  }

  handleBranchProtectionAlert() {
    if (!this.canEditBranch()) {
      this.alertBannerState.set(AlertSpec.ProtectedMainBranch);
    } else if (this.alertBannerState.get() === AlertSpec.ProtectedMainBranch) {
      this.alertBannerState.set(null);
    }
  }

  async handleBranchMerged() {
    // Ensure that we're up to date with the latest changes in the branch
    await this.fetchUpdates();
  }

  private async fetchUpdatesWatch() {
    const partial = await this.appCtx.api.getModelUpdates(
      this.siteInfo.id,
      this.dbCtx().revisionNum,
      this.bundler().allUuids(),
      this.branchInfo()?.id,
    );
    if (partial.needsReload) {
      await this.loadVersion();
      return;
    }
    this.setBlockChanges(false);
    if (partial.data) {
      const { data, depPkgs } = partial;
      await this.changeUnsafe(() => {
        this.dbCtx().revisionNum = partial.revision;
        depPkgs.forEach((dep) =>
          taggedUnbundle(this.bundler(), dep.model, dep.id),
        );
        this.bundler().unbundlePartial(JSON.parse(data), this.siteInfo.id);
        this.site.components.forEach((c) => {
          trackComponentRoot(c);
          trackComponentSite(c, this.site);
        });
      });
    }
    this.setBlockChanges(true);
  }

  private async fetchUpdates() {
    assert(
      !this._isChanging && !this._isUndoing,
      "should not be changing nor undoing",
    );
    await this.modelChangeQueue.push({ type: "fetchModelUpdates" });
    (this.modelChangeQueue as any).process();
    return drainQueue(this.modelChangeQueue).then(() =>
      this.framesChanged.dispatch(),
    );
  }

  /**
   * Never call this.change() inside this method without wrapping it
   * in a spawn() to avoid deadlocks and/or breaking this.modelChangeQueue.
   */
  private async fetchUpdatesInternal() {
    if (this.desktopSaveConflict) {
      return;
    }
    assert(
      !this._isChanging && !this._isUndoing,
      "should not be changing nor undoing",
    );
    const projectId = this.siteInfo.id;
    if (
      this.hasUnsavedChanges() &&
      this.desktopDraft?.store.getState().enabled &&
      !(await this.desktopDraft.flush())
    ) {
      throw new Error(
        "Cannot back up local edits before syncing remote updates",
      );
    }
    const updatedModel = await this.appCtx.api.getModelUpdates(
      projectId,
      this.dbCtx().revisionNum,
      this.bundler().allUuids(),
      this.branchInfo()?.id,
    );
    if (updatedModel.needsReload) {
      await this.loadVersion(undefined, true, this.branchInfo());
      // This just swapped in a different Site, with different instances of
      // everything. We should ideally go through model instance that StudioCtx
      // has and replace them with the new instance, but at the very least,
      // we make sure this.currentArena is valid, so we will trigger a re-render
      // of the current view
      if (this.currentArena) {
        const newCurrentArena = getArenaByNameOrUuidOrPath(
          this.site,
          getArenaName(this.currentArena),
          getArenaType(this.currentArena),
        );
        if (newCurrentArena) {
          spawn(
            this.change(
              () => {
                this.switchToArena(newCurrentArena);
                return ok();
              },
              {
                noUndoRecord: true,
              },
            ),
          );
        }
      }
      return;
    }
    const hasUnsavedChanges = this.hasUnsavedChanges();
    if (updatedModel.data) {
      const { data, depPkgs, deletedIids, modifiedComponentIids } =
        updatedModel;
      try {
        this._isRefreshing = true;

        this.dbCtx().maybeObserveComponents(
          withoutNils(
            modifiedComponentIids.map((c) => {
              const compInst = this.bundler().objByAddr({
                uuid: projectId,
                iid: c,
              });
              return classes.isKnownComponent(compInst) ? compInst : undefined;
            }),
          ),
        );

        const undoAndRecord = (changes: RecordedChanges) =>
          this.recorder.withRecording(() => undoChanges(changes.changes));

        const { summary, styleChanges, allChanges } = (() => {
          // First, revert all changes to recover the old server version
          const revertedQueuedUnloggedChanges = undoAndRecord(
            this._queuedUnloggedChanges,
          );
          const revertedChanges = arrayReversed(this._changeRecords).map(
            undoAndRecord,
          );
          const previousProjectDeps = this.site.projectDependencies;

          updateSummaryFromDeletedInstances(
            this._serverUpdatesSummary,
            withoutNils(
              deletedIids.map((iid) =>
                this.bundler().objByAddr({ uuid: projectId, iid }),
              ),
            ),
          );

          // Then, apply new changes from the server
          const serverChanges = this.recorder.withRecording(() => {
            depPkgs.forEach((dep) =>
              taggedUnbundle(this.bundler(), dep.model, dep.id),
            );
            const partialBundle: UnsafeBundle = JSON.parse(data);
            this.bundler().unbundlePartial(partialBundle, projectId);

            if (
              xDifference(previousProjectDeps, this.site.projectDependencies)
                .size > 0
            ) {
              // TODO: ProjectDependency deletion can be tricky since it might,
              // for example, replace component instances by local copies of the
              // components (created when the imported project has been deleted),
              // so adjustments in the undo log and to the unsaved changes would
              // require special handling to also use the local copies.

              // For now, we just refresh the project whenever an imported project
              // is deleted.
              throw new UnsupportedServerUpdate(
                "Don't support ProjectDependency deletion",
              );
            }

            this.site.components.forEach((c) => {
              trackComponentRoot(c);
              trackComponentSite(c, this.site);
            });

            Object.keys(partialBundle.map).forEach((iid) =>
              this._savedIids.add(iid),
            );
            deletedIids.forEach((iid) => this._savedIids.delete(iid));
          });

          // Re-apply the local changes on top of the server changes
          this._changeRecords = arrayReversed(revertedChanges).map((changes) =>
            undoChangesAndResolveConflicts(
              this.site,
              this.recorder,
              this._serverUpdatesSummary,
              changes.changes,
            ),
          );
          this._queuedUnloggedChanges = undoChangesAndResolveConflicts(
            this.site,
            this.recorder,
            this._serverUpdatesSummary,
            revertedQueuedUnloggedChanges.changes,
          );

          // Maybe clear focus if the focused element no longer exists
          const vc = this.focusedViewCtx();
          if (vc) {
            let clearFocus = false;
            if (
              getSiteArenas(this.site)
                .flatMap((arena) => getArenaFrames(arena))
                .find((frame) => frame === vc.arenaFrame())
            ) {
              const focusedTpl = vc.focusedTpl();
              if (focusedTpl) {
                if (!isTplAttachedToSite(this.site, focusedTpl)) {
                  clearFocus = true;
                } else {
                  const parents = ancestorsUp(focusedTpl);
                  parents.slice(0, parents.length - 1).forEach((child, i) => {
                    const parent = parents[i + 1];
                    if (!tplChildren(parent).includes(child)) {
                      child.parent = null;
                      clearFocus = true;
                    }
                  });
                }
              }
            } else {
              clearFocus = true;
            }
            if (clearFocus) {
              this.setStudioFocusOnFrameContents(undefined);
              this.focusReset.dispatch();
            }
          }
          const _allChanges = mergeRecordedChanges(
            serverChanges,
            ...this._changeRecords,
            this._queuedUnloggedChanges,
          );

          // Pruning
          this.pruneInvalidViewCtxs();
          this.pruneDetachedTpls();

          const _summary = summarizeChanges(this, _allChanges);
          const _styleChanges = this.syncAfterChanges(_summary);

          return {
            summary: _summary,
            styleChanges: _styleChanges,
            allChanges: _allChanges,
          };
        })();

        // Re-eval all frames that might have been affected
        const focusedVC = this.focusedViewCtx();

        const shouldEvaluate = (vc: ViewCtx) => {
          return this.shouldEvaluateViewCtx(vc, {
            summary,
            previousComponentCtx: vc.currentComponentCtx(),
            previousVcInfo: vc.getSpotlightAndVariantsInfo(),
          });
        };

        const shouldRestyle = (vc: ViewCtx) => {
          // Should update vc style if it's never had styles before,
          // or if there has been style changes
          return !vc.valState().maybeValSysRoot() || !!styleChanges;
        };

        // give precedence to the focused viewCtx so that the postEvalTasks added
        // to the current viewCtx is not cleared when current viewCtx is being
        // evaluated
        this.viewCtxs.forEach((vc) => {
          vc.scheduleSync({
            eval: shouldEvaluate(vc),
            styles: shouldRestyle(vc),
            asap: vc === focusedVC,
          });
        });

        // Check site invariants
        assertSiteInvariants(this.site);

        const persistentChanges = filterPersistentChanges(allChanges.changes);

        // fastBundle to run bundle invariants as well (also to update the local
        // bundle copy)
        this.bundler().fastBundle(
          this.site,
          projectId,
          persistentChanges.map((change) => change.changeNode),
        );

        this.dbCtx().revisionNum = updatedModel.revision;
        if (this.hasUnsavedChanges()) {
          this.desktopDraft?.changed();
        }
        this._isRefreshing = false;
      } catch (e) {
        this._isRefreshing = false;
        if (!(e instanceof UnsupportedServerUpdate)) {
          reportError(e, "Sync updates failed");
        }
        console.log("Failed to sync. Downloading entire bundle...");
        if (hasUnsavedChanges) {
          notification.warning({
            message: translate(getUiLocale(), "Failed to sync project"),
            description: translate(
              getUiLocale(),
              "Someone else has edited the project and it wasn't possible to sync with your latest changes. Refreshing the project...",
            ),
            duration: 5,
          });
        } else {
          notification.info({
            message: translate(getUiLocale(), "Syncing latest changes..."),
            duration: 5,
          });
        }
        return this.loadVersion(
          undefined,
          true,
          this.branchInfo(),
          undefined,
          true,
        );
      }
    }
  }

  // Fixes that are made after every `.change()`, `.undo()`, and `.refreshUpdates()`
  private syncAfterChanges(summary: ChangeSummary, complete?: () => void) {
    return this.runNativeArenaCommand(() => this.syncAfterChangesInternal(summary, complete));
  }

  private syncAfterChangesInternal(summary: ChangeSummary, complete?: () => void) {
    // Sync dependency manager
    this.projectDependencyManager.syncDirectDeps();

    this.fontManager.syncSite(this.site, summary.changes);

    // Upsert the style changes
    const _styleChanges = summaryToStyleChanges(summary);
    if (_styleChanges) {
      this.styleMgr.upsertStyles(_styleChanges);

      if (_styleChanges.updatedDeps) {
        for (const dep of _styleChanges.updatedDeps) {
          this.fontManager.installDepFonts(this, dep);
        }
      }
    }

    // Sync deleted objects (they might have been added again)
    Object.values(this._serverUpdatesSummary).forEach(
      (deletedInsts: ObjInst[]) => {
        // If there's a path from the root to the inst, it's no longer deleted
        removeWhere(
          deletedInsts,
          (inst) => !!this.recorder.getPathToChild(inst)?.length,
        );
      },
    );

    this.modelSnapshots.sync(summary.changes, () => {
      const previousArena = this.currentArena;
      this.arenaState.prepareModelCommit(summary.changes);
      if (previousArena && !this.currentArena) { this.selection.clear(); this.commentsCtx.resetViewSessions(); }
      this.prepareNativeArenaInputs(summary.changes);
      complete?.();
      this.commitPendingArenaRoute();
    });
    this.commentsCtx.syncModel(summary);
    this.syncHoveredViewCtx();
    this.notifyInspectorFocusChanged();
    this.inspectorSelection?.syncModel(summary.changes);
    this.viewCtxs.forEach((view) => view.syncInspectorModel(summary.changes));
    for (const listener of this.modelCommitListeners) {listener({ type: "commit", summary });}
    this.viewCtxs.forEach((view) => view.variants.publishCommit());
    this.viewCtxs.forEach((view) => view.styleInputs.publishCommit());
    this.singleRsStyleInputs.publishCommit();
    return _styleChanges;
  }

  /**
   * Goes through all references to Tpls from StudioCtx and ViewCtx,
   * and remove those that are no longer attached to site.  This can happen
   * during restore undo/redo, when, say, an arg tpl to a TplComponent has been
   * replaced. The observe-model framework will restore all pointers except
   * for the parent pointer, which isn't tracked; we fix up the parent pointers
   * for the site tree, but can't fix up parent pointers of nodes that have been
   * detached but we still have referene to.  We do so here.
   */
  pruneDetachedTpls() {
    this.viewCtxs.forEach((vc) => vc.pruneDetachedTpls());
  }

  //
  // Renaming an artboard or the selected row in Layers.
  //
  readonly renamingFocusedStore = createStore<boolean>(() => false);
  renamingFocused() {
    return this.renamingFocusedStore.getState();
  }
  tryStartRenamingFocused() {
    if (
      this.focusedFrame() ||
      (isMixedArena(this.currentArena) && isKnownArenaFrame(this.hoverBoxControlledObj))
    ) {
      this.renamingFocusedStore.setState(true, true);
      return;
    }
    const view = this.focusedViewCtx();
    const focusedTpl = view?.focusedTpl();
    if (
      view &&
      view.focusedTpls().length === 1 &&
      focusedTpl &&
      (isTplNamable(focusedTpl) || isTplSlot(focusedTpl))
    ) {
      this.switchToTreeTab();
      this.startRenamingOnPanel();
    }
  }
  endRenamingFocused() {
    this.renamingFocusedStore.setState(false, true);
  }

  //
  // Inline editing in Layers.
  //
  readonly renamingOnPanelStore = createStore<boolean>(() => false);
  renamingOnPanel() {
    return this.renamingOnPanelStore.getState();
  }
  startRenamingOnPanel() {
    this.renamingOnPanelStore.setState(true, true);
  }
  endRenamingOnPanel() {
    this.renamingOnPanelStore.setState(false, true);
  }

  //
  // Whether to show placeholder for slots
  //
  toggleShowSlotPlaceholder() {
    this.runRenderPolicyCommand(() => this.renderPolicy.toggleSlotPlaceholder());
  }
  showSlotPlaceholder() {
    return this.renderPolicy.showSlotPlaceholder;
  }

  //
  // Whether to show placeholder for containers
  //
  toggleShowContainerPlaceholder() {
    this.runRenderPolicyCommand(() => this.renderPolicy.toggleContainerPlaceholder());
  }

  showContainerPlaceholder() {
    return this.renderPolicy.showContainerPlaceholder;
  }

  //
  // Whether to show placeholder for selection boxes and cursors
  //
  toggleShowMultiplayerSelections() {
    this.overlayState.multiplayerSelections = !this.overlayState.multiplayerSelections;
  }

  showMultiplayerSelections() {
    return this.overlayState.multiplayerSelections;
  }

  //
  // Whether to show hover boxes for ancestors of hovered target
  //
  toggleShowAncestorsHoverBoxes() {
    this.overlayState.ancestorsHoverBoxes = !this.overlayState.ancestorsHoverBoxes;
  }

  showAncestorsHoverBoxes() {
    return this.overlayState.ancestorsHoverBoxes;
  }

  // Manage saving a Component preset; need this because taking screenshots
  // is an async process, so we need to stash the intermediate state
  // somewhere
  // Plain field: this only stashes intermediate state while a screenshot is
  // taken, and no component reads it reactively.
  private _saveAsPresetState: SaveTplAsPresetState | undefined = undefined;
  get saveAsPresetState() {
    return this._saveAsPresetState;
  }
  set saveAsPresetState(v: SaveTplAsPresetState | undefined) {
    this._saveAsPresetState = v;
  }

  prepareSavingPresets = (targetIsVisible: boolean) => {
    if (plasmicExtensionAvailable()) {
      if (targetIsVisible && this.zoom !== 1) {
        notification.error({
          message: translate(
            getUiLocale(),
            "Please set the zoom of the studio to 1, and make sure the element is in visible area of the canvas",
          ),
        });
        return false;
      }
    } else {
      notification.warning({
        message: translate(
          getUiLocale(),
          "The screenshot of presets can be degraded.",
        ),
        description: translate(
          getUiLocale(),
          "For better screenshot quality, please install Plasmic screenshoter Chrome extension at https://chrome.google.com/webstore/detail/plasmic-screenshoter/ekdpninpaghonjjjikcmffpgbagdjjkh?hl=en&authuser=3",
        ),
      });
    }
    return true;
  };

  get screenshotting() {
    return this.overlayState.screenshotting;
  }
  set screenshotting(show: boolean) {
    this.overlayState.screenshotting = show;
  }

  // Manage state of opening and closing the component preset drawer
  /*
  private _presetDrawerState = observable.box<PresetDrawerState | undefined>(
    undefined
  );

  get presetDrawerState() {
    return this._presetDrawerState.get();
  }
  set presetDrawerState(v: PresetDrawerState | undefined) {
    this._presetDrawerState.set(v);
  }
  */

  readonly findReferencesStore = createFindReferencesStore();
  get findReferencesComponent() {
    return this.findReferencesStore.getState().component;
  }
   setFindReferencesComponent(c: Component | undefined) {
    this.findReferencesStore.setState((previous) => previous.component === c ? previous : { component: c });
    if (!this.leftTabKey) {
      this.switchLeftTab("components");
    }
  }
  get findReferencesStyleToken() {
    return this.findReferencesStore.getState().styleToken;
  }
  set findReferencesStyleToken(c: StyleToken | undefined) {
    this.findReferencesStore.setState((previous) => previous.styleToken === c ? previous : { styleToken: c });
    if (!this.leftTabKey) {
      this.switchLeftTab("tokens");
    }
  }

  get findReferencesDataToken() {
    return this.findReferencesStore.getState().dataToken;
  }
  set findReferencesDataToken(c: DataToken | undefined) {
    this.findReferencesStore.setState((previous) => previous.dataToken === c ? previous : { dataToken: c });
    if (!this.leftTabKey) {
      this.switchLeftTab("dataTokens");
    }
  }

  readonly pageSettingsStore = createPageSettingsStore();
  get pageSettingsPage() {
    return this.pageSettingsStore.getState().page;
  }
  set pageSettingsPage(c: PageComponent | undefined) {
    this.pageSettingsStore.setState((previous) => previous.page === c ? previous : { page: c });
  }

  get pageSettingsOpen() {
    return this.pageSettingsStore.getState().open;
  }
  set pageSettingsOpen(open: boolean) {
    this.pageSettingsStore.setState((previous) => previous.open === open ? previous : { open });
  }

  siteIsEmpty() {
    return siteIsEmpty(this.site);
  }

  getProjectData = () => {
      const [pages, comps] = partition(
        this.site.components.filter((c) => !isBuiltinCodeComponent(c)),
        (c) => {
          return isNonNil(c.pageMeta);
        },
      );
      return {
        components: comps.map((c) => ({ name: c.name })),
        pages: pages.map((c) => ({
          name: c.name,
          pageMeta: { path: c.pageMeta!.path },
        })),
      };
  };

  readonly copilotStore = createCopilotStore();

  addToCopilotHistory(
    type: "code" | "sql",
    copilotInteraction: CopilotInteraction<string>,
  ): void;
  addToCopilotHistory(
    type: CopilotType,
    copilotInteraction: CopilotInteraction<unknown>,
  ): void;
  addToCopilotHistory(
    type: CopilotType,
    copilotInteraction: CopilotInteraction<unknown>,
  ): void {
    this.copilotStore.setState((state) => ({
      history: {
        ...state.history,
        [type]: [...(state.history[type] ?? []), copilotInteraction],
      },
    }));
  }

  getCopilotHistory(type: "code" | "sql"): CopilotInteraction<string>[];
  getCopilotHistory(type: CopilotType): CopilotInteraction<unknown>[];
  getCopilotHistory(type: CopilotType): CopilotInteraction<unknown>[] {
    return [...(this.copilotStore.getState().history[type] ?? [])];
  }



  async submitCopilotFeedback(
    id: CopilotInteractionId,
    feedback: boolean,
    feedbackDescription: string | null,
  ) {
    await this.appCtx.api.sendCopilotFeedback({
      id,
      feedback,
      feedbackDescription,
      projectId: this.siteInfo.id,
    });
    this.copilotStore.setState((state) => state.feedback[id] === feedback ? state : ({
      feedback: { ...state.feedback, [id]: feedback },
    }));
  }

  getCopilotFeedback(copilotInteractionId: CopilotInteractionId) {
    return this.copilotStore.getState().feedback[copilotInteractionId];
  }

  /** Gets dedicated arena for component/page, while checking if user has edit access. */
  getDedicatedArena(component: Component) {
    if (!this.canEditComponent(component)) {
      return undefined;
    }

    return getDedicatedArena(this.site, component);
  }

  async changeFrameViewMode(frame: ArenaFrame, mode: "stretch" | "centered") {
    return this.changeUnsafe(() => {
      const viewCtx = this.focusedViewCtx();
      const component = frame.container.component;

      if (isComponentArena(this.currentArena)) {
        getArenaFrames(this.currentArena).forEach(
          (_frame) => (_frame.viewMode = ensure(mode, "mode should exist")),
        );
      } else {
        frame.viewMode = ensure(mode, "mode should exist");
      }

      if (frame.viewMode === FrameViewMode.Stretch) {
        const exp = viewCtx
          ?.variantTplMgr()
          .targetRshForNode(
            ensure(component.tplTree as TplNode, "tplTree should exist"),
          );
        exp?.set("width", "stretch");

        // When switching to Stretch mode, shift focus to the
        // root node
        if (this.focusedFrame() === frame) {
          viewCtx?.setStudioFocusByTpl(frame.container.component.tplTree);
        }
      } else if (frame.viewMode === FrameViewMode.Centered) {
        // When switching to Centered mode, shift focus to the frame
        this.setStudioFocusOnFrame({
          frame: frame,
          autoZoom: false,
        });
      }
    });
  }

  switchToComponentArena(
    target: ValNode | SlotSelection | Component | undefined,
    opts?: {
      noFocusedModeChange?: boolean;
      replace?: boolean;
      stopWatching?: boolean;
      threadId?: string;
    },
  ) {
    const component = switchType(target)
      .when(undefined, () => undefined)
      .when(Component, (it) => it)
      .when(ValComponent, (it) => it.tpl.component)
      .when(ValNode, (it) => it.valOwner?.tpl.component)
      .when(SlotSelection, (it) => it.tpl?.component)
      .result();

    if (!component) {
      return undefined;
    }

    if (
      isCodeComponent(component) ||
      !this.site.components.find((c) => c === component)
    ) {
      return undefined;
    }

    const arena = this.getDedicatedArena(component);
    if (!arena) {
      return undefined;
    }

    this.switchToArena(arena, opts);
    return arena;
  }

  readonly canvasLoadStore = createCanvasLoadStore();

  reportCanvasLoadError(error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (this.canvasLoadStore.getState().error === errorMessage) { return; }
    logError(error, "Canvas initialization failed");
    this.canvasLoadStore.setState({ error: errorMessage });
  }

  canvasFrameError(frame: ArenaFrame | undefined) {
    return frame ? this.canvasLoadStore.getState().frameErrors.get(frame.uuid) : undefined;
  }

  reportCanvasFrameError(frame: ArenaFrame, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (this.canvasFrameError(frame) === message) { return; }
    const frameErrors = new Map(this.canvasLoadStore.getState().frameErrors);
    frameErrors.set(frame.uuid, message);
    this.canvasLoadStore.setState({ frameErrors });
    const waiter = this.frameToViewCtxPromise.get(frame);
    if (waiter) {
      this.frameToViewCtxPromise.delete(frame);
      waiter[2](error);
    }
    if (this.activeCanvasFrame === frame && !this.loadTimings.has("canvas-revealed")) {
      this.reportCanvasLoadError(error);
    } else {
      logError(error, "Artboard loading failed");
    }
  }

  clearCanvasFrameError(frame: ArenaFrame) {
    const previous = this.canvasLoadStore.getState().frameErrors;
    if (!previous.has(frame.uuid)) { return; }
    const frameErrors = new Map(previous);
    frameErrors.delete(frame.uuid);
    this.canvasLoadStore.setState({ frameErrors });
  }

  private canvasLoadRequests: CanvasLoadRequest[] = [];
  private canvasLoadingDisposed = false;
  private wakeCanvasLoad: (() => void) | undefined;

  private requestedActiveCanvas() {
    const target = this.activeCanvasFrame;
    return this.canvasLoadRequests.find(
      (request) => request.arena === this.currentArena && request.frame === target,
    );
  }

  // Keep iframe initialization serial. Idle waits and running background
  // attempts both yield when the user requests a different target.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  private canvasLoadQueue = asynclib.queue(
    safeCallbackify(async (_: {}) => {
      const stopped = () => this.canvasLoadingDisposed || !!this.canvasLoadStore.getState().error;
      let waitDone: (() => void) | undefined;
      while (!stopped() && this.initialRouteReady &&
        (!this.activeCanvasReady || !this.initialViewportReady) &&
        !this.canvasFrameError(this.activeCanvasFrame) &&
        !this.requestedActiveCanvas()) {
        waitDone ??= this.loadTimings.begin("background-canvas-wait");
        await asyncTimeout(16);
      }
      waitDone?.();
      if (stopped()) { return; }

      const onPriorityChange = () => this.wakeCanvasLoad?.();
      const stopSelection = this.selectionStore.subscribe(onPriorityChange);
      const stopArena = this.arenaState.store.subscribe(onPriorityChange);
      const lifetime = this.arenaState.lifetime();
      lifetime.addEventListener("abort", onPriorityChange, { once: true });
      try {
        if (!this.requestedActiveCanvas()) {
          await new Promise<void>((resolve) => {
            const idle = requestIdleCallback(() => resolve());
            this.wakeCanvasLoad = () => {
              if (stopped() || lifetime.aborted || this.requestedActiveCanvas()) {
                clearIdleCallback(idle);
                resolve();
              }
            };
          });
        }
        if (stopped() || lifetime.aborted) { return; }
        const request = this.requestedActiveCanvas() ??
          this.canvasLoadRequests.find((item) => item.arena === this.currentArena) ??
          this.canvasLoadRequests.find((item) => this.getArenaStatus(item.arena) === "background");
        if (!request) { return; }

        arrayRemove(this.canvasLoadRequests, request);
        const finish = this.loadTimings.begin("frame-initialization", request.frame.uuid);
        this.loadTimings.mark("frame-load-start", request.frame.uuid);
        let cancelled = false;
        const stopStatus = this.arenaState.statusStore(request.arena).subscribe(onPriorityChange);
        this.wakeCanvasLoad = () => {
          if (cancelled || !request.cancel || this.activeCanvasFrame === request.frame) { return; }
          const status = this.getArenaStatus(request.arena);
          if (status === "visible" || status === "background") {
            if (!this.requestedActiveCanvas()) { return; }
          }
          cancelled = true;
          request.cancel(true);
        };
        try {
          await withTimeout(request.load(), `Unable to load artboard: ${request.name}`, 180_000);
        } catch (error) {
          if (!cancelled && !lifetime.aborted && !this.canvasLoadingDisposed) {
            request.cancel?.(false);
            this.reportCanvasFrameError(request.frame, error);
          }
        } finally {
          finish();
          stopStatus();
        }
      } finally {
        this.wakeCanvasLoad = undefined;
        stopSelection();
        stopArena();
        lifetime.removeEventListener("abort", onPriorityChange);
      }
    }),
    1,
  );

  queueCanvasFrame(request: CanvasLoadRequest) {
    this.canvasLoadRequests.push(request);
    this.wakeCanvasLoad?.();
    spawn(this.canvasLoadQueue.push({}));
    return () => {
      const index = this.canvasLoadRequests.indexOf(request);
      if (index >= 0) {
        this.canvasLoadRequests.splice(index, 1);
      }
    };
  }

  drainCanvasFrameForArena(arena: AnyArena) {
    const canvasRequests = this.canvasLoadRequests.filter((request) => request.arena === arena);
    if (canvasRequests.length > 0) {
      defer(() => spawn(this.canvasLoadQueue.push(canvasRequests.map(() => ({})))));
    }
  }

  private debouncedWarn = debounce(
    (args: ArgsProps) => notification.warning(args),
    60000,
    {
      leading: true,
    },
  );

  // Execution cache for in-flight/resolved data op/query Promises keyed by
  // id+args for preview/interactions/canvas, invalidated via `mutateDataOp`.
  // Shared across all frames to ensure query execution occurs once.
  private dataOpCache = new BoundedCache<Promise<any>>(100);

  // SWR cache backing `$q` hooks in the studio host frame (useServerQueryOp).
  // SWR has to cache hook state somewhere, without this it falls back to the unbounded global
  // Map shared with all SWR users in the app, outliving this StudioCtx. This make it bounded
  // and scoped to the session, and keeps "Refresh data" away from unrelated app SWR state.
  hostQuerySwrCache = new BoundedCache<any>(100);

  executePlasmicDataOp = asyncMaxAtATime(
    10,
    async (op: DataOp, opts?: Parameters<typeof executePlasmicDataOp>[1]) => {
      // Custom in-studio executePlasmicDataOp. For now, it will point to localhost
      // instead of the production host. Soon, it will instead point to a studio endpoint
      // instead of the public server-data endpoint, so that it can make privileged
      // data requests as an app end user.
      const appUserCtx = this.currentAppUserCtx;
      if (op.roleId) {
        if (
          !appUserCtx.appUser ||
          !appUserCtx.appUser.roleIds ||
          !appUserCtx.appUser.roleIds.includes(op.roleId)
        ) {
          this.debouncedWarn({
            message: translate(
              getUiLocale(),
              "Some data couldn't be loaded because you are viewing the app as an user that doesn't have the required role.",
            ),
          });

          throw new UnauthorizedError();
        }
      }

      const execute = async () => {
        try {
          const result =
            await this.appCtx.api.executeDataSourceOperationInCanvas(
              this.siteInfo.id,
              op.sourceId,
              {
                opId: op.opId,
                paginate: opts?.paginate,
                userArgs: JSON.parse(stringify(op.userArgs)),
                identifier: {
                  email: appUserCtx.appUser.email,
                  externalId: appUserCtx.appUser.externalId,
                },
              },
            );

          if (op.invalidatedKeys?.some((k) => k === ALL_QUERIES.value)) {
            await this.refreshAppUserProperties();
          }
          return result;
        } catch (e) {
          if (e.name === "NotFoundError") {
            this.debouncedWarn({
              message: translate(getUiLocale(), "Could not find integration."),
              duration: 30,
            });
          } else if (e.name === "ForbiddenError") {
            this.debouncedWarn({
              message: translate(
                getUiLocale(),
                "You do not have permission to use some of the data integrations in this project. You must have at least viewer access to the Workspace that the data integrations belong to. Please contact the owner of the data integrations to add you to the necessary Workspaces.",
              ),
              duration: 0,
            });
          }
          throw e;
        }
      };

      // Should only happen when op is a write operation since we don't
      // want to cache an operation that mutates data.
      if (isNil(op.cacheKey)) {
        const result = await execute();
        return result;
      }

      const cacheKey = makeCacheKey(op, {
        paginate: opts?.paginate,
        userAuthToken: opts?.userAuthToken ?? appUserCtx.fakeAuthToken,
      });

      const cached = this.dataOpCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const resultPromise = execute();
      this.dataOpCache.set(cacheKey, resultPromise);
      return resultPromise;
    },
  );

  executeServerQuery = asyncMaxAtATime(
    10,
    async <F extends (...args) => Promise<any>>(
      id: string,
      fn: F,
      ...args: Parameters<F>
    ) => {
      const cacheKey = makeQueryCacheKey(id, args);
      const cached = this.dataOpCache.get(cacheKey);
      if (cached) {
        return cached;
      }
      const resultPromise = fn(...args);
      this.dataOpCache.set(cacheKey, resultPromise);
      return resultPromise;
    },
  );

  // Deletes entries in our studio dataOp cache.
  // If invalidateKey is undefined, will invalidate the whole cache. This happens
  // when the user clicks the "Refresh Data" button.
  mutateDataOp = (invalidateKey?: string) => {
    if (!isNil(invalidateKey)) {
      this.dataOpCache.delete(invalidateKey);
      if (invalidateKey.startsWith("$swr$")) {
        this.dataOpCache.delete(invalidateKey.slice(5));
      }
      return;
    }
    this.dataOpCache.clear();
  };

  getAllDataOpCacheKeys = () => {
    return Array.from(this.dataOpCache.keys());
  };

  readonly uiEnvironment: StudioUiEnvironment;
  readonly versionHistory: StudioVersionHistory;
  readonly projectMetadataStore: StoreApi<ProjectMetadataSnapshot>;

  readonly currentAppUserStore = createStore<{ appUser: StudioAppUser; fakeAuthToken?: string }>(() => ({
    appUser: { isLoggedIn: false, email: undefined, externalId: undefined, properties: undefined, customProperties: undefined, roleName: undefined, roleIds: undefined },
  }));

  get currentAppUserCtx() {
    return this.currentAppUserStore.getState();
  }

  get currentAppUser() {
    return this.currentAppUserStore.getState().appUser;
  }

  async logAsAppUser(appUser: StudioAppUser) {
    this.currentAppUserStore.setState({
      appUser,
      // We assign a fake auth token to emulate the proper behavior in live-preview
      // mode. Data sources use only the auth token to cache data.
      fakeAuthToken: appUser.email,
    });

    if (appUser.isLoggedIn) {
      await this.appCtx.api.addStorageItem(
        storageViewAsKey(this.siteInfo.id),
        JSON.stringify({
          studioAppUser: appUser,
        }),
      );
    } else {
      // Save null for logout
      await this.appCtx.api.addStorageItem(
        storageViewAsKey(this.siteInfo.id),
        "null",
      );
    }

    for (const vc of this.viewCtxs) {
      vc.scheduleSync({ eval: true });
    }
  }

  async resetAppUser() {
    await this.logAsAppUser({
      isLoggedIn: false,
      email: undefined,
      externalId: undefined,
      properties: undefined,
      customProperties: undefined,
      roleName: undefined,
      roleIds: undefined,
    });
  }

  async refreshAppUserProperties() {
    if (this.currentAppUser.email || this.currentAppUser.externalId) {
      const newProperties = await this.appCtx.api.getAppCurrentUserProperties(
        this.siteInfo.id,
        {
          email: this.currentAppUser.email,
          externalId: this.currentAppUser.externalId,
        },
      );

      const newAppUser = {
        ...this.currentAppUser,
        customProperties: newProperties,
      };

      if (!isEqual(this.currentAppUserCtx.appUser, newAppUser)) {
        await this.logAsAppUser(newAppUser);
      }
    }
  }

  tourActionEvents = new Signals.Signal();

  get onboardingTourState() {
    return this.leftPanelState.onboardingTourState;
  }

  setOnboardingTourState(state: OnboardingTourState) {
    this.leftPanelState.setOnboardingTourState(state);
  }

  readonly syntheticSectionsStore = createSyntheticSectionsStore();

  showSyntheticSection = (key: string) => showSyntheticSection(this, key);

  getCurrentPathName = () => {
    return this.focusedOrFirstViewCtx()?.component.pageMeta?.path;
  };
}

export type CopilotType = "code" | "sql";

export type CopilotPrompt = {
  prompt: string;
  images: CopilotImage[];
  modelProviderOverride?: string;
  copilotSystemPromptOverride?: string;
};

export interface CopilotInteraction<T = unknown> {
  prompt: string;
  id: CopilotInteractionId;
  response: T;
  displayMessage?: string;
}

type FrameViewWaiter = [Promise<ViewCtx>, (view: ViewCtx) => void, (error: unknown) => void];

interface CanvasLoadRequest {
  arena: AnyArena;
  frame: ArenaFrame;
  load: () => Promise<void>;
  cancel?: (restart: boolean) => void;
  name: string;
}

function canUserEditProject(user: ApiUser | null, project: SiteInfo) {
  if (isUnownedProject(project)) {
    // project with no owner and public can be edited
    return true;
  }
  if (!user) {
    // Anonymous users can never edit.
    return false;
  }
  if (
    (DEVFLAGS.allowPlasmicTeamEdits &&
      isAdminTeamEmail(user.email, DEVFLAGS)) ||
    accessLevelRank(project.defaultAccessLevel) >= accessLevelRank("content")
  ) {
    return true;
  }
  const accessLevel = getAccessLevelToResource(
    { type: "project", resource: project },
    user,
    project.perms,
  );
  return accessLevelRank(accessLevel) >= accessLevelRank("content");
}

function isContentEditor(user: ApiUser | null, project: SiteInfo) {
  if (!user) {
    return false;
  }
  const userAccessLevel = getAccessLevelToResource(
    { type: "project", resource: project },
    user,
    project.perms,
  );
  const accessLevel =
    accessLevelRank(project.defaultAccessLevel) >=
    accessLevelRank(userAccessLevel)
      ? project.defaultAccessLevel
      : userAccessLevel;
  return accessLevel === "content";
}

export function checkAccessLevelRank(
  user: ApiUser | null,
  project: ApiProject,
  perms: ApiPermission[],
  rank: AccessLevel,
) {
  if (!user) {
    return false;
  }
  return (
    accessLevelRank(
      getAccessLevelToResource(
        {
          type: "project",
          resource: project,
        },
        user,
        perms,
      ),
    ) >= accessLevelRank(rank)
  );
}

export function isUserProjectContentEditor(
  user: ApiUser | null,
  project: ApiProject,
  perms: ApiPermission[],
) {
  return checkAccessLevelRank(user, project, perms, "content");
}

export function canUpdateHistory(
  studioCtx: StudioCtx,
  thread: TplCommentThread,
): boolean {
  const appCtx = studioCtx.appCtx;
  const isProjectContentEditor = isUserProjectContentEditor(
    appCtx.selfInfo,
    studioCtx.siteInfo,
    studioCtx.siteInfo.perms,
  );
  return isProjectContentEditor || appCtx.selfInfo?.id === thread.createdById;
}

export function isUserProjectEditor(
  user: ApiUser | null,
  project: ApiProject,
  perms: ApiPermission[],
) {
  return checkAccessLevelRank(user, project, perms, "editor");
}

export function cssPropsForInvertTransform(
  curZoom: number,
  orgSize?: { width?: number; height?: number },
  orgTransform?: string,
) {
  return {
    transform: orgTransform
      ? `scale(${1 / curZoom}) ${orgTransform}`
      : `scale(${1 / curZoom})`,
    width: orgSize && orgSize.width ? `${orgSize.width * curZoom}px` : "0px",
    height: orgSize && orgSize.height ? `${orgSize.height * curZoom}px` : "0px",
  };
}

export const adjustSpotLightDueToZoom = (zoom: number) => {
  const $shadow = $(".component-ctx-spotlight__shadow");
  if ($shadow.length > 0 && $shadow.css("display") !== "none") {
    // The box-shadow may overflow the maximum pixel size after scale, which
    // seems become negative and cause weird black blocks in the screen. So
    // we scale it back to avoid overflow.
    $shadow.css({ boxShadow: `0 0 0 ${999999 / zoom}px rgba(0,0,0,0.15)` });
  }
  const $ctrl = $(".component-ctx-spotlight__controls");
  if ($ctrl.length > 0 && $ctrl.css("display") !== "none") {
    // We scale back the controls so that they are always at 1x, and always
    // 10px below the spotlight.
    $ctrl.css({
      transform: `translate(0, ${10.0 / zoom}px) scale(${1.0 / zoom})`,
    });
  }
};

function invertTransform($e: JQuery, curZoom: number) {
  const originalWidth = $e.attr("data-original-width");
  const originalHeight = $e.attr("data-original-height");
  const transform = $e.attr("data-original-transform");
  const styles = cssPropsForInvertTransform(
    curZoom,
    {
      width: maybe(originalWidth, (x) => +x),
      height: maybe(originalHeight, (x) => +x),
    },
    transform,
  );
  const elt = $e[0];
  setElementStyles(elt, styles);
}

/**
 * Compares spotlight and pinned variants info about a viewCtx to decide
 * whether it should re-render after making such changes.
 * Returns `true` if it needs to re-render.
 */
function viewCtxInfoChanged(
  vcInfo: SpotlightAndVariantsInfo,
  vcPreviousInfo: SpotlightAndVariantsInfo,
) {
  return (
    vcInfo.componentStackFrameLength !==
      vcPreviousInfo.componentStackFrameLength ||
    vcInfo.lastComponentFrame.tplComponent !==
      vcPreviousInfo.lastComponentFrame.tplComponent ||
    vcInfo.viewMode !== vcPreviousInfo.viewMode ||
    vcInfo.showDefaultSlotContents !== vcPreviousInfo.showDefaultSlotContents ||
    !isEqual(vcInfo.pinnedVariants, vcPreviousInfo.pinnedVariants)
  );
}

export function logChangedNodes(
  logMessage: string,
  changes: ModelChange[],
  includeUids?: boolean,
) {
  console.log(
    logMessage,
    uniq(
      changes.map(
        (change) =>
          `${instUtil.getInstClassName(change.changeNode.inst)}${
            includeUids ? `[${change.changeNode.inst.uid}]` : ""
          }.${change.changeNode.field}`,
      ),
    ).join(", "),
  );
}

// Changes that should be fine even when studioCtx.blockChanges is true
function emptyChanges(recordedChanges: RecordedChanges) {
  const changes = recordedChanges.changes;
  if (changes.length === 0) {
    return true;
  }
  // We might create a VariantSetting by selecting a node that hasn't one,
  // but it should be fine
  if (
    changes.length === 1 &&
    changes[0].changeNode.field === "vsettings" &&
    changes[0].type === "array-splice" &&
    changes[0].removed.length === 0 &&
    changes[0].added.every(
      (val) => isKnownVariantSetting(val) && isVariantSettingEmpty(val),
    )
  ) {
    return true;
  }

  return false;
}

export function studioCtxKey<
  Method extends keyof StudioCtx,
  Args extends (StudioCtx[Method] extends (..._args: any[]) => any
    ? Parameters<StudioCtx[Method]>
    : never),
>(method: Method, ...args: Args) {
  return invalidationKey(method, ...args);
}

export function normalizeTemplateSpec(
  templateSpec: TemplateSpec[],
  isPageTemplatesGroup: boolean,
): InsertableTemplatesGroup {
  return {
    type: "insertable-templates-group",
    name: "root",
    items: [...xGroupBy(templateSpec, (spec) => spec.category).entries()].map(
      ([category, specs]) => ({
        type: "insertable-templates-group",
        name: category ?? "",
        isPageTemplatesGroup,
        items: specs.map((spec) =>
          ensureType<InsertableTemplatesItem>({
            type: "insertable-templates-item",
            projectId: spec.projectId,
            componentName: spec.componentName,
            imageUrl: spec.imageUrl,
            displayName: spec.displayName,
            tokenResolution: spec.tokenResolution,
            componentResolution: spec.componentResolution,
          }),
        ),
      }),
    ),
  };
}

export async function addGetManyQuery({
  component,
  dataSourceId,
  table,
  templates,
  studioCtx,
  queryName,
}: {
  component: Component;
  dataSourceId: string;
  table: string;
  templates?: { [p: string]: DataSourceTemplate };
  studioCtx: StudioCtx;
  queryName?: string;
}) {
  const getMany = mkDataSourceOpExpr({
    sourceId: dataSourceId,
    opId: "temporary-id",
    opName: "getMany",
    templates: {
      resource: mkDataSourceTemplate({
        fieldType: "table",
        value: new TemplatedString({
          text: [JSON.stringify(table)],
        }),
        bindings: null,
      }),
      ...templates,
    },
  });

  const { opId } = await studioCtx.appCtx.app.withSpinner(
    studioCtx.appCtx.api.getDataSourceOpId(
      studioCtx.siteInfo.id,
      dataSourceId,
      {
        name: "getMany",
        templates: mapValues(getMany.templates, dataSourceTemplateToString),
        roleId: undefined,
      },
    ),
  );

  const query = await studioCtx.changeUnsafe(() => {
    const query_ = addEmptyQuery(component, queryName);

    getMany.opId = opId;

    query_.op = getMany;

    return query_;
  });
  return query;
}
