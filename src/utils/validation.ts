import type { BatchItem, ValidationResult } from "../types";

export const MAX_INPUT_LENGTH = 2000;
export const MAX_BATCH_ITEMS = 100;
export const MAX_LOGO_BYTES = 1024 * 1024;

const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "file:"]);
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]);
const URL_PROTOCOL_ERROR = "Enter a full URL starting with http:// or https://.";

export interface QrReadiness {
  ready: boolean;
  validation: ValidationResult;
  message: string | null;
}

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

  if (scheme && scheme !== "http" && scheme !== "https") {
    return {
      safe: false,
      warning: URL_PROTOCOL_ERROR,
      normalized
    };
  }

  if (scheme === "http" || scheme === "https") {
    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname.includes(".")) {
        return {
          safe: true,
          warning: "This URL has an unusual host. Confirm it is intentional.",
          normalized
        };
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
      safe: false,
      warning: URL_PROTOCOL_ERROR,
      normalized
    };
  }

  return { safe: true, warning: null, normalized };
}

export function isCompleteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const hostParts = parsed.hostname.split(".").filter(Boolean);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      hostParts.length >= 2 &&
      hostParts[hostParts.length - 1].length >= 2
    );
  } catch {
    return false;
  }
}

function looksLikeIncompleteUrl(value: string): boolean {
  return /^https?/i.test(value) && !isCompleteHttpUrl(value);
}

export function getQrGenerationReadiness(rawValue: string): QrReadiness {
  const validation = validateQrInput(rawValue);

  if (!validation.safe) {
    return { ready: false, validation, message: validation.warning };
  }

  if (looksLikeIncompleteUrl(validation.normalized)) {
    return {
      ready: false,
      validation,
      message: "Waiting for a complete URL before generating the QR code."
    };
  }

  return { ready: Boolean(validation.normalized), validation, message: validation.warning };
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

export function getReadyBatchItems(items: BatchItem[]): BatchItem[] {
  return items.filter((item) => item.validation.safe && getQrGenerationReadiness(item.value).ready);
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
