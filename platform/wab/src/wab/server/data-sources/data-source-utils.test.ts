import {
  normalizeOperationTemplate,
  substituteArgs,
} from "@/wab/server/data-sources/data-source-utils";
import {
  DataSourceError,
  DataSourceMeta,
  OperationMeta,
} from "@/wab/shared/data-sources-meta/data-sources";

describe("normalizing operation template", () => {
  const dataSourceMeta: DataSourceMeta = {
    id: "fake",
    label: "Fake data source",
    credentials: {},
    settings: {},
    studioOps: {},
    ops: [
      {
        name: "query",
        args: {
          filter1: {
            type: "filter[]",
            fields: () => ({}),
          },
          filter2: {
            type: "filter[]",
            fields: () => ({}),
            isSql: true,
          },
          resource: {
            type: "string",
          },
        },
        type: "read",
      },
      {
        name: "mutate",
        args: {
          resource: {
            type: "string",
          },
          variables: {
            type: "json-schema",
            fields: () => ({}),
          },
        },
        type: "write",
      },
    ],
  };
  it("works with int dynamic values", () => {
    expect(
      normalizeOperationTemplate(dataSourceMeta, {
        name: "query",
        roleId: "blah",
        templates: {
          // Replacing int dynamic value
          filter1: `{"tree":{"id":"bbbb989b-89ab-4cde-b012-318a800ad2dd","combinator":"and","rules":[{"id":"989889a9-0123-4456-b89a-b18a800b0a95","combinator":"or","not":false,"rules":[{"id":"b889bb9a-cdef-4012-b456-718a800b0a96","field":"from_bucket_id","operator":"=","value":{{ ($props.fromBucketId) }}},{"id":"a88ba8ba-89ab-4cde-b012-318a800b3bb5","field":"to_bucket_id","operator":"=","value":{{ ($props.toBucketId) }}}]}]},"fields":[{"name":"amount","label":"amount","datatype":"number","inputType":"number","valueEditorType":"text"},{"name":"created_at","label":"created_at","datatype":"datetime","inputType":"datetime-local","valueEditorType":"text"},{"name":"created_by","label":"created_by","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"description","label":"description","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"from_bucket_id","label":"from_bucket_id","datatype":"number","inputType":"number","valueEditorType":"text"},{"name":"id","label":"id","datatype":"number","inputType":"number","valueEditorType":"text"},{"name":"to_bucket_id","label":"to_bucket_id","datatype":"number","inputType":"number","valueEditorType":"text"},{"name":"type","label":"type","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"user_id","label":"user_id","datatype":"text","inputType":"text","valueEditorType":"text"}]}`,
        },
      }),
    ).toEqual({
      name: "query",
      roleId: "blah",
      templates: {
        // Replacing int dynamic value
        filter1: `{"tree":{"id":"$p$0","combinator":"and","rules":[{"id":"$p$1","combinator":"or","not":false,"rules":[{"id":"$p$2","field":"from_bucket_id","operator":"=","value":{{ DYNAMIC0 }}},{"id":"$p$3","field":"to_bucket_id","operator":"=","value":{{ DYNAMIC1 }}}]}]},"fields":[{"name":"amount","label":"amount","datatype":"number","inputType":"number","valueEditorType":"text"},{"name":"created_at","label":"created_at","datatype":"datetime","inputType":"datetime-local","valueEditorType":"text"},{"name":"created_by","label":"created_by","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"description","label":"description","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"from_bucket_id","label":"from_bucket_id","datatype":"number","inputType":"number","valueEditorType":"text"},{"name":"id","label":"id","datatype":"number","inputType":"number","valueEditorType":"text"},{"name":"to_bucket_id","label":"to_bucket_id","datatype":"number","inputType":"number","valueEditorType":"text"},{"name":"type","label":"type","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"user_id","label":"user_id","datatype":"text","inputType":"text","valueEditorType":"text"}]}`,
      },
    });
  });

  it("works with string dynamic values", () => {
    expect(
      normalizeOperationTemplate(dataSourceMeta, {
        name: "query",
        roleId: "blah",
        templates: {
          filter1: `{"tree":{"id":"8aa88b88-cdef-4012-b456-718a863be333","combinator":"and","rules":[{"id":"cdef-4012-b456-718a863be534","field":"id","operator":"=","value":"{{ ($ctx.name) }}"}]},"fields":[{"name":"avatar","label":"avatar","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"created_at","label":"created_at","datatype":"datetime","inputType":"datetime-local","valueEditorType":"text"},{"name":"email","label":"email","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"first_name","label":"first_name","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"id","label":"id","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"last_name","label":"last_name","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"role","label":"role","datatype":"text","inputType":"text","valueEditorType":"text"}]}`,
        },
      }),
    ).toEqual({
      name: "query",
      roleId: "blah",
      templates: {
        // Replacing string dynamic value
        filter1: `{"tree":{"id":"$p$0","combinator":"and","rules":[{"id":"$p$1","field":"id","operator":"=","value":"{{ DYNAMIC0 }}"}]},"fields":[{"name":"avatar","label":"avatar","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"created_at","label":"created_at","datatype":"datetime","inputType":"datetime-local","valueEditorType":"text"},{"name":"email","label":"email","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"first_name","label":"first_name","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"id","label":"id","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"last_name","label":"last_name","datatype":"text","inputType":"text","valueEditorType":"text"},{"name":"role","label":"role","datatype":"text","inputType":"text","valueEditorType":"text"}]}`,
      },
    });
  });

  it("works with sql statement", () => {
    expect(
      normalizeOperationTemplate(dataSourceMeta, {
        name: "query",
        roleId: "blah",
        templates: {
          // sql
          filter2: `SELECT\n  COUNT(*) AS user_signups\nFROM\n  users\nWHERE\n  signup_date > ({{ ($state.startDate.value) }}, '2000-01-01')::timestamp\n  AND signup_date <{{ ($state.endDate.value) }}`,
        },
      }),
    ).toEqual({
      name: "query",
      roleId: "blah",
      templates: {
        // sql
        filter2: `SELECT\n  COUNT(*) AS user_signups\nFROM\n  users\nWHERE\n  signup_date > ({{ DYNAMIC0 }}, '2000-01-01')::timestamp\n  AND signup_date <{{ DYNAMIC1 }}`,
      },
    });
  });

  it("works with currentUser dynamic expressions", () => {
    expect(
      normalizeOperationTemplate(dataSourceMeta, {
        name: "query",
        roleId: "blah",
        templates: {
          resource: `Hello {{($ctx.number)}} and things you "{{ ($ctx.name) }}" but I cannot change {{(currentUser.email)}} or {{ (currentUser.customProperties.id) }} etc.!`,
        },
      }),
    ).toEqual({
      name: "query",
      roleId: "blah",
      templates: {
        // Replacing string and non-string dynamic values, not filter[],
        // preserve currentUser
        resource: `Hello {{ DYNAMIC0 }} and things you "{{ DYNAMIC1 }}" but I cannot change {{(currentUser.email)}} or {{ (currentUser.customProperties.id) }} etc.!`,
      },
    });
  });

  it("works with many values", () => {
    expect(
      normalizeOperationTemplate(dataSourceMeta, {
        name: "mutate",
        roleId: null,
        templates: {
          variables: `{"amount":{{ ($state.form.value.amount) }},"to_bucket_id":{{ ($state.form.value.toBucketId) }},"user_id":"{{ (currentUser.customProperties.id) }}","description":"{{ ($state.form.value.description) }}"}`,
        },
      }),
    ).toEqual({
      name: "mutate",
      roleId: null,
      templates: {
        variables: `{"amount":{{ DYNAMIC0 }},"to_bucket_id":{{ DYNAMIC1 }},"user_id":"{{ (currentUser.customProperties.id) }}","description":"{{ DYNAMIC2 }}"}`,
      },
    });
  });
});

