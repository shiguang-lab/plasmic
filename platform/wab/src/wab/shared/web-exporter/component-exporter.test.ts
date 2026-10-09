import { mkStyleToken } from "@/wab/commons/StyleToken";
import {
  ensureVariantSetting,
  getBaseVariant,
  mkVariant,
} from "@/wab/shared/Variants";
import { generateSiteFromBundle } from "@/wab/shared/__testonly__/site-tests-utils";
import { Bundle } from "@/wab/shared/bundler";
import { ensure } from "@/wab/shared/common";
import {
  codeToDynExpr,
  interpolatedStringToTemplatedString,
  objectLiteralToExpr,
} from "@/wab/shared/copilot/dynamic-value-input";
import { mkServerQuery, mkCustomFunctionExpr } from "@/wab/shared/codegen/react-p/server-queries/__testonly__/test-utils";
import { mkDataSourceOpExpr, mkDataSourceTemplate } from "@/wab/shared/data-sources-meta/data-sources";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit, customCode } from "@/wab/shared/core/exprs";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset } from "@/wab/shared/core/image-assets";
import { mkParam, mkVar } from "@/wab/shared/core/lang";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { TplTagType, mkTplComponentX, mkTplTagX } from "@/wab/shared/core/tpls";
import {
  CodeComponentMeta,
  ComponentDataQuery,
  ExprText,
  ImageAssetRef,
  NodeMarker,
  ObjectPath,
  RawText,
  Rep,
  StyleMarker,
  StyleTokenRef,
  TplComponent,
  TplTag,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { TplVisibility, setTplVisibility } from "@/wab/shared/visibility-utils";
import _bundle from "@/wab/shared/web-exporter/bundles/starter-project-desktop-first.json";
import {
  buildComponentResource,
  tplToHtml,
} from "@/wab/shared/web-exporter/component-exporter";
import { jsonToXml } from "@/wab/shared/web-exporter/json-to-xml";
import {
  componentSchema,
} from "@/wab/shared/web-exporter/schema";

describe("Component Serialization", () => {
  const site = generateSiteFromBundle(_bundle as [string, Bundle][]);

  it("serializes all components", () => {
    const output: Record<string, unknown> = {};
    const xmlOutput: Record<string, string> = {};
    for (const component of site.components) {
      const resource = buildComponentResource(component, { site });
      output[component.name] = resource;
      xmlOutput[component.name] = jsonToXml(resource, true);
    }
    expect(xmlOutput).toMatchSnapshot();
    expect(output).toMatchSnapshot();
  });

  it("exposes registered usage guidance without changing prop contracts", () => {
    const component = mkComponent({
      name: "Descriptions",
      type: ComponentType.Code,
      tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, attrs: {} }),
      params: [mkParam({ paramType: "prop", name: "items", type: typeFactory.any(), description: "Separate labels from values", defaultExpr: codeLit([]) })],
      codeComponentMeta: new CodeComponentMeta({
        importPath: "antd", defaultExport: false, importName: "Descriptions",
        displayName: "Descriptions", description: "Grouped read-only fields",
        section: null, thumbnailUrl: null, classNameProp: null, refProp: null,
        defaultStyles: null, defaultDisplay: null, isHostLess: true,
        isContext: false, isAttachment: false, providesData: false,
        hasRef: false, isRepeatable: true, subtreePrefetchingConfig: null,
        styleSections: null, helpers: null, defaultSlotContents: {},
        variants: {}, refActions: [],
      }),
    });
    const result = buildComponentResource(component, { site });
    expect(componentSchema().parse(result)).toMatchObject({
      description: "Grouped read-only fields",
      codeComponent: { importPath: "antd", importName: "Descriptions", defaultExport: false },
      props: [{ name: "items", description: "Separate labels from values", type: "any", default: [] }],
    });
    ensure(component.codeComponentMeta, "Expected registered component metadata").description = null;
    component.params[0].description = null;
    const withoutGuidance = buildComponentResource(component, { site });
    expect(withoutGuidance).not.toHaveProperty("description");
    expect(withoutGuidance.props?.[0]).not.toHaveProperty("description");
  });

  it("serializes variant attr overrides without overwriting tpl ids", () => {
    const component = mkComponent({
      name: "VariantAttrs",
      type: ComponentType.Plain,
      tplTree: (baseVariant) =>
        mkTplTagX("button", { baseVariant, attrs: { title: "Base" } }),
    });
    const tpl = component.tplTree as TplTag;
    const hover = mkVariant({
      name: "hover",
      selectors: [":hover"],
      forTpl: tpl,
    });
    component.variants.push(hover);

    const vs = ensureVariantSetting(tpl, [hover]);
    vs.attrs["aria-label"] = codeLit("Hover label");
    vs.attrs.id = codeLit("html-id");

    const result = buildComponentResource(component, { site });
    // Base tree keeps the tpl's own id and base attr.
    expect(result.baseVariantTplTree).toContain(
      `<button id="${tpl.uuid}" title="Base">`,
    );
    // The hover variant's attr override is captured; the reserved `id` attr is
    // not applied (so the tpl's id is never overwritten).
    expect(result.variantSettings).toMatchObject([
      { elements: [{ attrs: { "aria-label": "Hover label" } }] },
    ]);
    expect(JSON.stringify(result)).not.toContain("html-id");
  });

  it("serializes variant visibility overrides as data-visibility attrs", () => {
    const component = mkComponent({
      name: "VariantVisibility",
      type: ComponentType.Plain,
      tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
    });
    const tpl = component.tplTree as TplTag;
    const hover = mkVariant({
      name: "hover",
      selectors: [":hover"],
      forTpl: tpl,
    });
    component.variants.push(hover);

    // Hidden in the base variant, explicitly revealed by the variant.
    setTplVisibility(
      tpl,
      [getBaseVariant(component)],
      TplVisibility.DisplayNone,
    );
    setTplVisibility(tpl, [hover], TplVisibility.Visible);

    const result = buildComponentResource(component, { site });
    expect(result.baseVariantTplTree).toContain(
      `data-visibility="displayNone"`,
    );
    expect(result.variantSettings).toMatchObject([
      { elements: [{ attrs: { "data-visibility": "visible" } }] },
    ]);
  });

  it("serializes rich text markers as nested inline HTML", () => {
    const component = mkComponent({
      name: "RichText",
      type: ComponentType.Plain,
      tplTree: (baseVariant) =>
        mkTplTagX("p", { baseVariant, type: TplTagType.Text }),
    });
    const tpl = component.tplTree as TplTag;
    const baseVariant = getBaseVariant(component);
    const link = mkTplTagX("a", {
      baseVariant,
      type: TplTagType.Text,
      attrs: { href: "/pricing" },
    });
    ensureVariantSetting(link, [baseVariant]).text = new RawText({
      text: "pricing",
      markers: [],
    });
    link.parent = tpl;
    tpl.children = [link];
    const vs = ensureVariantSetting(tpl, [baseVariant]);
    vs.text = new RawText({
      text: "See our [child] for bold details",
      markers: [
        new NodeMarker({ position: 8, length: 7, tpl: link }),
        new StyleMarker({
          position: 20,
          length: 4,
          rs: mkRuleSet({ values: { "font-weight": "700" } }),
        }),
      ],
    });

    const output = tplToHtml(tpl, site);
    expect(output).toEqual(
      `<p id="${tpl.uuid}">See our <a id="${link.uuid}" href="/pricing">pricing</a> for <span style="font-weight: 700">bold</span> details</p>`,
    );
  });

  describe("dynamic values", () => {
    it("serializes dynamic text (ExprText) as a {{ }} interpolation", () => {
      const component = mkComponent({
        name: "DynamicText",
        type: ComponentType.Plain,
        tplTree: (baseVariant) =>
          mkTplTagX("h1", { baseVariant, type: TplTagType.Text }),
      });
      const tpl = component.tplTree as TplTag;
      const vs = ensureVariantSetting(tpl, [getBaseVariant(component)]);
      vs.text = new ExprText({
        expr: interpolatedStringToTemplatedString(
          "Posts in {{ $ctx.params.category }}",
        ),
        html: false,
      });

      const output = tplToHtml(tpl, site);
      expect(output).toContain("Posts in {{ $ctx.params.category }}");
    });

    it("serializes a dynamic attribute as a {{ }} interpolation", () => {
      const component = mkComponent({
        name: "DynamicAttr",
        type: ComponentType.Plain,
        tplTree: (baseVariant) => mkTplTagX("a", { baseVariant }),
      });
      const tpl = component.tplTree as TplTag;
      const vs = ensureVariantSetting(tpl, [getBaseVariant(component)]);
      vs.attrs.href = codeToDynExpr("currentItem.url");

      const output = tplToHtml(tpl, site);
      expect(output).toContain(`href="{{ currentItem.url }}"`);
    });

    it("serializes repetition as data-repeat attributes", () => {
      const component = mkComponent({
        name: "Repeater",
        type: ComponentType.Plain,
        tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
      });
      const tpl = component.tplTree as TplTag;
      const vs = ensureVariantSetting(tpl, [getBaseVariant(component)]);
      vs.dataRep = new Rep({
        collection: codeToDynExpr("$q.pokedex.data") as ObjectPath,
        element: mkVar("currentItem"),
        index: mkVar("currentIndex"),
      });

      const output = tplToHtml(tpl, site);
      expect(output).toContain(`data-repeat="{{ $q.pokedex.data }}"`);
      expect(output).toContain(`data-repeat-item="currentItem"`);
      expect(output).toContain(`data-repeat-index="currentIndex"`);
    });

    it("serializes a dynamic visibility condition as data-visible-if", () => {
      const component = mkComponent({
        name: "ConditionalVisible",
        type: ComponentType.Plain,
        tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
      });
      const tpl = component.tplTree as TplTag;
      const combo = [getBaseVariant(component)];
      const vs = ensureVariantSetting(tpl, combo);
      setTplVisibility(tpl, combo, TplVisibility.CustomExpr);
      vs.dataCond = customCode("$q.users.data.length");

      const output = tplToHtml(tpl, site);
      expect(output).toContain(`data-visible-if="{{ $q.users.data.length }}"`);
    });

    it("serializes static displayNone as data-visibility", () => {
      const component = mkComponent({
        name: "HiddenBox",
        type: ComponentType.Plain,
        tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
      });
      const tpl = component.tplTree as TplTag;
      const combo = [getBaseVariant(component)];
      ensureVariantSetting(tpl, combo);
      setTplVisibility(tpl, combo, TplVisibility.DisplayNone);

      const output = tplToHtml(tpl, site);
      expect(output).toContain(`data-visibility="displayNone"`);
    });

    it("serializes a dynamic component prop into data-props as {{ }}", () => {
      const inner = mkComponent({
        name: "Card",
        type: ComponentType.Plain,
        tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
      });
      const labelParam = mkParam({
        name: "label",
        type: typeFactory.text(),
        paramType: "prop",
      });
      inner.params.push(labelParam);

      const host = mkComponent({
        name: "Host",
        type: ComponentType.Plain,
        tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
      });
      const instance = mkTplComponentX({
        component: inner,
        baseVariant: getBaseVariant(host),
        args: {
          [labelParam.variable.name]: codeToDynExpr("currentItem.name"),
        },
      }) as TplComponent;

      const output = tplToHtml(instance, site);
      expect(output).toContain(`data-props=`);
      expect(output).toContain(`{{ currentItem.name }}`);
    });

    it("preserves nested dynamic rules and initial values in editable prop readbacks", () => {
      const inner = mkComponent({name: "Form", type: ComponentType.Plain, tplTree: baseVariant => mkTplTagX("div", {baseVariant})});
      const param = mkParam({name: "initialValues", type: typeFactory.any(), paramType: "prop"});
      inner.params.push(param);
      const host = mkComponent({name: "Host", type: ComponentType.Plain, tplTree: baseVariant => mkTplTagX("div", {baseVariant})});
      const instance = mkTplComponentX({component: inner, baseVariant: getBaseVariant(host), args: {initialValues: objectLiteralToExpr(JSON.stringify({expiry: "{{ Number($ctx.query?.expiry||14) }}", rules: [{ruleType: "advanced", custom: "{{ (_rule,value)=>Number.isInteger(value) }}"}]}))!}});
      const output = tplToHtml(instance, site);
      expect(output).toContain("initialValues");
      expect(output).toContain("{{ Number($ctx.query?.expiry||14) }}");
      expect(output).toContain("advanced");
      expect(output).toContain("Number.isInteger(value)");
    });

    it("serializes prop defaults referencing project resources", () => {
      const component = mkComponent({
        name: "Badge",
        type: ComponentType.Plain,
        tplTree: (baseVariant) =>
          mkTplTagX("div", { baseVariant, attrs: { title: "Badge" } }),
      });
      const asset = mkImageAsset({
        name: "logo",
        type: ImageAssetType.Picture,
      });
      const token = mkStyleToken({
        name: "Primary",
        type: "Color",
        value: "#000000",
      });
      component.params.push(
        mkParam({
          name: "icon",
          type: typeFactory.img(),
          paramType: "prop",
          defaultExpr: new ImageAssetRef({ asset }),
        }),
        mkParam({
          name: "tint",
          type: typeFactory.color(),
          paramType: "prop",
          defaultExpr: new StyleTokenRef({ token }),
        }),
      );

      const resource = buildComponentResource(component, { site });
      expect(resource.props).toMatchObject([
        {
          name: "icon",
          default: {
            __type: "ImageAssetRef",
            uuid: asset.uuid,
            name: "logo",
          },
        },
        {
          name: "tint",
          default: {
            __type: "StyleTokenRef",
            uuid: token.uuid,
            name: "Primary",
          },
        },
      ]);
    });
  });

  describe("data queries", () => {
    it("reads real modern and legacy definitions, bindings and registration identity without mutating the model", () => {
      const component = mkComponent({
        name: "WithQueries", type: ComponentType.Plain,
        tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, attrs: {} }),
      });
      const functionOp = mkCustomFunctionExpr("fetch", ["url"], [{ name: "url", code: "$ctx.params.api" }]);
      functionOp.func.namespace = "plasmic";
      component.serverQueries.push(
        mkServerQuery("Users", customCode("(await $$.fetch('/api/users'))")),
        mkServerQuery("People", functionOp),
        mkServerQuery("Unconfigured", null),
      );
      component.dataQueries.push(new ComponentDataQuery({
        uuid: "dq1", name: "Get Users",
        op: mkDataSourceOpExpr({ sourceId: "src1", opId: "op1", opName: "getList", roleId: "role1", templates: {
          resource: mkDataSourceTemplate({ fieldType: "string", value: "users", bindings: null }),
          filter: mkDataSourceTemplate({ fieldType: "string", value: "__binding__", bindings: { __binding__: customCode("$state.filter") } }),
        } }),
      }));
      const originalOps = [...component.serverQueries.map((query) => query.op), component.dataQueries[0].op];
      const result = componentSchema().parse(buildComponentResource(component, { site }));
      expect(result.dataQueries).toMatchObject([
        { name: "Users", reference: "$q.users", kind: "customCode", code: "((await $$.fetch('/api/users')))" },
        { name: "People", reference: "$q.people", kind: "function", functionId: "plasmic.fetch", args: [{ name: "url", value: "{{ $ctx.params.api }}" }] },
        { name: "Unconfigured", kind: "empty" },
      ]);
      expect(result.legacyDataQueries).toMatchObject([{ name: "Get Users", reference: "$queries.getUsers", migratable: false,
        op: { sourceId: "src1", roleId: "role1", args: [{ name: "resource", value: "users" }, { name: "filter", value: "{{ ($state.filter) }}" }] },
      }]);
      expect(result.legacyDataQueries?.[0].migrationBlockers).toHaveLength(1);
      expect(result.legacyDataQueries?.[0].op).not.toHaveProperty("baseUrl");
      expect([...component.serverQueries.map((query) => query.op), component.dataQueries[0].op]).toEqual(originalOps);
      const xml = jsonToXml(result, true);
      expect(xml).toContain('reference="$q.users"');
      expect(xml).toContain('reference="$queries.getUsers"');
    });

    it("omits definitions for query-free components", () => {
      const component = mkComponent({ name: "NoQueries", type: ComponentType.Plain, tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, attrs: {} }) });
      const result = buildComponentResource(component, { site });
      expect(result.dataQueries).toBeUndefined();
      expect(result.legacyDataQueries).toBeUndefined();
      expect(result.codeComponent).toBeUndefined();
    });
    it("reports function arguments that cannot be represented instead of silently treating them as empty", () => {
      const component = mkComponent({ name: "AssetQuery", type: ComponentType.Plain, tplTree: (baseVariant) => mkTplTagX("div", { baseVariant, attrs: {} }) });
      const op = mkCustomFunctionExpr("load", ["asset"], [{ name: "asset", code: "null" }]);
      op.args[0].expr = new ImageAssetRef({ asset: mkImageAsset({ name: "logo", type: ImageAssetType.Picture }) });
      component.serverQueries.push(mkServerQuery("Asset", op));
      expect(buildComponentResource(component, { site }).dataQueries).toMatchObject([{ kind: "function", args: [], unavailableArgs: ["asset"] }]);
    });
  });
});
