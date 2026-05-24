import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Copy,
  Download,
  File,
  Image,
  Layers,
  Link,
  Moon,
  Palette,
  QrCode,
  RefreshCw,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  Zap
} from "lucide-react";
import type { BatchItem, ErrorLevel, ExportFormat, LogoAsset, Mode, QrOptions, QrSize, Theme } from "./types";
import {
  copyImageToClipboard,
  copyToClipboard,
  createBatchZip,
  createExportBlob,
  downloadBlob,
  generatePngDataUrl,
  safeFilename
} from "./utils/qr";
import { MAX_BATCH_ITEMS, MAX_INPUT_LENGTH, parseBatchInput, validateLogoFile, validateQrInput } from "./utils/validation";

const DEFAULT_BATCH = [
  "https://example.com",
  "https://github.com",
  "https://youtube.com",
  "https://linkedin.com/in/username",
  "Hello World",
  "contact@example.com"
].join("\n");

const sizeOptions: QrSize[] = [128, 256, 512];
const errorLevels: Array<{ value: ErrorLevel; label: string; detail: string }> = [
  { value: "L", label: "L", detail: "7%" },
  { value: "M", label: "M", detail: "15%" },
  { value: "Q", label: "Q", detail: "25%" },
  { value: "H", label: "H", detail: "30%" }
];

