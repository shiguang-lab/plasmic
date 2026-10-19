import { deflateSync, strToU8, zipSync } from "fflate";
import { compileSchema, encodeBinarySchema, parseSchema } from "kiwi-schema";
import { zstdCompressSync } from "node:zlib";

export const schema = parseSchema(`
  struct GUID { uint sessionID; uint localID; }
  struct Point { float x; float y; }
  struct Color { float r; float g; float b; float a; }
  struct Parent { GUID guid; string position; }
  message Image { byte[] hash = 1; }
  message Paint { string type = 1; Color color = 2; Image image = 3; bool visible = 4; VariableData colorVar = 5; }
  message GuidPath { GUID[] guids = 1; }
  message Symbol { GUID symbolID = 1; Node[] symbolOverrides = 2; }
  message TextData { string characters = 1; }
  message Geometry { uint commandsBlob = 1; string windingRule = 2; }
  message Reference { GUID guid = 1; }
  message PropRef { GUID defId = 1; }
  message Value { Reference alias = 1; float floatValue = 2; Color colorValue = 3; string textValue = 4; PropRef propRefValue = 5; bool boolValue = 6; TextData textDataValue = 7; }
  message VariableData { Value value = 1; }
  message ModeValue { GUID modeID = 1; VariableData variableData = 2; }
  message VariableValues { ModeValue[] entries = 1; }
  message Mode { GUID id = 1; string name = 2; }
  message ModeEntry { Reference variableSetID = 1; GUID variableModeID = 2; }
  message ModeMap { ModeEntry[] entries = 1; }
  message Binding { string variableField = 1; VariableData variableData = 2; }
  message BindingMap { Binding[] entries = 1; }
  message PropValue { TextData textValue = 1; bool boolValue = 2; }
  message PropDef { GUID id = 1; PropValue initialValue = 2; }
  message PropAssignment { GUID defID = 1; PropValue value = 2; }
  message PropReference { GUID defID = 1; string componentPropNodeField = 2; }
  message Node {
    GUID guid = 1; string type = 2; string name = 3; Parent parentIndex = 4;
    Point size = 5; bool visible = 6; bool internalOnly = 7;
    Paint[] fillPaints = 8; string stackMode = 9; float stackSpacing = 10;
    TextData textData = 11; float fontSize = 12; Symbol symbolData = 13;
    Geometry[] fillGeometry = 14; GuidPath guidPath = 15;
    Reference variableSetID = 16; Mode[] variableSetModes = 17; VariableValues variableDataValues = 18;
    ModeMap variableModeBySetMap = 19; BindingMap parameterConsumptionMap = 20;
    PropDef[] componentPropDefs = 21; PropAssignment[] componentPropAssignments = 22; PropReference[] componentPropRefs = 23;
    Reference styleIdForFill = 24;
  }
  message Blob { byte[] bytes = 1; }
  message Message { Node[] nodeChanges = 1; Blob[] blobs = 2; }
`);
export const guid = (localID: number) => ({ sessionID: 0, localID });
export const node = (id: number, parent: number, type: string, rest = {}) => ({
  guid: guid(id),
  type,
  parentIndex: { guid: guid(parent), position: String(id).padStart(4, "0") },
  ...rest,
});
export function fig(
  nodes: object[],
  options: {
    zstd?: boolean;
    zip?: boolean;
    images?: Record<string, Uint8Array>;
    blobs?: { bytes: Uint8Array }[];
    schema?: typeof schema;
  } = {},
) {
  const compress = (bytes: Uint8Array) =>
    options.zstd ? zstdCompressSync(bytes) : deflateSync(bytes);
  const chunks = [
    compress(encodeBinarySchema(options.schema ?? schema)),
    compress(
      compileSchema(schema).encodeMessage({
        nodeChanges: nodes,
        blobs: options.blobs ?? [],
      }),
    ),
  ];
  const bytes = new Uint8Array(
    12 + chunks.reduce((size, chunk) => size + 4 + chunk.length, 0),
  );
  bytes.set(strToU8("fig-kiwi"));
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 15, true);
  let offset = 12;
  for (const chunk of chunks) {
    view.setUint32(offset, chunk.length, true);
    bytes.set(chunk, offset + 4);
    offset += chunk.length + 4;
  }
  return options.zip
    ? zipSync({ "canvas.fig": bytes, ...options.images })
    : bytes;
}
