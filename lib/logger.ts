export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || "info";

function formatLogEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LOG_LEVEL]) return;

  const entry = formatLogEntry(level, message, context);

  if (process.env.NODE_ENV === "production") {
    // Structured JSON logging for production (OnRender, etc.)
    const output = JSON.stringify(entry);
    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  } else {
    // Human-readable logging for development
    const prefix = `[${entry.timestamp}] ${level.toUpperCase()}`;
    const contextStr = context ? `\n${JSON.stringify(context, null, 2)}` : "";
    switch (level) {
      case "error":
        console.error(`${prefix} ${message}${contextStr}`);
        break;
      case "warn":
        console.warn(`${prefix} ${message}${contextStr}`);
        break;
      default:
        console.log(`${prefix} ${message}${contextStr}`);
    }
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => log("error", message, context),
};
