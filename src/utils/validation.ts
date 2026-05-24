import type { BatchItem, ValidationResult } from "../types";

export const MAX_INPUT_LENGTH = 2000;
export const MAX_BATCH_ITEMS = 100;
export const MAX_LOGO_BYTES = 1024 * 1024;

const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "file:"]);
const TRUSTED_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]);

export function trimToLimit(value: string, limit = MAX_INPUT_LENGTH): string {
  return value.slice(0, limit);
}

export function validateQrInput(rawValue: string): ValidationResult {
  const normalized = trimToLimit(rawValue.trim());

  if (!normalized) {
    return { safe: false, warning: "Enter text or a URL to generate a QR code.", normalized };
  }

  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/i);
  const scheme = schemeMatch?.[1]?.toLowerCase();

  if (scheme && BLOCKED_SCHEMES.has(`${scheme}:`)) {
    return {
      safe: false,
      warning: "This URL scheme is blocked for safety.",
      normalized
    };
  }

  if (scheme && !TRUSTED_SCHEMES.has(`${scheme}:`)) {
    return {
      safe: true,
      warning: "This uses an uncommon URL scheme. Verify it before sharing.",
      normalized
    };
  }

  if (scheme && TRUSTED_SCHEMES.has(`${scheme}:`)) {
    try {
      if (scheme === "http" || scheme === "https") {
        const parsed = new URL(normalized);
        if (!parsed.hostname.includes(".")) {
          return {
            safe: true,
            warning: "This URL has an unusual host. Confirm it is intentional.",
            normalized
          };
        }
      }
      return { safe: true, warning: null, normalized };
    } catch {
      return {
        safe: true,
        warning: "This looks like a URL but could not be fully validated.",
        normalized
      };
    }
  }

  if (/^www\./i.test(normalized) || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(normalized)) {
    return {
      safe: true,
      warning: "This looks like a URL without a protocol. Consider adding https://.",
      normalized
    };
  }

  return { safe: true, warning: null, normalized };
}

export function parseBatchInput(rawValue: string): BatchItem[] {
  return rawValue
    .split(/\r?\n/)
    .map((line) => trimToLimit(line.trim()))
    .filter(Boolean)
    .slice(0, MAX_BATCH_ITEMS)
    .map((value, index) => ({
      id: `${index}-${value}`,
      value,
      validation: validateQrInput(value)
    }));
}

export function safeFilename(value: string, fallback = "qr-code"): string {
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return compact || fallback;
}

export function validateLogoFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const extensionOk = extension ? ["png", "jpg", "jpeg", "svg"].includes(extension) : false;

  if (file.size > MAX_LOGO_BYTES) {
    return "Logo must be 1 MB or smaller.";
  }

  if (!LOGO_TYPES.has(file.type) || !extensionOk) {
    return "Logo must be a PNG, JPG, JPEG, or SVG file.";
  }

  return null;
}
