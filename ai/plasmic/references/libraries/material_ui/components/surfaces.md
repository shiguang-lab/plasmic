# Surfaces

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| Accordion | `plasmic-material-ui-accordion` |
| AccordionActions | `plasmic-material-ui-accordion-actions` |
| AccordionDetails | `plasmic-material-ui-accordion-details` |
| AccordionSummary | `plasmic-material-ui-accordion-summary` |
| Card | `plasmic-material-ui-card` |
| CardActionArea | `plasmic-material-ui-card-action-area` |
| CardActions | `plasmic-material-ui-card-actions` |
| CardContent | `plasmic-material-ui-card-content` |
| CardHeader | `plasmic-material-ui-card-header` |
| CardMedia | `plasmic-material-ui-card-media` |
| Paper | `plasmic-material-ui-paper` |

## Generation rules

Use Paper as a themed surface, Card and its content/media/actions for a meaningful grouped item, and Accordion for content that should expand or collapse. These components do not imply Antd Card header restrictions, mandatory admin section wrappers or PC spacing recipes.

Accordion uses expanded with onChange(event, expanded), plus an initial defaultExpanded mapping. Compose Summary, Details and Actions through their actual children contracts. Canvas selection may reveal content temporarily; business expansion remains independently configured. CardHeader title/subheader/action/avatar are their own Slots; CardActionArea represents an actual interactive region.

## Acceptance checks

Verify surface content and action ownership without redundant wrappers. Exercise Accordion initial and changed expansion in Preview, keyboard operation and focus, and confirm editing reveals do not change saved defaults.
