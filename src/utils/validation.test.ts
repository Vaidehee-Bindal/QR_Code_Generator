import { describe, expect, it } from "vitest";
import { parseBatchInput, safeFilename, validateLogoFile, validateQrInput } from "./validation";

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

  it("warns for URL-like values without protocol", () => {
    const result = validateQrInput("example.com/path");
    expect(result.safe).toBe(true);
    expect(result.warning).toContain("protocol");
  });
});

describe("parseBatchInput", () => {
  it("trims empty rows and caps at 100 items", () => {
    const input = Array.from({ length: 105 }, (_, index) => `item-${index}`).join("\n");
    expect(parseBatchInput(`\n${input}\n`)).toHaveLength(100);
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
