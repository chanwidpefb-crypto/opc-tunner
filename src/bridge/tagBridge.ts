import type { DaClientAdapter, DaTag } from "../da/types.js";
import type { UaServer } from "../ua/uaServer.js";
import type { Logger } from "../logger.js";

export interface TagBridgeOptions {
  pollIntervalMs: number;
  includePrefixes?: string[];
}

/**
 * Owns the read loop: browses the DA server once to auto-discover its tags
 * (no per-tag configuration needed), mirrors them into the UA address space,
 * then polls their values on an interval and pushes each reading into the
 * matching UA variable.
 */
export class TagBridge {
  private timer?: NodeJS.Timeout;
  private itemIds: string[] = [];
  private running = false;

  constructor(
    private readonly da: DaClientAdapter,
    private readonly ua: UaServer,
    private readonly options: TagBridgeOptions,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    await this.da.connect();
    const tags = await this.discoverTags();
    this.logger.info(`Discovered ${tags.length} DA item(s)`);
    this.ua.buildAddressSpace(tags);
    this.itemIds = tags.map((t) => t.itemId);

    this.running = true;
    await this.pollOnce();
    this.timer = setInterval(() => {
      this.pollOnce().catch((err) => this.logger.error(`Poll failed: ${(err as Error).message}`));
    }, this.options.pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    await this.da.disconnect();
  }

  private async discoverTags(): Promise<DaTag[]> {
    const all = await this.da.browseAllFlat();
    const prefixes = this.options.includePrefixes;
    if (!prefixes || prefixes.length === 0) return all;
    return all.filter((tag) => prefixes.some((prefix) => tag.itemId.startsWith(prefix)));
  }

  private async pollOnce(): Promise<void> {
    if (!this.running || this.itemIds.length === 0) return;
    const values = await this.da.readItems(this.itemIds);
    for (const v of values) {
      this.ua.updateValue(v.itemId, { value: v.value, quality: v.quality, timestamp: v.timestamp });
    }
  }
}
