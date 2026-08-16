import { DataType, OPCUAServer, StatusCodes, Variant, type Namespace, type UAObject, type UAVariable } from "node-opcua";
import type { DaTag } from "../da/types.js";
import { inferDataType, toVariantValue } from "./dataType.js";
import type { Logger } from "../logger.js";

export interface UaServerOptions {
  port: number;
  resourcePath: string;
  allowAnonymous: boolean;
  productName: string;
}

export interface LiveValue {
  value: unknown;
  quality?: number;
  timestamp: Date;
}

/** DA quality byte, low 6 bits: 11xxxxxx = GOOD, 00xxxxxx = BAD, 01xxxxxx = UNCERTAIN. */
function daQualityToStatusCode(quality?: number) {
  if (quality === undefined) return StatusCodes.UncertainInitialValue;
  const qualityBits = quality & 0xc0;
  if (qualityBits === 0xc0) return StatusCodes.Good;
  if (qualityBits === 0x40) return StatusCodes.Uncertain;
  return StatusCodes.Bad;
}

/**
 * Wraps node-opcua's OPCUAServer and mirrors a flat list of DA tags into a UA
 * folder tree, so any standard OPC UA client (UaExpert, Ignition, asyncua,
 * node-opcua-client, ...) can browse and read the same data over a single
 * TCP endpoint - no DCOM, no OPC Enum, no per-client configuration.
 */
export class UaServer {
  private readonly server: OPCUAServer;
  private readonly variablesByItemId = new Map<string, UAVariable>();
  private readonly foldersByPath = new Map<string, UAObject>();

  constructor(
    private readonly options: UaServerOptions,
    private readonly logger: Logger,
  ) {
    this.server = new OPCUAServer({
      port: options.port,
      resourcePath: options.resourcePath,
      allowAnonymous: options.allowAnonymous,
      buildInfo: {
        productName: options.productName,
        buildNumber: "1",
        buildDate: new Date(),
      },
    });
  }

  async start(): Promise<void> {
    await this.server.initialize();
    await this.server.start();
    const endpointUrl = this.server.endpoints[0].endpointDescriptions()[0].endpointUrl;
    this.logger.info(`OPC UA server listening at ${endpointUrl}`);
  }

  async stop(): Promise<void> {
    await this.server.shutdown();
  }

  /** Creates (or reuses) the UA nodes needed to mirror the given DA tags; safe to call repeatedly. */
  buildAddressSpace(tags: DaTag[]): void {
    const namespace = this.server.engine.addressSpace!.getOwnNamespace();
    for (const tag of tags) {
      if (this.variablesByItemId.has(tag.itemId)) continue;
      const parent = this.getOrCreateFolder(namespace, tag.path);
      // DataType.Variant (BaseDataType) lets the node accept whatever concrete
      // type each poll produces (Double, Int32, Boolean, String, ...) without
      // knowing it up front - DA items can be any of those. A plain initial
      // Variant (rather than a get() binding) keeps the node a simple value
      // holder, so setValueFromSource() below actually updates what reads see.
      const variable = namespace.addVariable({
        componentOf: parent,
        browseName: tag.name,
        dataType: DataType.Variant,
        minimumSamplingInterval: 100,
        value: new Variant({ dataType: DataType.String, value: "" }),
      });
      this.variablesByItemId.set(tag.itemId, variable);
    }
  }

  /** Pushes a freshly-read DA value into its mirrored UA variable, triggering subscriptions/monitored items. */
  updateValue(itemId: string, live: LiveValue): void {
    const variable = this.variablesByItemId.get(itemId);
    if (!variable) return;
    const dataType = inferDataType(live.value);
    variable.setValueFromSource(
      new Variant({ dataType, value: toVariantValue(dataType, live.value) }),
      daQualityToStatusCode(live.quality),
      live.timestamp,
    );
  }

  private getOrCreateFolder(namespace: Namespace, path: string[]): UAObject {
    const addressSpace = this.server.engine.addressSpace!;
    let parent: UAObject = addressSpace.rootFolder.objects;
    let key = "";
    for (const segment of path) {
      key = key ? `${key}/${segment}` : segment;
      let folder = this.foldersByPath.get(key);
      if (!folder) {
        folder = namespace.addFolder(parent, { browseName: segment }) as UAObject;
        this.foldersByPath.set(key, folder);
      }
      parent = folder;
    }
    return parent;
  }
}
