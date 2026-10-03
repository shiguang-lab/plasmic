import { createComponent } from "@/wab/client/operations/create-component";
import { createComponentState } from "@/wab/client/operations/create-component-state";
import { createInteraction } from "@/wab/client/operations/create-interaction";
import { createStyleToken } from "@/wab/client/operations/create-style-token";
import { deleteTpl } from "@/wab/client/operations/delete-tpl";
import { htmlToTpl } from "@/wab/client/operations/html-to-tpl";
import { pasteTpls } from "@/wab/client/operations/insert-tpl";
import { setComponentInstanceProp } from "@/wab/client/operations/set-component-instance-prop";
import { setTplStyles } from "@/wab/client/operations/set-tpl-styles";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { formatWIError } from "@/wab/client/web-importer/errors";
import { getComponentArenaBaseFrame } from "@/wab/shared/component-arenas";
import {
  GlobalVariantFrame,
  RootComponentVariantFrame,
} from "@/wab/shared/component-frame";
import { assert, ensure } from "@/wab/shared/common";
import {
  CopilotTool,
  defineCopilotTool,
} from "@/wab/shared/copilot/copilot-tool-types";
import { PROTOTYPE_TOOL_META as meta } from "@/wab/shared/copilot/prototype-tools";
import {
  allComponentVariants,
  ComponentType,
  isCodeComponent,
  isPageComponent,
} from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import {
  allGlobalVariants,
  getComponentArena,
  getPageArena,
} from "@/wab/shared/core/sites";
import { flattenTpls } from "@/wab/shared/core/tpls";
import {
  Component,
  isKnownTplComponent,
  TplNode,
} from "@/wab/shared/model/classes";
import {
  assertSiteInvariants,
  genSiteErrors,
} from "@/wab/shared/site-invariants";
import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { getBaseVariant } from "@/wab/shared/Variants";
import {
  buildComponentResource,
  buildElementResource,
} from "@/wab/shared/web-exporter/component-exporter";
import {
  buildProjectResource,
  buildTokenResource,
} from "@/wab/shared/web-exporter/project-exporter";
import { outputResult } from "@/wab/shared/web-exporter/schema";
import { ok } from "neverthrow";
import { ensureOk } from "@/wab/commons/neverthrow-utils";

function findComponent(studio: StudioCtx, uuid: string, local = false) {
  const components = local
    ? studio.site.components
    : [
        ...studio.site.components,
        ...studio.site.projectDependencies.flatMap(
          (dep) => dep.site.components,
        ),
      ];
  const component = ensure(
    components.find((c) => c.uuid === uuid),
    `Component ${uuid} not found${local ? " in this project" : ""}`,
  );
  if (local) {
    assert(
      !isCodeComponent(component),
      "Registered code components cannot be edited; modify an instance instead.",
    );
  }
  return component;
}

function findElement(component: Component, uuid: string): TplNode {
  return ensure(
    flattenTpls(component.tplTree).find((t) => t.uuid === uuid),
    `Element ${uuid} not found in component ${component.name}`,
  );
}

function variantManager(studio: StudioCtx, component: Component) {
  const arena = ensure(
    isPageComponent(component)
      ? getPageArena(studio.site, component)
      : getComponentArena(studio.site, component),
    "Component arena not found",
  );
  const frame = getComponentArenaBaseFrame(arena);
  return new VariantTplMgr(
    [new RootComponentVariantFrame(frame)],
    studio.site,
    studio.tplMgr(),
    new GlobalVariantFrame(studio.site, frame),
  );
}

/** All writes go through the same permission and recorder path as human edits. */
export function assertCanEditPrototype(studio: StudioCtx) {
  assert(
    studio.canEditProject() &&
      studio.editMode &&
      studio.isAtTip &&
      !studio.blockChanges,
    "Project is read-only, blocked, or not at its latest revision. Open an editable current revision.",
  );
  assert(
    !studio.siteInfo.isMainBranchProtected || !!studio.dbCtx().branchInfo?.id,
    "The main branch is protected. Open an editable branch.",
  );
}

async function change<T>(
  studio: StudioCtx,
  components: Component[],
  fn: () => T,
): Promise<T> {
  assertCanEditPrototype(studio);
  return ensureOk(
    await studio.changeObserved(
      () => components,
      () => {
        assertCanEditPrototype(studio);
        // Studio validates invariants after observing newly attached model nodes.
        return ok(fn());
      },
    ),
  );
}

function componentResult(
  studio: StudioCtx,
  component: Component,
  messages?: string[],
) {
  return outputResult(
    [buildComponentResource(component, { site: studio.site })],
    messages,
  );
}

