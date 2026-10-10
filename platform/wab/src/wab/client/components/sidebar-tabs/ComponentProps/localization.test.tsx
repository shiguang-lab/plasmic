import {
  EnumPropEditor,
  EnumWithSearchPropEditor,
} from "@/wab/client/components/sidebar-tabs/ComponentProps/EnumPropEditor";
import { InputNumPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/NumPropEditor";
import { StringPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/StringPropEditor";
import { InnerPropEditorRow } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { setLanguagePreference } from "@/wab/client/i18n";
import { languageOptions, translate } from "@/wab/client/i18n/locales";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";

vi.mock(
  "@/wab/client/components/sidebar-tabs/DataBinding/useDataTokenSuggestionsMenu",
  () => ({
    useDataTokenSuggestionsMenu: () => ({
      openMenu: () => {},
      getComboboxProps: () => ({}),
      getInputProps: (props: any) => props,
      menu: null,
    }),
  }),
);
vi.mock(
  "@/wab/client/components/sidebar-tabs/ComponentProps/CodeEditor",
  () => ({ checkStrSizeLimit: () => true }),
);
vi.mock(
  "@/wab/client/components/sidebar-tabs/ComponentProps/TemplatedTextEditor",
  () => ({ TemplatedTextEditor: () => null }),
);
vi.mock("@/wab/client/studio-ctx/StudioCtx", async () => ({
  useStudioCtx: () => ({
    site: { dataTokens: [] },
    siteInfo: { id: "test" },
    customFunctionsSchema: () => ({}),
    projectFlags: () => ({}),
  }),
  StudioCtxContext: (await import("react")).createContext(undefined),
}));

// Isolate the select shell; retain the real enum editor's serialization and callbacks.
vi.mock("@/wab/client/components/style-controls/StyleSelect", () => {
  const Option = ({ children, value }: any) => (
    <option value={value}>{children}</option>
  );
  const OptionGroup = ({ children, title }: any) => (
    <optgroup label={title}>{children}</optgroup>
  );
  const Select = ({ children, onChange, value, placeholder }: any) => (
    <select
      aria-label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
  return { default: Object.assign(Select, { Option, OptionGroup }) };
});

afterEach(() => {
  cleanup();
  act(() => setLanguagePreference("en"));
});

it("changes empty hints in all five languages without replacing real default values", () => {
  const onChange = vi.fn();
  render(
    <>
      <InputNumPropEditor value={undefined} onChange={onChange} />
      <StringPropEditor value={undefined} onChange={onChange} />
      <StringPropEditor
        value={undefined}
        defaultValueHint="WorkspaceCard"
        onChange={onChange}
      />
    </>,
  );
  for (const { value: locale } of languageOptions) {
    act(() => setLanguagePreference(locale));
    expect(
      screen.getAllByPlaceholderText(translate(locale, "unset")),
    ).toHaveLength(2);
    expect(screen.getByPlaceholderText("WorkspaceCard")).toBeTruthy();
  }
  expect(onChange).not.toHaveBeenCalled();
});

it("keeps grouped choices in English across all UI languages and preserves values and unset action", () => {
  const onChange = vi.fn(),
    onDelete = vi.fn();
  const options = [
    {
      label: "Size",
      values: [
        { label: "Small", value: "small" },
        { label: "MyCustomLabel", value: "custom-value" },
      ],
    },
  ];
  render(
    <EnumPropEditor
      value="small"
      options={options}
      onChange={onChange}
      onDelete={onDelete}
    />,
  );
  for (const { value: locale } of languageOptions) {
    act(() => setLanguagePreference(locale));
    expect(screen.getByRole("option", { name: "Small" })).toHaveProperty(
      "value",
      "'small'",
    );
    expect(screen.getByRole("group", { name: "Size" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "MyCustomLabel" }),
    ).toHaveProperty("value", "'custom-value'");
  }
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "'custom-value'" },
  });
  expect(onChange).toHaveBeenCalledWith("custom-value");
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "'plasmic.unset'" },
  });
  expect(onDelete).toHaveBeenCalledOnce();
  expect(options[0].values[0]).toEqual({ label: "Small", value: "small" });
});

it("keeps searchable choices in English while the clear caption follows the UI language", async () => {
  render(
    <EnumWithSearchPropEditor
      value={undefined}
      options={[{ label: "Is required", value: "required" }]}
      onChange={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  fireEvent.mouseDown(screen.getByRole("combobox"));
  for (const { value: locale } of languageOptions) {
    act(() => setLanguagePreference(locale));
    expect(await screen.findByText("Is required")).toBeTruthy();
    expect(await screen.findByText(translate(locale, "(Unset)"))).toBeTruthy();
  }
});

it("keeps property names and registration help in English across all UI languages", () => {
  render(
    <>
      {["Direction", "Username", "Language", "Menu items"].map((label) => (
        <InnerPropEditorRow
          key={label}
          attr={label}
          label={label}
          expr={undefined}
          propType={{ type: "string", required: true, helpText: "Is required" }}
          disableDynamicValue
          onChange={vi.fn()}
        />
      ))}
    </>,
  );
  for (const { value: locale } of languageOptions) {
    act(() => setLanguagePreference(locale));
    for (const label of ["Direction", "Username", "Language", "Menu items"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByText("Is required")).toHaveLength(4);
  }
});
