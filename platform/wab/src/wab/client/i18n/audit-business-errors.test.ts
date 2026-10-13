const { scanSource } =
  require("../../../../tools/i18n/audit-business-errors.cjs") as {
    scanSource: (
      source: string,
      file: string,
    ) => { errors: unknown[]; sinks: unknown[] };
  };
it("inventories server business errors and permissions, including decorated TypeScript", () => {
  const result = scanSource(
    `
    @Entity() class Record {}
    throw new ForbiddenError("Limit reached");
    checkPermissions(allowed, "Access denied");
  `,
    "server/route.ts",
  );
  expect(result.errors).toHaveLength(2);
});
it("flags raw error descriptions while accepting the subscribed error renderer", () => {
  expect(
    scanSource(
      `notification.error({description: error.message});`,
      "client/view.tsx",
    ).sinks,
  ).toHaveLength(1);
  expect(
    scanSource(
      `notification.error({description: <ErrorDescription error={error} />});`,
      "client/view.tsx",
    ).sinks,
  ).toHaveLength(0);
});
