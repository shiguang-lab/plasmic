import type { CodePreviewCtx } from "@/wab/client/components/docs/CodePreviewCtx";
import { useDocsFocusedComponentRef, useDocsFocusedIconRef } from "@/wab/client/components/docs/DocsModelResources";
import { subscribePreviewCodegen } from "@/wab/client/components/live/preview-codegen";
import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import {
  makePlumeDepsImports,
  serializeDependentModules,
  serializeToggledComponent,
  serializeToggledIcon,
} from "@/wab/client/components/docs/serialize-docs-preview";
import { configureMonacoWorkers } from "@/wab/client/monaco-worker-url";
import { useUiAppearance } from "@/wab/client/ui-theme";
import {
  makeAssetClassName,
  makeIconAssetFileNameWithoutExt,
} from "@/wab/shared/codegen/image-assets";
import {
  getExportedComponentName,
  makePlasmicComponentName,
} from "@/wab/shared/codegen/react-p/serialize-utils";
import { ensure, mkUuid, tryCatchElse } from "@/wab/shared/common";
import {
  isCodeComponent,
  isPlumeComponent,
} from "@/wab/shared/core/components";
import MonacoEditor, { loader } from "@monaco-editor/react";
import L from "lodash";
import * as monacoEditor from "monaco-editor";
import React from "react";

loader.config({ monaco: monacoEditor });

// @ts-expect-error: Importing raw @plasmicapp/react-web types as a string
import REACT_WEB_TYPES from "!raw-loader!../../../../../node_modules/@plasmicapp/react-web/dist/all.d.ts";
// We need to install some typing information into our Monaco editor to
// support typing <Plasmic*/> components.  We cheat a bit here by just
// loading the relevant types directly from our own node_modules :-p
// @ts-expect-error: Importing raw react types as a string
import REACT_TYPES from "!raw-loader!../../../../../node_modules/@types/react/index.d.ts";

type MonacoType = typeof monacoEditor;

/** Reentrant Monaco content events distinguish programmatic text from edits. */
class CodeTextSynchronization {
  private replacing = false;
  isReplacing() { return this.replacing; }
  replace(model: monacoEditor.editor.ITextModel, code: string) {
    this.replacing = true;
    try { model.setValue(code); } finally { this.replacing = false; }
  }
}

