import { ProjectId } from "@/wab/shared/ApiSchema";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { componentsReferencingDataToken } from "@/wab/shared/cached-selectors";
import { makeShortProjectId, toVarName } from "@/wab/shared/codegen/util";
import { ensure, mkShortId } from "@/wab/shared/common";
import { isFrameComponent } from "@/wab/shared/core/components";
import { customCode, stripParens } from "@/wab/shared/core/exprs";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { GeneralUsageSummary } from "@/wab/shared/core/sites";
import { FinalToken, MutableToken, toFinalToken } from "@/wab/shared/core/tokens";
import { tryEvalExpr } from "@/wab/shared/eval";
import { makeDataTokenIdentifier } from "@/wab/shared/eval/expression-parser";
import { DataToken, Site } from "@/wab/shared/model/classes";
import { mkMetaName } from "@plasmicapp/host";
import { upperFirst } from "lodash";
import type { Opaque } from "type-fest";

export const dataTokenTypes = ["string", "number", "code"] as const;
export type DataTokenType = (typeof dataTokenTypes)[number];
export type DataTokenValue = Opaque<string, "DataTokenValue">;

export interface DataTokenRef {
  token: DataToken;
  projectId: ProjectId;
}

/**
 * Determine the type of a data token based on its value
 */
export function getDataTokenType(value: string): DataTokenType {
  try {
    const parsed = JSON.parse(value);
    const type = typeof parsed;
    if (type === "string" || type === "number") {
      return type;
    }
    // Objects, arrays, null (valid JSON) are also considered code expressions
    return "code";
  } catch (e) {
    // Invalid JSON means it's a code expression (e.g. `a + b`)
    return "code";
  }
}

export const dataTypes: Record<
  DataTokenType,
  { label: string; defaultValue: any; defaultSerializedValue: string }
> = {
  string: {
    label: "Text",
    defaultValue: "",
    defaultSerializedValue: '""',
  },
  number: {
    label: "Number",
    defaultValue: 0,
    defaultSerializedValue: "0",
  },
  code: {
    label: "Code Expression",
    defaultValue: undefined,
    defaultSerializedValue: "(undefined)",
  },
};

/**
 * Sort data token categories in canonical order (string, number, any)
 * Uses the key order from dataTypes as the source of truth
 */
export function sortDataTokenCategories(
  categories: DataTokenType[],
): DataTokenType[] {
  const canonicalOrder = Object.keys(dataTypes) as DataTokenType[];
  return categories.sort(
    (a, b) => canonicalOrder.indexOf(a) - canonicalOrder.indexOf(b),
  );
}

/** Converts a stored value to its editable form, e.g. `"abc"` -> `abc`. */
export function toDataTokenDisplayValue(
  storedValue: string,
  type: DataTokenType,
) {
  if (type === "string") {
    try {
      const parsed = JSON.parse(storedValue);
      if (typeof parsed === "string") {
        return parsed;
      }
    } catch (e) {
      // If it's not valid JSON, return as-is
    }
  }
  return stripParens(storedValue);
}

/** Inverse of {@link toDataTokenDisplayValue}. */
export function toDataTokenStoredValue(
  displayValue: string,
  type: DataTokenType,
) {
  if (type === "string") {
    return JSON.stringify(displayValue);
  }
  if (type === "code") {
    //  Store the code inside parentheses so `tryEvalExpr` can evaluate it correctly.
    return customCode(displayValue).code;
  }
  return displayValue;
}

/**
 * Create a new DataToken
 */
export function mkDataToken({
  name,
  value,
  uuid,
  isRegistered = false,
}: {
  name: string;
  value: string;
  uuid?: string;
  isRegistered?: boolean;
}) {
  return new DataToken({
    name,
    type: "Data",
    value,
    uuid: uuid || mkShortId(),
    variantedValues: [],
    isRegistered,
    regKey: undefined,
  });
}

/**
 * Checks if a data token is editable.
 */
export function isDataTokenEditable(
  token: FinalToken<DataToken>,
): token is MutableToken<DataToken> {
  return token instanceof MutableToken;
}

/**
 * Computes a single data token value from its token definition.
 */
export function computeDataTokenValue(
  token: Readonly<Pick<DataToken, "value">>,
  evalEnv?: Record<string, any>,
): any {
  const tokenType = getDataTokenType(token.value);

  try {
    if (tokenType === "code") {
      // For code tokens, evaluate in the provided environment, or empty object if not provided
      const env = evalEnv ?? {};
      const evalResult = tryEvalExpr(token.value, env);
      return evalResult.val;
    } else {
      // For non-code tokens (string, number), parse the JSON value
      return JSON.parse(token.value);
    }
  } catch (e) {
    // If evaluation or parsing fails, set to undefined
    return undefined;
  }
}

