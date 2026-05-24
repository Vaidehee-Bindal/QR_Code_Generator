import { describe, expect, it } from "vitest";
import {
  getQrGenerationReadiness,
  getReadyBatchItems,
  parseBatchInput,
  safeFilename,
  validateLogoFile,
  validateQrInput
} from "./validation";

function makeFile(name: string, type: string, size = 128): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateQrInput", () => {
  it("rejects dangerous schemes", () => {
    expect(validateQrInput("javascript:alert(1)").safe).toBe(false);
    expect(validateQrInput("data:text/html,<script>x</script>").safe).toBe(false);
  });

  it("allows plain text without warning", () => {
    expect(validateQrInput("Hello World")).toEqual({
      safe: true,
      warning: null,
      normalized: "Hello World"
    });
  });

  it("rejects URL-like values without http or https", () => {
    const result = validateQrInput("example.com/path");
    expect(result.safe).toBe(false);
    expect(result.warning).toBe("Enter a full URL starting with http:// or https://.");
  });

  it("rejects non-http URL schemes", () => {
    const result = validateQrInput("ftp://example.com");
    expect(result.safe).toBe(false);
    expect(result.warning).toBe("Enter a full URL starting with http:// or https://.");
  });
});

describe("parseBatchInput", () => {
  it("trims empty rows and caps at 100 items", () => {
    const input = Array.from({ length: 105 }, (_, index) => `item-${index}`).join("\n");
    expect(parseBatchInput(`\n${input}\n`)).toHaveLength(100);
  });
});

describe("getQrGenerationReadiness", () => {
  it("waits for incomplete http URLs", () => {
    expect(getQrGenerationReadiness("https").ready).toBe(false);
    expect(getQrGenerationReadiness("https:").ready).toBe(false);
    const result = getQrGenerationReadiness("https://exa");
    expect(result.ready).toBe(false);
    expect(result.message).toContain("complete URL");
  });

  it("allows complete URLs and plain text", () => {
    expect(getQrGenerationReadiness("https://example.com").ready).toBe(true);
    expect(getQrGenerationReadiness("Hello World").ready).toBe(true);
  });

  it("filters batch items to only ready values", () => {
    const items = parseBatchInput("https://exa\nexample.com\nhttps://example.com\nHello World");
    expect(getReadyBatchItems(items).map((item) => item.value)).toEqual(["https://example.com", "Hello World"]);
  });
});

describe("safeFilename", () => {
  it("creates deterministic filesystem-friendly names", () => {
    expect(safeFilename("https://Example.com/A Thing?x=1")).toBe("example-com-a-thing-x-1");
    expect(safeFilename("")).toBe("qr-code");
  });
});

describe("validateLogoFile", () => {
  it("accepts supported small image files", () => {
    expect(validateLogoFile(makeFile("logo.png", "image/png"))).toBeNull();
  });

  it("rejects unsupported or oversized files", () => {
    expect(validateLogoFile(makeFile("logo.gif", "image/gif"))).toContain("PNG");
    expect(validateLogoFile(makeFile("logo.png", "image/png", 1024 * 1024 + 1))).toContain("1 MB");
  });
});
