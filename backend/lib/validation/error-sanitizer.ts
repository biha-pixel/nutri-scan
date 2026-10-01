/**
 * Error Message Sanitization
 *
 * This module sanitizes error messages before sending them to clients,
 * preventing information leakage about internal system details.
 *
 * WHY THIS MATTERS:
 * Raw error messages can reveal:
 * - Database schema and table names
 * - File paths and directory structure
 * - API keys or connection strings in stack traces
 * - Framework versions and internal module names
 *
 * Attackers use this information to map your system and find vulnerabilities.
 */

interface SanitizedError {
  message: string;
  code: string;
}

/**
 * Patterns that indicate internal implementation details.
 * These should never appear in client-facing error messages.
 */
const SENSITIVE_PATTERNS = [
  /\/[A-Z]:[\\\/].+/gi,           // Windows file paths (C:\Users\...)
  /\/home\/[^\/\s]+/gi,           // Unix home directories
  /\/var\/[^\/\s]+/gi,            // Unix var directories
  /\.env\.[a-z]+/gi,              // Environment file names
  /postgres:\/\/.+/gi,            // Database connection strings
  /https?:\/\/localhost:\d+/gi,   // Local service URLs
  /at .+ \(.+:\d+:\d+\)/gi,       // Stack trace lines
  /Error: .+\n\s+at/gi,           // Multi-line stack traces
  /"[A-Z_]+_KEY":/gi,             // Environment variable names
  /password|token|secret|key/gi,  // Sensitive field names (when in error context)
];

/**
 * Replace sensitive patterns with generic placeholders.
 */
function redactSensitiveInfo(message: string): string {
  let sanitized = message;

  // Replace file paths with "[path]"
  sanitized = sanitized.replace(/\/[A-Z]:[\\\/][^\s]+/gi, "[path]");
  sanitized = sanitized.replace(/\/home\/[^\/\s]+[^\s]*/gi, "[path]");
  sanitized = sanitized.replace(/\/var\/[^\/\s]+[^\s]*/gi, "[path]");

  // Replace connection strings with "[connection]"
  sanitized = sanitized.replace(/postgres:\/\/[^\s]+/gi, "[connection]");
  sanitized = sanitized.replace(/https?:\/\/localhost:\d+[^\s]*/gi, "[connection]");

  // Remove stack traces entirely
  sanitized = sanitized.replace(/\n\s+at .+/g, "");
  sanitized = sanitized.replace(/Error: .+\n\s+at .+/g, "Error");

  // Replace environment variable references
  sanitized = sanitized.replace(/"[A-Z_]+_KEY":/gi, '"[KEY]":');

  return sanitized;
}

/**
 * Sanitize an error for client consumption.
 *
 * Takes any error object and returns a safe message that doesn't leak
 * internal implementation details.
 *
 * @param error - The original error (Error object, string, or unknown)
 * @param context - A safe context label like "database" or "validation"
 * @returns A sanitized error with message and code
 */
export function sanitizeError(
  error: unknown,
  context: string = "request"
): SanitizedError {
  // Default safe error
  const fallback: SanitizedError = {
    message: `An error occurred while processing your ${context}. Please try again.`,
    code: "INTERNAL_ERROR",
  };

  if (!error) {
    return fallback;
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = redactSensitiveInfo(error.message);

    // Don't expose detailed validation errors if they contain sensitive info
    if (message.toLowerCase().includes("postgres") ||
        message.toLowerCase().includes("database") ||
        message.includes("[path]") ||
        message.includes("[connection]")) {
      return {
        message: `A ${context} error occurred. Please try again.`,
        code: "INTERNAL_ERROR",
      };
    }

    // Safe validation errors can pass through (they're user-facing by design)
    if (error.name === "ZodError" || message.includes("validation")) {
      return {
        message: message.substring(0, 200), // Limit length
        code: "VALIDATION_ERROR",
      };
    }

    return {
      message: message.substring(0, 200),
      code: error.name.toUpperCase().replace(/ERROR$/, "") || "ERROR",
    };
  }

  // Handle string errors
  if (typeof error === "string") {
    const message = redactSensitiveInfo(error);
    return {
      message: message.substring(0, 200),
      code: "ERROR",
    };
  }

  // Unknown error shape - return generic message
  return fallback;
}

/**
 * Check if a value is safe to log (doesn't contain secrets or PII).
 *
 * Use this before logging request bodies, query params, or other user input.
 */
export function isSafeToLog(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const lower = value.toLowerCase();

  // Check for common secret patterns
  if (lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("api_key") ||
      lower.includes("secret") ||
      lower.includes("authorization")) {
    return false;
  }

  // Check for base64-encoded data (potential secrets)
  if (/^[A-Za-z0-9+/]{40,}={0,2}$/.test(value)) {
    return false;
  }

  return true;
}
