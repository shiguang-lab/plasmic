# InputNumber

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Number Input | `plasmic-antd5-input-number` |

## Numeric field

Read this wrapper's value/defaultValue, min/max/step, controls and onChange(value) contract; native numeric clear may be null and zero is a legitimate value. The registration's input state metadata and the native returned value must be inspected together before binding or code generation. Do not infer the runtime type from a copied Input event handler.

This v5 registration exposes bordered and its own decoration controls; it does not certify the v6 variant/size/precision API. Business decimal/integer/range requirements belong in actual Form validation rather than an arbitrary display conversion.

## Acceptance

Test zero, clear, negative/decimal/boundary values when allowed, step changes, typing and the saved Form payload. Verify initialization, explicit disabling and reopen with another record; do not convert empty to zero with a truthy fallback.
