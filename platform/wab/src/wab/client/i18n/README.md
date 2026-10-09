# UI languages

The application supports English (`en`), Simplified Chinese (`zh-CN`), Traditional Chinese (`zh-TW`), Japanese (`ja`) and Korean (`ko`). Each selectable language has its own JSON message pack, checked for equal keys and interpolation parameters.

`useI18n()` provides `t(message, values)`, `label(displayText)`, the resolved locale, and the language preference. English source messages are typed keys. Add a new message to every language pack before using it. UI translations must not change persisted component props, node names, registration metadata, or business page content.

The initial preference is `system`. The desktop preload supplies the operating system's preferred languages; the web application uses `navigator.languages`. The first supported language wins; unsupported languages fall back to English. Chinese script tags take precedence over regional tags. Manual choices and an explicit return to `system` are stored in `localStorage` under `shiguang.ui.language`, and restored before the first render. Storage failure is reported by the language selector without claiming the preference was saved.

The shared external store updates all React roots, including independently rendered popups. The Ant Design provider uses the corresponding component language pack and updates the document's `lang`. Browser storage events synchronize windows. The top frame sends its resolved UI locale through the existing Comlink connection before mounting the host editor; host frames follow subsequent changes and do not store a second preference in the custom app host's origin.

Studio menus, sidebar controls, common dialogs and generated presentation captions use this layer. `<UiText message="…" />` subscribes independently so module-level JSX and memoized views update when the language changes. Use complete messages for sentences with changing states or interpolated names.

`label()` and `<UiLabel text={metadataLabel} />` translate known presentation labels from shared editor metadata without modifying that metadata. Unknown labels retain their original text. Insertable built-in captions and their search terms use the same translation; user-authored component names and item keys remain unchanged.

Built-in Ant Design property labels, descriptions, grouped options, empty hints and action captions use the same display translation. Stored property names, enum values, CSS values, defaults and custom component names remain intact; editable CSS input shows its original value. The metadata coverage test checks labels, descriptions and option captions against the five packs.

Desktop bundles these JSON packs and the shared locale resolver with its renderer assets. The trusted Studio main frame sends the resolved locale to the desktop process, which refreshes native menus and broadcasts it to the update, login and MCP dialogs. Native dialogs read the same Studio preference; they do not persist a second language setting.
