import type { DaClientAdapter, DaTag, DaValue } from "./types.js";

/**
 * Stand-in DA server for demos, dev boxes and CI - none of which have a real
 * DCOM/OPC-DA endpoint reachable. Produces a small fixed tag tree with
 * values that drift over time, so the rest of the pipeline (bridge -> UA
 * address space -> UA client) can be exercised end to end without hardware.
 */
export class SimulatedDaAdapter implements DaClientAdapter {
  private readonly tags: DaTag[] = [
    { itemId: "Channel1.Device1.Temperature", path: ["Channel1", "Device1"], name: "Temperature" },
    { itemId: "Channel1.Device1.Pressure", path: ["Channel1", "Device1"], name: "Pressure" },
    { itemId: "Channel1.Device2.RunningHours", path: ["Channel1", "Device2"], name: "RunningHours" },
    { itemId: "Channel1.Device2.Fault", path: ["Channel1", "Device2"], name: "Fault" },
  ];

  private readonly state = new Map<string, number>([
    ["Channel1.Device1.Temperature", 65],
    ["Channel1.Device1.Pressure", 4.2],
    ["Channel1.Device2.RunningHours", 1200],
    ["Channel1.Device2.Fault", 0],
  ]);

  async connect(): Promise<void> {
    // nothing to do - simulator is always "connected"
  }

  async disconnect(): Promise<void> {
    // nothing to do
  }

  async browseAllFlat(): Promise<DaTag[]> {
    return this.tags;
  }

  async readItems(itemIds: string[]): Promise<DaValue[]> {
    const now = new Date();
    return itemIds.map((itemId) => {
      const previous = this.state.get(itemId) ?? 0;
      const next = this.drift(itemId, previous);
      this.state.set(itemId, next);
      return { itemId, value: next, quality: 192, timestamp: now };
    });
  }

  private drift(itemId: string, previous: number): number {
    if (itemId.endsWith("RunningHours")) return previous + 1 / 3600;
    if (itemId.endsWith("Fault")) return Math.random() < 0.02 ? 1 : 0;
    const noise = (Math.random() - 0.5) * 0.5;
    return Math.round((previous + noise) * 100) / 100;
  }
}
