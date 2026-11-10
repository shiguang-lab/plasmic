import { parseProjectLocation } from "@/wab/client/cli-routes";
import {
  CommentFilters,
  CommentsStats,
  computeCommentStats,
  getCommentFrameKey,
  getCommentThreadWithModelMetadata,
  hasNonDeletedComments,
  makeCommonFields,
  TplCommentThread,
} from "@/wab/client/components/comments/utils";
import { reportError, showError } from "@/wab/client/ErrorNotifications";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  ApiComment,
  ApiCommentReaction,
  ApiCommentThread,
  ApiCommentThreadHistory,
  ApiNotificationSettings,
  ApiUser,
  BranchId,
  CommentId,
  CommentReactionData,
  CommentReactionId,
  CommentThreadId,
  GetCommentsResponse,
  RootCommentData,
  ThreadCommentData,
  ThreadHistoryId,
} from "@/wab/shared/ApiSchema";
import { AnyArena } from "@/wab/shared/Arenas";
import { mkIdMap } from "@/wab/shared/collections";
import {
  ensure,
  mkShortUuid,
  mkUuid,
  sortBy,
  spawn,
  xGroupBy,
} from "@/wab/shared/common";
import { TplNamable } from "@/wab/shared/core/tpls";
import {
  ChangesType,
  type ChangeSummary,
} from "@/wab/shared/model/model-change-util";
import { SEARCH_PARAM_COMMENT } from "@/wab/shared/route/app-routes";
import { cloneDeep, isEqual, partition } from "lodash";
import { shallow } from "zustand/shallow";
import { createStore } from "zustand/vanilla";

export interface OpenedThread {
  readonly threadId: CommentThreadId;
  readonly viewCtx?: ViewCtx;
}

export interface OpenedNewThread {
  readonly tpl: TplNamable;
  readonly viewCtx: ViewCtx;
}

interface CommentDialogs {
  readonly thread?: OpenedThread;
  readonly newThread?: OpenedNewThread;
}

const emptyCommentDialogs: CommentDialogs = Object.freeze({ thread: undefined, newThread: undefined });

interface CommentRequestState {
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly hasLoaded: boolean;
  readonly selfNotificationSettings?: ApiNotificationSettings;
}

function emptyCommentData() {
  return {
    allThreads: [] as TplCommentThread[],
    unresolvedThreads: [] as TplCommentThread[],
    resolvedThreads: [] as TplCommentThread[],
    threadsById: new Map<CommentThreadId, TplCommentThread>(),
    unresolvedThreadsByFrame: new Map<string, TplCommentThread[]>(),
    commentedSubjectIds: new Set<string>(),
    commentStatsBySubject: new Map<string, CommentsStats>(),
    commentStatsByComponent: new Map<string, CommentsStats>(),
    commentStatsByVariant: new Map<string, CommentsStats>(),
    usersMap: new Map<string, ApiUser>(),
    reactionsByCommentId: new Map<string, ApiCommentReaction[]>(),
  };
}

// Preserve unaffected entries so node/author/reaction selectors remain stable.
function shareMap<K, V>(
  previous: Map<K, V>,
  next: Map<K, V>,
  equal: (a: V, b: V) => boolean,
): Map<K, V> {
  if (previous === next) {
    return previous;
  }
  for (const [key, value] of next) {
    const old = previous.get(key);
    if (old !== undefined && equal(old, value)) {
      next.set(key, old);
    }
  }
  return shallow(previous, next) ? previous : next;
}

