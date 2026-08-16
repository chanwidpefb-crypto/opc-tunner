import { readFileSync } from "node:fs";
import { load } from "js-yaml";

export interface AppConfig {
  da: {
    mode: "simulated" | "node-opc-da";
    pollIntervalMs: number;
    nodeOpcDa?: {
      host: string;
      domain: string;
      username: string;
      password: string;
      clsid: string;
      updateRateMs?: number;
    };
    /** Only mirror items whose itemId matches one of these prefixes; omit/empty to mirror everything found by browseAllFlat(). */
    includePrefixes?: string[];
  };
  ua: {
    port: number;
    resourcePath: string;
    allowAnonymous: boolean;
    productName: string;
  };
}

const DEFAULTS: AppConfig = {
  da: {
    mode: "simulated",
    pollIntervalMs: 1000,
  },
  ua: {
    port: 4840,
    resourcePath: "/opc-tunner",
    allowAnonymous: true,
    productName: "opc-tunner",
  },
};

export function loadConfig(path: string): AppConfig {
  const raw = load(readFileSync(path, "utf-8")) as Partial<AppConfig> | undefined;
  const config: AppConfig = {
    da: { ...DEFAULTS.da, ...raw?.da },
    ua: { ...DEFAULTS.ua, ...raw?.ua },
  };

  if (config.da.mode === "node-opc-da" && !config.da.nodeOpcDa) {
    throw new Error('config.da.mode is "node-opc-da" but config.da.nodeOpcDa is missing');
  }
  return config;
}
