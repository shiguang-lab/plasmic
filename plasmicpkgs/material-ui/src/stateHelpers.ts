// Keep MUI's native event signatures. Only the state binding extracts a value.
const eventValue = {
  onChangeArgsToValue: (event: { target: { value: unknown } }) =>
    event.target.value,
};
const eventChecked = {
  onChangeArgsToValue: (event: { target: { checked: boolean } }) =>
    event.target.checked,
};
const secondValue = {
  onChangeArgsToValue: (_event: unknown, value: unknown) => value,
};
const openValue = { onChangeArgsToValue: (open: boolean) => open };
export const TextFieldHelpers = { states: { value: eventValue } };
export const InputHelpers = TextFieldHelpers;
export const InputBaseHelpers = TextFieldHelpers;
export const OutlinedInputHelpers = TextFieldHelpers;
export const SelectHelpers = TextFieldHelpers;
export const NativeSelectHelpers = TextFieldHelpers;
export const RadioGroupHelpers = { states: { value: secondValue } };
export const CheckboxHelpers = { states: { checked: eventChecked } };
export const SwitchHelpers = CheckboxHelpers;
export const RadioHelpers = CheckboxHelpers;
export const SliderHelpers = { states: { value: secondValue } };
export const RatingHelpers = SliderHelpers;
export const TabsHelpers = SliderHelpers;
export const BottomNavigationHelpers = SliderHelpers;
export const ToggleButtonGroupHelpers = SliderHelpers;
export const PaginationHelpers = { states: { page: secondValue } };
export const AccordionHelpers = { states: { expanded: secondValue } };
export const AutocompleteHelpers = {
  states: { value: secondValue, inputValue: secondValue },
};
export const DialogHelpers = { states: { open: openValue } };
export const DrawerHelpers = DialogHelpers;
export const SwipeableDrawerHelpers = DialogHelpers;
export const SnackbarHelpers = DialogHelpers;
export const MenuHelpers = DialogHelpers;
export const TooltipHelpers = DialogHelpers;
export const TablePaginationHelpers = {
  states: {
    page: secondValue,
    rowsPerPage: {
      onChangeArgsToValue: (event: { target: { value: string } }) =>
        Number(event.target.value),
    },
  },
};
