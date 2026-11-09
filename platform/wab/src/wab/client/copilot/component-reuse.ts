import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { assert } from "@/wab/shared/common";
import { componentReviewContextSchema, componentReviewResultSchema, describeReviewRegistration, type ComponentReviewContext, type ComponentReviewResult, type ReviewComponentDocument, type ReviewRegion } from "@/wab/shared/copilot/component-review";
import type { MutationReceipt } from "@/wab/shared/copilot/mutation-receipt";
import { getRealParams, isCodeComponent, isContextCodeComponent, isFrameComponent, isPageComponent } from "@/wab/shared/core/components";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import { ancestorsUp, flattenTpls } from "@/wab/shared/core/tpls";
import { isKnownEventHandler, isKnownFunctionType, isKnownSlotParam, isKnownTplComponent, isKnownTplTag, type Component, type TplNode } from "@/wab/shared/model/classes";
import isEqual from "lodash/isEqual";

type Operation = { name: string; input: Record<string, unknown> };
const coverageSnapshots = new WeakMap<StudioCtx, Pick<ComponentReviewResult, "indexed" | "total">>();
function rememberCoverage(studio: StudioCtx, value: unknown) {
  if (value && typeof value === "object" && "indexed" in value && "total" in value && typeof value.indexed === "number" && typeof value.total === "number") {
    coverageSnapshots.set(studio, { indexed: value.indexed, total: value.total });
  }
}
export function reviewInput(name: string, input: Record<string, unknown>) {
  try {
    const context = componentReviewContextSchema.parse(input.reviewContext);
    const operations = name === "executeBatch" ? input.operations as Operation[] : [{ name, input }];
    return { context, operations };
  } catch (error) { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { operationExecuted: false }); }
}

export function componentDocuments(studio: StudioCtx) {
  const documents: ReviewComponentDocument[] = []; let unavailable = 0;
  const registrations = new Map<string, ReturnType<StudioCtx["getCodeComponentMeta"]>>();
  for (const entry of studio.getCodeComponentsRegistration()) {if (!registrations.has(entry.meta.name)) {registrations.set(entry.meta.name, entry.meta);}}
  const sources = [{ site: studio.site, projectId: studio.siteInfo.id, version: "local" }, ...walkDependencyTree(studio.site, "all")];
  const seen = new Set<string>();
  for (const source of sources) {for (const component of source.site.components) {
    if (seen.has(component.uuid) || isPageComponent(component) || isFrameComponent(component) || isContextCodeComponent(component)) {continue;}
    seen.add(component.uuid);
    const meta = isCodeComponent(component) ? registrations.get(component.name) : undefined;
    if (isCodeComponent(component) && !meta) { unavailable++; continue; }
    if (meta) {
      documents.push({ componentUuid: component.uuid, name: component.name, fromProject: source.projectId, version: source.version, ...describeReviewRegistration(meta) });
      continue;
    }
    const props: string[] = []; const slots: string[] = []; const events: string[] = []; const lines: string[] = [];
    for (const param of getRealParams(component, { includeSlots: true })) {
      const name = param.variable.name;
      if (["className", "style", "ref", "key"].includes(name)) {continue;}
      const kind = isKnownSlotParam(param) ? "slot" : isKnownFunctionType(param.type) ? "eventHandler" : "prop";
      (kind === "slot" ? slots : kind === "eventHandler" ? events : props).push(name);
      lines.push(`${name}: ${kind}${param.description ? " — " + param.description : ""}`);
    }
    const description = component.codeComponentMeta?.description ?? "";
    const composition = !isCodeComponent(component) ? [...new Set(flattenTpls(component.tplTree).filter(isKnownTplComponent).map(node => node.component.name))].sort() : [];
    const sections = [[component.name, description].filter(Boolean).join("\n"),
      [composition.length ? "Composition uses: " + composition.join(", ") : "", ...lines].filter(Boolean).join("\n")].filter(Boolean);
    documents.push({ componentUuid: component.uuid, name: component.name, fromProject: source.projectId, version: source.version,
      description, sections, props, slots, events });
  }}
  documents.sort((a, b) => a.componentUuid.localeCompare(b.componentUuid)); return { documents, unavailable };
}

