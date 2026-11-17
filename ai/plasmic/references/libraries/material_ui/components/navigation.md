# Navigation

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| AppBar | `plasmic-material-ui-app-bar` |
| Toolbar | `plasmic-material-ui-toolbar` |
| BottomNavigation | `plasmic-material-ui-bottom-navigation` |
| BottomNavigationAction | `plasmic-material-ui-bottom-navigation-action` |
| Breadcrumbs | `plasmic-material-ui-breadcrumbs` |
| Link | `plasmic-material-ui-link` |
| MenuList | `plasmic-material-ui-menu-list` |
| MobileStepper | `plasmic-material-ui-mobile-stepper` |
| Pagination | `plasmic-material-ui-pagination` |
| PaginationItem | `plasmic-material-ui-pagination-item` |
| Step | `plasmic-material-ui-step` |
| StepButton | `plasmic-material-ui-step-button` |
| StepConnector | `plasmic-material-ui-step-connector` |
| StepContent | `plasmic-material-ui-step-content` |
| StepLabel | `plasmic-material-ui-step-label` |
| Stepper | `plasmic-material-ui-stepper` |
| Tab | `plasmic-material-ui-tab` |
| Tabs | `plasmic-material-ui-tabs` |

## Generation rules

Choose navigation from the page task: AppBar/Toolbar for an application bar, Breadcrumbs/Link for destinations, Tabs for peer content, BottomNavigation for top-level destinations, and Stepper/MobileStepper for progress. No shell, heading, bottom navigation or viewport is mandatory merely because MUI is selected.

Tabs and BottomNavigation use value and onChange(event, value); the wrapper supports an initial value through the registration's defaultValue mapping. Give Tab/BottomNavigationAction values that match the owning selection. Tabs do not create content panels or routes: bind the required content visibility or destination explicitly. Stepper activeStep and next/back actions likewise need real workflow state.

Pagination uses a one-based page with onChange(event, page); TablePagination is zero-based and belongs to the [table reference](table.md). Bind the actual dataset and count. Read supported AppBar positioning and responsive navigation props from the current contract.

## Acceptance checks

Verify each destination or selected panel, initial selection, keyboard behavior and step transitions. Check pagination against actual records and totals, and verify navigation at the required widths. Canvas selection is not evidence that runtime content switching works.