export class CommentsCtx {
  private stopped = false;
  private dialogSnapshot = emptyCommentDialogs;
  private readonly dialogState = createStore<CommentDialogs>(() => this.dialogSnapshot);
  private dialogPublicationDepth = 0;
  private dialogTransactionDepth = 0;
  private readonly dialogSubscriptions = new Set<() => void>();
  readonly dialogStore: Pick<
    typeof this.dialogState,
    "getState" | "getInitialState" | "subscribe"
  > = {
    getState: () => this.dialogSnapshot,
    getInitialState: this.dialogState.getInitialState,
    subscribe: (listener) => {
      if (this.stopped) { return () => undefined; }
      const unsubscribe = this.dialogState.subscribe(listener);
      const stop = () => { unsubscribe(); this.dialogSubscriptions.delete(stop); };
      this.dialogSubscriptions.add(stop);
      return stop;
    },
  };
  private readonly filters = createStore<CommentFilters>(() => ({
    scope: "current",
    status: "unresolved",
    onlyRelated: false,
  }));
  readonly filterStore: Pick<
    typeof this.filters,
    "getState" | "getInitialState" | "subscribe"
  > = this.filters;
  private readonly requestState = createStore<CommentRequestState>(() => ({
    isLoading: false,
    loadFailed: false,
    hasLoaded: false,
  }));
  readonly requestStore: Pick<
    typeof this.requestState,
    "getState" | "getInitialState" | "subscribe"
  > = this.requestState;
  private readonly data = createStore(emptyCommentData);
  readonly store: Pick<
    typeof this.data,
    "getState" | "getInitialState" | "subscribe"
  > = this.data;
  private loadedBranchId?: BranchId;
  private response: Pick<
    GetCommentsResponse,
    "threads" | "users" | "reactions"
  > | null = null;
  private readonly drafts = {
    arenas: new WeakMap<AnyArena, string>(),
    threads: new Map<CommentThreadId, string>(),
  };
  private skipZoomOnFocus = false;
  private commentsRequest?: {
    branchId: BranchId | undefined;
    promise: Promise<void>;
  };

  constructor(private readonly studioCtx: StudioCtx) {
    // Deep-linked threads must load before navigation can finish. Normal loads
    // wait for the active canvas through the Studio's owned readiness task.
    if (parseProjectLocation(studioCtx.appCtx.history.location)?.threadId) {
      spawn(this.fetchComments());
    } else {
      studioCtx.runAfterInitialCanvasReady(() => this.fetchComments());
    }
  }

  /** Session commands install their complete snapshot before any related owner
   * publishes; notifications wait until the enclosing lifecycle command ends. */
  deferPublication<Result>(command: () => Result): Result {
    this.dialogPublicationDepth++;
    try { return command(); }
    finally { this.dialogPublicationDepth--; this.publishDialogs(); }
  }

  /** Restore same-owner sessions and drafts; a replaced model owner can never
   * regain its departed ViewCtx/Tpl handles. */
  transaction<Result>(command: () => Result): Result {
    const checkpoint = this.dialogSnapshot;
    const modelOwner = this.studioCtx.modelSnapshots;
    this.dialogTransactionDepth++;
    try { return command(); }
    catch (error) {
      if (!this.stopped) {
        this.dialogSnapshot = this.studioCtx.modelSnapshots === modelOwner ? checkpoint : emptyCommentDialogs;
      }
      throw error;
    } finally {
      this.dialogTransactionDepth--;
      this.publishDialogs();
    }
  }

  private publishDialogs() {
    if (!this.dialogPublicationDepth && !this.dialogTransactionDepth &&
        this.dialogSnapshot !== this.dialogState.getState()) {
      this.dialogState.setState(this.dialogSnapshot, true);
    }
  }

  private installDialogs(next: CommentDialogs) {
    if (this.stopped || shallow(this.dialogSnapshot, next)) { return; }
    this.dialogSnapshot = next.thread || next.newThread ? Object.freeze(next) : emptyCommentDialogs;
    this.publishDialogs();
  }

  /** Clear view-bound command sessions while their evaluator/model is readable.
   * A targeted ViewCtx removal preserves unbound, global thread dialogs. */
  resetViewSessions(views?: readonly ViewCtx[]) {
    const { thread, newThread } = this.dialogSnapshot;
    this.installDialogs({
      thread: !views || thread?.viewCtx && views.includes(thread.viewCtx) ? undefined : thread,
      newThread: !views || newThread && views.includes(newThread.viewCtx) ? undefined : newThread,
    });
  }

  get isLoading() {
    return this.requestState.getState().isLoading;
  }
  get loadFailed() {
    return this.requestState.getState().loadFailed;
  }
  get hasLoaded() {
    return this.requestState.getState().hasLoaded;
  }
  computedData() {
    return this.data.getState();
  }
  openedThread() {
    return this.dialogSnapshot.thread;
  }
  openedNewThread() {
    return this.dialogSnapshot.newThread;
  }
  bundler() {
    return this.studioCtx.bundler();
  }
  selfNotificationSettings() {
    return this.requestState.getState().selfNotificationSettings;
  }
  commentsFilter() {
    return this.filters.getState();
  }
  branchId() {
    return this.studioCtx.dbCtx().branchInfo?.id;
  }
  projectId() {
    return this.studioCtx.siteInfo.id;
  }