export function DocsPortalEditor(props: {
  docsCtx: DocsPortalCtx;
  codePreviewCtx?: CodePreviewCtx;
}) {
  const { docsCtx, codePreviewCtx } = props;
  const { appearance } = useUiAppearance();
  const [dependencyError, setDependencyError] = React.useState<string>();
  const componentRef = useDocsFocusedComponentRef(docsCtx);
  const iconRef = useDocsFocusedIconRef(docsCtx);
  const [{ monaco, editor }, setMonaco] = React.useState<{
    monaco?: MonacoType;
    editor?: monacoEditor.editor.IStandaloneCodeEditor;
  }>({ monaco: undefined, editor: undefined });

  const [modelDirectory] = React.useState(() => `file:///docs_${mkUuid()}/`);
  const editorInstance =
    React.useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const models = React.useRef(
    new Map<string, monacoEditor.editor.ITextModel>(),
  );
  const extraLibs = React.useRef<monacoEditor.IDisposable[]>([]);

  configureMonacoWorkers();

  React.useEffect(
    () => () => {
      if (editorInstance.current?.getModel())
        {editorInstance.current.setModel(null);}
      editorInstance.current = null;
      models.current.forEach((model) => model.dispose());
      models.current.clear();
      extraLibs.current.forEach((lib) => lib.dispose());
      extraLibs.current = [];
    },
    [],
  );

  React.useEffect(() => {
    // Command handles stay inside the editor effect; rendered metadata is native.
    const component = componentRef && docsCtx.models.snapshots.resolve(componentRef);
    const icon = iconRef && docsCtx.models.snapshots.resolve(iconRef);
    if ((!component && !icon) || !monaco || !editor) {
      return;
    }

    // If there's no model for the component/icon we're targeting yet,
    // create one
    const targetUri = monaco.Uri.parse(
      `${modelDirectory}script_${component?.uuid || icon?.uuid}_${
        codePreviewCtx?.uuid
      }.tsx`,
    );
    const model = upsertModel(monaco, models.current, targetUri, "");
    if (editor.getModel() !== model) {
      editor.setModel(model);

      // Everytime we switch to a different model, we need to ask the
      // editor to hide injected Plasmic imports
      hideInjectedCode(editor);
    }

    // Whenver the model content changes, we inform docsCtx about it
    const textSynchronization = new CodeTextSynchronization();
    const disposeModel = model.onDidChangeContent((_event) => {
      if (textSynchronization.isReplacing()) {
        return;
      }
      const newCode = removeInjectedCode(model.getValue());

      if (codePreviewCtx) {
        codePreviewCtx.setCode(newCode);
        return;
      }

      if (component) {
        docsCtx.setComponentCustomCode(component, newCode);
      } else {
        docsCtx.setIconCustomCode(ensure(icon, "picked icon"), newCode);
      }
    });

    let injectedCode = "";
    const syncCode = () => {
      const docsCtxCode = codePreviewCtx
        ? codePreviewCtx.getCode()
        : component
          ? (docsCtx.getComponentCustomCode(component) ??
            "// Try directly editing this code to pass in different props and overrides\n" +
              serializeToggledComponent(
                component,
                docsCtx.getComponentToggles(component),
                docsCtx.isUsingLoader(),
              ))
          : (docsCtx.getIconCustomCode(ensure(icon, "picked icon")) ??
            "// Try directly editing this code to pass in different props\n" +
              serializeToggledIcon(
                ensure(icon, "picked icon"),
                docsCtx.getIconToggles(ensure(icon, "picked icon")),
                docsCtx.isUsingLoader(),
              ));

      if (
        !codePreviewCtx &&
        component &&
        docsCtx.getComponentCustomCode(component) === undefined
      ) {
        docsCtx.setComponentCustomCode(component, docsCtxCode, true);
      }

      const code = `
${injectedCode}
${codePreviewCtx?.getCode() ?? docsCtxCode}
`.trim();
      if (model.getValue() !== code) {
        textSynchronization.replace(model, code);
        hideInjectedCode(editor);
      }
    };
    const syncDependencies = () => tryCatchElse({
      try: () => {
        // Regenerate dependencies only for project-model changes. Native
        // code/toggle edits below update the editor text without codegen.

        // First, re-generate the dependent code modules, in case they have
        // changed
        const { modules } = serializeDependentModules(
          docsCtx.studioCtx,
          component,
        );
        for (const dep of modules) {
          if (dep.lang === "tsx") {
            const depUri = monaco.Uri.parse(
              new URL(ensure(dep.name, "has name"), modelDirectory).href,
            );
            upsertModel(monaco, models.current, depUri, dep.source);
          }
        }

        // We need to inject some definitions so that the model file will
        // typecheck correctly.  See injection comment at the end of this file.
        const componentOrIconName =
          component &&
          (isPlumeComponent(component) || isCodeComponent(component))
            ? getExportedComponentName(component)
            : component
              ? makePlasmicComponentName(component)
              : makeAssetClassName(ensure(icon, "picked icon"));
        injectedCode = markInjectedCode(`
import React from "react";
import ${componentOrIconName} from "./${
          component
            ? componentOrIconName
            : makeIconAssetFileNameWithoutExt(ensure(icon, "picked icon"))
        }";
${component ? makePlumeDepsImports(docsCtx.studioCtx.site, component) : ""}
        `);

        syncCode();
        setDependencyError(undefined);
      },
      catch: (error: unknown) => {
        setDependencyError(error instanceof Error ? error.message || error.name : String(error));
      },
    });
    const dispose = subscribePreviewCodegen(docsCtx.studioCtx, () => component, syncDependencies);
    syncDependencies();

    const disposeInputs = docsCtx.subscribePreviewInputs(
      codePreviewCtx ? undefined : (component ?? icon),
      syncCode,
    );
    const disposeExample = codePreviewCtx?.store.subscribe(syncCode);
    return () => {
      dispose();
      disposeExample?.();
      disposeInputs();
      disposeModel.dispose();
    };
  }, [
    componentRef,
    iconRef,
    docsCtx,
    codePreviewCtx,
    monaco,
    editor,
    modelDirectory,
  ]);

  if (!componentRef && !iconRef) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {dependencyError && <div role="alert" className="code error-bg p-sm">{dependencyError}</div>}
      <div style={{ flex: 1, minHeight: 0 }}>
    <MonacoEditor
      theme={appearance === "dark" ? "vs-dark" : "vs"}
      options={{
        folding: false,
        fontSize: 12,
        glyphMargin: false,
        language: "typescript",
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        lineNumbers: "off",
        minimap: { enabled: false },
        tabSize: 2,
        useTabStops: false,

        // automaticLayout means the editor will resize when the available
        // space changes
        automaticLayout: true,
      }}
      width="100%"
      height="100%"
      onMount={(
        editor_: monacoEditor.editor.IStandaloneCodeEditor,
        monaco_: typeof monacoEditor,
      ) => {
        editorInstance.current = editor_;
        const initialModel = editor_.getModel();
        if (initialModel) {
          models.current.set(initialModel.uri.toString(), initialModel);
        }
        // set state to trigger re-render
        setMonaco({ editor: editor_, monaco: monaco_ });
      }}
      keepCurrentModel
      beforeMount={(monaco_: typeof monacoEditor) => {
        // Upon initialization, set up monaco configurations to make sure
        // typechecking works as expected

        monaco_.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco_.typescript.ScriptTarget.Latest,
          allowNonTsExtensions: true,
          moduleResolution: monaco_.typescript.ModuleResolutionKind.NodeJs,
          module: monaco_.typescript.ModuleKind.CommonJS,
          noEmit: true,
          esModuleInterop: true,
          jsx: monaco_.typescript.JsxEmit.React,
          reactNamespace: "React",
          allowJs: true,
          typeRoots: ["node_modules/@types"],
        });
        monaco_.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        });
        // Makes sure content changes in dependent files are reflected immediately
        monaco_.typescript.typescriptDefaults.setEagerModelSync(true);

        // We add typing information as libraries for react and @plasmicapp/react-web,
        // which are the minimum necessary for typing to work when working with
        // Plasmic* components.
        // See https://github.com/microsoft/monaco-editor/issues/264#issuecomment-654578687
        extraLibs.current.push(
          monaco_.typescript.typescriptDefaults.addExtraLib(
            REACT_TYPES as any,
            `${modelDirectory}node_modules/@types/react/index.d.ts`,
          ),
        );
        extraLibs.current.push(
          monaco_.typescript.typescriptDefaults.addExtraLib(
            REACT_WEB_TYPES as any,
            `${modelDirectory}node_modules/@plasmicapp/react-web/index.d.ts`,
          ),
        );
        extraLibs.current.push(
          monaco_.typescript.typescriptDefaults.addExtraLib(
            `function PlasmicComponent(props: {component: string, componentProps?: Record<string, any>}) {
            return <div />;
          }`,
            `${modelDirectory}globals.d.ts`,
          ),
        );
      }}
    />
      </div>
    </div>
  );
}

