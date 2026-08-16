import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { SimulatedDaAdapter } from "./da/simulatedAdapter.js";
import { NodeOpcDaAdapter } from "./da/nodeOpcDaAdapter.js";
import type { DaClientAdapter } from "./da/types.js";
import { UaServer } from "./ua/uaServer.js";
import { TagBridge } from "./bridge/tagBridge.js";

async function main() {
  const logger = createLogger();
  const configPath = process.argv[2] ?? "config/config.yaml";
  const config = loadConfig(configPath);
  logger.info(`Loaded config from ${configPath} (da.mode=${config.da.mode})`);

  const adapter: DaClientAdapter =
    config.da.mode === "node-opc-da"
      ? new NodeOpcDaAdapter(config.da.nodeOpcDa!)
      : new SimulatedDaAdapter();

  const uaServer = new UaServer(config.ua, logger);
  await uaServer.start();

  const bridge = new TagBridge(
    adapter,
    uaServer,
    { pollIntervalMs: config.da.pollIntervalMs, includePrefixes: config.da.includePrefixes },
    logger,
  );
  await bridge.start();
  logger.info("Bridge running - DA tags are now mirrored as OPC UA variables");

  const shutdown = async () => {
    logger.info("Shutting down...");
    await bridge.stop();
    await uaServer.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
