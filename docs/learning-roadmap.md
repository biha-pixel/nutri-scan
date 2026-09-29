# Learning Roadmap — NutriScan

This document maps out what software engineering concepts you will learn at each phase of
building NutriScan. Each phase produces working, running software — learning happens through
building something real.

---

## How to Use This Roadmap

Each phase has:
- **What we build** — the feature or system that gets built
- **What you learn** — the software engineering concepts introduced
- **Why it matters** — how this concept applies beyond just this project

Phases are sequential. Earlier phases lay the foundation for later ones.

---

## Phase 0 — Project Setup & Documentation ← YOU ARE HERE

**What we build:**
- `CLAUDE.md` (project rules for Claude Code)
- `.claude/skills/` (custom skills for this project)
- `docs/architecture.md` (system architecture explanation)
- `docs/learning-roadmap.md` (this file)

**What you learn:**
- What software architecture means and why you plan it before coding
- What a monolith vs microservices means
- What a modular monolith is and why it is the right choice here
- What provider abstractions are and why we use them
- What environment variables are and why secrets never go in code
- How to document a project for future contributors (and your future self)

**Why it matters:**
Real software projects fail more often from poor planning and unclear ownership than from
technical mistakes. Architects and senior engineers spend a significant portion of their time
on exactly this kind of work.

---

## Phase 1 — Mobile App Foundation

**What we build:**
- Clean Expo Router screen structure (replacing the template)
- Home screen with a "Scan Food" button
- Camera screen (image capture + gallery selection)
- Basic navigation between screens
- Reusable UI components (Button, LoadingSpinner, ErrorMessage)

**What you learn:**
- **File-based routing** — how Expo Router turns files into screens
- **Components** — what they are, how they compose, why we keep them small
- **Props** — how components receive data from their parent
- **State** (`useState`) — how a component remembers something that can change
- **Hooks** — what they are, why React uses them
- **TypeScript interfaces** — how you define the shape of data
- **Permissions** — how mobile apps request access to the camera
- **Touch events** — how the user interacts with the screen
- **Loading states** — why UI must always show feedback during async operations
- **Accessibility** — why screen reader labels matter

**Why it matters:**
Components, props, state, and hooks are the fundamental vocabulary of React and React Native.
Every React Native application in the world is built from these primitives.

---

## Phase 2 — Next.js Backend Foundation

**What we build:**
- Next.js project at `/backend`
- Health-check endpoint (`GET /api/health`)
- Image upload endpoint (`POST /api/scan`) — structure only, returns mock data
- Zod schemas for request and response shapes
- Environment variable setup

**What you learn:**
- **HTTP** — how computers communicate over the internet (request / response, methods, status codes)
- **REST** — a conventional style for designing APIs
- **API endpoint** — a URL that does a specific job (like a function your mobile app can call)
- **Route Handler** — a Next.js function that responds to an HTTP request
- **Request / Response** — what gets sent and what comes back
- **JSON** — the data format APIs use
- **Zod** — how to validate that incoming data matches the shape you expect
- **Schema** — a definition of what shape data must have
- **Environment variables** — how to keep secrets out of code
- **`multipart/form-data`** — how files are uploaded over HTTP
- **CORS** — why the backend needs to explicitly allow requests from the mobile app

**Why it matters:**
HTTP, REST, and JSON are the lingua franca of the modern web. Understanding them lets you
interact with any API — not just the ones we build here.

---

## Phase 3 — AI Food Recognition

**What we build:**
- `VisionProvider` interface in `lib/vision/`
- `GeminiVisionProvider` implementation
- Integration into the `/api/scan` endpoint
- Confidence scoring and uncertainty exposure in the response

**What you learn:**
- **Interface** — a contract that says "any implementation must have these functions"
- **Dependency inversion** — why high-level code depends on interfaces, not implementations
- **Multimodal AI** — what it means for an AI to process both text and images
- **Prompt engineering** — how you write instructions to a language model that produce reliable output
- **Structured output** — how to ask an AI model to respond in a specific JSON format
- **Confidence scores** — what they mean and why we surface uncertainty to the user
- **Hallucination** — why we never let the AI generate nutritional values
- **API key security** — why the Gemini key never appears in mobile code
- **Zod validation of external responses** — why you validate AI output just like user input

**Why it matters:**
AI integrations are increasingly common in software products. Understanding how to use them
safely, validate their output, and hide them behind abstractions is an important modern skill.

---

## Phase 4 — Nutrition Data Lookup

**What we build:**
- `NutritionProvider` interface in `lib/nutrition/`
- `USDANutritionProvider` implementation
- Data normalization from USDA format → internal `NutritionInfo` schema
- Food matching (handling no match, ambiguous match)
- Caching of USDA responses

