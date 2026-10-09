# UI languages

The application supports English (`en`), Simplified Chinese (`zh-CN`), Traditional Chinese (`zh-TW`), Japanese (`ja`) and Korean (`ko`). Each selectable language has its own JSON message pack, checked for equal keys and interpolation parameters.

`useI18n()` provides `t(message, values)`, the resolved locale, and the language preference. English source messages are typed keys. Add a new message to every language pack before using it. UI translations must not change persisted component props, node names, registration metadata, or business page content.

The initial preference is `system`. The desktop preload supplies the operating system's preferred languages; the web application uses `navigator.languages`. The first supported language wins; unsupported languages fall back to English. Chinese script tags take precedence over regional tags. Manual choices and an explicit return to `system` are stored in `localStorage` under `shiguang.ui.language`, and restored before the first render. Storage failure is reported by the language selector without claiming the preference was saved.

The shared external store updates all React roots, including independently rendered popups. The Ant Design provider uses the corresponding component language pack and updates the document's `lang`. Browser storage events synchronize windows. The top frame sends its resolved UI locale through the existing Comlink connection before mounting the host editor; host frames follow subsequent changes and do not store a second preference in the custom app host's origin.

Settings, dashboard navigation, project/workspace actions and editor navigation use this layer. Additional Studio surfaces should use the same typed messages as their labels are internationalized.
