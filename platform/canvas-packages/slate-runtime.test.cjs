const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const esbuild = require("esbuild");
const { clientConfigs } = require("./esbuild.js");

test("compiled Slate leaves use their own iframe React and preserve native text", async () => {
  await esbuild.build(clientConfigs[0]);
  const host = fs.readFileSync(path.join(__dirname, "../sub/public/static/sub/build/client.js"), "utf8");
  const canvas = fs.readFileSync(path.join(__dirname, "build/client.js"), "utf8");
  const frames = [];
  const errors = [];
  const flush = async (frame, command) => {
    frame.ReactDOM.flushSync(command);
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  function createFrame(label) {
    const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
    const frame = { dom };
    frames.push(frame);
    const win = dom.window;
    win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    win.eval(host);
    win.eval(canvas);
    const { React, ReactDOM, ReactDOMClient } = win.__Sub;
    const runtime = win.__CanvasPkgs;
    const editor = runtime.slateReact.withReact(runtime.slate.createEditor());
    const root = ReactDOMClient.createRoot(win.document.getElementById("root"), { onUncaughtError: (error) => errors.push(error) });
    Object.assign(frame, { React, ReactDOM, runtime, editor, root });
    frame.render = () => root.render(React.createElement(runtime.slateReact.Slate, { editor, initialValue: [{ children: [{ text: label }] }] },
      React.createElement(runtime.slateReact.Editable, { renderLeaf: ({ attributes, leaf, text }) => {
        const textPath = runtime.slateReact.ReactEditor.findPath(editor, text);
        const parent = runtime.slate.Node.parent(editor, textPath);
        return React.createElement("span", attributes, React.createElement(runtime.SlateString, { isLast: true, leaf, parent, text }));
      } }),
    ));
    return frame;
  }
  try {
    const first = createFrame("First frame"), second = createFrame("Second frame");
    assert.notEqual(first.React, second.React);
    assert.notEqual(first.runtime.SlateString, second.runtime.SlateString);
    await flush(first, first.render);
    await flush(second, second.render);
    assert.deepEqual(errors, []);
    const firstSpan = first.dom.window.document.querySelector("[data-slate-string]");
    const secondSpan = second.dom.window.document.querySelector("[data-slate-string]");
    assert(firstSpan);
    assert(secondSpan);
    assert.equal(firstSpan.textContent, "First frame");
    assert.equal(secondSpan.textContent, "Second frame");
    const nativeText = firstSpan.firstChild;
    assert(nativeText);
    nativeText.nodeValue = "First frame!";
    await flush(first, () => first.runtime.slate.Transforms.insertText(first.editor, "!", { at: { path: [0, 0], offset: "First frame".length } }));
    assert.equal(first.dom.window.document.querySelector("[data-slate-string]"), firstSpan);
    assert.equal(firstSpan.firstChild, nativeText);
    assert.equal(firstSpan.textContent, "First frame!");
    assert.equal(secondSpan.textContent, "Second frame");
    assert.deepEqual(errors, []);
  } finally {
    for (const frame of frames) {
      if (frame.root) { await flush(frame, () => frame.root.unmount()); }
      frame.dom.window.close();
    }
  }
});

test("compiled frames and errors use each iframe's React, context and document", async () => {
  await esbuild.build(clientConfigs[0]);
  const host = fs.readFileSync(path.join(__dirname, "../sub/public/static/sub/build/client.js"), "utf8");
  const canvas = fs.readFileSync(path.join(__dirname, "build/client.js"), "utf8");
  const frames = [], errors = [];
  const flush = async (frame, command) => {
    frame.ReactDOM.flushSync(command);
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  const store = (initial) => {
    let current = initial;
    const listeners = new Set();
    return {
      getState: () => current, getInitialState: () => initial,
      subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      setState: (next) => { current = next; listeners.forEach((listener) => listener()); },
      listenerCount: () => listeners.size,
    };
  };
  function createFrame(label, color) {
    const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
    const win = dom.window;
    win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    win.eval(host); win.eval(canvas);
    const { React, ReactDOM, ReactDOMClient } = win.__Sub, runtime = win.__CanvasPkgs;
    const lifetime = new win.AbortController();
    const frameInfo = store({ viewMode: "centered", height: 600, isHeightAutoDerived: true, fullPageHeight: true, bgColor: color });
    const currentUser = store({ appUser: { email: `${label}@example.com`, roleIds: ["reader"] } });
    const userContext = React.createContext(undefined);
    const globals = store({ label }), released = [];
    const invalidated = () => {};
    const owner = { releaseRenderListener: (listener) => released.push(listener) };
    function User() { return React.createElement("span", { id: "user" }, React.useContext(userContext).user.email); }
    const root = ReactDOMClient.createRoot(win.document.getElementById("root"), { onCaughtError() {}, onUncaughtError: (error) => errors.push(error) });
    const frame = { dom, React, ReactDOM, runtime, root, lifetime, frameInfo, currentUser, globals, released, invalidated };
    frame.render = () => root.render(React.createElement(runtime.CanvasFrame, { frameInfo, currentUser, lifetime: lifetime.signal, DataSourceProvider: userContext.Provider }, React.createElement(runtime.CanvasRoot, { globals, owner, onRenderInvalidated: invalidated, render: (pins) => React.createElement(React.Fragment, null, React.createElement(User), React.createElement("span", { id: "pin" }, pins.label)) })));
    frames.push(frame); return frame;
  }
  try {
    const first = createFrame("first", "#112233"), second = createFrame("second", "#445566");
    for (const name of ["CanvasFrame", "CanvasRoot", "CanvasErrorBoundary", "CanvasErrorDisplay"]) { assert.notEqual(first.runtime[name], second.runtime[name]); }
    assert.equal(first.runtime.CanvasErrorBoundary.contextType, first.dom.window.__Sub.DataContext);
    await flush(first, first.render); await flush(second, second.render);
    const firstNode = first.dom.window.document.querySelector(".__wab_root"), secondNode = second.dom.window.document.querySelector(".__wab_root");
    assert(firstNode.classList.contains("__wab_root--full-height"));
    assert.equal(first.dom.window.document.body.style.backgroundColor, "rgb(17, 34, 51)");
    assert.equal(second.dom.window.document.body.style.backgroundColor, "rgb(68, 85, 102)");
    await flush(first, () => {
      first.frameInfo.setState({ ...first.frameInfo.getState(), fullPageHeight: false, height: 720, bgColor: "#abcdef" });
      first.currentUser.setState({ appUser: { email: "updated@example.com" } });
      first.globals.setState({ label: "updated pin" });
    });
    assert.equal(first.dom.window.document.querySelector(".__wab_root"), firstNode);
    assert.equal(firstNode.style.minHeight, "720px");
    assert(!firstNode.classList.contains("__wab_root--full-height"));
    assert.equal(first.dom.window.document.getElementById("user").textContent, "updated@example.com");
    assert.equal(first.dom.window.document.getElementById("pin").textContent, "updated pin");
    assert.equal(second.dom.window.document.getElementById("pin").textContent, "second");
    assert.equal(second.dom.window.document.querySelector(".__wab_root"), secondNode);
    assert.equal(secondNode.style.minHeight, "600px");
    assert.equal(second.dom.window.document.getElementById("user").textContent, "second@example.com");
    assert.equal(second.dom.window.document.body.style.backgroundColor, "rgb(68, 85, 102)");
    await flush(first, () => first.lifetime.abort());
    assert.equal(first.dom.window.document.querySelector(".__wab_root"), null);
    assert.deepEqual(first.released, [first.invalidated]);
    assert.equal(second.dom.window.document.querySelector(".__wab_root"), secondNode);
    const listeners = new Set(), errorLifetime = new first.dom.window.AbortController();
    let broken = true;
    function Content() { if (broken) { throw new first.dom.window.Error("native failure"); } return first.React.createElement("span", null, "recovered"); }
    const renderBoundary = (lifetime = errorLifetime) => first.root.render(first.React.createElement(first.runtime.CanvasErrorBoundary, {
      lifetime: lifetime.signal,
      subscribeToChanges: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      isPendingError: () => false,
      renderError: (error) => first.React.createElement(first.runtime.CanvasErrorDisplay, { ctx: {}, nodeOrComponent: {}, title: "Frame error", message: String(error), valKey: "root", ownerKey: "owner", envId: "env-1" }),
    }, first.React.createElement(Content)));
    await flush(first, () => renderBoundary());
    const display = first.dom.window.document.querySelector(".__wab_error-display");
    assert.equal(display.getAttribute("data-plasmic-valkey"), "root");
    assert.equal(display.getAttribute("data-plasmic-valowner"), "owner");
    assert.equal(display.getAttribute("data-plasmic-canvas-envs"), "env-1");
    assert(display.textContent.includes("native failure")); assert.equal(listeners.size, 1);
    await flush(first, () => { broken = false; listeners.forEach((listener) => listener()); });
    assert.equal(first.dom.window.document.getElementById("root").textContent, "recovered");
    assert.equal(listeners.size, 0);
    await flush(first, () => { broken = true; renderBoundary(); });
    const queued = [...listeners][0];
    assert.equal(listeners.size, 1);
    await flush(first, () => errorLifetime.abort());
    assert.equal(listeners.size, 0);
    const retiredDisplay = first.dom.window.document.querySelector(".__wab_error-display");
    await flush(first, () => queued());
    assert.equal(first.dom.window.document.querySelector(".__wab_error-display"), retiredDisplay);
    const replacementLifetime = new first.dom.window.AbortController();
    await flush(first, () => { broken = false; renderBoundary(replacementLifetime); });
    assert.equal(first.dom.window.document.getElementById("root").textContent, "recovered");
    assert.deepEqual(errors, []);
  } finally {
    for (const frame of frames) {
      await flush(frame, () => frame.root.unmount());
      assert.equal(frame.frameInfo.listenerCount(), 0); assert.equal(frame.currentUser.listenerCount(), 0); assert.equal(frame.globals.listenerCount(), 0);
      frame.dom.window.close();
    }
  }
});

test("compiled component fibers share their iframe SDK state engine and publish immutable state and refs", async () => {
  const host = fs.readFileSync(path.join(__dirname, "../sub/public/static/sub/build/client.js"), "utf8");
  const sdk = fs.readFileSync(path.join(__dirname, "../react-web-bundle/build/client.js"), "utf8");
  const frames = [], errors = [];
  const flush = async (frame, command) => { frame.ReactDOM.flushSync(command); await new Promise((resolve) => setTimeout(resolve, 40)); };
  const store = (initial) => {
    let current = initial;
    const listeners = new Set();
    return { getState: () => current, getInitialState: () => initial,
      subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      setState: (next) => { current = next; listeners.forEach((listener) => listener()); },
      listenerCount: () => listeners.size };
  };
  function createFrame(initial) {
    const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
    const win = dom.window;
    win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    win.eval(host); win.eval(sdk);
    const { React, ReactDOM, ReactDOMClient } = win.__Sub;
    const ReactWeb = win.__PlasmicReactWebBundle, Runtime = win.__PlasmicCanvasReactRuntime;
    const input = store({ definitions: Object.freeze([{ value: initial }]) });
    const retained = new Set(), released = [];
    const frame = { dom, React, ReactDOM, ReactWeb, Runtime, input, initial, retained, released };
    const controller = {
      input,
      dataTokenDefinitions: (snapshot) => snapshot.definitions,
      evaluateDataTokens: (definitions) => ({ $dataTokens: { token: { value: definitions[0].value } }, pickerEnv: {} }),
      prepare(props, snapshot, values) {
        return { data: { props, values }, stateSpecs: [
          { path: "count", type: "private", variableType: "number", initFunc: ({ $props }) => $props.initial },
        ], stateEnv: { $props: props, $ctx: values.$ctx, $refs: values.$refs, $queries: values.$queries, $q: values.$q } };
      },
      finish(prepared, commands, state, values) {
        frame.commands = commands; frame.state = state; frame.values = values;
        return { context: { ...prepared, commands, state, values }, consumerKey: "instance", consumerSlot: undefined };
      },
      retain(key) { retained.add(key); return () => { retained.delete(key); released.push(key); }; },
      commit() {},
      render({ state, values }) {
        return React.createElement("button", { id: "counter", ref: values.registerRef("counter"), onClick: () => {
          const { $state } = ReactWeb.getStateCommandEnv({ $state: state });
          ReactWeb.set($state, ["count"], $state.count + 1);
          ReactWeb.set($state, ["count"], $state.count + 1);
        } }, `${state.count}:${values.$refs.counter ? "attached" : "pending"}:${values.evaluatedDataTokens.$dataTokens.token.value}`);
      },
    };
    const renderButton = controller.render;
    const queryTree = { type: "component", queries: {}, stateSpecs: [], propsContext: {}, children: [] };
    const registrations = store(Object.freeze([]));
    const queryController = {
      registrations,
      plan: () => ({ server: queryTree, legacy: [] }),
      environment: (context) => ({ $props: context.props, $ctx: context.values.$ctx, $refs: context.values.$refs, $q: context.values.$q, $queries: context.values.$queries, $state: context.state }),
      specs: () => [{ path: "count", type: "private", variableType: "number", initFunc: ({ $props }) => $props.initial }],
      withQueries: (context, state) => ({ ...context, state }),
      publish() {},
      renderInput(context) {
        frame.state = context.state; frame.commands = ReactWeb.getStateCommandValue(context.state); frame.values = context.values;
        const node = renderButton(context);
        return { getState: () => node, getInitialState: () => node, subscribe: () => () => {}, commit() {}, dispose() {} };
      },
    };
    controller.render = (context) => React.createElement(Runtime.CanvasQueriesRuntime, { controller: queryController, context });
    const root = ReactDOMClient.createRoot(win.document.getElementById("root"), { onUncaughtError: (error) => errors.push(error) });
    Object.assign(frame, { root, controller });
    frame.render = () => root.render(React.createElement(Runtime.CanvasComponentRuntime, { controller, originalProps: { initial: frame.initial } }));
    frames.push(frame); return frame;
  }
  try {
    const first = createFrame(1), second = createFrame(5);
    assert.notEqual(first.Runtime.CanvasComponentRuntime, second.Runtime.CanvasComponentRuntime);
    await flush(first, first.render); await flush(second, second.render);
    const button = first.dom.window.document.getElementById("counter"), other = second.dom.window.document.getElementById("counter");
    assert.equal(button.textContent, "1:attached:1"); assert.equal(other.textContent, "5:attached:5");
    assert.equal(first.values.$refs.counter, button);
    assert(Object.isFrozen(first.values.$refs));
    assert(first.ReactWeb.getStateCellsInPlasmicProxy(first.commands).some((cell) => cell.path === "count"));
    const previousState = first.state;
    await flush(first, () => button.dispatchEvent(new first.dom.window.MouseEvent("click", { bubbles: true })));
    assert.equal(button.textContent, "3:attached:1"); assert.equal(other.textContent, "5:attached:5");
    assert.equal(previousState.count, 1); assert.equal(first.state.count, 3);
    assert.equal(first.ReactWeb.getStateCommandValue(first.state), first.commands);
    await flush(first, () => first.input.setState({ definitions: Object.freeze([{ value: 9 }]) }));
    assert.equal(first.dom.window.document.getElementById("counter"), button);
    assert.equal(button.textContent, "3:attached:9"); assert.equal(other.textContent, "5:attached:5");
    assert.deepEqual([...first.retained], ["instance"]);
    await flush(first, () => { first.initial = 11; first.render(); });
    assert.equal(button.textContent, "11:attached:9");
    assert.equal(other.textContent, "5:attached:5");
    assert.deepEqual(errors, []);
  } finally {
    for (const frame of frames) {
      await flush(frame, () => frame.root.unmount());
      assert.equal(frame.input.listenerCount(), 0); assert.equal(frame.retained.size, 0); assert.deepEqual(frame.released, ["instance"]);
      frame.dom.window.close();
    }
  }
});

test("compiled Canvas text editors own Slate hooks, history and selection in each iframe", async () => {
  await esbuild.build(clientConfigs[0]);
  const host = fs.readFileSync(path.join(__dirname, "../sub/public/static/sub/build/client.js"), "utf8");
  const canvas = fs.readFileSync(path.join(__dirname, "build/client.js"), "utf8");
  const frames = [], errors = [];
  const flush = async (frame, command) => {
    frame.ReactDOM.flushSync(command);
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  function createFrame(label) {
    const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
    const win = dom.window;
    win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    win.eval(host); win.eval(canvas);
    const { React, ReactDOM, ReactDOMClient } = win.__Sub;
    const runtime = win.__CanvasPkgs;
    const frame = { dom, React, ReactDOM, runtime, initialValue: [{ type: "paragraph", children: [{ text: label }] }], editors: [], resets: 0 };
    const props = {
      runtime: undefined, inline: true, readOnly: false,
      configureEditor: (editor) => { frame.editors.push(editor); return editor; },
      activateEditor() {}, onSetup(editor) { frame.editor = editor; },
      resetEditor(editor, value) { editor.children = value; editor.history = { undos: [], redos: [] }; editor.onChange(); frame.resets++; },
      valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      onChange() {}, onValueChange() {}, onReset() {}, onKeyDown() {},
      editableProps: { as: "span", renderElement: ({ attributes, children }) => React.createElement("span", attributes,
        React.createElement(runtime.CanvasSlateChildren, { render: (selected) => React.createElement("span", { "data-selected": selected }, children) })) },
    };
    frame.root = ReactDOMClient.createRoot(win.document.getElementById("root"), { onUncaughtError: (error) => errors.push(error) });
    frame.TextComponent = runtime.createCanvasComponentType((editorProps) => React.createElement(runtime.CanvasTextEditor, editorProps));
    frame.render = () => frame.root.render(React.createElement(frame.TextComponent, { ...props, initialValue: frame.initialValue }));
    frames.push(frame); return frame;
  }
  try {
    const first = createFrame("First"), second = createFrame("Second");
    await flush(first, first.render); await flush(second, second.render);
    assert.notEqual(first.React, second.React);
    assert.notEqual(first.runtime.CanvasTextEditor, second.runtime.CanvasTextEditor);
    assert.notEqual(first.TextComponent, second.TextComponent);
    assert.notEqual(first.editor, second.editor);
    const content = first.dom.window.document.querySelector("[data-slate-editor]");
    assert.equal(content.textContent, "First");
    await flush(first, () => first.runtime.slate.Transforms.insertText(first.editor, " draft", { at: { path: [0, 0], offset: 5 } }));
    assert.equal(content.textContent, "First draft");
    first.initialValue = [{ type: "paragraph", children: [{ text: "First" }] }];
    await flush(first, first.render);
    assert.equal(content.textContent, "First draft"); assert.equal(first.resets, 0);
    first.initialValue = [{ type: "paragraph", children: [{ text: "Remote" }] }];
    await flush(first, first.render);
    assert.equal(content.textContent, "Remote"); assert.equal(first.resets, 1);
    assert.equal(first.editors.length, 1);
    assert.equal(second.dom.window.document.querySelector("[data-slate-editor]").textContent, "Second");
    assert.equal(second.resets, 0);
    assert.deepEqual(errors, []);
  } finally {
    for (const frame of frames) { await flush(frame, () => frame.root.unmount()); frame.dom.window.close(); }
  }
});

test("compiled native triggers and Plume behaviors preserve iframe ownership and updates", async () => {
  const host = fs.readFileSync(path.join(__dirname, "../sub/public/static/sub/build/client.js"), "utf8");
  const sdk = fs.readFileSync(path.join(__dirname, "../react-web-bundle/build/client.js"), "utf8");
  const frames = [], errors = [];
  const flush = async (frame, command) => { frame.ReactDOM.flushSync(command); await new Promise((resolve) => setTimeout(resolve, 30)); };
  function createFrame(label) {
    const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
    const win = dom.window;
    win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    win.eval(host); win.eval(sdk);
    const { React, ReactDOM, ReactDOMClient } = win.__Sub;
    const Runtime = win.__PlasmicCanvasReactRuntime;
    const listeners = new Set(); let policy = { interactive: true };
    const store = { getState: () => policy, subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); } };
    const frame = { dom, React, ReactDOM, Runtime, checkbox: React.createRef(), steps: [{ group: "hover", hook: "useHover", opposite: false, propName: "hoverProps" }] };
    frame.setInteractive = (interactive) => { policy = { interactive }; listeners.forEach((listener) => listener()); };
    function CheckboxImplementation({ variants, args, overrides }) {
      const root = overrides.root;
      return React.createElement(root.as, { ...root.props, id: "checkbox", "data-checked": variants.checked?.on ?? false }, root.wrapChildren(args.children));
    }
    const metadata = { internalArgProps: ["children"], internalVariantProps: [] };
    const renderTriggers = (result) => { frame.triggerProps = result.triggerProps; return React.createElement("button", { id: "trigger", ...result.triggerProps.hoverProps, ...result.triggerProps.focusProps }, `${result.triggers.hover}:${result.triggers.focus ?? false}`); };
    frame.root = ReactDOMClient.createRoot(win.document.getElementById("root"), { onUncaughtError: (error) => errors.push(error) });
    frame.render = () => frame.root.render(React.createElement(React.Fragment, {},
      React.createElement(Runtime.CanvasTriggersRuntime, { policy: store, steps: frame.steps, render: renderTriggers }),
      React.createElement(Runtime.CanvasPlume.CanvasPlumeCheckbox, { impl: CheckboxImplementation, metadata, componentProps: { children: label }, internalProps: {},
        config: { root: "root", labelSlot: "children", isCheckedVariant: { group: "checked", variant: "on" } }, forwardedRef: frame.checkbox }),
      React.createElement(Runtime.CanvasPlume.CanvasPlumeSelectOption, { impl: ({ args }) => React.createElement("span", { id: "standalone-option" }, args.children), metadata,
        componentProps: { children: `${label} option` }, internalProps: {}, config: { root: "root", labelContainer: "label", labelSlot: "children", isSelectedVariant: { group: "selected", variant: "on" } } }),
    ));
    frame.listenerCount = () => listeners.size;
    frames.push(frame); return frame;
  }
  try {
    const first = createFrame("First"), second = createFrame("Second");
    await flush(first, first.render); await flush(second, second.render);
    assert.notEqual(first.Runtime.CanvasPlume.CanvasPlumeCheckbox, second.Runtime.CanvasPlume.CanvasPlumeCheckbox);
    const trigger = first.dom.window.document.getElementById("trigger");
    assert.equal(trigger.textContent, "false:false");
    await flush(first, () => {
      const event = new first.dom.window.MouseEvent(first.triggerProps.hoverProps.onPointerEnter ? "pointerover" : "mouseover", { bubbles: true, relatedTarget: null });
      Object.defineProperty(event, "pointerType", { value: "mouse" });
      trigger.dispatchEvent(event);
    });
    assert.equal(first.dom.window.document.getElementById("trigger") === trigger, true);
    assert.equal(trigger.textContent, "true:false");
    assert.equal(second.dom.window.document.getElementById("trigger").textContent, "false:false");
    await flush(first, () => first.setInteractive(false));
    assert.equal(trigger.textContent, "false:false");
    await flush(first, () => { first.setInteractive(true); first.steps = [...first.steps, { group: "focus", hook: "useFocused", opposite: false, propName: "focusProps" }]; first.render(); });
    const nextTrigger = first.dom.window.document.getElementById("trigger");
    await flush(first, () => nextTrigger.focus());
    assert.equal(nextTrigger.textContent, "true:true");
    await flush(first, () => first.checkbox.current.setChecked(true));
    assert.equal(first.dom.window.document.getElementById("checkbox").getAttribute("data-checked"), "true");
    assert.equal(second.dom.window.document.getElementById("checkbox").getAttribute("data-checked"), "false");
    assert.equal(first.dom.window.document.getElementById("standalone-option").textContent, "First option");
    assert.deepEqual(errors, []);
  } finally {
    for (const frame of frames) { await flush(frame, () => frame.root.unmount()); assert.equal(frame.listenerCount(), 0); frame.dom.window.close(); }
  }
});
