# Installed Ant Design Icons filters

The installed library has a single-row toolbar with the style selector on the
left and Ant Design Input.Search on the right, plus an empty state. All styles
are selected by default; the selector also supports Outlined/Filled/Two Tone.
Typing filters immediately; Enter or the search button applies the query and
highlights the first result. Filters operate on the standard component
cards before their virtual rows are built. The style dropdown stays inside the
insert panel so selecting an option does not dismiss it. The original global
search and project SVG list retain their existing behavior.

Ant Design icon cards are square, with a centered 24px icon and a 10px gap
before the name. Names use 10px type and wrap at CamelCase word boundaries;
the title area centers short names and grows with longer names.
Page component sizes and individual official component imports are unchanged.

## Verified — 2026-10-05

- Production Studio build and packaged macOS arm64 desktop build pass.
- ESLint has zero errors and two existing unused-variable warnings.
- Ten desktop asset tests pass.
- Native desktop UI: Outlined 447, Filled 251, Two Tone 150, all styles 848.
  Style selection keeps the panel open.
- Searching `accountbook` returns one Two Tone component, or three independent
  components with all styles selected. Clearing search restores 848 results.
- An unmatched query shows zero results and the empty-state message.
- Global search for `Button` still returns native component results.
- The rebuilt desktop shows both controls on one row. Searching `accountbook`
  finds AccountBookOutlined; clearing it and selecting Filled keeps the panel
  open and shows AccountBookFilled.
- On a fresh panel, All styles is selected and Input.Search has its search
  button. Searching `accountbook` returns Filled, Outlined and Two Tone
  components; Enter and clicking the search button keep the results/panel open.
- All five project page models match the prior saved models by UUID. Saving
  project `2DdvqnozKTQgbqsQAu4c4X` remains at revision 135.

Current layout: [single-row toolbar](antd-icons-filters/single-row.png).

This change is bundled in the local desktop client; the server/web release
remains 0.0.28.
