import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { BatchItem, ExportFormat, LogoAsset, QrOptions } from "../types";
import { safeFilename } from "./validation";

const MARGIN = 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load logo image."));
    image.src = src;
  });
}

function removeCheckerboardBackground(source: HTMLImageElement, size: number): HTMLCanvasElement {
  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = size;
  logoCanvas.height = size;
  const logoContext = logoCanvas.getContext("2d", { willReadFrequently: true });

  if (!logoContext) return logoCanvas;

  logoContext.clearRect(0, 0, size, size);
  logoContext.drawImage(source, 0, 0, size, size);

  const imageData = logoContext.getImageData(0, 0, size, size);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];
    const isLightChecker = red > 220 && green > 220 && blue > 220;
    const isGrayChecker = Math.abs(red - green) < 4 && Math.abs(green - blue) < 4 && red >= 185 && red <= 225;

    if (alpha > 0 && (isLightChecker || isGrayChecker)) {
      data[index + 3] = 0;
    }
  }

  logoContext.putImageData(imageData, 0, 0);
  return logoCanvas;
}

export async function generatePngDataUrl(
  value: string,
  options: QrOptions,
  logo?: LogoAsset | null
): Promise<string> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, value, {
    width: options.size,
    margin: MARGIN,
    errorCorrectionLevel: options.errorLevel,
    color: { dark: "#000000", light: "#ffffff" }
  });

  if (logo) {
    const context = canvas.getContext("2d");
    if (context) {
      const image = await loadImage(logo.dataUrl);
      const logoSize = Math.round(options.size * 0.2);
      const x = (canvas.width - logoSize) / 2;
      const y = (canvas.height - logoSize) / 2;
      const radius = Math.max(8, Math.round(logoSize * 0.12));

      context.fillStyle = "#ffffff";
      context.beginPath();
      context.roundRect(x - 6, y - 6, logoSize + 12, logoSize + 12, radius);
      context.fill();
      context.drawImage(removeCheckerboardBackground(image, logoSize), x, y, logoSize, logoSize);
    }
  }

  return canvas.toDataURL("image/png");
}

export async function generateSvg(value: string, options: QrOptions): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    width: options.size,
    margin: MARGIN,
    errorCorrectionLevel: options.errorLevel,
    color: { dark: "#000000", light: "#ffffff" }
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function createPdfBlob(
  value: string,
  options: QrOptions,
  logo?: LogoAsset | null
): Promise<Blob> {
  const dataUrl = await generatePngDataUrl(value, options, logo);
  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [options.size + 96, options.size + 136] });
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, options.size + 96, options.size + 136, "F");
  pdf.addImage(dataUrl, "PNG", 48, 32, options.size, options.size);
  pdf.setFontSize(11);
  pdf.setTextColor(31, 41, 55);
  pdf.text(value.slice(0, 80), 48, options.size + 72, { maxWidth: options.size });
  return pdf.output("blob");
}

export async function createExportBlob(
  value: string,
  format: ExportFormat,
  options: QrOptions,
  logo?: LogoAsset | null
): Promise<Blob> {
  if (format === "svg") {
    return new Blob([await generateSvg(value, options)], { type: "image/svg+xml;charset=utf-8" });
  }

  if (format === "pdf") {
    return createPdfBlob(value, options, logo);
  }

  return dataUrlToBlob(await generatePngDataUrl(value, options, logo));
}

export async function createBatchZip(
  items: BatchItem[],
  format: ExportFormat,
  options: QrOptions,
  logo?: LogoAsset | null
): Promise<Blob> {
  const zip = new JSZip();
  const safeItems = items.filter((item) => item.validation.safe);

  await Promise.all(
    safeItems.map(async (item, index) => {
      const blob = await createExportBlob(item.value, format, options, logo);
      const extension = format;
      const name = `${String(index + 1).padStart(2, "0")}-${safeFilename(item.value)}.${extension}`;
      zip.file(name, blob);
    })
  );

  return zip.generateAsync({ type: "blob" });
}

export async function copyToClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export async function copyImageToClipboard(dataUrl: string): Promise<void> {
  const blob = await dataUrlToBlob(dataUrl);
  if ("ClipboardItem" in window && navigator.clipboard.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return;
    } catch {
      // Fall back to copying the data URL when image clipboard writes are unavailable.
    }
  }

  await navigator.clipboard.writeText(dataUrl);
}

export { safeFilename };
