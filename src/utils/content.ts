import type { ContentFields, ContentType, ValidationResult } from "../types";
import { isCompleteHttpUrl, validateQrInput } from "./validation";

const REQUIRED_URL_MESSAGE = "Enter a full URL starting with http:// or https://.";
const URL_STUB_MESSAGE = "Keep typing to complete the URL.";

export const defaultContentFields: ContentFields = {
  url: "https://example.com",
  pdf: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  contactCompany: "",
  contactWebsite: "",
  text: "Hello World",
  app: "",
  smsPhone: "",
  smsMessage: "",
  emailTo: "",
  emailSubject: "",
  emailBody: "",
  phone: ""
};

function result(safe: boolean, normalized: string, warning: string | null): ValidationResult {
  return { safe, normalized, warning };
}

function validateHttpUrl(value: string, requiredLabel = "URL"): ValidationResult {
  const validation = validateQrInput(value);
  if (!validation.normalized) return result(false, "", `${requiredLabel} is required.`);
  if (!isCompleteHttpUrl(validation.normalized)) {
    return result(false, validation.normalized, validation.warning ?? URL_STUB_MESSAGE);
  }
  return validation;
}

function validateEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function validatePhoneNumber(value: string): boolean {
  return value.replace(/[^\d+]/g, "").replace(/^\+/, "").length >= 7;
}

function encodeMailto(to: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject.trim()) params.set("subject", subject.trim());
  if (body.trim()) params.set("body", body.trim());
  const query = params.toString();
  return `mailto:${to.trim()}${query ? `?${query}` : ""}`;
}

function escapeVcard(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function getContentPayload(type: ContentType, fields: ContentFields): ValidationResult {
  if (type === "url") return validateHttpUrl(fields.url);
  if (type === "pdf") return validateHttpUrl(fields.pdf, "PDF URL");
  if (type === "app") return validateHttpUrl(fields.app, "App URL");

  if (type === "text") {
    const normalized = fields.text.trim();
    return result(Boolean(normalized), normalized, normalized ? null : "Enter plain text.");
  }

  if (type === "sms") {
    if (!validatePhoneNumber(fields.smsPhone)) return result(false, fields.smsPhone.trim(), "Enter a valid phone number.");
    const phone = fields.smsPhone.trim();
    const message = fields.smsMessage.trim();
    return result(true, `SMSTO:${phone}:${message}`, null);
  }

  if (type === "email") {
    if (!validateEmailAddress(fields.emailTo)) return result(false, fields.emailTo.trim(), "Enter a valid email address.");
    return result(true, encodeMailto(fields.emailTo, fields.emailSubject, fields.emailBody), null);
  }

  if (type === "phone") {
    if (!validatePhoneNumber(fields.phone)) return result(false, fields.phone.trim(), "Enter a valid phone number.");
    return result(true, `tel:${fields.phone.trim()}`, null);
  }

  const hasContact = [fields.contactName, fields.contactPhone, fields.contactEmail, fields.contactCompany, fields.contactWebsite]
    .some((value) => value.trim());
  if (!hasContact) return result(false, "", "Enter contact details.");
  if (fields.contactEmail.trim() && !validateEmailAddress(fields.contactEmail)) {
    return result(false, fields.contactEmail.trim(), "Enter a valid email address.");
  }
  if (fields.contactPhone.trim() && !validatePhoneNumber(fields.contactPhone)) {
    return result(false, fields.contactPhone.trim(), "Enter a valid phone number.");
  }
  if (fields.contactWebsite.trim() && !validateHttpUrl(fields.contactWebsite, "Website").safe) {
    return result(false, fields.contactWebsite.trim(), REQUIRED_URL_MESSAGE);
  }

  const payload = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    fields.contactName.trim() ? `FN:${escapeVcard(fields.contactName.trim())}` : "",
    fields.contactCompany.trim() ? `ORG:${escapeVcard(fields.contactCompany.trim())}` : "",
    fields.contactPhone.trim() ? `TEL:${escapeVcard(fields.contactPhone.trim())}` : "",
    fields.contactEmail.trim() ? `EMAIL:${escapeVcard(fields.contactEmail.trim())}` : "",
    fields.contactWebsite.trim() ? `URL:${escapeVcard(fields.contactWebsite.trim())}` : "",
    "END:VCARD"
  ].filter(Boolean).join("\n");

  return result(true, payload, null);
}
