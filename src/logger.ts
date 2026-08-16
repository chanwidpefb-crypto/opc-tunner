export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export function createLogger(): Logger {
  const stamp = () => new Date().toISOString();
  return {
    info: (message) => console.log(`${stamp()} INFO  ${message}`),
    warn: (message) => console.warn(`${stamp()} WARN  ${message}`),
    error: (message) => console.error(`${stamp()} ERROR ${message}`),
  };
}
