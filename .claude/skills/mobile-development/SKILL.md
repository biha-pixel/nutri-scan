---
name: mobile-development
description: Use when building, modifying, or debugging the Expo/React Native mobile application. Covers component architecture, navigation, state management, camera/photo features, performance, accessibility, and dependency decisions.
---

# Mobile Development Guide

Guide development of the Expo / React Native mobile application for the food recognition and nutrition project.

## Technology Stack

- **Expo** (managed workflow unless ejection is required)
- **React Native** for cross-platform mobile UI
- **TypeScript** — strict mode, no `any` types without justification
- **Expo Router** for file-based navigation

## Component Architecture

### Structure
- Use **functional components** with hooks. No class components.
- Keep components small and focused — one component, one job.
- Separate **presentational components** (how things look) from **container components** (how things work / data fetching).
- Co-locate component files: `ComponentName.tsx`, and a styles file or styled section nearby.

### State Management
- Start with **React's built-in state** (`useState`, `useReducer`, `useContext`).
- Lift state to the nearest common ancestor — no higher.
- Do not add a state management library (Redux, Zustand, MobX) unless local state and context genuinely prove insufficient. Document the reason if one is added.
- For server data, prefer a data-fetching library with caching (e.g., TanStack Query) over manual `useEffect` + `useState` patterns.

### Props and Types
- Define explicit TypeScript interfaces for all component props.
- Avoid passing more props than a component needs.
- Use `children` for composition over configuration.

## Camera and Photo Features

- Use **expo-camera** for live camera access and **expo-image-picker** for gallery selection.
- Request permissions at the moment they are needed, not at app launch.
- Handle all permission states: granted, denied, not determined, and restricted.
- Show clear, friendly messages when permissions are denied, with a link to device settings.
- Compress/resize images before uploading — do not send raw multi-megabyte photos to the server.

## Image Selection Flow

1. User chooses camera or gallery.
2. App requests permission (if not yet granted).
3. Image is captured or selected.
4. Image is compressed/resized on-device.
5. A preview is shown with a "Scan" / "Analyze" action.
6. Image is uploaded to the server; a loading state is shown.
7. Results are displayed; errors are shown with a retry option.

## Loading, Error, and Empty States

Every screen and async operation must handle:

- **Loading** — show a spinner, skeleton, or progress indicator. Never leave the screen blank.
- **Error** — show what went wrong in plain language and offer a retry or fallback action. Never show raw error objects or stack traces to the user.
- **Empty** — when there is no data yet (no scan history, no results), show a helpful empty state, not a blank screen.

## Mobile Performance

- Avoid unnecessary re-renders. Use `React.memo`, `useMemo`, and `useCallback` only where profiling shows a real performance issue — not preemptively everywhere.
- Use **FlatList** (not `ScrollView` with `.map()`) for lists of any significant length.
- Lazy-load heavy screens with `React.lazy` or Expo Router's built-in lazy loading.
- Keep the JS bundle small: audit dependencies, avoid libraries that pull in large sub-dependencies for a small feature.

## Accessibility

- Every touchable element must have an accessible label (`accessibilityLabel`).
- Use semantic roles (`accessibilityRole`): `"button"`, `"image"`, `"header"`, etc.
- Ensure sufficient color contrast (4.5:1 for text, 3:1 for large text / UI components).
- Support dynamic font sizes — do not hardcode font sizes in pixels without `allowFontScaling`.
- Test with a screen reader (VoiceOver / TalkBack) in mind when designing interactions.

## Dependency Policy

- **Avoid unnecessary dependencies.** Before adding a package, ask: can this be done with Expo SDK, React Native, or a small amount of custom code?
- When a dependency is needed, prefer well-maintained packages with small footprints.
- Pin dependency versions. Document why each non-obvious dependency was added.
- Never install a dependency "just in case" — install it when a feature actually requires it.

## Code Organization

```
app/                   # Expo Router screens (file-based routing)
components/            # Reusable UI components
hooks/                 # Custom React hooks
services/              # API calls, business logic
types/                 # Shared TypeScript types/interfaces
utils/                 # Pure utility functions
constants/             # App-wide constants (colors, spacing, config)
assets/                # Images, fonts, static files
```

This layout is a starting point. Adjust it as the project grows, but keep the principle: each directory has a clear purpose.
