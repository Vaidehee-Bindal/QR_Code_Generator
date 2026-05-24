import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  File,
  Contact,
  Grid3X3,
  Image,
  Layers,
  Link,
  Mail,
  MessageSquare,
  Moon,
  Palette,
  Phone,
  QrCode,
  RefreshCw,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  Zap
} from "lucide-react";
import type { BatchItem, ContentFields, ContentType, ErrorLevel, ExportFormat, LogoAsset, Mode, QrOptions, QrSize, Theme } from "./types";
import {
  copyImageToClipboard,
  createBatchZip,
  createExportBlob,
  downloadBlob,
  generatePngDataUrl,
  safeFilename
} from "./utils/qr";
import { defaultContentFields, getContentPayload } from "./utils/content";
import {
  MAX_BATCH_ITEMS,
  MAX_INPUT_LENGTH,
  getQrGenerationReadiness,
  getReadyBatchItems,
  parseBatchInput,
  validateLogoFile
} from "./utils/validation";
import { isCompleteHttpUrl } from "./utils/validation";

const DEFAULT_BATCH = [
  "https://example.com",
  "https://github.com",
  "https://youtube.com",
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

const contentTypes: Array<{ type: ContentType; label: string; icon: typeof Link }> = [
  { type: "url", label: "URL", icon: Link },
  { type: "pdf", label: "PDF", icon: File },
  { type: "contact", label: "Contact", icon: Contact },
  { type: "text", label: "Plain Text", icon: Clipboard },
  { type: "app", label: "App", icon: Grid3X3 },
  { type: "sms", label: "SMS", icon: MessageSquare },
  { type: "email", label: "Email", icon: Mail },
  { type: "phone", label: "Phone", icon: Phone }
];

const TYPING_DEBOUNCE_MS = 1400;
const PASTE_DEBOUNCE_MS = 120;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

function App() {
  const [mode, setMode] = useState<Mode>("single");
  const [theme, setTheme] = useState<Theme>("light");
  const [contentType, setContentType] = useState<ContentType>("url");
  const [contentFields, setContentFields] = useState<ContentFields>(defaultContentFields);
  const [singleInput, setSingleInput] = useState("https://example.com");
  const [batchInput, setBatchInput] = useState(DEFAULT_BATCH);
  const [options, setOptions] = useState<QrOptions>({ size: 256, errorLevel: "M" });
  const [logo, setLogo] = useState<LogoAsset | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [singleQr, setSingleQr] = useState<string>("");
  const [batchQrs, setBatchQrs] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>("png");
  const [busy, setBusy] = useState(false);
  const [singleDebounceMs, setSingleDebounceMs] = useState(TYPING_DEBOUNCE_MS);
  const [batchDebounceMs, setBatchDebounceMs] = useState(TYPING_DEBOUNCE_MS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeContentValue = useMemo(() => JSON.stringify({ contentType, contentFields }), [contentType, contentFields]);
  const debouncedSingleInput = useDebouncedValue(activeContentValue, singleDebounceMs);
  const debouncedBatchInput = useDebouncedValue(batchInput, batchDebounceMs);
  const singleReadiness = useMemo(() => {
    const payload = getContentPayload(contentType, contentFields);
    if (!payload.safe) return { ready: false, validation: payload, message: payload.warning };
    if (contentType === "url" || contentType === "pdf" || contentType === "app") {
      return getQrGenerationReadiness(payload.normalized);
    }
    return { ready: Boolean(payload.normalized), validation: payload, message: payload.warning };
  }, [contentType, contentFields]);
  const debouncedSingleReadiness = useMemo(
    () => {
      const parsed = JSON.parse(debouncedSingleInput) as { contentType: ContentType; contentFields: ContentFields };
      const payload = getContentPayload(parsed.contentType, parsed.contentFields);
      if (!payload.safe) return { ready: false, validation: payload, message: payload.warning };
      if (parsed.contentType === "url" || parsed.contentType === "pdf" || parsed.contentType === "app") {
        return getQrGenerationReadiness(payload.normalized);
      }
      return { ready: Boolean(payload.normalized), validation: payload, message: payload.warning };
    },
    [debouncedSingleInput]
  );
  const batchItems = useMemo(() => parseBatchInput(batchInput), [batchInput]);
  const debouncedBatchItems = useMemo(() => parseBatchInput(debouncedBatchInput), [debouncedBatchInput]);
  const readyBatchItems = useMemo(() => getReadyBatchItems(debouncedBatchItems), [debouncedBatchItems]);
  const exportableBatchItems = useMemo(() => getReadyBatchItems(batchItems), [batchItems]);
  const selectedBatchItems = useMemo(
    () => exportableBatchItems.filter((item) => selectedIds.has(item.id)),
    [exportableBatchItems, selectedIds]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!debouncedSingleReadiness.ready) {
        setSingleQr("");
        return;
      }

      try {
        setSingleQr(await generatePngDataUrl(debouncedSingleReadiness.validation.normalized, options, logo));
      } catch {
        setSingleQr("");
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [debouncedSingleReadiness, options, logo]);

  useEffect(() => {
    if (mode !== "batch") return;

    const timer = window.setTimeout(async () => {
      const entries = await Promise.all(
        readyBatchItems.map(async (item) => [item.id, await generatePngDataUrl(item.value, options, logo)] as const)
      );
      setBatchQrs(Object.fromEntries(entries));
      setSelectedIds((current) => {
        const next = new Set<string>();
        const readyIds = new Set(readyBatchItems.map((item) => item.id));
        current.forEach((id) => {
          if (readyIds.has(id)) next.add(id);
        });
        if (next.size === 0) readyBatchItems.forEach((item) => next.add(item.id));
        return next;
      });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [mode, readyBatchItems, options, logo]);

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

  function updateSingleInput(nextValue: string) {
    const delta = Math.abs(nextValue.length - singleInput.length);
    setSingleDebounceMs(delta > 3 ? PASTE_DEBOUNCE_MS : TYPING_DEBOUNCE_MS);
    setSingleInput(nextValue);
  }

  function updateBatchInput(nextValue: string) {
    const delta = Math.abs(nextValue.length - batchInput.length);
    setBatchDebounceMs(delta > 3 ? PASTE_DEBOUNCE_MS : TYPING_DEBOUNCE_MS);
    setBatchInput(nextValue);
  }

  function updateContentField<K extends keyof ContentFields>(field: K, value: ContentFields[K]) {
    const previousValue = String(contentFields[field] ?? "");
    const delta = Math.abs(String(value).length - previousValue.length);
    setSingleDebounceMs(delta > 3 ? PASTE_DEBOUNCE_MS : TYPING_DEBOUNCE_MS);
    setContentFields((current) => ({ ...current, [field]: value }));
  }

  async function exportSingle(nextFormat: ExportFormat) {
    if (!singleReadiness.ready) return;
    setBusy(true);
    try {
      const blob = await createExportBlob(singleReadiness.validation.normalized, nextFormat, options, logo);
      const extension = nextFormat;
      downloadBlob(blob, `${safeFilename(singleReadiness.validation.normalized)}.${extension}`);
    } finally {
      setBusy(false);
    }
  }

  async function exportBatchZip() {
    const items = selectedBatchItems.length ? selectedBatchItems : exportableBatchItems;
    if (!items.length) return;
    setBusy(true);
    try {
      const blob = await createBatchZip(items, format, options, logo);
      downloadBlob(blob, "qr-codes.zip");
    } finally {
      setBusy(false);
    }
  }

  function resetCurrentMode() {
    if (mode === "single") {
      setContentFields({
        url: "",
        pdf: "",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        contactCompany: "",
        contactWebsite: "",
        text: "",
        app: "",
        smsPhone: "",
        smsMessage: "",
        emailTo: "",
        emailSubject: "",
        emailBody: "",
        phone: ""
      });
      setSingleInput("");
      setSingleQr("");
      return;
    }

    {
      setBatchInput("");
      setBatchQrs({});
      setSelectedIds(new Set());
    }
  }

  const warning = mode === "single" ? singleReadiness.message : null;
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
            onChange={updateSingleInput}
            contentType={contentType}
            contentFields={contentFields}
            contentTypes={contentTypes}
            onContentTypeChange={setContentType}
            onContentFieldChange={updateContentField}
            hasValidationError={!singleReadiness.validation.safe}
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
            onCopyImage={() => singleQr ? copyImageToClipboard(singleQr) : Promise.resolve()}
            busy={busy}
          />
        ) : (
          <BatchPanel
            value={batchInput}
            onChange={updateBatchInput}
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
        {(logoError || logoWarning) && <p className={logoError ? "warning error" : "warning logo-warning"}>{logoError ?? logoWarning}</p>}
      </div>
    </div>
  );
}

interface SinglePanelProps extends CommonSettingsProps {
  value: string;
  onChange: (value: string) => void;
  contentType: ContentType;
  contentFields: ContentFields;
  contentTypes: Array<{ type: ContentType; label: string; icon: typeof Link }>;
  onContentTypeChange: (type: ContentType) => void;
  onContentFieldChange: <K extends keyof ContentFields>(field: K, value: ContentFields[K]) => void;
  hasValidationError: boolean;
  validationWarning: string | null;
  qrDataUrl: string;
  onReset: () => void;
  onExport: (format: ExportFormat) => void;
  onCopyImage: () => Promise<void>;
  busy: boolean;
}

function SinglePanel(props: SinglePanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyImage() {
    if (!props.qrDataUrl) return;
    await props.onCopyImage();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="content-grid single-grid">
      <section className="form-panel" aria-label="Single QR generator">
        <ContentTypePicker
          activeType={props.contentType}
          contentTypes={props.contentTypes}
          onChange={props.onContentTypeChange}
        />
        <ContentFieldsForm
          type={props.contentType}
          fields={props.contentFields}
          hasValidationError={props.hasValidationError}
          validationWarning={props.validationWarning}
          onFieldChange={props.onContentFieldChange}
          legacyValue={props.value}
          onLegacyChange={props.onChange}
        />
        <p className={props.hasValidationError ? "hint warning error" : props.validationWarning ? "hint warning" : "hint"}>
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
        </div>
        <div className="qr-frame">
          {props.qrDataUrl ? <img src={props.qrDataUrl} alt="Generated QR code" /> : <div className="empty">No QR</div>}
        </div>
        <button
          className={`wide-button copy-button ${copied ? "copied" : ""}`}
          type="button"
          onClick={handleCopyImage}
          disabled={!props.qrDataUrl}
        >
          <Copy size={22} />
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>
        <DownloadControls onExport={props.onExport} busy={props.busy} />
      </aside>
    </div>
  );
}

function ContentTypePicker({
  activeType,
  contentTypes,
  onChange
}: {
  activeType: ContentType;
  contentTypes: Array<{ type: ContentType; label: string; icon: typeof Link }>;
  onChange: (type: ContentType) => void;
}) {
  return (
    <div className="content-type-strip" aria-label="QR content type">
      {contentTypes.map(({ type, label, icon: Icon }) => (
        <button
          className={activeType === type ? "active" : ""}
          type="button"
          key={type}
          onClick={() => onChange(type)}
        >
          <Icon size={24} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function TextInputField({
  id,
  label,
  value,
  placeholder,
  type = "text",
  hasValidationError,
  validationWarning,
  showError,
  showSuccess,
  showWarning,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  hasValidationError: boolean;
  validationWarning: string | null;
  showError?: boolean;
  showSuccess?: boolean;
  showWarning?: boolean;
  onChange: (value: string) => void;
}) {
  const effectiveError = showError ?? hasValidationError;
  const effectiveSuccess = showSuccess ?? (Boolean(value.trim()) && !hasValidationError);
  const effectiveWarning = showWarning ?? (Boolean(validationWarning) && !effectiveError);

  return (
    <>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className={`text-field ${effectiveError ? "has-error" : effectiveWarning ? "has-warning" : ""}`}>
        <Link size={22} />
        <input
          id={id}
          type={type}
          maxLength={MAX_INPUT_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        {effectiveSuccess && <CheckCircle2 size={22} className="valid-icon" />}
      </div>
    </>
  );
}

function ContentFieldsForm({
  type,
  fields,
  hasValidationError,
  validationWarning,
  onFieldChange,
  legacyValue,
  onLegacyChange
}: {
  type: ContentType;
  fields: ContentFields;
  hasValidationError: boolean;
  validationWarning: string | null;
  onFieldChange: <K extends keyof ContentFields>(field: K, value: ContentFields[K]) => void;
  legacyValue: string;
  onLegacyChange: (value: string) => void;
}) {
  if (type === "url") {
    const urlReady = isCompleteHttpUrl(fields.url);
    return (
      <TextInputField
        id="single-input"
        label="Enter URL"
        value={fields.url}
        placeholder="https://example.com"
        hasValidationError={hasValidationError}
        validationWarning={validationWarning}
        showError={Boolean(fields.url.trim()) && !urlReady}
        showSuccess={urlReady}
        showWarning={false}
        onChange={(value) => {
          onLegacyChange(value);
          onFieldChange("url", value);
        }}
      />
    );
  }

  if (type === "pdf" || type === "app") {
    const field = type === "pdf" ? "pdf" : "app";
    const fieldReady = isCompleteHttpUrl(fields[field]);
    return (
      <TextInputField
        id={`${type}-input`}
        label={type === "pdf" ? "Enter PDF URL" : "Enter App URL"}
        value={fields[field]}
        placeholder={type === "pdf" ? "https://example.com/file.pdf" : "https://apps.apple.com/app/example"}
        hasValidationError={hasValidationError}
        validationWarning={validationWarning}
        showError={Boolean(fields[field].trim()) && !fieldReady}
        showSuccess={fieldReady}
        showWarning={false}
        onChange={(value) => onFieldChange(field, value)}
      />
    );
  }

  if (type === "text") {
    return (
      <>
        <label className="field-label" htmlFor="plain-text-input">
          Enter Plain Text
        </label>
        <textarea
          id="plain-text-input"
          className={hasValidationError ? "has-error" : ""}
          value={fields.text || legacyValue}
          onChange={(event) => onFieldChange("text", event.target.value)}
          rows={5}
          maxLength={MAX_INPUT_LENGTH}
          placeholder="Hello World"
        />
      </>
    );
  }

  if (type === "sms") {
    return (
      <div className="field-grid">
        <TextInputField id="sms-phone" label="Phone Number" value={fields.smsPhone} placeholder="+15551234567" hasValidationError={hasValidationError} validationWarning={validationWarning} onChange={(value) => onFieldChange("smsPhone", value)} />
        <TextInputField id="sms-message" label="Message" value={fields.smsMessage} placeholder="Your message" hasValidationError={false} validationWarning={null} onChange={(value) => onFieldChange("smsMessage", value)} />
      </div>
    );
  }

  if (type === "email") {
    return (
      <div className="field-grid">
        <TextInputField id="email-to" label="Email Address" type="email" value={fields.emailTo} placeholder="contact@example.com" hasValidationError={hasValidationError} validationWarning={validationWarning} onChange={(value) => onFieldChange("emailTo", value)} />
        <TextInputField id="email-subject" label="Subject" value={fields.emailSubject} placeholder="Subject" hasValidationError={false} validationWarning={null} onChange={(value) => onFieldChange("emailSubject", value)} />
        <label className="field-label" htmlFor="email-body">Body</label>
        <textarea id="email-body" value={fields.emailBody} onChange={(event) => onFieldChange("emailBody", event.target.value)} rows={4} placeholder="Email body" />
      </div>
    );
  }

  if (type === "phone") {
    return (
      <TextInputField
        id="phone-input"
        label="Phone Number"
        value={fields.phone}
        placeholder="+15551234567"
        hasValidationError={hasValidationError}
        validationWarning={validationWarning}
        onChange={(value) => onFieldChange("phone", value)}
      />
    );
  }

  return (
    <div className="field-grid two-columns">
      <TextInputField id="contact-name" label="Name" value={fields.contactName} placeholder="Jane Doe" hasValidationError={hasValidationError} validationWarning={validationWarning} onChange={(value) => onFieldChange("contactName", value)} />
      <TextInputField id="contact-phone" label="Phone" value={fields.contactPhone} placeholder="+15551234567" hasValidationError={hasValidationError} validationWarning={validationWarning} onChange={(value) => onFieldChange("contactPhone", value)} />
      <TextInputField id="contact-email" label="Email" type="email" value={fields.contactEmail} placeholder="jane@example.com" hasValidationError={hasValidationError} validationWarning={validationWarning} onChange={(value) => onFieldChange("contactEmail", value)} />
      <TextInputField id="contact-company" label="Company" value={fields.contactCompany} placeholder="Company" hasValidationError={false} validationWarning={null} onChange={(value) => onFieldChange("contactCompany", value)} />
      <TextInputField
        id="contact-website"
        label="Website"
        value={fields.contactWebsite}
        placeholder="https://example.com"
        hasValidationError={hasValidationError}
        validationWarning={validationWarning}
        showError={Boolean(fields.contactWebsite.trim()) && !isCompleteHttpUrl(fields.contactWebsite)}
        showSuccess={Boolean(fields.contactWebsite.trim()) && isCompleteHttpUrl(fields.contactWebsite)}
        showWarning={false}
        onChange={(value) => onFieldChange("contactWebsite", value)}
      />
    </div>
  );
}

function DownloadControls({ onExport, busy }: { onExport: (format: ExportFormat) => void; busy: boolean }) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("png");

  function selectFormat(format: ExportFormat) {
    setSelectedFormat(format);
  }

  function triggerDownload() {
    onExport(selectedFormat);
  }

  return (
    <div className="download-block">
      <h2>Download</h2>
      <p>Choose format and download your QR code.</p>
      <div className="batch-download-row single-download-row">
        <button className={selectedFormat === "png" ? "selected" : ""} type="button" disabled={busy} onClick={() => selectFormat("png")}>
          <Image size={22} />
          PNG
        </button>
        <button className={selectedFormat === "svg" ? "selected" : ""} type="button" disabled={busy} onClick={() => selectFormat("svg")}>
          <Sparkles size={22} />
          SVG
        </button>
        <button className={selectedFormat === "pdf" ? "selected" : ""} type="button" disabled={busy} onClick={() => selectFormat("pdf")}>
          <File size={22} />
          PDF
        </button>
        <button className="zip-button download-btn" type="button" onClick={() => triggerDownload()} disabled={busy}>
          <Download size={18} />
          Download
        </button>
      </div>
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
  const pageSize = 6;
  const [previewPage, setPreviewPage] = useState(0);
  const itemReadiness = useMemo(
    () => new Map(props.items.map((item) => [item.id, getQrGenerationReadiness(item.value)])),
    [props.items]
  );
  const readyItems = useMemo(() => getReadyBatchItems(props.items), [props.items]);
  const totalPages = Math.max(1, Math.ceil(props.items.length / pageSize));
  const visibleItems = useMemo(
    () => props.items.slice(previewPage * pageSize, previewPage * pageSize + pageSize),
    [props.items, previewPage]
  );
  const allSelected = readyItems.length > 0 && readyItems.every((item) => props.selectedIds.has(item.id));

  useEffect(() => {
    setPreviewPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

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
          className="batch-input"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          rows={5}
          maxLength={MAX_INPUT_LENGTH * MAX_BATCH_ITEMS}
        />
        <p className="hint split-hint">
          <span>Enter up to 100 items. One text or URL per line.</span>
          <span>{props.items.length} / {MAX_BATCH_ITEMS}</span>
        </p>

        <CommonSettings {...props} compact />

        <div className="action-row">
          <button className="primary-action" type="button" disabled={!readyItems.length || props.busy}>
            <Layers size={22} />
            Generate {readyItems.length} QR Codes
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
            <div className="preview-pager" aria-label="Batch preview page controls">
              <button type="button" onClick={() => setPreviewPage((current) => Math.max(0, current - 1))} disabled={previewPage === 0}>
                Prev
              </button>
              <span>
                {previewPage + 1} / {totalPages}
              </span>
              <button type="button" onClick={() => setPreviewPage((current) => Math.min(totalPages - 1, current + 1))} disabled={previewPage >= totalPages - 1}>
                Next
              </button>
            </div>
            <button
              type="button"
              onClick={() => props.setSelectedIds(allSelected ? new Set() : new Set(readyItems.map((item) => item.id)))}
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
          {visibleItems.map((item, index) => {
            const readiness = itemReadiness.get(item.id);
            const ready = Boolean(readiness?.ready);
            const itemNumber = previewPage * pageSize + index + 1;

            return (
              <button
                className={`qr-tile ${props.selectedIds.has(item.id) ? "chosen" : ""} ${!ready ? "blocked" : ""}`}
                type="button"
                key={item.id}
                onClick={() => ready && toggleItem(item.id)}
                title={readiness?.message ?? item.value}
              >
                <span className="tile-index">{itemNumber}</span>
                {props.qrMap[item.id] ? <img src={props.qrMap[item.id]} alt={`QR code ${itemNumber}`} /> : <div className="tile-empty" />}
                <span className="tile-text">
                  <span className="tile-label">{ready ? item.value : readiness?.message}</span>
                  <Copy size={16} />
                </span>
              </button>
            );
          })}
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
            <button className="zip-button" type="button" onClick={props.onExportZip} disabled={!readyItems.length || props.busy}>
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