  setCommentsFilter(filter: CommentFilters) {
    if (this.stopped) {
      return;
    }
    this.filters.setState(
      (previous) => (shallow(previous, filter) ? previous : { ...filter }),
      true,
    );
  }

  private updateRequest(next: Partial<CommentRequestState>) {
    if (!this.stopped) {
      this.requestState.setState((previous) => {
        const value = { ...previous, ...next };
        return shallow(previous, value) ? previous : value;
      });
    }
  }

  private ensureCommentsResponse() {
    return ensure(this.response, "Comments data not loaded");
  }

  private publishResponse(
    response: NonNullable<CommentsCtx["response"]>,
    summary?: ChangeSummary | true,
  ) {
    if (this.stopped) {
      return;
    }
    const previousResponse = this.response;
    const previous = this.data.getState();
    const candidates =
      previousResponse?.threads === response.threads && !summary
        ? previous.allThreads
        : response.threads.filter(hasNonDeletedComments).map((thread) => {
            const old = previous.threadsById.get(thread.id);
            const affected =
              summary === true ||
              (summary &&
                (!old?.subjectInfo ||
                  summary.deepUpdatedComponents.has(
                    old.subjectInfo.ownerComponent,
                  ) ||
                  summary.updatedComponents.has(
                    old.subjectInfo.ownerComponent,
                  )));
            if (old && !affected) {
              const { label: _label, subjectInfo: _info, ...apiFields } = old;
              if (shallow(apiFields, thread)) {
                return old;
              }
            }
            return getCommentThreadWithModelMetadata(
              this.studioCtx,
              this.bundler(),
              thread,
            );
          });
    const mergedThreads =
      candidates === previous.allThreads
        ? candidates
        : candidates.map((thread) => {
            const old = previous.threadsById.get(thread.id);
            if (!old || old === thread) {
              return thread;
            }
            const { label: _oldLabel, subjectInfo: oldInfo, ...oldApi } = old;
            const { label: _label, subjectInfo: info, ...api } = thread;
            return shallow(oldApi, api) &&
              old.label === thread.label &&
              oldInfo?.subject === info?.subject &&
              oldInfo?.ownerComponent === info?.ownerComponent &&
              oldInfo?.ownerComponentName === info?.ownerComponentName &&
              shallow(oldInfo?.variants, info?.variants)
              ? old
              : thread;
          });
    const allThreads = shallow(previous.allThreads, mergedThreads)
      ? previous.allThreads
      : mergedThreads;
    this.response = response;
    const [resolvedThreads, unresolvedThreads] =
      previous.allThreads === allThreads
        ? [previous.resolvedThreads, previous.unresolvedThreads]
        : partition(allThreads, (thread) => thread.resolved);
    const stats =
      !summary && shallow(previous.unresolvedThreads, unresolvedThreads)
        ? previous
        : computeCommentStats(unresolvedThreads);
    const usersMap =
      previousResponse?.users === response.users
        ? previous.usersMap
        : shareMap(previous.usersMap, mkIdMap(response.users), isEqual);
    const reactionsByCommentId =
      previousResponse?.reactions === response.reactions
        ? previous.reactionsByCommentId
        : shareMap(
            previous.reactionsByCommentId,
            xGroupBy(
              sortBy(
                response.reactions,
                (reaction) => +new Date(reaction.createdAt),
              ),
              (reaction) => reaction.commentId,
            ),
            shallow,
          );
    const commentedSubjectIds =
      previous.unresolvedThreads === unresolvedThreads
        ? previous.commentedSubjectIds
        : new Set(
            unresolvedThreads.flatMap((thread) =>
              thread.subjectInfo ? [thread.subjectInfo.subject.uuid] : [],
            ),
          );
    const unresolvedThreadsByFrame =
      previous.unresolvedThreads === unresolvedThreads
        ? previous.unresolvedThreadsByFrame
        : xGroupBy(
            unresolvedThreads.filter(
              (thread) => thread.subjectInfo?.variants !== undefined,
            ),
            (thread) => {
              const info = ensure(thread.subjectInfo, "Comment subject");
              return getCommentFrameKey(
                info.ownerComponent,
                ensure(info.variants, "Comment variants"),
              );
            },
          );
    const next = {
      unresolvedThreadsByFrame: shareMap(
        previous.unresolvedThreadsByFrame,
        unresolvedThreadsByFrame,
        shallow,
      ),
      commentedSubjectIds: shallow(
        previous.commentedSubjectIds,
        commentedSubjectIds,
      )
        ? previous.commentedSubjectIds
        : commentedSubjectIds,
      allThreads: shallow(previous.allThreads, allThreads)
        ? previous.allThreads
        : allThreads,
      unresolvedThreads: shallow(previous.unresolvedThreads, unresolvedThreads)
        ? previous.unresolvedThreads
        : unresolvedThreads,
      resolvedThreads: shallow(previous.resolvedThreads, resolvedThreads)
        ? previous.resolvedThreads
        : resolvedThreads,
      threadsById:
        previous.allThreads === allThreads
          ? previous.threadsById
          : shareMap(
              previous.threadsById,
              new Map(allThreads.map((thread) => [thread.id, thread])),
              Object.is,
            ),
      usersMap,
      reactionsByCommentId,
      commentStatsBySubject: shareMap(
        previous.commentStatsBySubject,
        stats.commentStatsBySubject,
        shallow,
      ),
      commentStatsByComponent: shareMap(
        previous.commentStatsByComponent,
        stats.commentStatsByComponent,
        shallow,
      ),
      commentStatsByVariant: shareMap(
        previous.commentStatsByVariant,
        stats.commentStatsByVariant,
        shallow,
      ),
    };
    this.data.setState(shallow(previous, next) ? previous : next, true);
  }

