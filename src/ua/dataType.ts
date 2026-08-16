import { DataType } from "node-opcua";

/** Best-effort mapping from a JS value coming out of OPC DA to a UA Variant DataType. */
export function inferDataType(value: unknown): DataType {
  switch (typeof value) {
    case "number":
      return Number.isInteger(value) ? DataType.Int32 : DataType.Double;
    case "boolean":
      return DataType.Boolean;
    case "string":
      return DataType.String;
    default:
      return DataType.String;
  }
}

export function toVariantValue(dataType: DataType, value: unknown): unknown {
  if (dataType === DataType.String && typeof value !== "string") {
    return value === undefined || value === null ? "" : JSON.stringify(value);
  }
  return value;
}
