import { http, HttpResponse } from "msw";
import { fakeInitDatabase, fakeSchema } from "./fake-data-source";

export const formDataHandlers = [
  http.post<{ id: string }, { userArgs: { opName: string; id?: number; table: string } }>(
    "https://data.plasmic.app/api/v1/server-data/sources/:id/execute",
    async ({ request }) => {
      const { userArgs: { opName, id, table } } = await request.json();
      return HttpResponse.json({
        data: opName === "getRow"
          ? fakeInitDatabase[table].find((row: { id: number }) => row.id === id)
          : [],
        schema: { id: table, fields: fakeSchema[table] },
      });
    }
  ),
];
