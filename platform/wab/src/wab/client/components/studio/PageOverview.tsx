import styles from "./PageOverview.module.less";
import { loadComponentPreviewRuntime } from "@/wab/client/components/docs/DocsPreviewCanvas";
import {
  buildPreviewUpdate,
  subscribePreviewCodegen,
} from "@/wab/client/components/live/preview-codegen";
import { syncPreview } from "@/wab/client/components/live/preview-sync";
import { useNavigationCatalogInputs } from "@/wab/client/components/sidebar-tabs/ProjectPanel/navigation-catalog-inputs";
import { useI18n } from "@/wab/client/i18n";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { maybeToggleTrailingSlash } from "@/wab/client/utils/app-hosting-utils";
import { usedHostLessPkgs } from "@/wab/shared/cached-selectors";
import type { PageArena } from "@/wab/shared/model/classes";
import { getPublicUrl, getStaticBaseUrl } from "@/wab/shared/urls";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import React from "react";
import { useStore } from "zustand";

/** Mount only visible previews. They use the project's own host and models,
 * independent of the editor's selected frame, zoom, and persisted arenas. */
function PageCard({
  studio,
  arena,
  name,
}: {
  studio: StudioCtx;
  arena: PageArena;
  name: string;
}) {

  const { t } = useI18n();
  const hostUrl = useStore(
    studio.uiEnvironment.store,
    (state) => state.hostUrl,
  );
  const preview = React.useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = React.useState(false);
  const [width, setWidth] = React.useState(0);
  const [iframe, setIframe] = React.useState<HTMLIFrameElement | null>(null);
  const clearIframe = React.useCallback((node: HTMLIFrameElement | null) => {
    if (!node) {
      setIframe(null);
    }
  }, []);
  const [toggleSlash, setToggleSlash] = React.useState(false);
  const [error, setError] = React.useState(false);
  const frame = arena.matrix.rows[0]?.cols[0]?.frame;
  const viewportWidth = frame?.width ?? 390;
  const viewportHeight = frame?.height ?? 844;
  React.useEffect(() => {
    const node = preview.current;
    if (!node) {
      return;
    }
    const visibility = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    const resize = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    visibility.observe(node);
    resize.observe(node);
    return () => {
      visibility.disconnect();
      resize.disconnect();
    };
  }, []);
  React.useEffect(() => {
    if (!iframe) {
      return;
    }
    let active = true;
    let stop: (() => void) | undefined;
    setError(false);
    const page = arena.component;
    loadComponentPreviewRuntime(
      studio,
      iframe,
      usedHostLessPkgs(studio.site),
      true,
    )
      .then(({ frameWindow }) => {
        if (!active) {
          return;
        }
        stop = syncPreview(
          frameWindow,
          () =>
            buildPreviewUpdate(studio, {
              component: page,
              previewPath: page.pageMeta?.path ?? "/",
              variants: {},
              globals: {},
              pageParams: page.pageMeta?.params,
              pageQuery: page.pageMeta?.query ?? {},
              appUser: {
                user: studio.currentAppUser,
                userAuthToken: studio.currentAppUserCtx.fakeAuthToken,
              },
            }),
          (failure) => {
            if (active) {
              setError(Boolean(failure));
            }
          },
          {
            subscribe: (invalidate) =>
              subscribePreviewCodegen(studio, () => page, invalidate),
            compileModules: studio.previewCtx?.previewCompiler.compile,
          },
        );
      })
      .catch((failure: unknown) => {
        if (!active) {
          return;
        }
        if (
          !toggleSlash &&
          failure instanceof DOMException &&
          failure.name === "SecurityError"
        ) {
          setIframe(null);
          setToggleSlash(true);
        } else {
          setError(true);
        }
      });
    return () => {
      active = false;
      stop?.();
    };
  }, [studio, arena, iframe, toggleSlash]);
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => studio.switchToArena(arena)}
    >
      <strong>{name}</strong>
      <span
        className={styles.preview}
        ref={preview}
        style={{ aspectRatio: `${viewportWidth} / ${viewportHeight}` }}
      >
        {visible && width > 0 && (
          <iframe
            title={name}
            aria-hidden
            tabIndex={-1}
            src={
              maybeToggleTrailingSlash(toggleSlash, hostUrl) +
              "#live=true&origin=" +
              encodeURIComponent(getPublicUrl()) +
              "&staticBaseUrl=" +
              encodeURIComponent(getStaticBaseUrl())
            }
            onLoad={(event) => setIframe(event.currentTarget)}
            ref={clearIframe}
            style={{
              width: viewportWidth,
              height: viewportHeight,
              transform: `scale(${width / viewportWidth})`,
            }}
          />
        )}
        {error && (
          <span style={{ position: "absolute", inset: 0 }}>
            {t("Preview unavailable")}
          </span>
        )}
      </span>
    </button>
  );
}

export function PageOverview({ studio }: { studio: StudioCtx }) {

  const { t } = useI18n();
  const contentEditor = useStore(
    studio.uiEnvironment.store,
    (state) => state.contentEditorMode,
  );
  const { pages } = useNavigationCatalogInputs(studio, contentEditor);
  return (
    <section className={styles.root} aria-label={t("Pages overview")}>
      <div className={styles.heading}>
        <h2>{t("Pages overview")}</h2>
        <span>{pages.length}</span>
      </div>
      <Scrollbar className={styles.scroll}>
        <div className={styles.grid}>
          {pages.map(
            (page) =>
              page.type === "page" && (
                <PageCard
                  key={page.key}
                  name={page.name}
                  arena={page.arena}
                  studio={studio}
                />
              ),
          )}
        </div>
      </Scrollbar>
    </section>
  );
}
