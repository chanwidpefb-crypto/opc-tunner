import type { DaClientAdapter, DaTag, DaValue } from "./types.js";

export interface NodeOpcDaConfig {
  /** IP or hostname of the machine running the OPC DA server */
  host: string;
  /** Windows domain (or hostname) of the account used to authenticate over DCOM */
  domain: string;
  username: string;
  password: string;
  /**
   * CLSID (GUID) of the OPC DA server, e.g. "{F8582CF2-88FB-11D0-B850-00C0F0104305}".
   * node-opc-da talks DCOM directly, so it needs the raw CLSID rather than a
   * ProgID - look it up once in the target server's documentation or in
   * HKEY_CLASSES_ROOT\CLSID on the server machine, and it never changes.
   */
  clsid: string;
  /** Group update rate requested from the DA server, in milliseconds */
  updateRateMs?: number;
  /** Socket timeout for the underlying DCOM session, in milliseconds */
  socketTimeoutMs?: number;
}

/**
 * DA adapter backed by node-opc-da / node-dcom, a pure-JS reimplementation of
 * DCOM/DCE-RPC (no native bindings, no vendor OPC client to install). It talks
 * to the DA server's DCOM endpoint directly over the network, so this process
 * can run on the same box as the DA server, on any other Windows host, or -
 * since the DCOM stack is reimplemented in JS - even from Linux/macOS, as
 * long as the DA server's DCOM/firewall configuration allows the connection.
 *
 * This is intentionally the *only* place in the codebase that talks DCOM -
 * everything downstream works against the vendor-neutral DaClientAdapter
 * interface.
 */
export class NodeOpcDaAdapter implements DaClientAdapter {
  private comServer: any;
  private opcServer: any;
  private group: any;
  /** itemId -> { clientHandle, serverHandle }. Reads are addressed by serverHandle;
   *  results come back tagged with clientHandle, which is how we map them back to itemId. */
  private items = new Map<string, { clientHandle: number; serverHandle: number }>();
  private clientHandleToItemId = new Map<number, string>();

  constructor(private readonly config: NodeOpcDaConfig) {}

  async connect(): Promise<void> {
    // Lazily required so that environments without this optional dependency
    // (e.g. contributors on Linux without a DA server to test against) can
    // still install and run the rest of the gateway with the simulator.
    const { createServer } = await import("node-opc-da");
    const { comServer, opcServer } = await createServer(
      this.config.host,
      this.config.domain,
      this.config.username,
      this.config.password,
      this.config.clsid,
    );
    this.comServer = comServer;
    this.opcServer = opcServer;
  }

  async disconnect(): Promise<void> {
    if (this.group) {
      await this.opcServer.removeGroup(this.group, true).catch(() => undefined);
      this.group = undefined;
    }
    if (this.opcServer) {
      await this.opcServer.end().catch(() => undefined);
      this.opcServer = undefined;
    }
    this.comServer = undefined;
    this.items.clear();
    this.clientHandleToItemId.clear();
  }

  async browseAllFlat(): Promise<DaTag[]> {
    if (!this.opcServer) throw new Error("NodeOpcDaAdapter is not connected");
    const browser = await this.opcServer.getBrowser();
    const itemIds: string[] = await browser.browseAllFlat();
    return itemIds.map((itemId) => this.toDaTag(itemId));
  }

  async readItems(itemIds: string[]): Promise<DaValue[]> {
    if (!this.opcServer) throw new Error("NodeOpcDaAdapter is not connected");
    await this.ensureGroup(itemIds);

    const { constants } = await import("node-opc-da");
    const serverHandles = itemIds
      .map((id) => this.items.get(id)?.serverHandle)
      .filter((h): h is number => h !== undefined);
    if (serverHandles.length === 0) return itemIds.map((itemId) => ({ itemId, value: undefined, timestamp: new Date() }));

    const syncIO = await this.group.getSyncIO();
    const results = await syncIO.read(constants.opc.dataSource.DEVICE, serverHandles);

    const byItemId = new Map(
      results.map((r: any) => [this.clientHandleToItemId.get(r.clientHandle), r]),
    );
    return itemIds.map((itemId) => {
      const result: any = byItemId.get(itemId);
      return {
        itemId,
        value: result?.value,
        quality: result?.quality,
        timestamp: result?.timestamp ?? new Date(),
      };
    });
  }

  /** Adds any item not yet part of the read group; DA items only need to be added once. */
  private async ensureGroup(itemIds: string[]): Promise<void> {
    if (!this.group) {
      this.group = await this.opcServer.addGroup("opc-tunner", {
        active: true,
        updateRate: this.config.updateRateMs ?? 1000,
      });
    }

    const newItems = itemIds.filter((id) => !this.items.has(id));
    if (newItems.length === 0) return;

    const itemManager = await this.group.getItemManager();
    let nextClientHandle = this.items.size + 1;
    const additions = newItems.map((itemId) => ({
      itemID: itemId,
      clientHandle: nextClientHandle++,
    }));

    const results: Array<[number, { itemID: string; serverHandle: number }]> = await itemManager.add(additions);
    results.forEach(([errorCode, item], i) => {
      if (errorCode === 0) {
        const { itemID, clientHandle } = additions[i];
        this.items.set(itemID, { clientHandle, serverHandle: item.serverHandle });
        this.clientHandleToItemId.set(clientHandle, itemID);
      }
    });
  }

  private toDaTag(itemId: string): DaTag {
    const parts = itemId.split(".");
    const name = parts[parts.length - 1] ?? itemId;
    const path = parts.slice(0, -1);
    return { itemId, path, name };
  }
}
