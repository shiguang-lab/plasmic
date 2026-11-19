import { modelSchemaHash } from "@/wab/shared/model/classes-metas";

// Migration 259 only adds the optional Arena.metadata map. Match both schemas
// exactly so later model changes still require an updated client or server.
const arenaMetadataSchema = 2004003986;
const schema258 = 639587200;

export function getBundleSchemaHash(version: string) {
  return modelSchemaHash === arenaMetadataSchema &&
    version === "258-add-page-href-encode"
    ? schema258
    : modelSchemaHash;
}

export function supportsArenaMetadata(version: string) {
  return !(parseInt(version, 10) < 259);
}