describe("substituteArgs", () => {
  const source = { source: "postgres", id: "src", workspaceId: "w" } as any;
  // getList op with no args pinned via templates, so all args fall
  // through to the "use whatever is specified live" branch.
  const op = {
    name: "getList",
    type: "read",
    args: {
      resource: { type: "table" },
      filters: { type: "filter[]", fields: () => ({}), isSql: true },
      sort: { type: "sort[]", fields: () => ({}), isSql: true },
    },
  } as unknown as OperationMeta;

  it("passes a runtime sort through untouched", () => {
    const result = substituteArgs(
      source,
      op,
      {},
      { resource: "users", sort: [{ field: "name", order: "asc" }] },
    );
    expect(result.resource).toEqual("users");
    expect(result.sort).toEqual([{ field: "name", order: "asc" }]);
  });

  it("rejects a raw SQL filter supplied at request time", () => {
    expect(() =>
      substituteArgs(
        source,
        op,
        {},
        { resource: "users", filters: "1=1; DROP TABLE users; --" },
      ),
    ).toThrow(DataSourceError);
  });

  it("rejects a structured filter object supplied at request time", () => {
    expect(() =>
      substituteArgs(
        source,
        op,
        {},
        { resource: "users", filters: { value: "1=1; DROP TABLE users; --" } },
      ),
    ).toThrow(DataSourceError);
  });

  it("leaves an absent filter untouched on an untemplated op", () => {
    const result = substituteArgs(source, op, {}, { resource: "users" });
    expect(result.filters).toBeUndefined();
  });
});

describe("native filter SQL parameterization", () => {
  const source = {source: "postgres"} as any;
  const op = { name: "getList", type: "read", args: { filters: {type: "filter[]", isSql: true, isParamString: true, fields: () => ({})} } } as unknown as OperationMeta;
  it.each([["number", 0], ["boolean", false], ["text", "x'; DROP TABLE users; --"]])("binds %s values without interpolating them", (datatype, value) => {
    const template = JSON.stringify({tree: {combinator: "and", rules: [{field: "value", operator: "=", value: "BINDING"}]}, fields: [{name: "value", label: "Value", datatype}]}).replace('"BINDING"', '{{ ($ctx.value) }}');
    const result = substituteArgs(source, op, {filters: template}, {filters: [value]});
    expect(result.filters.parameters).toEqual({__plasmic_binding_1_: value});
    expect(result.filters.value).toContain("$1");
    expect(result.filters.value).not.toContain("DROP TABLE");
    expect(result.filters.value).not.toContain("{{");
  });
});
