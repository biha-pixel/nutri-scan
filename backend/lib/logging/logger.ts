/**
 * Production Logger
 *
 * Replaces unformatted `console.log` with structured JSON logs.
 * This is crucial for observability platforms (DataDog, Cloudwatch, Vercel Logs)
 * which parse JSON automatically for filtering and alerts.
 */

type LogLevel = "info" | "warn" | "error";

interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: any; // Additional metadata
}

function writeLog(level: LogLevel, message: string, metadata?: Record<string, any>) {
  const logEntry: LogMessage = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  // Check if we are in production
  if (process.env.NODE_ENV === "production") {
    // In production, ALWAYS log as a structured JSON string
    console[level](JSON.stringify(logEntry));
  } else {
    // In development, log in human-readable format
    if (metadata && Object.keys(metadata).length > 0) {
      console[level](`[${level.toUpperCase()}] ${message}`, metadata);
    } else {
      console[level](`[${level.toUpperCase()}] ${message}`);
    }
  }
}

export const logger = {
  info: (message: string, metadata?: Record<string, any>) => writeLog("info", message, metadata),
  warn: (message: string, metadata?: Record<string, any>) => writeLog("warn", message, metadata),
  error: (message: string, metadata?: Record<string, any>) => writeLog("error", message, metadata),
};
