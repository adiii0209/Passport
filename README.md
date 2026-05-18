# Passport Extractor

The project is now split into independently deployable apps:

- `frontend/` contains the React + Vite client.
- `backend/` contains the Express API.

Each app has its own `package.json`, environment sample, and Dockerfile so you can host them separately.

## Structure

```text
Passport Extractor/
|-- frontend/
|   |-- src/
|   |-- public/
|   |-- Dockerfile
|   |-- package.json
|   `-- .env.example
|-- backend/
|   |-- controllers/
|   |-- middleware/
|   |-- routes/
|   |-- services/
|   |-- uploads/
|   |-- Dockerfile
|   |-- package.json
|   `-- .env.example
`-- README.md
```

## Local development

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

The frontend dev server runs on `https://localhost:5173` and proxies `/api` to `http://localhost:5000` by default.

## Environment variables

Frontend `.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_API_PROXY_TARGET=http://localhost:5000
```

Backend `.env`:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
GOOGLE_DRIVE_ROOT_FOLDER_ID=your_folder_id
PASSPORT_FRONT_FOLDER_ID=your_passport_front_folder_id
PASSPORT_BACK_FOLDER_ID=your_passport_back_folder_id
PAN_FOLDER_ID=your_pan_folder_id
PHOTO_FOLDER_ID=your_photo_folder_id
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4o-mini
```

## Docker

Build the frontend image:

```bash
docker build -t passport-extractor-frontend ./frontend
```

Build the backend image:

```bash
docker build -t passport-extractor-backend ./backend
```

When deploying separately:

- Set `VITE_API_URL` during the frontend build to your hosted backend URL, for example `https://api.example.com/api`.
- Set `FRONTEND_URL` on the backend to your hosted frontend origin so CORS allows browser requests.