/** One editor lifetime; tracked contract fields do not include instance styles/text. */
export function startComponentReuse(studio: StudioCtx) {
  if (!studio.appCtx.appConfig.enableComponentReuseAdvisory) {return () => {};}
  const api = studio.appCtx.topFrameApi;
  if (!api) {return () => {};}
  let closed = false; let lastActivity = 0; let dispose = () => {};
  const activity = () => { if (Date.now() - lastActivity > 350) { lastActivity = Date.now(); void api.componentReuse({ command: "activity" }).catch(() => {}); } };
  const events = ["pointermove", "keydown", "wheel"] as const;
  void api.componentReuse({ command: "status" }).then(status => {
    if (closed || !(status && typeof status === "object" && "available" in status && status.available === true)) {return;}
    let previous: ReturnType<typeof componentDocuments> | undefined;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const publish = () => {
      pending = undefined;
      if (closed) { return; }
      const catalogue = componentDocuments(studio);
      if (isEqual(previous, catalogue)) { return; }
      previous = catalogue;
      void api.componentReuse({ command: "sync", projectId: studio.siteInfo.id, ...catalogue }).then(value => { if (!closed) { rememberCoverage(studio, value); } }).catch(() => {});
    };
    const schedule = () => { if (!closed && !pending) { pending = setTimeout(publish, 250); } };
    const stopModel = studio.subscribeModelChanges(schedule);
    const stopVersion = studio.dbCtx().subscribeVersionInputs(schedule);
    const stopRegistrations = studio.subscribeCodeRegistrations(schedule);
    dispose = () => { stopModel(); stopVersion(); stopRegistrations(); clearTimeout(pending); };
    publish();
    events.forEach(name => window.addEventListener(name, activity, { passive: true }));
  }).catch(() => {});
  return () => { closed = true; dispose(); events.forEach(name => window.removeEventListener(name, activity)); void api.componentReuse({ command: "release", projectId: studio.siteInfo.id }).catch(() => {}); };
}

function nodesAndUsed(root: TplNode) {
  const nodes: TplNode[] = []; const used = new Set<string>(); const visited = new Set<string>();
  const visit = (node: TplNode) => {
    for (const child of flattenTpls(node)) {
      nodes.push(child);
      if (isKnownTplComponent(child)) {
        used.add(child.component.uuid);
        if (!isCodeComponent(child.component) && !visited.has(child.component.uuid)) { visited.add(child.component.uuid); visit(child.component.tplTree); }
      }
    }
  };
  visit(root); return { nodes, used };
}
function hasNativeWidget(node: TplNode) {
  return isKnownTplTag(node) && (["button", "input", "select", "textarea", "form", "table", "dialog", "details", "summary"].includes(node.tag) || node.vsettings.some(setting =>
    Object.entries(setting.attrs).some(([name, value]) => /^on[A-Z]/.test(name) && isKnownEventHandler(value))));
}
export function shouldReviewRegion(operations: Operation[], root: TplNode) {
  if (operations.some(op => op.name === "reviewComponentReuse")) { return true; }
  const relevant = operations.filter(op => ["insertHtml", "copyElement", "createComponent", "createInteraction", "updateInteraction"].includes(op.name) ||
    op.name === "changeElement" && ["props", "resetProps", "visibleIf", "repeat"].some(key => key in op.input));
  if (!relevant.length) { return false; }
  const { nodes } = nodesAndUsed(root);
  if (nodes.some(hasNativeWidget)) {return true;}
  // Registered components do not establish that adjacent or Slot content is
  // covered. Inspect the authored custom structure, including inside Card Slots.
  const native = nodes.filter(isKnownTplTag);
  const widgetRoles = new Set(["table", "grid", "row", "tablist", "tab", "tabpanel", "listbox", "tree", "menu"]);
  if (native.some(node => node.vsettings.some(setting => setting.attrs.role && widgetRoles.has(String(tryExtractJson(setting.attrs.role)))))) { return true; }
  const hasText = (node: TplNode) => isKnownTplTag(node) && node.vsettings.some(setting => !!setting.text);
  const fieldPairs = native.filter(node => node.children.length === 2 && node.children.every(hasText));
  const hasContent = (node: TplNode) => flattenTpls(node).some(child => hasText(child) || isKnownTplComponent(child));
  const repeatedRows = native.some(node => {
    const rows = node.children.filter(isKnownTplTag);
    if (rows.length < 3 || rows.length !== node.children.length) { return false; }
    const width = rows[0].children.length;
    return width >= 2 && rows.every(row => row.children.length === width && row.children.every(hasContent));
  });
  return repeatedRows || native.some(node => ["dl", "dt", "dd", "ul", "ol"].includes(node.tag)) || fieldPairs.length >= 2;
}