/**
 * Finds an existing Model for the argument `uri`, and if none exists,
 * creates one.  In either case, makes sure the model content is `content`.
 */
function upsertModel(
  monaco: MonacoType,
  models: Map<string, monacoEditor.editor.ITextModel>,
  uri: monacoEditor.Uri,
  content: string,
) {
  const existing = models.get(uri.toString());
  if (existing) {
    if (existing.getValue() !== content) {
      existing.setValue(content);
    }
    return existing;
  } else {
    const model = monaco.editor.createModel(content, "typescript", uri);
    models.set(uri.toString(), model);
    return model;
  }
}

/*
 * "Injected" code
 *
 * We only want the user the be editing just the relevant code --
 * the <Plasmic* /> instantiation.  However, this code snippet
 * is incomplete -- for example, Plasmic* is an undefined identifier --
 * so you'd typically need to also `import PlasmicX from "./PlasmicX"`,
 * etc.  We don't want to show the import noise to the user, but monaco
 * works by file, and requires us to add the imports to that file.  To
 * accomplish this, we:
 *
 * - Mark all such "injected" code with a PLASMIC_INJECTED_IMPORT_MARKER
 * - Find and hide all such lines from the monaco editor, using an
 *   UNOFFICIAL and UNSUPPORTED API, editor.setHiddenAreans()
 * - We remove the injected code when we call
 *   docsPortalCtx.setComponentCustomCode() (or
 *   docsPortalCtx.setIconCustomCode()).
 */

const PLASMIC_INJECTED_IMPORT_MARKER = "// plasmic-monaco";

/**
 * Marks every line in this code snippet as injected
 */
function markInjectedCode(code: string) {
  return code
    .split("\n")
    .map((line) => `${line} ${PLASMIC_INJECTED_IMPORT_MARKER}`)
    .join("\n");
}

/**
 * Removes all lines in `code` marked as injected
 */
function removeInjectedCode(code: string) {
  return code
    .split("\n")
    .filter((line) => !line.endsWith(PLASMIC_INJECTED_IMPORT_MARKER))
    .join("\n");
}

/**
 * Finds lines marked as injected, and hides them from the monaco editor
 */
function hideInjectedCode(editor: monacoEditor.editor.IStandaloneCodeEditor) {
  const code = ensure(editor.getModel(), "has model").getValue();
  const lastIndex = L.findLastIndex(code.split("\n"), (line) =>
    line.trim().endsWith(PLASMIC_INJECTED_IMPORT_MARKER),
  );

  // We currently assume there's just a block of injected stuff in the
  // beginning of the file
  (editor as any).setHiddenAreas([
    { startLineNumber: 1, endLineNumber: lastIndex + 1 },
  ]);
}
