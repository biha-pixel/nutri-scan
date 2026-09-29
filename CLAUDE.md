# NutriScan — CLAUDE.md

This file is read by Claude Code at the start of every session. It defines the project purpose,
architecture, technology stack, coding rules, security rules, and teaching rules.

---

## Project Purpose

A mobile application that allows a user to photograph food, identify one or more food items in
the image using AI, retrieve reliable nutritional information from a trusted data source, and
display nutrition facts with educational highlights.

This is NOT a medical application. It must never claim to provide medical diagnosis,
personalized dietary therapy, or clinical nutritional advice.

---

## Architecture Overview

```
Mobile App (Expo / React Native)
        │
        │  HTTPS  (multipart/form-data image upload, JSON responses)
        ▼
Next.js Backend  (API Route Handlers — modular monolith)
        │
        ├──▶  AI Vision Service  (Gemini multimodal API — behind a provider abstraction)
        │           │
        │           └──▶  Food identification result  (structured JSON, with confidence)
        │
        └──▶  Nutrition Lookup Service  (USDA FoodData Central — behind a provider abstraction)
                    │
                    └──▶  Nutrition data  (normalized to internal schema)
                                │
                                └──▶  Benefit / highlight rules  (rule-based, not AI-generated)
                                            │
                                            └──▶  Structured API response  ──▶  Mobile App
```

**Design decision:** Modular monolith. One Next.js application with clear internal modules.
No microservices unless a concrete, demonstrated requirement appears.

**Deployable units:**
1. Expo mobile app
2. Next.js backend (deployed to Vercel or similar)

---

## Technology Stack

### Mobile
| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | Expo (managed workflow) | Cross-platform, fast iteration, Expo Go for development |
| UI | React Native | Native components |
| Language | TypeScript (strict) | Type safety, better tooling |
| Navigation | Expo Router | File-based routing, consistent with Next.js mental model |
| Styling | React Native StyleSheet | No extra dependency; NativeWind only if we explicitly decide to add it |

### Backend
| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | Next.js (App Router) | API Route Handlers, TypeScript-first, easy Vercel deploy |
| Language | TypeScript (strict) | Shared types with mobile possible |
| Validation | Zod | Runtime schema validation at API boundaries |
| Auth | Supabase Auth (later) | Managed, integrates with Supabase DB |
| Database | Supabase PostgreSQL (later) | Managed Postgres, built-in RLS |

### AI
| Concern | Choice | Reason |
|---------|--------|--------|
| Vision model | Google Gemini multimodal | Strong food recognition, structured output mode |
| Integration | Provider abstraction interface | Swap to another provider without changing consuming code |

### Nutrition Data
| Concern | Choice | Reason |
|---------|--------|--------|
| Primary source | USDA FoodData Central | Free, authoritative, US government data |
| Future source | Open Food Facts | Packaged products, barcodes |
| Integration | Provider abstraction interface | Swap or combine providers without changing consuming code |

---

## Project Structure

```
/                          ← Expo mobile app root
├── src/
│   ├── app/               ← Expo Router screens (file-based routing)
│   ├── components/        ← Reusable UI components
│   ├── hooks/             ← Custom React hooks
│   ├── services/          ← API calls to our backend
│   ├── types/             ← Shared TypeScript types
│   ├── utils/             ← Pure utility functions
│   └── constants/         ← Colors, spacing, config
├── assets/                ← Images, fonts, static files
├── docs/                  ← Architecture and learning documentation
├── .claude/skills/        ← Custom Claude Code skills (this project)
└── .agents/skills/        ← Expo skills (installed from expo/skills)

/backend/                  ← Next.js backend (to be created)
├── app/
│   └── api/               ← API Route Handlers
├── lib/
│   ├── vision/            ← AI vision provider abstraction + Gemini implementation
│   ├── nutrition/         ← Nutrition provider abstraction + USDA implementation
│   ├── highlights/        ← Benefit/highlight rules (rule-based)
│   └── validation/        ← Zod schemas
└── types/                 ← Shared TypeScript types
```

---

## Coding Rules

1. **TypeScript strict mode** everywhere. No `any` without a written justification comment.
2. **Zod validation** at every API boundary — both input (request) and output (response).
3. **Explicit error handling.** Never swallow errors silently. Surface them with clear types.
4. **No unnecessary dependencies.** Before adding a package, ask: can this be done with what we have?
5. **Small, focused files.** One file, one responsibility.
6. **Name things after what they do** in this project, not after abstract design patterns.
7. **Loading / error / empty states** must be handled in every screen.
8. **Accessibility** — every interactive element needs an accessible label and role.
9. **FlatList** for any list of dynamic length — never `ScrollView` + `.map()`.
10. **No `console.log` in production paths** — use structured logging on the backend.

---

## Security Rules

These are non-negotiable. Violating them is always a bug.

1. **Never put secrets in mobile client code.** API keys (Gemini, USDA, Supabase service role)
   live in server-side environment variables only.
2. **`EXPO_PUBLIC_` prefix** exposes a variable to the client bundle — never use it for secrets.
3. **Supabase anon key** may be in the client (it is designed to be public). The **service role key** must never leave the server.
4. **Validate all input on the server** with Zod before processing it.
5. **Validate uploaded images** — check MIME type from file header (not extension), limit size.
6. **Enable RLS on every Supabase table.** A table without RLS is accessible to anyone with the anon key.
7. **Rate-limit expensive endpoints** — the scan endpoint calls paid AI APIs.
8. **Never log secrets, tokens, or full request bodies** containing user data.
9. **Strip EXIF metadata** from images before storage — EXIF can contain GPS coordinates.
10. **Never expose raw external API responses** to the mobile app — always normalize first.

---

## AI & Nutrition Rules

These rules protect the user and the integrity of the application.

1. **The AI model identifies food only.** It never generates calorie counts, macros, or any
   nutritional values. Those come from USDA or another authoritative data source.
2. **Nutrition data must come from a trusted data source.** Never invent or hallucinate
   nutritional values.
3. **Expose uncertainty.** When the AI is not confident about food identification, surface that
   uncertainty to the user rather than picking an answer and presenting it as fact.
4. **Clearly communicate serving-size assumptions** in every nutrition response.
5. **Never present the app as a medical tool.** No diagnosis, no personalized medical advice,
   no therapeutic claims.
6. **Highlight rules are rule-based**, not AI-generated. A food is "high in protein" because
   its protein content crosses a defined threshold — not because the AI said so.

---

## Teaching Rules

Claude is also acting as a software engineering teacher for a beginner CSE student.

1. **Explain before implementing.** Before writing code for a new concept, explain what it is,
   why we need it, what alternatives exist, and why we are choosing our approach.
2. **Define every new term** the first time it is used (API, endpoint, schema, middleware, hook,
   state, REST, HTTP, JSON, validation, caching, authentication, authorization, etc.).
3. **Use this project as the example.** Never use abstract textbook examples when the project
   itself can illustrate the concept.
4. **After every implementation**, explain what files were created or changed and what
   responsibility each file has.
5. **Prefer simple over clever.** When two approaches work, choose the one a beginner can read
   and understand six months from now.
6. **Never introduce complexity without a demonstrated requirement.**
