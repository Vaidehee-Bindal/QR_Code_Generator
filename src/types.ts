export type Mode = "single" | "batch";
export type Theme = "light" | "dark";
export type QrSize = 128 | 256 | 512;
export type ErrorLevel = "L" | "M" | "Q" | "H";
export type ExportFormat = "png" | "svg" | "pdf";
export type ContentType = "url" | "pdf" | "contact" | "text" | "app" | "sms" | "email" | "phone";

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

export interface ContentFields {
  url: string;
  pdf: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactCompany: string;
  contactWebsite: string;
  text: string;
  app: string;
  smsPhone: string;
  smsMessage: string;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  phone: string;
}
