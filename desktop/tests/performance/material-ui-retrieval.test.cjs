const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { setTimeout: delay } = require("node:timers/promises");
const { reviewIndex } = require("./review-index.cjs");
const {
  ComponentEmbedding,
} = require("../../../platform/wab/src/wab/server/component-reuse/component-embedding.cjs");
const {
  ComponentReuse,
  hash,
} = require("../../../platform/wab/src/wab/server/component-reuse/component-reuse.cjs");
const documents = require("../../../platform/wab/src/wab/server/component-reuse/component-reuse-public-documents.json");

const queries = [
  ["Edit customer details in a slide-out panel from the right", "drawer"],
  [
    "Open a side panel beside the list so I can update a record without leaving the page",
    "drawer",
  ],
  ["从右侧滑出面板，编辑客户资料", "drawer"],
  [
    "Let users adjust the minimum and maximum price by dragging two handles along a track",
    "slider",
  ],
  [
    "Change the volume by dragging a thumb to the desired numeric value",
    "slider",
  ],
  [
    "Swipe from the edge of the screen to open navigation and swipe back to close it",
    "swipeable-drawer",
  ],
  [
    "Switch customer information panels and keep the selected tab and content in sync on the same page",
    "tabs",
  ],
  ["Display customer records in a sortable paginated table", "table"],
];

test(
  "Material UI retrieval ranks the intended control first in the full library",
  {
    skip:
      !process.env.COMPONENT_MODEL_DIRECTORY &&
      "Set COMPONENT_MODEL_DIRECTORY to the native embedding runtime",
    timeout: 600_000,
  },
  async (t) => {
    const library = documents.filter(
      (doc) => doc.fromProject === "@shiguang-lab/plasmic-material-ui",
    );
    const scope = {
      account: hash("component-reuse-regression"),
      project: "material-ui",
    };
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "mui-retrieval-"),
    );
    const embedding = new ComponentEmbedding(
      process.env.COMPONENT_MODEL_DIRECTORY,
    );
    const index = new ComponentReuse({
      directory,
      embedding,
      backgroundDelayMs: 0,
    });
    try {
      await index.sync(scope, library);
      while (index.coverage().indexed < library.length) {
        if (index.failure) throw index.failure;
        await delay(50, undefined, { signal: t.signal });
      }
      for (const [intent, expected] of queries) {
        await t.test(intent, async () => {
          const result = await reviewIndex(index, scope, [
            {
              intent,
              componentUuid: "page",
              elementUuid: "region",
              usedComponentUuids: [],
            },
          ]);
          assert.equal(result.status, "completed");
          const names = result.suggestions.flatMap((s) =>
            s.candidates.map((c) => c.name),
          );
          if (expected === "drawer") {
            assert.ok(!names.includes("plasmic-material-ui-slider"), names.join(", "));
          }
          assert.equal(
            names[0],
            "plasmic-material-ui-" + expected,
            names.join(", "),
          );
        });
      }
    } finally {
      await index.close();
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);