  syncModel(summary?: ChangeSummary) {
    if (!this.response || this.stopped) {
      return;
    }
    // Style-only edits do not affect comment labels, ownership or variants.
    if (
      summary &&
      (summary.changesType === ChangesType.NoChange ||
        (summary.changesType === ChangesType.CssOnly &&
          !summary.changes.some(
            ({ changeNode: { field } }) => field === "selectors",
          )))
    ) {
      return;
    }
    const affectsAll =
      !summary ||
      summary.changes.some(({ changeNode: { field } }) =>
        [
          "selectors",
          "codeComponentVariantKeys",
          "components",
          "globalVariantGroups",
          "activeScreenVariantGroup",
          "variants",
          "variantGroups",
          "projectDependencies",
          "site",
        ].includes(field),
      );
    if (
      summary &&
      !affectsAll &&
      !summary.updatedComponents.size &&
      !summary.deepUpdatedComponents.size
    ) {
      return;
    }
    this.publishResponse(this.response, affectsAll ? true : summary);
  }

  onSiteReplaced() {
    if (this.stopped) {
      return;
    }
    this.resetViewSessions();
    if (this.loadedBranchId !== this.branchId()) {
      this.response = null;
      this.data.setState(emptyCommentData(), true);
      this.updateRequest({
        hasLoaded: false,
        selfNotificationSettings: undefined,
      });
      spawn(this.fetchComments());
    } else {
      this.syncModel();
    }
  }

  getAndResetSkipZoomOnFocus(): boolean {
    const value = this.skipZoomOnFocus;
    this.skipZoomOnFocus = false;
    return value;
  }

  private getQueryParams(): URLSearchParams {
    return new URLSearchParams(this.studioCtx.appCtx.history.location.search);
  }

  closeNewThreadDialog() {
    if (!this.stopped && this.openedNewThread()) {
      this.installDialogs({ ...this.dialogSnapshot, newThread: undefined });
    }
  }

  openNewCommentDialog(viewCtx: ViewCtx, tpl: TplNamable) {
    if (this.stopped) {
      return;
    }
    this.installDialogs({
      thread: undefined,
      newThread: Object.freeze({ viewCtx, tpl }),
    });
    if (!this.studioCtx.showCommentsPanel) { this.studioCtx.toggleCommentsPanel(); }
  }

