import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate, translateUiLabel } from "@/wab/client/i18n/locales";
import {
  insertPenDesign,
  uploadPenAssets,
} from "@/wab/client/pen-importer/insert";
import {
  pickPenChoice,
  pickPenFiles,
} from "@/wab/client/pen-importer/PenImportPicker";
import type { PenChoice, PenReader } from "@/wab/client/pen-importer/types";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { assert } from "@/wab/shared/common";
import { message, notification } from "antd";
import { releaseProxy, wrap } from "comlink";
import { createElement } from "react";

export async function importPenFile(studioCtx: StudioCtx) {
  const editable = () =>
    studioCtx.isAtTip &&
    studioCtx.canEditProject() &&
    studioCtx.canEditBranch();
  if (!editable()) {return;}
  const t = (
    key: Parameters<typeof translate>[1],
    values?: Record<string, string | number>,
  ) => translate(getUiLocale(), key, values);
  let worker: Worker | undefined;
  let release: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const files = await pickPenFiles();
    if (!files?.length || !editable()) {return;}
    worker = new Worker(new URL("./pen-file.worker.ts", import.meta.url), {
      type: "module",
    });
    const reader = wrap<PenReader>(worker);
    release = () => reader[releaseProxy]();
    let rejectWorker: (error: Error) => void;
    const failure = new Promise<never>((_, reject) => {
      rejectWorker = reject;
    });
    // The chooser can be open when a worker fails; observe that rejection even
    // while no remote request is pending, then surface it on the next request.
    void failure.catch(() => undefined);
    worker.onerror = (event) => {
      event.preventDefault();
      rejectWorker(new Error(event.message));
    };
    worker.onmessageerror = () =>
      rejectWorker(new Error("Could not read Pen worker response"));
    const wait = async <T>(request: Promise<T>) => {
      timer = setTimeout(
        () => rejectWorker(new Error("Pen import timed out")),
        120000,
      );
      try {
        return await Promise.race([request, failure]);
      } finally {
        clearTimeout(timer);
      }
    };
    const choose = async (choices: PenChoice[], kind: "file" | "canvas") => {
      assert(choices.length > 0, "The Pen file has no visible canvases");
      return choices.length === 1
        ? choices[0].id
        : pickPenChoice(choices, kind);
    };
    const designs = await studioCtx.app.withSpinner(
      (async () => {
        if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
          assert(files[0].size <= 100 * 1024 * 1024, "Pen ZIP exceeds 100 MiB");
          return wait(reader.read([{ path: files[0].name, bytes: new Uint8Array(await files[0].arrayBuffer()) }]));
        }
        // File objects are structured-cloned to the worker without eagerly
        // reading an entire project directory into memory.
        return wait(reader.read(files.map((file) => ({ path: file.webkitRelativePath || file.name, file }))));
      })(),
    );
    const file = await choose(designs, "file");
    if (!file) {return;}
    const frames = await studioCtx.app.withSpinner(wait(reader.frames(file)));
    const frame = await choose(frames, "canvas");
    if (!frame || !editable()) {return;}
    await studioCtx.app.withSpinner(
      (async () => {
        const design = await wait(reader.convert(file, frame));
        if (!editable()) {return;}
        const uploads = await uploadPenAssets(studioCtx, design);
        if (!editable()) {return;}
        const name = frames.find((f) => f.id === frame)?.name ?? "Pen";
        await insertPenDesign(studioCtx, design, uploads, name);
        void message.success(
          t('Imported "{page}" canvas from Pen', { page: name }),
        );
        if (design.warnings.length)
          {notification.warning({
            message: t("Some Pen effects were simplified"),
            description: design.warnings
              .map((w) => translateUiLabel(getUiLocale(), w))
              .join("; "),
            duration: 0,
          });}
      })(),
    );
  } catch (error) {
    console.error("Pen import failed", error);
    notification.error({
      message: createElement(UiText, { message: "Could not import Pen file" }),
      description: createElement(UiText, { message: "Check the file and include its libraries, images and scripts in the selected folder or ZIP." }),
      duration: 0,
    });
  } finally {
    clearTimeout(timer);
    release?.();
    worker?.terminate();
  }
}
