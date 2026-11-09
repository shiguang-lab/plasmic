import { flattenComponent } from "@/wab/shared/cached-selectors";
import { InvisibleElementLintIssue } from "@/wab/shared/linting/lint-types";
import { lintIssuesEquals } from "@/wab/shared/linting/lint-utils";
import { memoizeModelQuery } from "@/wab/shared/model-query";
import { Component, Site, TplNode } from "@/wab/shared/model/classes";
import { isAlwaysInvisibleTpl } from "@/wab/shared/visibility-utils";

const TYPE = "invisible-element";

export const lintInvisibleElements = memoizeModelQuery(function lintInvisibleElements(site: Site) {
    const issues: InvisibleElementLintIssue[] = [];
    for (const comp of site.components) {
      issues.push(...lintComponent(comp));
    }
    return issues;
  }, {equals: lintIssuesEquals});

const lintComponent = memoizeModelQuery(function lintComponent(component: Component) {
    const issues: InvisibleElementLintIssue[] = [];
    for (const tpl of flattenComponent(component)) {
      if (isAlwaysInvisibleTpl(tpl)) {
        issues.push({
          key: makeIssueKey(component, tpl),
          type: TYPE,
          tpl,
          component,
        });
      }
    }
    return issues;
  }, {equals: lintIssuesEquals});

function makeIssueKey(component: Component, tpl: TplNode) {
  return `${TYPE}-${component.uuid}-${tpl.uuid}`;
}