  handleOpenCommentThreadDialog(threadId: CommentThreadId, viewCtx?: ViewCtx) {
    if (this.stopped) {
      return;
    }
    if (!this.studioCtx.showCommentsPanel) { this.studioCtx.toggleCommentsPanel(); }
    const previous = this.openedThread();
    if (
      previous?.threadId === threadId &&
      previous.viewCtx === viewCtx &&
      !this.openedNewThread()
    ) {
      return;
    }
    this.installDialogs({
      newThread: undefined,
      thread: Object.freeze({ threadId, viewCtx }),
    });
  }

  handleCloseThreadDialog() {
    if (!this.stopped && this.openedThread()) {
      this.installDialogs({ ...this.dialogSnapshot, thread: undefined });
    }
  }

  openCommentThreadDialog(threadId: string, skipZoom?: boolean) {
    if (this.stopped) { return; }
    if (!this.studioCtx.showCommentsPanel) { this.studioCtx.toggleCommentsPanel(); }
    const queryParams = this.getQueryParams();
    if (queryParams.get(SEARCH_PARAM_COMMENT) === threadId) {
      if (!this.openedThread()) { spawn(this.studioCtx.focusCommentThread(threadId)); }
      return;
    }
    this.skipZoomOnFocus = !!skipZoom;
    queryParams.set(SEARCH_PARAM_COMMENT, threadId);
    this.studioCtx.appCtx.history.push({ search: queryParams.toString() });
  }

  closeCommentThreadDialog() {
    const queryParams = this.getQueryParams();
    queryParams.delete(SEARCH_PARAM_COMMENT);
    this.studioCtx.appCtx.history.push({ search: queryParams.toString() });
  }

  /** A mutation must not reuse a read that started before it was persisted. */
  async refreshComments(): Promise<void> {
    await this.commentsRequest?.promise;
    await this.fetchComments();
  }

  fetchComments(): Promise<void> {
    if (this.stopped || !this.studioCtx.showComments()) {
      return Promise.resolve();
    }
    const branchId = this.branchId();
    if (this.commentsRequest && this.commentsRequest.branchId === branchId) {
      return this.commentsRequest.promise;
    }
    const request = { branchId, promise: Promise.resolve() };
    this.commentsRequest = request;
    this.updateRequest({ isLoading: true, loadFailed: false });
    request.promise = this.fetchCommentsInternal(request);
    return request.promise;
  }

  private async fetchCommentsInternal(
    request: NonNullable<CommentsCtx["commentsRequest"]>,
  ) {
    const isCurrent = () =>
      !this.stopped &&
      this.commentsRequest === request &&
      this.branchId() === request.branchId;
    try {
      const response = await this.studioCtx.appCtx.api.getComments(
        this.projectId(),
        request.branchId,
      );
      if (!isCurrent()) {
        return;
      }
      const old =
        this.loadedBranchId === request.branchId ? this.response : null;
      this.loadedBranchId = request.branchId;
      const oldThreads = new Map(
        old?.threads.map((thread) => [thread.id, thread]),
      );
      const oldReactions = new Map(
        old?.reactions.map((reaction) => [reaction.id, reaction]),
      );
      this.publishResponse({
        threads: response.threads.map((thread) => {
          const previous = oldThreads.get(thread.id);
          return previous && isEqual(previous, thread)
            ? previous
            : cloneDeep(thread);
        }),
        users: response.users.map((user) => {
          const previous = this.data.getState().usersMap.get(user.id);
          return previous && isEqual(previous, user)
            ? previous
            : cloneDeep(user);
        }),
        reactions: response.reactions.map((reaction) => {
          const previous = oldReactions.get(reaction.id);
          return previous && isEqual(previous, reaction)
            ? previous
            : cloneDeep(reaction);
        }),
      });
      const previous = this.selfNotificationSettings();
      this.updateRequest({
        hasLoaded: true,
        selfNotificationSettings: isEqual(
          previous,
          response.selfNotificationSettings,
        )
          ? previous
          : response.selfNotificationSettings && {
              ...response.selfNotificationSettings,
            },
      });
    } catch (error) {
      if (isCurrent()) {
        this.updateRequest({ loadFailed: true });
        reportError(error);
      }
    } finally {
      if (isCurrent()) {
        this.updateRequest({ isLoading: false });
      }
      if (this.commentsRequest === request) {
        this.commentsRequest = undefined;
      }
    }
  }

  async waitForInitialCommentsLoad() {
    if (!this.hasLoaded || this.loadedBranchId !== this.branchId()) {
      await this.fetchComments();
    }
  }

