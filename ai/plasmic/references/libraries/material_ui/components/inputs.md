# Inputs and field composition

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| Autocomplete | `plasmic-material-ui-autocomplete` |
| Checkbox | `plasmic-material-ui-checkbox` |
| FormControl | `plasmic-material-ui-form-control` |
| FormControlLabel | `plasmic-material-ui-form-control-label` |
| FormGroup | `plasmic-material-ui-form-group` |
| FormHelperText | `plasmic-material-ui-form-helper-text` |
| FormLabel | `plasmic-material-ui-form-label` |
| Input | `plasmic-material-ui-input` |
| InputAdornment | `plasmic-material-ui-input-adornment` |
| InputBase | `plasmic-material-ui-input-base` |
| InputLabel | `plasmic-material-ui-input-label` |
| MenuItem | `plasmic-material-ui-menu-item` |
| NativeSelect | `plasmic-material-ui-native-select` |
| NativeOption | `plasmic-material-ui-native-option` |
| OutlinedInput | `plasmic-material-ui-outlined-input` |
| Radio | `plasmic-material-ui-radio` |
| RadioGroup | `plasmic-material-ui-radio-group` |
| Rating | `plasmic-material-ui-rating` |
| Select | `plasmic-material-ui-select` |
| Slider | `plasmic-material-ui-slider` |
| Switch | `plasmic-material-ui-switch` |
| TextField | `plasmic-material-ui-text-field` |

## Generation rules

Use TextField for a labeled input with helper/error content; compose lower-level Input, labels and adornments only when needed. FormControl coordinates field presentation, FormGroup groups controls, and FormControlLabel supplies a control with its label. They do not provide Antd Form's field store, rules or onFinish workflow. Use the project's actual form/submission/validation contract.

### Values and events

TextField/Input/Select/NativeSelect callbacks expose event.target.value; Checkbox/Switch/Radio use event.target.checked. RadioGroup, Slider, Rating and Autocomplete expose the next value as the second callback argument. Read live event arguments before binding; a registration's writable-state helper extracts values without changing the native callback signature. Keep numeric/range values, nullable ratings and multi-select arrays in their actual types.

Initial-value controls use the registration's editOnly/uncontrolledProp mapping (value to defaultValue or checked to defaultChecked). Use the exposed Studio control/state instead of inventing an additional default prop binding. Choose a single business owner for controlled state.

### Slots and choices

Select uses MenuItem children; NativeSelect uses NativeOption. FormControlLabel.control and Select/NativeSelect.input accept a single element. Respect the registration's allowed children and native context rather than inserting layout wrappers between a selector and its options.

Autocomplete keeps selected value and typed inputValue separate. Its wrapper supplies a TextField when renderInput is absent; textFieldProps customizes it while preserving native input refs and attributes. A replacement renderInput is a function expression, not a text Slot, and must preserve that native input contract. Read options, getOptionLabel, equality and multiple/freeSolo behavior from the current registration.

## Acceptance checks

Exercise typing, selection, clearing, initial values and required validation/submission. Check labels and error associations. For Autocomplete, verify both selected values and search text; for multi/range controls, verify the full value shape.
