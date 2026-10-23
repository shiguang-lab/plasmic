# Transfer

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Transfer | `plasmic-antd6-transfer` |

## Generation rules

### Moving a selected subset

Transfer expresses which records belong to a target set. dataSource keys and targetKeys are stable business identities; titles are display text. This wrapper renders the actual item's title or key and exposes targetKeys through onChange. Moving between panels changes the selected subset and does not itself save it to the server unless the requirement explicitly defines that workflow.

## Acceptance checks

### Acceptance

Test initial membership, moving both directions or oneWay when used, disabled records, search, empty panels and unknown/deleted source keys under the actual native contract. Verify the submitted target keys, permissions and keyboard operation. Do not copy the default two sample records into a business deliverable.