  dispose() {
    if (this.stopped) { return; }
    this.stopped = true;
    this.dialogSnapshot = emptyCommentDialogs;
    // Closing supersedes an in-flight transaction/publication deferral.
    this.dialogState.setState(this.dialogSnapshot, true);
    for (const stop of this.dialogSubscriptions) { stop(); }
    this.commentsRequest = undefined;
    this.drafts.threads.clear();
  }
  getArenaDraft(arena: AnyArena): string {
    return this.drafts.arenas.get(arena) || "";
  }
  setArenaDraft(arena: AnyArena, body: string) {
    this.drafts.arenas.set(arena, body);
  }
  clearArenaDraft(arena: AnyArena) {
    this.drafts.arenas.delete(arena);
  }
  getThreadDraft(thread: ApiCommentThread): string {
    return this.drafts.threads.get(thread.id) || "";
  }
  setThreadDraft(thread: ApiCommentThread, body: string) {
    this.drafts.threads.set(thread.id, body);
  }
  clearThreadDraft(thread: ApiCommentThread) {
    this.drafts.threads.delete(thread.id);
  }

  private createThread(commentData: RootCommentData): ApiCommentThread {
    const user = ensure(this.studioCtx.appCtx.selfInfo, "must have selfInfo");
    const commonFields = makeCommonFields(user.id);
    const newComment: ApiComment = {
      id: ensure(commentData.commentId, "Comment ID"),
      body: commentData.body,
      commentThreadId: ensure(commentData.commentThreadId, "Thread ID"),
      ...commonFields,
    };
    const newThread: ApiCommentThread = {
      id: newComment.commentThreadId,
      location: cloneDeep(commentData.location),
      resolved: false,
      comments: [newComment],
      commentThreadHistories: [],
      ...commonFields,
    };
    const response = this.ensureCommentsResponse();
    this.publishResponse({
      ...response,
      threads: [newThread, ...response.threads],
    });
    return newThread;
  }

  private addComment(
    threadId: CommentThreadId,
    commentData: ThreadCommentData,
  ): ApiComment {
    const user = ensure(this.studioCtx.appCtx.selfInfo, "must have selfInfo");
    const newComment: ApiComment = {
      id: commentData.id,
      body: commentData.body,
      commentThreadId: threadId,
      ...makeCommonFields(user.id),
    };
    const response = this.ensureCommentsResponse();
    this.publishResponse({
      ...response,
      threads: response.threads.map((thread) =>
        thread.id === threadId
          ? { ...thread, comments: [...thread.comments, newComment] }
          : thread,
      ),
    });
    return newComment;
  }

  private updateComment(
    commentId: CommentId,
    update: (comment: ApiComment) => ApiComment,
  ) {
    const response = this.ensureCommentsResponse();
    let changed = false;
    const threads = response.threads.map((thread) => {
      const comments = thread.comments.map((comment) =>
        comment.id === commentId ? update(comment) : comment,
      );
      if (shallow(thread.comments, comments)) {
        return thread;
      }
      changed = true;
      return { ...thread, comments };
    });
    if (changed) {
      this.publishResponse({ ...response, threads });
    }
  }

  private editCommentBody(commentId: CommentId, body: string) {
    this.updateComment(commentId, (comment) =>
      comment.body === body
        ? comment
        : { ...comment, body, updatedAt: new Date().toISOString() },
    );
  }

  private deleteThreadComment(commentId: CommentId) {
    this.updateComment(commentId, (comment) =>
      comment.deletedAt
        ? comment
        : {
            ...comment,
            body: "",
            deletedAt: new Date().toISOString(),
            deletedById: ensure(
              this.studioCtx.appCtx.selfInfo?.id,
              "must have selfInfo",
            ),
          },
    );
  }

  private addReaction(
    id: CommentReactionId,
    commentId: CommentId,
    data: CommentReactionData,
  ): ApiCommentReaction {
    const user = ensure(this.studioCtx.appCtx.selfInfo, "must have selfInfo");
    const reaction: ApiCommentReaction = {
      id,
      commentId,
      data: { ...data },
      ...makeCommonFields(user.id),
    };
    const response = this.ensureCommentsResponse();
    this.publishResponse({
      ...response,
      reactions: [...response.reactions, reaction],
    });
    return reaction;
  }

