# 🛂 Travel Registration App — Passport Extractor

A modern full-stack travel onboarding application that automates passport and PAN card detail extraction using **Google Drive OCR** + **OpenRouter AI**.

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![Express](https://img.shields.io/badge/Express-5-green?logo=express)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

---

## ✨ Features

- **AI-Powered OCR**: Automatically extracts passport & PAN card details
- **Smart Autofill**: Pre-fills form fields from extracted data
- **Image Compression**: Client-side compression before upload
- **Drag & Drop**: Modern file upload with previews
- **Mobile Camera**: Direct camera capture on mobile devices
- **Google Drive Storage**: Organized folder structure per user
- **Google Sheets**: Automatic data logging
- **Premium UI**: Glassmorphism, animations, dark theme

---

## 🏗️ Architecture

```
Frontend (React + Vite)          Backend (Express.js)
┌──────────────────────┐        ┌──────────────────────┐
│  Upload Documents    │  POST  │  Multer (file recv)  │
│  ────────────────>   │ ────>  │  ────────────────>   │
│                      │        │  Google Drive Upload  │
│  Show Progress       │        │  ────────────────>   │
│                      │        │  Google Docs OCR     │
│  Autofill Form       │  JSON  │  ────────────────>   │
│  <────────────────   │ <────  │  OpenRouter AI       │
│                      │        │  ────────────────>   │
│  Submit Registration │  POST  │  Google Sheets Save  │
│  ────────────────>   │ ────>  │                      │
└──────────────────────┘        └──────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ installed
- **Google Cloud** Service Account (see setup below)
- **OpenRouter** API key ([openrouter.ai](https://openrouter.ai))

### 1. Clone & Install

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Google Cloud Setup

#### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable these APIs:
   - **Google Drive API**
   - **Google Docs API**
   - **Google Sheets API**
4. Go to **IAM & Admin → Service Accounts**
5. Click **Create Service Account**
6. Give it a name (e.g., `travel-registration`)
7. Click **Create & Continue**
8. Grant role: **Editor** (or specific Drive/Sheets roles)
9. Click **Done**
10. Click the service account → **Keys** tab → **Add Key → Create New Key → JSON**
11. Download the JSON file and save it as `server/credentials.json`

#### Create Google Drive Folder

1. Open [Google Drive](https://drive.google.com)
2. Create a folder called `Travel Registrations`
3. Right-click → **Share** → Add the service account email (from credentials.json)
4. Give **Editor** access
5. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/<FOLDER_ID>`
6. Paste it in `server/.env` as `GOOGLE_DRIVE_ROOT_FOLDER_ID`

#### Create Google Sheet

1. Create a new Google Sheet
2. Share it with the service account email (Editor access)
3. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>`
4. Paste it in `server/.env` as `GOOGLE_SHEET_ID`

### 3. OpenRouter Setup

1. Go to [openrouter.ai](https://openrouter.ai)
2. Create an account & get an API key
3. Paste it in `server/.env` as `OPENROUTER_API_KEY`

### 4. Configure Environment

Edit `server/.env`:

```env
PORT=5000
NODE_ENV=development
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
GOOGLE_DRIVE_ROOT_FOLDER_ID=your_folder_id
GOOGLE_SHEET_ID=your_sheet_id
OPENROUTER_API_KEY=sk-or-v1-xxxx
OPENROUTER_MODEL=google/gemini-2.0-flash-001
FRONTEND_URL=http://localhost:5173
```

### 5. Run the Application

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 📁 Project Structure

```
Passport Extractor/
├── src/                          # React Frontend
│   ├── components/
│   │   ├── UploadCard.jsx        # Drag-and-drop upload component
│   │   ├── ProgressLoader.jsx    # Animated OCR processing overlay
│   │   └── AutofillForm.jsx      # Editable form with autofilled data
│   ├── pages/
│   │   └── Home.jsx              # Main registration wizard
│   ├── services/
│   │   └── api.js                # Axios API client
│   ├── App.jsx                   # Root component
│   └── index.css                 # Global design system
│
├── server/                       # Express Backend
│   ├── controllers/
│   │   ├── extractionController.js  # OCR + AI extraction endpoints
│   │   └── registrationController.js # Final submission handler
│   ├── middleware/
│   │   └── upload.js             # Multer file upload config
│   ├── routes/
│   │   └── api.js                # Route definitions
│   ├── services/
│   │   ├── driveService.js       # Google Drive file management
│   │   ├── ocrService.js         # OCR orchestration pipeline
│   │   ├── aiService.js          # OpenRouter AI extraction
│   │   └── sheetsService.js      # Google Sheets data storage
│   ├── uploads/                  # Temp file storage (auto-cleaned)
│   ├── app.js                    # Express server entry
│   ├── .env                      # Environment variables
│   └── credentials.json          # Google Service Account key
│
├── index.html                    # Vite entry HTML
├── vite.config.js                # Vite configuration
└── package.json                  # Frontend dependencies
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |
| `POST` | `/api/extract-passport` | Upload passport images → OCR → AI extract |
| `POST` | `/api/extract-pan` | Upload PAN card → OCR → AI extract |
| `POST` | `/api/submit-registration` | Submit final form + selfie |

---

## 🔒 Security

- Google credentials are **never** exposed to the frontend
- API keys stored in `.env` (gitignored)
- File type validation (images only)
- 10MB upload size limit
- Client-side image compression
- Temp files deleted after processing

---

## 📱 User Flow

1. **Welcome** → Start Registration
2. **Upload** → Passport front/back, PAN card, Selfie
3. **Processing** → Animated OCR + AI extraction
4. **Review** → Editable autofilled form
5. **Submit** → Data saved to Sheets + Drive

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| Animations | Framer Motion |
| File Upload | React Dropzone, browser-image-compression |
| HTTP Client | Axios |
| Backend | Node.js, Express 5 |
| File Handling | Multer |
| OCR | Google Drive API + Google Docs conversion |
| AI Extraction | OpenRouter API (Gemini Flash) |
| Storage | Google Sheets, Google Drive |