const prompted = new WeakMap<StudioCtx, Map<string, { regions: Set<string>; candidates: Set<string> }>>();
export async function reviewComponents(studio: StudioCtx, operations: Operation[], receipts: MutationReceipt[], context: ComponentReviewContext, callerId = "local", signal?: AbortSignal, retry = false): Promise<ComponentReviewResult> {
  const skipped: ComponentReviewResult = { status: "skipped", indexed: null, total: null, ...coverageSnapshots.get(studio), elapsedMs: 0, suggestions: [] };
  const api = studio.appCtx.topFrameApi;
  if (!studio.appCtx.appConfig.enableComponentReuseAdvisory || !api) {return { ...skipped, status: "unavailable" };}
  let sessions = prompted.get(studio); if (!sessions) { sessions = new Map(); prompted.set(studio, sessions); }
  const sessionKey = studio.aiSessionId + ":" + callerId;
  let history = sessions.get(sessionKey); if (!history) { history = { regions: new Set(), candidates: new Set() }; sessions.set(sessionKey, history); }
  const sent = history.regions; const offered = history.candidates;
  if (sessions.size > 32) {sessions.delete(sessions.keys().next().value as string);}
  for (const receipt of receipts) {
    if (receipt.componentUuid && receipt.replacedElementUuid && sent.has(receipt.componentUuid + ":" + receipt.replacedElementUuid)) {
      for (const created of receipt.created) {if (created.kind === "Element") {sent.add(receipt.componentUuid + ":" + created.uuid);}}
    }
  }
  const regions: ReviewRegion[] = []; const snapshots = new Set<string>();
  const skippedRegions: NonNullable<ComponentReviewResult["skippedRegions"]> = [];
  if (context.customOnly) {return { ...skipped, skippedRegions: [{ reason: "user-choice-agent-reported" }] };}
  const targets: { component: Component; node: TplNode }[] = [];
  const recordSkip = (reason: NonNullable<ComponentReviewResult["skippedRegions"]>[number]["reason"], component?: Component, node?: TplNode) => {
    if (skippedRegions.length < 5) {skippedRegions.push({ ...(component ? { componentUuid: component.uuid } : {}), ...(node ? { elementUuid: node.uuid } : {}), reason });}
  };
  for (const [index, operation] of operations.entries()) {
    const receipt = receipts[index];
    const created = receipt?.created?.filter(item => item.kind === "Element" || item.kind === "Component") ?? [];
    for (const item of created.length ? created : [undefined]) {
      const componentUuid = item?.componentUuid ?? (item?.kind === "Component" ? item.uuid : undefined) ?? receipt?.componentUuid ?? operation.input.componentUuid;
      const component = studio.site.components.find(entry => entry.uuid === componentUuid);
      if (!component) { recordSkip("target-unresolved"); continue; }
      const elementUuid = item?.kind === "Element" ? item.uuid : item?.rootElementUuid ?? receipt?.elementUuid ?? operation.input.elementUuid;
      const node = flattenTpls(component.tplTree).find(entry => entry.uuid === elementUuid) ?? (!elementUuid ? component.tplTree : undefined);
      if (!node) { recordSkip("target-unresolved", component); continue; }
      if (!shouldReviewRegion([operation], node)) { recordSkip("component-owned-or-presentation", component, node); continue; }
      // Deduplicate actual changed scopes without asking the agent to map operations.
      if (targets.some(target => target.component === component && ancestorsUp(node).includes(target.node))) {continue;}
      for (let i = targets.length - 1; i >= 0; i--) {if (targets[i].component === component && ancestorsUp(targets[i].node).includes(node)) {targets.splice(i, 1);}}
      targets.push({ component, node });
    }
  }
  let truncated = false;
  for (const { component, node } of targets) {
    if (ancestorsUp(node).some(ancestor => sent.has(component.uuid + ":" + ancestor.uuid))) { recordSkip("already-reviewed", component, node); continue; }
    if (regions.length === 5) { truncated = true; continue; }
    const { nodes, used } = nodesAndUsed(node);
    snapshots.add(component.uuid + ":" + node.uuid);
    regions.push({ componentUuid: component.uuid, elementUuid: node.uuid, intent: context.purpose, usedComponentUuids: [...used], ancestorComponentUuids: ancestorsUp(node).filter(isKnownTplComponent).map(ancestor => ancestor.component.uuid), facts: [...new Set(nodes.filter(isKnownTplTag).map(item => item.tag))] });
  }
  if (!regions.length) {return { ...skipped, skippedRegions };}
  const started = performance.now(); const id = crypto.randomUUID(); const counter = studio._changeCounter;
  let ended = false; let interrupted: (result: ComponentReviewResult) => void = () => {};
  const retryCall = (afterMs: number) => ({ tool: "execute" as const, arguments: { name: "reviewComponentReuse" as const, input: { targets: regions.map(({ componentUuid, elementUuid }) => ({ componentUuid, elementUuid })), reviewContext: context } }, afterMs });
  const stop = (status: "cancelled" | "timeout") => { ended = true; void api.componentReuse({ command: "cancel", id }).catch(() => {}); interrupted({ ...skipped, ...coverageSnapshots.get(studio), status, skippedRegions, ...(status === "timeout" ? { retry: retryCall(1000) } : {}), elapsedMs: performance.now() - started }); };
  const cancel = () => stop("cancelled"); signal?.addEventListener("abort", cancel, { once: true });
  const timeout = new Promise<ComponentReviewResult>(resolve => { interrupted = resolve; });
  const timer = setTimeout(() => stop("timeout"), 5000);
  try {
    if (signal?.aborted) {return { ...skipped, status: "cancelled" };}
    const work = (async (): Promise<ComponentReviewResult> => {
      const status = await api.componentReuse({ command: "status" });
      if (ended) {return { ...skipped, status: "timeout" };}
      if (!(status && typeof status === "object" && "available" in status && status.available === true)) {return { ...skipped, status: "unavailable" };}
      const catalogue = componentDocuments(studio);
      rememberCoverage(studio, await api.componentReuse({ command: "sync", projectId: studio.siteInfo.id, ...catalogue, ...(retry ? { retry: true } : {}) }));
      if (ended) {return { ...skipped, status: "timeout" };}
      const result = componentReviewResultSchema.parse(await api.componentReuse({ command: "review", projectId: studio.siteInfo.id, id, regions }));
      rememberCoverage(studio, result);
      if (ended || signal?.aborted) {return { ...skipped, status: "cancelled", elapsedMs: performance.now() - started };}
      if (studio._changeCounter !== counter || JSON.stringify(componentDocuments(studio)) !== JSON.stringify(catalogue)) {return { ...result, status: "partial", issues: ["catalogue-changed"], suggestions: [], skippedRegions, retry: retryCall(0) };}
      const suggestions = result.suggestions.flatMap(suggestion => {
        const key = suggestion.componentUuid + ":" + suggestion.elementUuid;
        assert(snapshots.has(key), "Unexpected component advisory target");
        // A delete-and-insert edit has no replacement identity. Repeating the
        // same candidate in this definition must still not restart the advice loop.
        const fresh = new Set(suggestion.candidates.filter(candidate => !offered.has(suggestion.componentUuid + ":" + candidate.componentUuid)).map(candidate => candidate.componentUuid));
        // Retain dependencies even when their own advisory was offered before.
        for (let i = 0; i < suggestion.candidates.length; i++) {
          for (const candidate of suggestion.candidates) {
            if (candidate.requiredBy?.some(uuid => fresh.has(uuid))) { fresh.add(candidate.componentUuid); }
          }
        }
        const candidates = suggestion.candidates.filter(candidate => fresh.has(candidate.componentUuid));
        return candidates.length ? [{ ...suggestion, candidates }] : [];
      });
      const response: ComponentReviewResult = { ...result, suggestions, ...(truncated ? { status: "partial" as const, issues: [...(result.issues ?? []), "regions-truncated" as const] } : {}),
        ...(result.status === "indexing" || result.status === "timeout" || result.issues?.some(issue => ["embedding-failed", "catalogue-changed"].includes(issue)) ? { retry: retryCall(result.status === "indexing" || result.status === "timeout" ? 1000 : 0) } : {}), skippedRegions, elapsedMs: performance.now() - started };
      // Recovery metadata shares the wire budget with suggestions. Drop entire
      // compositions so truncation cannot strand a child without its parent.
      while (new TextEncoder().encode(JSON.stringify(response)).length > 6144 && response.suggestions.length) {
        response.suggestions.pop(); if (response.status === "completed") { response.status = "partial"; }
        response.issues = [...new Set([...(response.issues ?? []), "output-truncated" as const])];
      }
      if (response.status === "completed") {
        for (const suggestion of response.suggestions) {
          sent.add(suggestion.componentUuid + ":" + suggestion.elementUuid);
          for (const candidate of suggestion.candidates) { offered.add(suggestion.componentUuid + ":" + candidate.componentUuid); }
        }
      }
      return response;
    })();
    return await Promise.race([work, timeout]);
  } catch { return { ...skipped, status: signal?.aborted ? "cancelled" : "unavailable", elapsedMs: performance.now() - started }; }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}

/** Explicit recovery uses the current model and never performs a design mutation. */
export function reviewComponentReuse(studio: StudioCtx, input: { targets: { componentUuid: string; elementUuid: string }[]; reviewContext: ComponentReviewContext }, callerId?: string, signal?: AbortSignal) {
  return reviewComponents(studio, input.targets.map(target => ({ name: "reviewComponentReuse", input: target })), [], input.reviewContext, callerId, signal, true);
}