  private removeReaction(reactionId: CommentReactionId) {
    const response = this.ensureCommentsResponse();
    const reactions = response.reactions.filter(
      (reaction) => reaction.id !== reactionId,
    );
    if (reactions.length !== response.reactions.length) {
      this.publishResponse({ ...response, reactions });
    }
  }

  private addThreadHistory(
    id: ThreadHistoryId,
    threadId: CommentThreadId,
    resolved: boolean,
  ): ApiCommentThreadHistory {
    const user = ensure(this.studioCtx.appCtx.selfInfo, "must have selfInfo");
    const history = {
      id,
      commentThreadId: threadId,
      resolved,
      ...makeCommonFields(user.id),
    };
    const response = this.ensureCommentsResponse();
    this.publishResponse({
      ...response,
      threads: response.threads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              commentThreadHistories: [
                ...thread.commentThreadHistories,
                history,
              ],
              resolved,
            }
          : thread,
      ),
    });
    return history;
  }

  private spawnHandlingErrors<T>(promise: Promise<T>): void {
    const branchId = this.branchId();
    spawn(
      (async () => {
        try {
          await promise;
        } catch (err) {
          if (this.stopped || branchId !== this.branchId()) {
            return;
          }
          reportError(err);
          showError(err, {
            title: translate(getUiLocale(), "Unable to process your request"),
            description: translate(getUiLocale(), "Please try again"),
          });
          spawn(this.fetchComments());
        }
      })(),
    );
  }

  postRootComment(
    commentData: Omit<RootCommentData, "commentThreadId" | "commentId">,
  ): ApiCommentThread {
    const api = this.studioCtx.appCtx.api;
    const optimisticRootCommentData = {
      ...commentData,
      commentThreadId: mkShortUuid<CommentThreadId>(),
      commentId: mkShortUuid<CommentId>(),
    };
    this.spawnHandlingErrors(
      api.postRootComment(
        this.projectId(),
        this.branchId(),
        optimisticRootCommentData,
      ),
    );
    return this.createThread(optimisticRootCommentData);
  }

  postThreadComment(
    threadId: CommentThreadId,
    commentData: Omit<ThreadCommentData, "id">,
  ) {
    const api = this.studioCtx.appCtx.api;
    const optimisticThreadCommentData = {
      ...commentData,
      id: mkShortUuid<CommentId>(),
    };
    this.spawnHandlingErrors(
      api.postThreadComment(
        this.projectId(),
        this.branchId(),
        threadId,
        optimisticThreadCommentData,
      ),
    );
    return this.addComment(threadId, optimisticThreadCommentData);
  }

  editThread(threadId: CommentThreadId, resolved: boolean) {
    const api = this.studioCtx.appCtx.api;
    const id = mkUuid<ThreadHistoryId>();
    this.spawnHandlingErrors(
      api.editThread(this.projectId(), this.branchId(), threadId, {
        id,
        resolved,
      }),
    );
    return this.addThreadHistory(id, threadId, resolved);
  }

  editComment(commentId: CommentId, body: string) {
    const api = this.studioCtx.appCtx.api;
    this.spawnHandlingErrors(
      api.editComment(this.projectId(), this.branchId(), commentId, {
        body,
      }),
    );
    this.editCommentBody(commentId, body);
  }

  deleteComment(commentId: CommentId) {
    const api = this.studioCtx.appCtx.api;
    this.spawnHandlingErrors(
      api.deleteComment(this.projectId(), this.branchId(), commentId),
    );
    this.deleteThreadComment(commentId);
  }

  addReactionToComment(
    commentId: CommentId,
    data: Omit<CommentReactionData, "id">,
  ): ApiCommentReaction {
    const api = this.studioCtx.appCtx.api;
    const id = mkUuid<CommentReactionId>();
    this.spawnHandlingErrors(
      api.addReactionToComment(
        id,
        this.projectId(),
        this.branchId(),
        commentId,
        data,
      ),
    );
    return this.addReaction(id, commentId, data);
  }

  removeReactionFromComment(reactionId: CommentReactionId) {
    const api = this.studioCtx.appCtx.api;
    this.spawnHandlingErrors(
      api.removeReactionFromComment(
        this.projectId(),
        this.branchId(),
        reactionId,
      ),
    );
    this.removeReaction(reactionId);
  }
}
