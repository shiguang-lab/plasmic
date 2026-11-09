import { showError } from "@/wab/client/ErrorNotifications";
import { elementSchemaToTplAndLogErrors } from "@/wab/client/code-components/code-components";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { HOSTLESS_PKGS_KEY } from "@/wab/client/studio-ctx/hostless-pkgs-state";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { modelKeys } from "@/wab/shared/model-revisions";
import { withoutNils } from "@/wab/shared/common";
import {
  CodeComponent,
  getComponentDisplayName,
} from "@/wab/shared/core/components";
import { TplComponent } from "@/wab/shared/model/classes";
import { CodeComponentElement } from "@plasmicapp/host/dist/element-types";
import { notification } from "antd";

export interface Preset {
  name: string;
  tpl: TplComponent;
  screenshot?: string;
}

/**
 * Component templates registered by a code component, converted to tpl.
 *
 * Replaces a MobX `computedFn`. The result depends on the component, the site
 * (template → tpl conversion) and the installed hostless packages (which supply
 * the registration meta), so it is cached per component and invalidated by those
 * two revisions. Render sites must use `useComponentPresets`, which subscribes to
 * the same keys.
 */
const presetsCache = new WeakMap<
  StudioCtx,
  WeakMap<CodeComponent, { site: StudioCtx["site"]; signature: string; value: Preset[] }>
>();

function presetsSignature(studio: StudioCtx): string {
  return `${studio.modelRevisions.getModelRevision(modelKeys.site)}:${studio.modelRevisions.getModelRevision(HOSTLESS_PKGS_KEY)}:${studio.getCodeRegistrationRevision()}`;
}

export function getComponentPresets(
  studioCtx: StudioCtx,
  component: CodeComponent,
): Preset[] {
  const signature = presetsSignature(studioCtx);
  let cache = presetsCache.get(studioCtx);
  if (!cache) { cache = new WeakMap(); presetsCache.set(studioCtx, cache); }
  const cached = cache.get(component);
  if (cached && cached.site === studioCtx.site && cached.signature === signature) {
    return cached.value;
  }
  const value = computeComponentPresets(studioCtx, component);
  cache.set(component, { site: studioCtx.site, signature, value });
  return value;
}

function computeComponentPresets(
  studioCtx: StudioCtx,
  component: CodeComponent,
): Preset[] {
  const meta = studioCtx.getCodeComponentMeta(component);
  const schemas = meta?.templates ?? {};
  return withoutNils(
    [...Object.entries(schemas)].map(([name, template]): Preset | undefined => {
      if (typeof template !== "object") {
        notification.error({
          message: translate(
            getUiLocale(),
            "Type error while registering code templates",
          ),
          description: translate(
            getUiLocale(),
            "Component {part1} has template {part2} of unexpected type {part3}",
            {
              part1: String(getComponentDisplayName(component)),
              part2: String(name),
              part3: String(typeof template),
            },
          ),
        });
        return undefined;
      }
      const schema: CodeComponentElement<{}> = {
        type: "component",
        name: component.name,
        ...template,
      };
      const maybeTpl = elementSchemaToTplAndLogErrors(
        studioCtx.site,
        undefined,
        schema,
      );
      if (maybeTpl.isErr()) {
        showError(maybeTpl.error, { title: translate(getUiLocale(), "Component registration failed") });
        return undefined;
      }
      const tpl = maybeTpl.value as TplComponent;
      return {
        name,
        screenshot: template.previewImg,
        tpl,
      };
    }),
  );
}
