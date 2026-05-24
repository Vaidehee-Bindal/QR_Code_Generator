# QR Code Generator

A modern and feature-rich QR Code Generator built using React, TypeScript, and Vite. Generate QR codes for multiple content types, export them in different formats, and create batch QR codes with support for up to 100 entries.

# Live Demo
Try it here - https://multipurpose-qr-code-generator.vercel.app/

# Video Demo
https://github.com/user-attachments/assets/09724c02-3af0-4932-a4cc-d6e7d5db4992

## Features

### QR Code Types Supported

- URL
- PDF
- Contact
- Plain Text
- App Links
- SMS
- Email
- Phone Number

## Core Functionalities

- Instant QR code generation
- Download QR as PNG
- Export QR as PDF
- Batch QR generation (up to 100 QR codes)
- ZIP export for batch downloads
- Client-side input validation
- Responsive modern UI
- Fast performance with Vite


# Security Features

The application is designed with privacy, safety, and secure client-side processing in mind.

## Client-Side Processing

- All QR code generation happens directly in the browser
- No user data is sent to external servers
- Faster and more secure processing


## Input Validation & Sanitization

The application validates and sanitizes all user inputs before generating QR codes.

### Validation Includes

- URL format validation
- Email format validation
- Phone number validation
- Required field checks
- Maximum batch limit validation (100 entries)

### Sanitization Includes

- Removal of unsafe characters
- Prevention of malformed inputs
- Basic protection against injection attempts


## Privacy Protection

- No database storage
- No tracking scripts
- No analytics collection
- No third-party cookies
- User-generated QR data remains temporary and local


## Batch Generation Protection

To prevent abuse and browser performance issues:

- Batch generation limited to 100 QR codes
- Invalid entries are filtered automatically
- Error handling for corrupted inputs


## Safe File Handling

- Only supported file formats are accepted
- PDF processing handled securely on the client side
- No uploaded files are stored permanently


## Dependency Security

The project uses trusted and actively maintained libraries:

- qrcode
- jsPDF
- JSZip
- React
- Vite

Security best practices include:

- Regular dependency updates
- Avoiding deprecated packages
- Type-safe development with TypeScript


## Error Handling

The application provides secure and user-friendly error handling:

- Prevents application crashes
- Displays safe validation messages
- Avoids exposing sensitive internal errors

## Performance & Stability

- Lightweight architecture
- Fast rendering with Vite
- Optimized batch processing
- Efficient memory handling during exports

## Tech Stack

- React 19
- TypeScript
- Vite
- qrcode
- jsPDF
- JSZip
- Vitest
- React Testing Library

## Installation

Clone the repository:

```bash
git clone https://github.com/Vaidehee-Bindal/QR_Code_Generator.git
```

Move into the project directory:

```bash
cd QR_Code_Generator
```

Install dependencies:

```bash
npm install
```

## Run Development Server

```bash
npm run dev
```

Open in browser:

```bash
http://localhost:5173
```

## Production Build

Build the application:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Running Tests

```bash
npm run test
```

# Workflow 
<img width="1536" height="1024" alt="workflow" src="https://github.com/user-attachments/assets/76af937d-36ab-44ff-9090-38421f0f7ccb" />

## Supported QR Formats

| QR Type | Description |
|---|---|
| URL | Generate QR codes for websites and links |
| PDF | Convert PDF references into QR codes |
| Contact | Share contact information instantly |
| Plain Text | Encode simple text |
| App | Redirect users to applications |
| SMS | Pre-fill SMS messages |
| Email | Open email drafts instantly |
| Phone | Direct call functionality |

## Batch QR Generation

The application supports generating up to **100 QR codes simultaneously**.

### Batch Features

- Bulk QR creation
- ZIP export support
- PDF export for multiple QR codes
- Fast client-side processing
- Optimized generation workflow

## Project Structure

```bash
QR_Code_Generator/
│
├── public/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── types.ts
│   │
│   ├── utils/
│   │   ├── qr.ts
│   │   ├── validation.ts
│   │   ├── content.ts
│   │   ├── validation.test.ts
│   │   └── content.test.ts
│   │
│   ├── test/
│   │   └── setup.ts
│   │
│   └── App.test.tsx
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── package.json
└── README.md
```

### Test Coverage

- Validation logic
- Utility functions
- QR generation logic
- UI rendering
- Component interactions
