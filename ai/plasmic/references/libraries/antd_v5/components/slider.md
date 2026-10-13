# Slider

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Range Slider | `plasmic-antd5-range-slider` |
| Slider | `plasmic-antd5-slider` |
| Slider Mark | `plasmic-antd5-slider-mark` |

## Slider, Range Slider and Slider Mark

Single Slider exposes value; Range Slider exposes its actual valueMin/valueMax states and draggableTrack, not a copied v6 range/value-array control surface. Read onChange/onAfterChange conversion and mark/stylableMarks/Slider Mark children, min/max/step and tooltip controls independently. Keep one actual numeric owner and preserve zero.

## Acceptance

Verify endpoints, step precision, marks, keyboard movement, disabled state and distinct single/range outputs. Intermediate movement and completion follow their registered events; do not submit an expensive mutation on every change unless required. Check long labels, initialization and actual saved values without assuming a v6 completion event.
