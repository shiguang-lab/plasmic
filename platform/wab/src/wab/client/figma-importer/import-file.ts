import { denormalizeFigmaData, insertFigmaData } from "@/wab/client/figma";
import { pickFigmaPage } from "@/wab/client/figma-importer/FigmaPagePicker";
import {
  uploadFigmaImages,
  uploadNodeImages,
} from "@/wab/client/figma-importer/assets";
import type { FigFileReader } from "@/wab/client/figma-importer/fig-file";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { notification, message } from "antd";
import { releaseProxy, transfer, wrap } from "comlink";

/** File API and a module worker are shared by Studio in browsers and Electron. */
export async function importFigmaFile(studioCtx: StudioCtx, file: File) {
  if (
    !studioCtx.isAtTip ||
    !studioCtx.canEditProject() ||
    !studioCtx.canEditBranch()
  ) {
    return;
  }
  const t = (
    key: Parameters<typeof translate>[1],
    values?: Record<string, string | number>,
  ) => translate(getUiLocale(), key, values);
  if (!/\.fig$/i.test(file.name)) {
    notification.error({
      message: t("Could not import Figma file"),
      description: t("Choose a .fig file saved from Figma."),
    });
    return;
  }
  let worker: Worker | undefined;
  let release: (() => void) | undefined;
  try {
    worker = new Worker(new URL("./fig-file.worker.ts", import.meta.url), {
      type: "module",
    });
    const reader = wrap<FigFileReader>(worker);
    release = () => reader[releaseProxy]();
    // Comlink rejects remote exceptions; also reject worker loading/runtime failures.
    let rejectWorker: (error: Error) => void;
    const failure = new Promise<never>((_, reject) => {
      rejectWorker = reject;
    });
    worker.onerror = (event) => {
      event.preventDefault();
      rejectWorker(new Error(event.message));
    };
    worker.onmessageerror = () =>
      rejectWorker(new Error("Could not read Figma worker response"));
    const wait = <T>(request: Promise<T>) => Promise.race([request, failure]);
    const pages = await studioCtx.app.withSpinner(
      (async () => {
        const bytes = await file.arrayBuffer();
        return wait(reader.read(transfer(new Uint8Array(bytes), [bytes])));
      })(),
    );
    if (pages.length === 0) {
      notification.error({
        message: t("Could not import Figma file"),
        description: t("The Figma file has no visible pages."),
      });
      return;
    }
    const selectedId =
      pages.length === 1 ? pages[0].id : await pickFigmaPage(pages);
    if (selectedId === undefined) {
      return;
    }
    const page = pages.find((item) => item.id === selectedId);
    if (!page) {
      return;
    }
    await studioCtx.app.withSpinner(
      (async () => {
        if (
          !studioCtx.isAtTip ||
          !studioCtx.canEditProject() ||
          !studioCtx.canEditBranch()
        ) {
          return;
        }
        const data = await wait(reader.convert(page.id));
        const { nodes, imagesToRename } = denormalizeFigmaData(data);
        if (!nodes.length) {
          notification.error({
            message: t("Could not import Figma file"),
            description: t("The selected Figma page has no supported layers."),
          });
          return;
        }
        // Do not upload assets or mutate the project until a page is selected.
        const uploadedImages = await uploadFigmaImages(data, studioCtx.appCtx);
        const nodeImages = await uploadNodeImages(nodes, studioCtx.appCtx);
        if (
          !studioCtx.isAtTip ||
          !studioCtx.canEditProject() ||
          !studioCtx.canEditBranch()
        ) {
          return;
        }
        const previousArena = studioCtx.currentArena;
        try {
          const result = await insertFigmaData(
            { nodes, uploadedImages, nodeImages, imagesToRename },
            { studioCtx },
            false,
            page.name,
          );
          if (result.handled && result.success) {
            void message.success({
              content: t('Imported "{page}" page from Figma', {
                page: page.name,
              }),
            });
          }
        } catch (error) {
          // Model changes roll back in StudioCtx.change(); restore navigation too.
          if (studioCtx.currentArena !== previousArena) {
            studioCtx.switchToArena(previousArena);
          }
          throw error;
        }
      })(),
    );
  } catch (error) {
    console.error("Figma file import failed", error);
    notification.error({
      message: t("Could not import Figma file"),
      description: t(
        "Check that the file is a valid .fig export and try again.",
      ),
    });
  } finally {
    release?.();
    worker?.terminate();
  }
}
