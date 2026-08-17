// Produces a self-contained offline package in dist-offline/:
//   opc-tunner.cjs         - the whole app (all deps) as one file, via esbuild
//   nodesets/*.xml         - OPC UA standard nodeset node-opcua needs at runtime
//   config/config.example.yaml
//   start-windows.bat      - launcher assuming a portable Node.js runtime in node/
//
// Run on any machine with internet access, then copy the whole dist-offline/
// folder (plus a portable Node.js runtime - see packaging/README.md) to the
// offline target machine. No `npm install` or internet access needed there.
import { build } from "esbuild";
import { cpSync, mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "dist-offline");

await build({
  entryPoints: [path.join(root, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: path.join(outDir, "opc-tunner.cjs"),
  // optional dep of node-opcua's file-locking helper; not needed for this app
  external: ["proper-lockfile"],
});

mkdirSync(path.join(outDir, "nodesets"), { recursive: true });
copyFileSync(
  path.join(root, "node_modules/node-opcua-nodesets/nodesets/Opc.Ua.NodeSet2.xml"),
  path.join(outDir, "nodesets/Opc.Ua.NodeSet2.xml"),
);

mkdirSync(path.join(outDir, "config"), { recursive: true });
copyFileSync(path.join(root, "config/config.example.yaml"), path.join(outDir, "config/config.example.yaml"));

copyFileSync(path.join(root, "packaging/start-windows.bat"), path.join(outDir, "start-windows.bat"));

console.log(`Offline package ready in ${outDir}`);
