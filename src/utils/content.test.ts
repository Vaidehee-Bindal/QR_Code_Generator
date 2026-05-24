import { describe, expect, it } from "vitest";
import { defaultContentFields, getContentPayload } from "./content";

describe("getContentPayload", () => {
  it("builds URL payloads only for http or https URLs", () => {
    expect(getContentPayload("url", { ...defaultContentFields, url: "https://example.com" }).safe).toBe(true);
    expect(getContentPayload("url", { ...defaultContentFields, url: "h" }).safe).toBe(false);
    expect(getContentPayload("url", { ...defaultContentFields, url: "example.com" }).warning).toBe(
      "Enter a full URL starting with http:// or https://."
    );
    expect(getContentPayload("pdf", { ...defaultContentFields, pdf: "h" }).safe).toBe(false);
  });

  it("builds vCard contact payloads", () => {
    const payload = getContentPayload("contact", {
      ...defaultContentFields,
      contactName: "Jane Doe",
      contactPhone: "+15551234567",
      contactEmail: "jane@example.com"
    });
    expect(payload.safe).toBe(true);
    expect(payload.normalized).toContain("BEGIN:VCARD");
    expect(payload.normalized).toContain("FN:Jane Doe");
  });

  it("builds SMS, email, and phone payloads", () => {
    expect(getContentPayload("sms", { ...defaultContentFields, smsPhone: "+15551234567", smsMessage: "Hi" }).normalized)
      .toBe("SMSTO:+15551234567:Hi");
    expect(getContentPayload("email", { ...defaultContentFields, emailTo: "a@b.com", emailSubject: "Hello" }).normalized)
      .toBe("mailto:a@b.com?subject=Hello");
    expect(getContentPayload("phone", { ...defaultContentFields, phone: "+15551234567" }).normalized)
      .toBe("tel:+15551234567");
  });

});