**What you learn:**
- **Data normalization** — transforming external data into a consistent internal format
- **External API integration** — how to call a third-party API and handle its responses
- **Caching** — storing results to avoid repeated expensive API calls
- **TTL (Time-To-Live)** — how long a cached result is valid
- **Null vs zero** — why a missing nutrient value is `null`, not `0`
- **Error handling patterns** — no match, ambiguous match, API errors, malformed data
- **Exponential backoff** — how to retry a failed request without hammering the server
- **Serving size** — why every nutrition value is meaningless without its serving context

**Why it matters:**
Almost every real application consumes data from external APIs. Normalizing that data and
handling failure modes gracefully is a skill you will use in every backend you ever build.

---

## Phase 5 — Nutrition Display on Mobile

**What we build:**
- Nutrition results screen
- Per-food-item nutrition card (calories, macros, key micronutrients)
- Highlight badges ("High Protein", "Good source of Vitamin C")
- Serving size disclosure
- Confidence indicator
- Error and empty states

**What you learn:**
- **FlatList** — how to render long lists efficiently in React Native
- **Conditional rendering** — showing different UI based on state
- **Data → UI mapping** — how you turn a JSON object into a visual component
- **Design tokens** — colours, spacing, typography as named constants
- **User feedback** — why every state (loading, error, empty, success) needs a UI

**Why it matters:**
Turning structured data into readable, accessible UI is the core job of a frontend developer.
The patterns you learn here apply to every screen you ever build.

---

## Phase 6 — Authentication & Scan History (Supabase)

**What we build:**
- Supabase project setup
- Sign up / sign in screens on mobile
- JWT token handling (what a token is, how it is sent to the backend)
- Scan history stored in Supabase PostgreSQL
- Row Level Security policies
- Scan history screen on mobile

**What you learn:**
- **Authentication** — proving who you are (sign in, tokens)
- **Authorization** — proving you are allowed to do something (RLS policies)
- **JWT (JSON Web Token)** — a self-contained token that carries identity information
- **Supabase Auth** — managed authentication, how it works
- **PostgreSQL** — a relational database, tables, rows, columns, queries
- **SQL** — the language for querying a relational database
- **Row Level Security** — database-level access control
- **Session management** — how the mobile app stores and refreshes a login session

**Why it matters:**
Authentication and authorization are required in virtually every production application.
Understanding them deeply — not just "how to copy the docs" — is essential.

---

## Phase 7 — Testing

**What we build:**
- Unit tests for nutrition data normalization
- Unit tests for highlight rules
- Unit tests for Zod schemas
- Integration tests for the `/api/scan` endpoint (with mocked AI and nutrition providers)
- Type checks and lint as part of the workflow

**What you learn:**
- **Unit test** — a test that verifies one function in isolation
- **Integration test** — a test that verifies multiple parts working together
- **Mock** — a fake version of something (e.g. a fake Gemini API) used in tests
- **Test coverage** — which parts of the code are exercised by tests
- **Behavior-driven testing** — testing what the code does, not how it does it
- **Regression** — a bug that reappears because there was no test for it
- **CI** — Continuous Integration: running tests automatically when code changes

**Why it matters:**
Tests are how you know that code that worked yesterday still works today. Every professional
software team writes tests. Learning to write good tests is as important as learning to write
good code.

---

## Phase 8 — Polish & Deployment

**What we build:**
- EAS (Expo Application Services) build configuration
- Over-the-air update configuration
- Environment-specific configuration (development vs production)
- Rate limiting on the scan endpoint
- Final security review

**What you learn:**
- **Build** — compiling your app into a binary that can be installed on a real device
- **OTA update** — updating your app's JavaScript bundle without going through the App Store
- **Environment** — separating development settings from production settings
- **Rate limiting** — protecting your endpoint from abuse
- **App Store submission** — the process of distributing an iOS/Android app

**Why it matters:**
Writing code is only part of software engineering. Shipping it reliably and securely to real
users is what turns a project into a product.

---

## Concept Reference Index

This table maps concepts to the phase where they are first introduced:

| Concept | First introduced |
|---|---|
| Architecture, monolith, module | Phase 0 |
| Provider abstraction, interface | Phase 0 |
| Environment variables | Phase 0 |
| Component, props, state, hooks | Phase 1 |
| File-based routing | Phase 1 |
| Permissions, accessibility | Phase 1 |
| HTTP, REST, JSON, endpoint | Phase 2 |
| Zod, schema, validation | Phase 2 |
| CORS, multipart/form-data | Phase 2 |
| Multimodal AI, prompt engineering | Phase 3 |
| Confidence scores, hallucination | Phase 3 |
| Data normalization, caching, TTL | Phase 4 |
| External API integration | Phase 4 |
| FlatList, conditional rendering | Phase 5 |
| Authentication, authorization, JWT | Phase 6 |
| PostgreSQL, SQL, RLS | Phase 6 |
| Unit test, integration test, mock | Phase 7 |
| Build, OTA update, rate limiting | Phase 8 |
