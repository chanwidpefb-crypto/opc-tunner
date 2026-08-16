import { describe, it, expect, afterEach } from "vitest";
import { AttributeIds, OPCUAClient } from "node-opcua";
import { SimulatedDaAdapter } from "../src/da/simulatedAdapter.js";
import { UaServer } from "../src/ua/uaServer.js";
import { TagBridge } from "../src/bridge/tagBridge.js";
import { createLogger } from "../src/logger.js";

describe("DA -> UA bridge (simulated DA server)", () => {
  let uaServer: UaServer | undefined;
  let bridge: TagBridge | undefined;

  afterEach(async () => {
    await bridge?.stop();
    await uaServer?.stop();
    uaServer = undefined;
    bridge = undefined;
  });

  it("auto-discovers DA tags and exposes them as readable UA variables over plain TCP", async () => {
    const port = 4850;
    const logger = createLogger();
    uaServer = new UaServer(
      { port, resourcePath: "/opc-tunner-test", allowAnonymous: true, productName: "opc-tunner-test" },
      logger,
    );
    await uaServer.start();

    bridge = new TagBridge(new SimulatedDaAdapter(), uaServer, { pollIntervalMs: 200 }, logger);
    await bridge.start();

    const client = OPCUAClient.create({ endpointMustExist: false });
    const endpointUrl = `opc.tcp://localhost:${port}/opc-tunner-test`;

    await client.withSessionAsync(endpointUrl, async (session) => {
      const objects = await session.browse("ObjectsFolder");
      const channel1 = objects.references.find((r) => r.browseName.name === "Channel1");
      expect(channel1).toBeDefined();

      const channelBrowse = await session.browse(channel1!.nodeId);
      const device1 = channelBrowse.references.find((r) => r.browseName.name === "Device1");
      expect(device1).toBeDefined();

      const device1Browse = await session.browse(device1!.nodeId);
      const temperature = device1Browse.references.find((r) => r.browseName.name === "Temperature");
      expect(temperature).toBeDefined();

      const first = await session.read({ nodeId: temperature!.nodeId, attributeId: AttributeIds.Value });
      expect(first.statusCode.isGood()).toBe(true);
      expect(typeof first.value.value).toBe("number");

      // No per-tag config was ever written for "Temperature" - it was auto-discovered
      // via browseAllFlat() and mirrored automatically, matching the goal of the gateway.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const second = await session.read({ nodeId: temperature!.nodeId, attributeId: AttributeIds.Value });
      expect(second.sourceTimestamp!.getTime()).toBeGreaterThan(first.sourceTimestamp!.getTime());
    });
  }, 15000);
});