/**
 * Computes flat data tokens for a given site and evaluation environment.
 *
 *   $dataTokens_12345_token1: value1,  // flat identifiers for evaluation
 *   $dataTokens_12345_token2: value2,
 *   $dataTokens_1T8AH_token1: value1,
 * }
 */
export type EvaluatedDataTokens =
  | { $dataTokens: Record<string, any>; pickerEnv: Record<string, any> }
  | undefined;

export interface DataTokenDefinition {
  readonly uuid: string;
  readonly name: string;
  readonly value: string;
}
export interface DataTokenProjectDefinition {
  readonly projectId: ProjectId;
  /** undefined is the local picker namespace; null excludes a transitive dep. */
  readonly pickerName: string | null | undefined;
  readonly tokens: readonly DataTokenDefinition[];
}
export type DataTokenDefinitions = readonly DataTokenProjectDefinition[];

/** Committed source text and names only. Evaluation payloads belong to each caller. */
export function captureDataTokenDefinitions(site: Site, siteId: ProjectId): DataTokenDefinitions {
  const capture = (tokens: readonly DataToken[]) => Object.freeze(tokens.map((base) => {
    const token = toFinalToken(base, site);
    return Object.freeze({ uuid: token.uuid, name: token.name, value: token.value });
  }));
  const directDepIds = new Set(site.projectDependencies.map((dep) => dep.projectId));
  const projects: DataTokenProjectDefinition[] = [];
  const localTokens = capture(site.dataTokens);
  if (localTokens.length) { projects.push(Object.freeze({ projectId: siteId, pickerName: undefined, tokens: localTokens })); }
  for (const dep of walkDependencyTree(site, "all")) {
    const tokens = capture(dep.site.dataTokens);
    if (!tokens.length) { continue; }
    projects.push(Object.freeze({
      projectId: dep.projectId as ProjectId,
      pickerName: directDepIds.has(dep.projectId) ? dep.name : null,
      tokens,
    }));
  }
  return Object.freeze(projects);
}

/** Keep flat evaluation and picker evaluation separate, including within one
 * component: code tokens can return independent mutable objects or handles. */
export function evaluateDataTokenDefinitions(
  definitions: DataTokenDefinitions,
  evalEnv?: Record<string, any>,
): EvaluatedDataTokens {
  if (!definitions.some((project) => project.tokens.length)) { return undefined; }
  const $dataTokens: Record<string, any> = {};
  const pickerEnv: Record<string, any> = {};
  for (const project of definitions) {
    if (!project.tokens.length) { continue; }
    const shortId = makeShortProjectId(project.projectId);
    for (const token of project.tokens) {
      const identifier = makeDataTokenIdentifier(shortId, toVarName(token.name));
      $dataTokens[identifier] = computeDataTokenValue(token, evalEnv);
      $dataTokens[mkMetaName(identifier)] = { hidden: true };
    }
    if (project.pickerName !== null) {
      const envObj: Record<string, any> = project.pickerName === undefined ? pickerEnv : {};
      if (project.pickerName !== undefined) {
        const key = toVarName(project.pickerName);
        pickerEnv[mkMetaName(key)] = { label: project.pickerName };
        pickerEnv[key] = envObj;
      }
      for (const token of project.tokens) {
        const key = toVarName(token.name);
        envObj[mkMetaName(key)] = { label: token.name };
        envObj[key] = computeDataTokenValue(token, evalEnv);
      }
    }
  }
  return { $dataTokens, pickerEnv };
}

export function computeDataTokens(site: Site, siteId: ProjectId, evalEnv?: Record<string, any>): EvaluatedDataTokens {
  return evaluateDataTokenDefinitions(captureDataTokenDefinitions(site, siteId), evalEnv);
}

/**
 * @param site - The site containing the data token
 * @param dataToken - The data token to extract usages for
 * @returns A summary of the usages of the data token
 */
export function extractDataTokenUsages(
  projectId: ProjectId,
  site: Site,
  dataToken: DataToken,
): GeneralUsageSummary {
  const usingComponents = [
    ...componentsReferencingDataToken(projectId, site, dataToken),
  ];

  const arenaFrames = site.arenas.flatMap((arena) => getArenaFrames(arena));

  const usingFrames = usingComponents.filter(isFrameComponent).map((c) =>
    ensure(
      arenaFrames.find((frame) => frame.container.component === c),
      () => `Couldn't find arenaFrame for component ${c.name} (${c.uuid})`,
    ),
  );

  return {
    components: usingComponents.filter((c) => !isFrameComponent(c)),
    frames: usingFrames,
  };
}

/**
 * Generates an appropriate name for a data token, created specifically for a prop by right-clicking it
 */
export function generateDataTokenName(propName: string) {
  return upperFirst(propName.replace(/-/g, " "));
}
