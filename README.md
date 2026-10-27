# NutriScan

NutriScan is a mobile application and modular backend service designed to photograph food, identify food items using multimodal AI, retrieve authoritative nutritional data from the USDA FoodData Central database, and display detailed nutrition facts with rule-based educational highlights, scale calibration, and portion adjustments.

> **Disclaimer:** NutriScan is an educational and informational tool. It is **not** a medical application and does not provide medical diagnoses, personalized dietary therapy, or clinical nutritional advice.

---

## Architecture Overview

NutriScan follows a modular monolith architecture consisting of two primary deployable units:

```
Mobile App (Expo / React Native)
        │
        │  HTTPS  (multipart/form-data image upload, JSON responses)
        ▼
Next.js Backend  (API Route Handlers)
        │
        ├──▶  AI Vision Service  (Gemini multimodal API via OmniRoute provider abstraction)
        │           │
        │           └──▶  Food identification result (structured JSON with confidence)
        │
        └──▶  Nutrition Lookup Service  (USDA FoodData Central provider abstraction)
                    │
                    └──▶  Nutrition data (normalized to internal schema)
                                │
                                └──▶  Benefit & Highlight Rules (deterministic, rule-based)
                                            │
                                            └──▶  Structured API Response  ──▶  Mobile App
```

---

## Key Features & Capabilities

- **Multimodal AI Food Identification**: Identifies food items and estimates initial portions from captured images.
- **Authoritative Nutrition Data**: Fetches verified nutritional profiles from USDA FoodData Central.
- **Reference Calibration & Geometry**: Supports scale calibration using reference markers to improve portion estimation accuracy.
- **Interactive Portion Adjuster**: Allows users to dynamically adjust portion sizes with real-time recalculation of calories and macronutrients.
- **Scan History & Persistence**: Saves analysis results and user adjustments to local storage / Supabase backend.
- **Security & Hardening**: Magic-byte image validation, IP extraction, sliding-window rate limiting, and server-side secret management.
- **Accuracy Evaluation Module**: Built-in test fixtures and evaluators for assessing estimation accuracy against weighed-food samples.

---

## Technology Stack

### Mobile App
- **Framework**: Expo (Managed Workflow, SDK 57)
- **UI & Navigation**: React Native, Expo Router (file-based routing)
- **Language**: TypeScript (Strict mode)

### Backend API
- **Framework**: Next.js (App Router, API Route Handlers)
- **Validation**: Zod (runtime validation at all API boundaries)
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS)
- **AI Vision**: Google Gemini multimodal API (via OmniRoute abstraction)
- **Nutrition Source**: USDA FoodData Central API

---

## Project Structure

```
/                          ← Expo mobile app root
├── src/
│   ├── app/               ← Expo Router screens (file-based routing)
│   ├── components/        ← Reusable UI components and widgets
│   ├── hooks/             ← Custom React hooks
│   ├── services/          ← API integration services
│   ├── types/             ← Shared TypeScript types
│   ├── utils/             ← Pure utility functions
│   └── constants/         ← Colors, spacing, and configuration
├── assets/                ← Static images, fonts, and icons
└── docs/                  ← Architecture and evaluation documentation

/backend/                  ← Next.js backend service
├── app/
│   └── api/               ← API Route Handlers (/api/analyze-food, /api/nutrition, etc.)
├── lib/
│   ├── vision/            ← AI vision provider abstraction + Gemini implementation
│   ├── nutrition/         ← Nutrition provider abstraction + USDA implementation
│   ├── highlights/        ← Rule-based benefit and highlight generator
│   ├── evaluation/        ← Weighed-sample accuracy evaluation module
│   ├── security/          ← Rate limiter and magic-byte image validation
│   └── validation/        ← Zod validation schemas
└── types/                 ← Shared backend TypeScript types
```

---

## Local Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Expo CLI / Expo Go app on your mobile device (or iOS/Android simulator)

### 1. Clone the Repository
```bash
git clone https://github.com/biha-pixel/nutrition-app.git
cd nutrition-app
```

### 2. Set Up and Run the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   npm install
   ```
2. Create your local environment configuration:
   ```bash
   cp .env.example .env.local
   ```
3. Populate `.env.local` with your API keys and configuration:
   ```env
   OMNIROUTE_API_KEY=your_omniroute_api_key_here
   OMNIROUTE_BASE_URL=http://localhost:20128
   OMNIROUTE_MODEL=gemini
   USDA_API_KEY=your_usda_api_key_here
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The backend will run on `http://localhost:3001`.*

### 3. Set Up and Run the Mobile App

1. Open a new terminal and return to the root directory:
   ```bash
   cd ..
   npm install
   ```
2. Start the Expo development server:
   ```bash
   npm start
   ```
3. Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code using the Expo Go app on your physical device.

---

## Testing & Verification

NutriScan includes unit and integration tests across both the mobile client and backend modules.

### Run Backend Tests
```bash
cd backend
npm test
```

### Run Mobile Client Tests
```bash
npm test
```

---

## Security & Compliance Rules

1. **No Client-Side Secrets**: All API keys (Gemini, USDA, Supabase service role) reside exclusively in server-side environment variables.
2. **Input Validation**: All incoming API requests and payloads are strictly validated using Zod schemas on the server.
3. **Image Hardening**: Uploaded images undergo magic-byte signature validation to ensure valid MIME types prior to vision processing.
4. **Rate Limiting**: Rate limiting middleware protects expensive AI vision and nutrition lookup endpoints.

---

## License

Distributed under the MIT License. See `LICENSE` for details.