function App() {
  const [mode, setMode] = useState<Mode>("single");
  const [theme, setTheme] = useState<Theme>("light");
  const [singleInput, setSingleInput] = useState("https://example.com");
  const [batchInput, setBatchInput] = useState(DEFAULT_BATCH);
  const [options, setOptions] = useState<QrOptions>({ size: 256, errorLevel: "M" });
  const [logo, setLogo] = useState<LogoAsset | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [singleQr, setSingleQr] = useState<string>("");
  const [batchQrs, setBatchQrs] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>("png");
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const singleValidation = useMemo(() => validateQrInput(singleInput), [singleInput]);
  const batchItems = useMemo(() => parseBatchInput(batchInput), [batchInput]);
  const safeBatchItems = useMemo(() => batchItems.filter((item) => item.validation.safe), [batchItems]);
  const selectedBatchItems = useMemo(
    () => safeBatchItems.filter((item) => selectedIds.has(item.id)),
    [safeBatchItems, selectedIds]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!singleValidation.safe) {
        setSingleQr("");
        setStatus(singleValidation.warning ?? "Input is not safe to generate.");
        return;
      }

      try {
        setSingleQr(await generatePngDataUrl(singleValidation.normalized, options, logo));
        setStatus(singleValidation.warning ?? "Live preview updated");
      } catch {
        setStatus("Unable to generate this QR code.");
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [singleValidation, options, logo]);

  useEffect(() => {
    if (mode !== "batch") return;

    const timer = window.setTimeout(async () => {
      const entries = await Promise.all(
        safeBatchItems.map(async (item) => [item.id, await generatePngDataUrl(item.value, options, logo)] as const)
      );
      setBatchQrs(Object.fromEntries(entries));
      setSelectedIds((current) => {
        const next = new Set<string>();
        const safeIds = new Set(safeBatchItems.map((item) => item.id));
        current.forEach((id) => {
          if (safeIds.has(id)) next.add(id);
        });
        if (next.size === 0) safeBatchItems.forEach((item) => next.add(item.id));
        return next;
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [mode, safeBatchItems, options, logo]);

  async function onLogoChange(file?: File) {
    setLogoError(null);
    if (!file) return;

    const validationError = validateLogoFile(file);
    if (validationError) {
      setLogoError(validationError);
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read logo."));
      reader.readAsDataURL(file);
    });

    setLogo({ file, dataUrl, mime: file.type });
    if (options.errorLevel === "L") setOptions((current) => ({ ...current, errorLevel: "M" }));
  }

  async function exportSingle(nextFormat: ExportFormat) {
    if (!singleValidation.safe) return;
    setBusy(true);
    try {
      const blob = await createExportBlob(singleValidation.normalized, nextFormat, options, logo);
      const extension = nextFormat;
      downloadBlob(blob, `${safeFilename(singleValidation.normalized)}.${extension}`);
      setStatus(
        nextFormat === "svg" && logo
          ? "Downloaded SVG without logo overlay"
          : `Downloaded ${extension.toUpperCase()}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportBatchZip() {
    const items = selectedBatchItems.length ? selectedBatchItems : safeBatchItems;
    if (!items.length) return;
    setBusy(true);
    try {
      const blob = await createBatchZip(items, format, options, logo);
      downloadBlob(blob, "qr-codes.zip");
      setStatus(`Downloaded ${items.length} QR codes`);
    } finally {
      setBusy(false);
    }
  }

  function resetCurrentMode() {
    if (mode === "single") setSingleInput("");
    else {
      setBatchInput("");
      setBatchQrs({});
      setSelectedIds(new Set());
    }
    setStatus("Reset complete");
  }

  const warning = mode === "single" ? singleValidation.warning : null;
  const logoWarning = logo && (options.errorLevel === "L" || options.errorLevel === "M")
    ? "Logo overlays work best with Q or H error correction."
    : null;

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="QR Code Generator">
        <header className="header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <QrCode size={42} />
            </div>
            <div className="divider" />
            <div>
              <h1>QR Code Generator</h1>
              <p>Create QR codes from text, URLs or generate in batch.</p>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </header>

        <nav className="tabs" aria-label="Generator mode">
          <button className={mode === "single" ? "active" : ""} type="button" onClick={() => setMode("single")}>
            <UserRound size={21} />
            Single
          </button>
          <button className={mode === "batch" ? "active" : ""} type="button" onClick={() => setMode("batch")}>
            <Layers size={22} />
            Batch
          </button>
        </nav>

        {mode === "single" ? (
          <SinglePanel
            value={singleInput}
            onChange={setSingleInput}
            validationWarning={warning}
            qrDataUrl={singleQr}
            options={options}
            setOptions={setOptions}
            logo={logo}
            logoError={logoError}
            logoWarning={logoWarning}
            onLogoChange={onLogoChange}
            onLogoRemove={() => setLogo(null)}
            fileInputRef={fileInputRef}
            onReset={resetCurrentMode}
            onExport={exportSingle}
            onCopyInput={() => copyToClipboard(singleValidation.normalized)}
            onCopyImage={() => singleQr && copyImageToClipboard(singleQr)}
            busy={busy}
            status={status}
          />
        ) : (
          <BatchPanel
            value={batchInput}
            onChange={setBatchInput}
            items={batchItems}
            qrMap={batchQrs}
            options={options}
            setOptions={setOptions}
            logo={logo}
            logoError={logoError}
            logoWarning={logoWarning}
            onLogoChange={onLogoChange}
            onLogoRemove={() => setLogo(null)}
            fileInputRef={fileInputRef}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            format={format}
            setFormat={setFormat}
            onReset={resetCurrentMode}
            onExportZip={exportBatchZip}
            busy={busy}
          />
        )}

        <FeatureStrip mode={mode} />
      </section>
    </main>
  );
}

interface CommonSettingsProps {
  options: QrOptions;
  setOptions: (options: QrOptions | ((current: QrOptions) => QrOptions)) => void;
  logo: LogoAsset | null;
  logoError: string | null;
  logoWarning: string | null;
  onLogoChange: (file?: File) => void;
  onLogoRemove: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  compact?: boolean;
}

function CommonSettings({
  options,
  setOptions,
  logo,
  logoError,
  logoWarning,
  onLogoChange,
  onLogoRemove,
  fileInputRef,
  compact = false
}: CommonSettingsProps) {
  return (
    <div className={compact ? "settings compact" : "settings"}>
      <h2>{compact ? "Batch Settings" : "Customize"}</h2>
      <div className="setting-row">
        <span>Size</span>
        <div className="segmented size-options">
          {sizeOptions.map((size) => (
            <button
              className={options.size === size ? "selected" : ""}
              type="button"
              key={size}
              onClick={() => setOptions((current) => ({ ...current, size }))}
            >
              {size} x {size}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span>Error Level</span>
        <div className="segmented error-options">
          {errorLevels.map((level) => (
            <button
              className={options.errorLevel === level.value ? "selected" : ""}
              type="button"
              key={level.value}
              onClick={() => setOptions((current) => ({ ...current, errorLevel: level.value }))}
            >
              <strong>{level.label}</strong>
              <small>{level.detail}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row logo-row">
        <span>Logo (optional)</span>
        <div className="logo-controls">
          <button className="dropzone" type="button" onClick={() => fileInputRef.current?.click()}>
            <Image size={23} />
            <span>
              {logo ? logo.file.name : "Upload logo"}
              <small>PNG, JPG, SVG (Max 1MB)</small>
            </span>
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
            onChange={(event) => onLogoChange(event.target.files?.[0])}
          />
          <button className="icon-button secondary" type="button" onClick={onLogoRemove} aria-label="Remove logo">
            <Trash2 size={18} />
          </button>
        </div>
        {(logoError || logoWarning) && <p className={logoError ? "warning error" : "warning"}>{logoError ?? logoWarning}</p>}
      </div>
    </div>
  );
}

interface SinglePanelProps extends CommonSettingsProps {
  value: string;
  onChange: (value: string) => void;
  validationWarning: string | null;
  qrDataUrl: string;
  onReset: () => void;
  onExport: (format: ExportFormat) => void;
  onCopyInput: () => void;
  onCopyImage: () => void;
  busy: boolean;
  status: string;
}

function SinglePanel(props: SinglePanelProps) {
  return (
    <div className="content-grid single-grid">
      <section className="form-panel" aria-label="Single QR generator">
        <label className="field-label" htmlFor="single-input">
          Enter Text / URL
        </label>
        <div className={`text-field ${props.validationWarning ? "has-warning" : ""}`}>
          <Link size={22} />
          <input
            id="single-input"
            maxLength={MAX_INPUT_LENGTH}
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
            placeholder="https://example.com"
          />
          <CheckCircle2 size={22} className="valid-icon" />
        </div>
        <p className={props.validationWarning ? "hint warning" : "hint"}>
          {props.validationWarning ?? "Enter any text or URL to generate a QR code."}
        </p>

        <CommonSettings {...props} />

        <div className="action-row">
          <button className="primary-action" type="button" disabled={!props.qrDataUrl || props.busy}>
            <QrCode size={24} />
            Generate QR Code
          </button>
          <button className="secondary-action" type="button" onClick={props.onReset}>
            <RefreshCw size={24} />
            Reset
          </button>
        </div>
      </section>

      <aside className="preview-card" aria-label="QR Code Preview">
        <div className="panel-title">
          <h2>QR Code Preview</h2>
          <span className="live-badge">
            <span />
            Live
          </span>
        </div>
        <div className="qr-frame">
          {props.qrDataUrl ? <img src={props.qrDataUrl} alt="Generated QR code" /> : <div className="empty">No QR</div>}
        </div>
        <button className="wide-button" type="button" onClick={props.onCopyImage} disabled={!props.qrDataUrl}>
          <Copy size={22} />
          Copy to Clipboard
        </button>
        <button className="ghost-link" type="button" onClick={props.onCopyInput}>
          <Clipboard size={17} />
          Copy input text
        </button>
        <DownloadControls onExport={props.onExport} busy={props.busy} />
        <p className="status" role="status">
          {props.status}
        </p>
      </aside>
    </div>
  );
}

function DownloadControls({ onExport, busy }: { onExport: (format: ExportFormat) => void; busy: boolean }) {
  return (
    <div className="download-block">
      <h2>Download</h2>
      <div className="download-grid">
        <button type="button" disabled={busy} onClick={() => onExport("png")}>
          <Image size={22} />
          PNG
        </button>
        <button type="button" disabled={busy} onClick={() => onExport("svg")}>
          <Sparkles size={22} />
          SVG
        </button>
        <button type="button" disabled={busy} onClick={() => onExport("pdf")}>
          <File size={22} />
          PDF
        </button>
      </div>
      <button className="wide-button muted" type="button">
        More Options
        <ChevronDown size={20} />
      </button>
    </div>
  );
}

interface BatchPanelProps extends CommonSettingsProps {
  value: string;
  onChange: (value: string) => void;
  items: BatchItem[];
  qrMap: Record<string, string>;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string> | ((current: Set<string>) => Set<string>)) => void;
  format: ExportFormat;
  setFormat: (format: ExportFormat) => void;
  onReset: () => void;
  onExportZip: () => void;
  busy: boolean;
}

function BatchPanel(props: BatchPanelProps) {
  const safeItems = props.items.filter((item) => item.validation.safe);
  const allSelected = safeItems.length > 0 && safeItems.every((item) => props.selectedIds.has(item.id));

  function toggleItem(id: string) {
    props.setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="content-grid batch-grid">
      <section className="form-panel" aria-label="Batch QR generator">
        <div className="textarea-header">
          <label className="field-label" htmlFor="batch-input">
            Input <span>(One per line)</span>
          </label>
        </div>
        <textarea
          id="batch-input"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          rows={7}
          maxLength={MAX_INPUT_LENGTH * MAX_BATCH_ITEMS}
        />
        <p className="hint split-hint">
          <span>Enter up to 100 items. One text or URL per line.</span>
          <span>{props.items.length} / {MAX_BATCH_ITEMS}</span>
        </p>

        <CommonSettings {...props} compact />

        <div className="action-row">
          <button className="primary-action" type="button" disabled={!safeItems.length || props.busy}>
            <Layers size={22} />
            Generate {safeItems.length} QR Codes
          </button>
          <button className="secondary-action" type="button" onClick={props.onReset}>
            <RefreshCw size={24} />
            Reset
          </button>
        </div>
      </section>

      <aside className="batch-preview" aria-label="Batch QR preview">
        <div className="panel-title">
          <h2>Preview ({props.items.length})</h2>
          <div className="batch-actions">
            <button
              type="button"
              onClick={() => props.setSelectedIds(allSelected ? new Set() : new Set(safeItems.map((item) => item.id)))}
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            <button type="button" className="danger" onClick={() => props.onChange("")}>
              <Trash2 size={16} />
              Clear All
            </button>
          </div>
        </div>

        <div className="batch-card-grid">
          {props.items.map((item, index) => (
            <button
              className={`qr-tile ${props.selectedIds.has(item.id) ? "chosen" : ""} ${!item.validation.safe ? "blocked" : ""}`}
              type="button"
              key={item.id}
              onClick={() => item.validation.safe && toggleItem(item.id)}
              title={item.validation.warning ?? item.value}
            >
              <span className="tile-index">{index + 1}</span>
              {props.qrMap[item.id] ? <img src={props.qrMap[item.id]} alt={`QR code ${index + 1}`} /> : <div className="tile-empty" />}
              <span className="tile-text">
                <span className="tile-label">{item.validation.safe ? item.value : item.validation.warning}</span>
                <Copy size={16} />
              </span>
            </button>
          ))}
          {!props.items.length && <div className="empty-batch">Batch QR previews will appear here.</div>}
        </div>

        <div className="download-all">
          <h2>Download All</h2>
          <p>Choose format and download all selected QR codes as a zip file.</p>
          <div className="batch-download-row">
            {(["png", "svg", "pdf"] as ExportFormat[]).map((nextFormat) => (
              <button
                className={props.format === nextFormat ? "selected" : ""}
                type="button"
                key={nextFormat}
                onClick={() => props.setFormat(nextFormat)}
              >
                {nextFormat === "png" ? <Image size={20} /> : nextFormat === "svg" ? <Sparkles size={20} /> : <File size={20} />}
                {nextFormat.toUpperCase()}
              </button>
            ))}
            <button className="zip-button" type="button" onClick={props.onExportZip} disabled={!safeItems.length || props.busy}>
              <Download size={21} />
              Download ZIP
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function FeatureStrip({ mode }: { mode: Mode }) {
  const items = mode === "single"
    ? [
        ["Instant Generation", "Generate QR codes in real-time", Zap],
        ["Secure & Private", "Your data stays on your device", Shield],
        ["Batch Generation", "Generate multiple QR codes", Layers],
        ["Customizable", "Personalize to your needs", Palette]
      ]
    : [
        ["Fast & Easy", "Generate multiple QR codes instantly.", Zap],
        ["Private & Secure", "Your data stays on your device.", Shield],
        ["Multiple Formats", "Download as PNG, SVG or PDF.", Download],
        ["Customizable", "Choose size, error level and add your logo.", Palette]
      ];

  return (
    <footer className="feature-strip" aria-label="Features">
      {items.map(([title, copy, Icon]) => (
        <div className="feature" key={title as string}>
          <Icon size={36} />
          <span>
            <strong>{title as string}</strong>
            <small>{copy as string}</small>
          </span>
        </div>
      ))}
    </footer>
  );
}

export default App;
