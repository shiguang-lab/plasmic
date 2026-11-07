import { setupServer } from "msw/node";
import { afterAll, beforeAll, expect, it } from "vitest";
import { fakeInitDatabase, fakeSchema } from "./fake-data-source";
import { formDataHandlers } from "./form-data-handlers";

const server = setupServer(...formDataHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

it.each(["athletes", "products"])("keeps schema and selected row responses for %s", async (table) => {
  for (const opName of ["getSchema", "getRow"]) {
    const response = await fetch("https://data.plasmic.app/api/v1/server-data/sources/story-source/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userArgs: { table, opName, id: 1 } }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: opName === "getRow" ? fakeInitDatabase[table].find((row: { id: number }) => row.id === 1) : [],
      schema: { id: table, fields: fakeSchema[table] },
    });
  }
});
