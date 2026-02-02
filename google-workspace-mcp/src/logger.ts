/**
 * Logger Module
 * Provides structured logging with levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL = (process.env.LOG_LEVEL?.toUpperCase() as keyof typeof LogLevel) || "INFO";
const currentLevel = LogLevel[LOG_LEVEL] ?? LogLevel.INFO;

function formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (currentLevel <= LogLevel.DEBUG) {
      console.error(formatMessage("DEBUG", message, meta));
    }
  },

  info(message: string, meta?: Record<string, unknown>): void {
    if (currentLevel <= LogLevel.INFO) {
      console.error(formatMessage("INFO", message, meta));
    }
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    if (currentLevel <= LogLevel.WARN) {
      console.error(formatMessage("WARN", message, meta));
    }
  },

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    if (currentLevel <= LogLevel.ERROR) {
      const errorMeta = error instanceof Error 
        ? { ...meta, error: error.message, stack: error.stack }
        : { ...meta, error: String(error) };
      console.error(formatMessage("ERROR", message, errorMeta));
    }
  },
};

export type Logger = typeof logger;