export const COPILOT_TOOLS: Record<string, CopilotTool<any>> = {
  identify: defineCopilotTool(meta.identify, async (studio, input) => {
    studio.setPreferredAiOutputFormat(input.outputFormat);
    return {
      ...input,
      projectId: studio.siteInfo.id,
      projectName: studio.siteInfo.name,
      canEdit:
        studio.canEditProject() &&
        studio.editMode &&
        studio.isAtTip &&
        !studio.blockChanges &&
        (!studio.siteInfo.isMainBranchProtected ||
          !!studio.dbCtx().branchInfo?.id),
    };
  }),
  read: defineCopilotTool(meta.read, async (studio, input) => {
    if (!input.componentUuids?.length && !input.elements?.length) {
      return outputResult([
        buildProjectResource(studio.site, undefined, {
          projectId: studio.siteInfo.id,
          components: true,
          tokens: true,
          screenBreakpoints: true,
          globalVariants: true,
        }),
      ]);
    }
    return outputResult([
      ...(input.componentUuids ?? []).map((uuid) =>
        buildComponentResource(findComponent(studio, uuid), {
          site: studio.site,
        }),
      ),
      ...(input.elements ?? []).map(({ componentUuid, elementUuid }) =>
        buildElementResource(
          findElement(findComponent(studio, componentUuid), elementUuid),
          { site: studio.site },
        ),
      ),
    ]);
  }),
  createComponent: defineCopilotTool(
    meta.createComponent,
    async (studio, input) => {
      const component = await change(studio, [], () => {
        assert(
          !studio.site.components.some((c) => c.name === input.name),
          `Component name "${input.name}" already exists`,
        );
        assert(
          input.type === "page" || !input.path,
          "Only pages can have a path",
        );
        if (input.path) {
          assert(
            !studio.site.components.some(
              (c) => c.pageMeta?.path === input.path,
            ),
            `Page path "${input.path}" already exists`,
          );
        }
        return ensureOk(
          createComponent({
            tplMgr: studio.tplMgr(),
            name: input.name,
            type:
              input.type === "page" ? ComponentType.Page : ComponentType.Plain,
            ...(input.path ? { pageMeta: { path: input.path } } : {}),
          }),
        );
      });
      return componentResult(studio, component);
    },
  ),
  insertHtml: defineCopilotTool(meta.insertHtml, async (studio, input) => {
    assertCanEditPrototype(studio);
    const component = findComponent(studio, input.componentUuid, true);
    assert(
      input.location !== "replace" || !!input.elementUuid,
      "Replacement requires an explicit elementUuid",
    );
    const target = input.elementUuid
      ? findElement(component, input.elementUuid)
      : component.tplTree;
    const vtm = variantManager(studio, component);
    const parsed = ensureOk(
      await htmlToTpl(input.html, {
        site: studio.site,
        vtm,
        appCtx: studio.appCtx,
        pageHrefs: true,
      }),
    );
    assert(
      parsed.errors.length === 0,
      parsed.errors.map(formatWIError).join("; "),
    );
    await change(studio, [component], () => {
      // Recheck the target after async HTML/image processing.
      assert(
        findElement(component, target.uuid) === target,
        "Target changed while HTML was being prepared",
      );
      const errors = parsed.finalize({
        component,
        tplMgr: studio.tplMgr(),
        ccRegistry: studio.codeComponentsRegistry,
      });
      assert(errors.length === 0, errors.map(formatWIError).join("; "));
      const result = pasteTpls(parsed.tpls, target, input.location, {
        site: studio.site,
        component,
        vtm,
        tplMgr: studio.tplMgr(),
        ccRegistry: studio.codeComponentsRegistry,
      });
      assert(
        result.errors.length === 0 &&
          result.pasted.length === parsed.tpls.length,
        `Insertion rejected: ${JSON.stringify(result.errors.map((e) => e.type))}`,
      );
    });
    return componentResult(studio, component);
  }),
  changeElement: defineCopilotTool(
    meta.changeElement,
    async (studio, input) => {
      assert(input.props || input.styles, "Provide props or styles");
      const component = findComponent(studio, input.componentUuid, true);
      const tpl = findElement(component, input.elementUuid);
      const vtm = variantManager(studio, component);
      const variants = (input.variantUuids ?? []).map((uuid) =>
        ensure(
          [
            ...allComponentVariants(component),
            ...allGlobalVariants(studio.site, { includeDeps: "direct" }),
          ].find((v) => v.uuid === uuid),
          `Variant ${uuid} not found`,
        ),
      );
      const combo = variants.length ? variants : [getBaseVariant(component)];
      const messages: string[] = [];
      await change(studio, [component], () => {
        if (input.props) {
          assert(
            isKnownTplComponent(tpl),
            "props requires a component instance; use insertHtml to replace native text/markup",
          );
          const vs = vtm.ensureVariantSetting(tpl, combo);
          for (const [name, value] of Object.entries(input.props)) {
            ensureOk(
              setComponentInstanceProp(tpl, name, value, {
                vs,
                tplMgr: studio.tplMgr(),
              }),
            );
          }
        }
        if (input.styles) {
          messages.push(
            ...ensureOk(
              setTplStyles(tpl, input.styles, {
                studioCtx: studio,
                vtm,
                variantCombo: combo,
              }),
            ),
          );
        }
      });
      return componentResult(studio, component, messages);
    },
  ),
  deleteElement: defineCopilotTool(
    meta.deleteElement,
    async (studio, input) => {
      const component = findComponent(studio, input.componentUuid, true);
      const tpl = findElement(component, input.elementUuid);
      await change(studio, [component], () =>
        ensureOk(
          deleteTpl([tpl], {
            component,
            site: studio.site,
            vtm: variantManager(studio, component),
          }),
        ),
      );
      return componentResult(studio, component);
    },
  ),
  createState: defineCopilotTool(meta.createState, async (studio, input) => {
    const component = findComponent(studio, input.componentUuid, true);
    await change(studio, [component], () =>
      ensureOk(
        createComponentState({
          site: studio.site,
          component,
          tplMgr: studio.tplMgr(),
          name: input.name,
          variableType: input.variableType,
          ...(input.initialValue !== undefined
            ? { initialValue: codeLit(input.initialValue) }
            : {}),
        }),
      ),
    );
    return componentResult(studio, component);
  }),
  createInteraction: defineCopilotTool(
    meta.createInteraction,
    async (studio, input) => {
      const component = findComponent(studio, input.componentUuid, true);
      const tpl = findElement(component, input.elementUuid);
      await change(studio, [component], () =>
        ensureOk(
          createInteraction({
            component,
            tpl,
            eventName: input.eventName,
            action: input.action,
            name: input.name,
          }),
        ),
      );
      return componentResult(studio, component);
    },
  ),
  createStyleToken: defineCopilotTool(
    meta.createStyleToken,
    async (studio, input) => {
      const token = await change(studio, [], () =>
        ensureOk(createStyleToken({ tplMgr: studio.tplMgr(), ...input })),
      );
      return outputResult([buildTokenResource(token, { site: studio.site })]);
    },
  ),
  navigate: defineCopilotTool(meta.navigate, async (studio, input) => {
    const component = findComponent(studio, input.componentUuid, true);
    studio.switchToComponentArena(component);
    return componentResult(studio, component);
  }),
  validate: defineCopilotTool(meta.validate, async (studio, input) => {
    const components = input.componentUuids
      ? input.componentUuids.map((uuid) => findComponent(studio, uuid, true))
      : studio.site.components.filter((c) => !isCodeComponent(c));
    const instances = components
      .flatMap((c) => flattenTpls(c.tplTree).filter(isKnownTplComponent))
      .filter((t) => isCodeComponent(t.component));
    const errors = [...genSiteErrors(studio.site)].map((e) => e.message);
    const antDesign6Instances = instances.filter((t) =>
      t.component.name.startsWith("plasmic-antd6-"),
    ).length;
    const warnings: string[] = [];
    if (!antDesign6Instances) {
      warnings.push(
        "No Ant Design 6 instances found in the selected prototype.",
      );
    }
    for (const component of components) {
      if (flattenTpls(component.tplTree).length === 1) {
        warnings.push(`Component "${component.name}" has no child elements.`);
      }
    }
    return {
      valid: !errors.length,
      errors,
      warnings,
      pages: components.filter(isPageComponent).length,
      components: components.length,
      codeComponentInstances: instances.length,
      antDesign6Instances,
    };
  }),
  save: defineCopilotTool(meta.save, async (studio) => {
    assertCanEditPrototype(studio);
    assertSiteInvariants(studio.site);
    const result = await studio.save();
    assert(
      !studio.hasUnsavedChanges(),
      `Save did not persist all changes (${String(result)}); retry or resolve the editor's save error`,
    );
    return {
      projectId: studio.siteInfo.id,
      revision: studio.dbCtx().revisionNum,
      saved: true as const,
    };
  }),
  undo: defineCopilotTool(meta.undo, async (studio) => {
    assertCanEditPrototype(studio);
    const undone = studio.canUndo();
    if (undone) {
      await studio.undo();
    }
    return { undone };
  }),
};
