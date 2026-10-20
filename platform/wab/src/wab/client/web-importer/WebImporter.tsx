import {
  ensureViewCtxOrThrowUserError,
  PasteArgs,
  PasteResult,
} from "@/wab/client/clipboard/common";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { htmlToTpl } from "@/wab/client/operations/html-to-tpl";
import {
  formatWIErrors,
  isRecoverableWIError,
  WIError,
} from "@/wab/client/web-importer/errors";
import { unwrap } from "@/wab/commons/neverthrow-utils";
import { message } from "antd";
import { ok } from "neverthrow";

export async function pasteFromWebImporter(
  text,
  { studioCtx, cursorClientPt, insertRelLoc }: PasteArgs,
): Promise<PasteResult> {
  const htmlString = text.trim();
  if (!htmlString.startsWith("<")) {
    return { handled: false };
  }

  const viewCtx = ensureViewCtxOrThrowUserError(studioCtx);
  const component = viewCtx.currentTplComponent().component;

  const result = await studioCtx.app.withSpinner(
    htmlToTpl(htmlString, {
      site: studioCtx.site,
      vtm: viewCtx.variantTplMgr(),
      appCtx: viewCtx.appCtx,
      pageHrefs: false,
      getCodeComponentMeta: (definition) => studioCtx.getCodeComponentMeta(definition),
    }),
  );

  if (result.isErr()) {
    // The HTML produced nothing usable; leave it to other paste handlers.
    return { handled: false };
  }

  const { tpls, errors, finalize } = result.value;

  const finalizeResult = unwrap(
    await studioCtx.change<never, { success: boolean; wiErrors: WIError[] }>(
      () => {
        const wiErrors = finalize({
          component,
          tplMgr: viewCtx.tplMgr(),
          ccRegistry: studioCtx.codeComponentsRegistry,
        });

        return ok({
          success: viewCtx.viewOps.pasteNodes({
            nodes: tpls,
            cursorClientPt,
            target: undefined,
            loc: insertRelLoc,
          }),
          wiErrors,
        });
      },
    ),
  );

  const issues = [...errors, ...finalizeResult.wiErrors];
  const wiErrors = formatWIErrors(issues);
  if (wiErrors.length > 0) {
    console.warn(
      `[web-importer] HTML imported with ${wiErrors.length} issue(s):\n` +
        wiErrors.map((e) => `  - ${e}`).join("\n"),
    );
  }
  const actionableIssues = formatWIErrors(
    issues.filter((error) => !isRecoverableWIError(error)),
  );
  if (actionableIssues.length > 0) {
    void message.warning({
      key: "web-importer",
      content: translate(getUiLocale(), "HTML imported with {part1} issue(s)", {
        part1: String(actionableIssues.length),
      }),
    });
  }

  return { handled: true, success: finalizeResult.success };
}
