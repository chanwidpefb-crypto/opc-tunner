/**
 * Vendor-neutral shape for a single OPC DA item, whether it came from a real
 * DCOM browse or the built-in simulator. Paths use "/" as separator so they
 * map cleanly onto an OPC UA folder tree.
 */
export interface DaTag {
  /** Full OPC item ID as understood by the DA server, e.g. "Channel1.Device1.Tag1" */
  itemId: string;
  /** Folder path split from itemId, e.g. ["Channel1", "Device1"] */
  path: string[];
  /** Leaf name shown in the UA address space, e.g. "Tag1" */
  name: string;
}

export interface DaValue {
  itemId: string;
  value: unknown;
  /** OPC DA quality (192 = GOOD in the DA quality bitfield); undefined if unknown */
  quality?: number;
  timestamp: Date;
}

/**
 * Everything the bridge needs from a DA connection. Implemented once against
 * a real DCOM session (NodeOpcDaAdapter) and once as an in-memory fixture
 * (SimulatedDaAdapter) so the bridge and the UA server can be exercised
 * without a live PLC or Windows host.
 */
export interface DaClientAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Auto-discovers every leaf item the server exposes - no per-tag setup needed. */
  browseAllFlat(): Promise<DaTag[]>;
  /** Reads the current value of every requested item in one round-trip. */
  readItems(itemIds: string[]): Promise<DaValue[]>;
}
