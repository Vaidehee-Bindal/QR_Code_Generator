export type Mode = "single" | "batch";
export type Theme = "light" | "dark";
export type QrSize = 128 | 256 | 512;
export type ErrorLevel = "L" | "M" | "Q" | "H";
export type ExportFormat = "png" | "svg" | "pdf";

export interface QrOptions {
  size: QrSize;
  errorLevel: ErrorLevel;
}

export interface ValidationResult {
  safe: boolean;
  warning: string | null;
  normalized: string;
}

export interface LogoAsset {
  file: File;
  dataUrl: string;
  mime: string;
}

export interface BatchItem {
  id: string;
  value: string;
  validation: ValidationResult;
}
