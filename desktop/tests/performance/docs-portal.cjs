// Native production regression using an isolated project fixture. Code edits are
// local Docs Portal examples; the persisted Studio model must stay identical.
const { createHash } = require("node:crypto");
const fs = require("node:fs");

async function probe(expectedMode) {
  const assert = (value, message) => {
    if (!value) throw Error(message);
    return value;
  };
  const wait = async (read, message) => {
    for (let i = 0; i < 1000; i++) {
      const value = read();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error(message);
  };
  const editorState = () => {
    for (const node of document.querySelectorAll(".monaco-editor")) {
      let owner = node;
      let key;
      // Monaco owns its inner DOM; React owns the wrapper above it.
      while (owner && !(key = Object.keys(owner).find(key => key.startsWith("__reactFiber$")))) owner = owner.parentElement;
      for (let fiber = owner?.[key]; fiber; fiber = fiber.return) {
        // DOM nodes retain a Fiber across commits; its alternate can own the
        // committed onMount state after the editor has initialized.
        for (const candidate of [fiber, fiber.alternate]) {
          if (!candidate?.memoizedProps?.docsCtx || candidate.memoizedProps.docsCtx.getCodegenType() !== expectedMode) continue;
          for (let hook = candidate.memoizedState; hook; hook = hook.next) {
            const state = hook.memoizedState;
            if (state?.monaco && state?.editor?.getModel()?.uri.toString().includes("/script_") &&
              state.editor.getModel().getValue().includes("// plasmic-monaco")) {
              return { ...state, ctx: candidate.memoizedProps.docsCtx };
            }
          }
        }
      }
    }
  };
  const { monaco, editor, ctx } = await wait(editorState, "Docs Monaco controller not found").catch(error => {
    const details = [];
    for (const node of document.querySelectorAll(".monaco-editor")) {
      let owner = node, key;
      while (owner && !(key = Object.keys(owner).find(key => key.startsWith("__reactFiber$")))) owner = owner.parentElement;
      let depth = 0;
      for (let fiber = owner?.[key]; fiber && depth++ < 12; fiber = fiber.return) {
        const hooks = [];
        for(let hook = fiber.memoizedState; hook && hooks.length < 12; hook = hook.next) {
          hooks.push(hook.memoizedState && typeof hook.memoizedState === "object" ? Object.keys(hook.memoizedState).slice(0,8) : typeof hook.memoizedState);
        }
        details.push({type: fiber.type?.displayName || fiber.type?.name || typeof fiber.type, props: Object.keys(fiber.memoizedProps || {}).slice(0,12), hooks});
      }
    }
    throw Error(error.message + ": " + JSON.stringify(details));
  });
  const component = ctx.getFocusedComponent();
  const model = editor.getModel();
  const original = model.getValue();
  const originalCode = ctx.getComponentCustomCode(component);
  const counter = ctx.studioCtx._changeCounter;
  const injected = original.split("\n").filter(line => line.trim().endsWith("// plasmic-monaco")).join("\n");
  const edited = `${injected}\n<div data-react19-docs-probe="true">Docs preview regression</div>`;
  assert(editor.executeEdits("react19-docs-regression", [{range: model.getFullModelRange(), text: edited}]), "Monaco rejected the example edit");
  await wait(() => ctx.getComponentCustomCode(component)?.includes("data-react19-docs-probe"), "Monaco edit did not reach the selected store");
  await wait(() => [...document.querySelectorAll("iframe")].some(frame => {
    try {return !!frame.contentDocument?.querySelector('[data-react19-docs-probe="true"]');}
    catch {return false;}
  }), "Docs preview did not render the edited code");
  const factory = await monaco.typescript.getTypeScriptWorker();
  const worker = await factory(model.uri);
  const diagnostics = await worker.getSyntacticDiagnostics(model.uri.toString());
  assert(Array.isArray(diagnostics) && diagnostics.length === 0, "TypeScript worker rejected valid Docs JSX");
  const directory = model.uri.toString().slice(0, model.uri.toString().lastIndexOf("/") + 1);
  const dependencies = monaco.editor.getModels().filter(item => item !== model && item.uri.toString().startsWith(directory));
  for (const dependency of dependencies) {
    const checks = await worker.getSyntacticDiagnostics(dependency.uri.toString());
    assert(Array.isArray(checks) && checks.length === 0, "TypeScript worker rejected a generated dependency");
  }
  editor.executeEdits("react19-docs-restore", [{range: model.getFullModelRange(), text: original}]);
  await wait(() => ctx.getComponentCustomCode(component)?.trim() === originalCode?.trim(), "Docs code did not restore");
  await wait(() => [...document.querySelectorAll("iframe")].every(frame => {
    try {return !frame.contentDocument?.querySelector('[data-react19-docs-probe="true"]');}
    catch {return true;}
  }), "Docs preview retained the previous example");
  assert(counter === ctx.studioCtx._changeCounter, "Docs editing changed the persisted project");
  return {mode: ctx.getCodegenType(), monacoMounted: true, editReachedSelectedStore: true, previewUpdated: true,
    typeScriptWorkerDiagnostics: diagnostics.length, dependencyModelsValidated: dependencies.length, restored: true, persistedModelUnchanged: true};
}

exports.run = async ({ frame, win, ready }) => {
  const before = await frame.executeJavaScript(`(() => {
    const s = studioCtx;
    const component = s.site.components.find(c => (c.type === "plain" || c.type === "page") && !c.superComp && !c.codeComponentMeta);
    if (!component) throw Error("No ordinary Docs component in this fixture");
    const original = s.appCtx.history.location.pathname + s.appCtx.history.location.search + s.appCtx.history.location.hash;
    const bundle = JSON.stringify(s.bundler().bundle(s.site, s.siteInfo.id, s.appCtx.lastBundleVersion));
    s.appCtx.history.push('/projects/' + s.siteInfo.id + '/docs/codegen/component/' + component.uuid);
    return {original, bundle};
  })()`);
  let docsFrame;
  for (let i = 0; i < 1000 && !docsFrame; i++) {
    for (const candidate of win.webContents.mainFrame.framesInSubtree) {
      try {if (await candidate.executeJavaScript("!!document.querySelector('.monaco-editor')")) {docsFrame = candidate; break;}}
      catch {}
    }
    if (!docsFrame) await new Promise(resolve => setTimeout(resolve, 20));
  }
  if (!docsFrame) throw Error("Docs Portal editor not found");
  const codegen = await docsFrame.executeJavaScript(`(${probe.toString()})("codegen")`);
  await docsFrame.executeJavaScript("studioCtx.appCtx.history.push(studioCtx.appCtx.history.location.pathname.replace('/docs/codegen/', '/docs/loader/'))");
  const loader = await docsFrame.executeJavaScript(`(${probe.toString()})("loader")`);
  const result = {codegen, loader};
  const unchanged = await docsFrame.executeJavaScript(`(() => {
    const s = studioCtx;
    const bundle = JSON.stringify(s.bundler().bundle(s.site, s.siteInfo.id, s.appCtx.lastBundleVersion));
    s.appCtx.history.push(${JSON.stringify(before.original)});
    return bundle === ${JSON.stringify(before.bundle)};
  })()`);
  if (!unchanged) throw Error("Docs Portal changed the serialized model");
  const restoredFrame = await ready();
  await restoredFrame.executeJavaScript("studioCtx.awaitStudioReady()");
  return {frame: restoredFrame, result: {...result, serializedModelUnchanged: true,
    harnessSha256: createHash("sha256").update(fs.readFileSync(__filename)).digest("hex")}};
};
