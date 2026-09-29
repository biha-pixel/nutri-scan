---
name: mobile-development
description: Use when building, modifying, or debugging the Expo/React Native mobile application. Covers component architecture, navigation, state management, camera/photo features, performance, accessibility, and dependency decisions.
---

# Mobile Development Guide

Guide development of the Expo / React Native mobile application for the food recognition and nutrition project.

## Technology Stack

- **Expo** (managed workflow)
- **React Native** for cross-platform mobile UI
- **TypeScript** — strict mode
- **Expo Router** for file-based navigation
- **Styling** — React Native `StyleSheet` only. Do not add NativeWind unless explicitly decided.

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

## Camera and Photo Features
- Use **expo-camera** for live camera access and **expo-image-picker** for gallery selection.
- Request permissions at the moment they are needed, not at app launch.
- Handle all permission states: granted, denied, not determined, and restricted.
- Show clear, friendly messages when permissions are denied, with a link to device settings.
- Compress/resize images on-device before uploading to the backend.

## Loading, Error, and Empty States
Every screen and async operation must handle:
- **Loading** — show a spinner, skeleton, or progress indicator.
- **Error** — show what went wrong in plain language and offer a retry action. Never show raw error objects.
- **Empty** — show a helpful empty state when no data exists yet.

## Accessibility
- Every touchable element needs an accessible label (`accessibilityLabel`).
- Use semantic roles (`accessibilityRole`): `"button"`, `"image"`, `"header"`, etc.
- Support dynamic font sizes.

## Dependency Policy
- **Avoid unnecessary dependencies.** Before adding a package, ask: can this be done with Expo SDK or React Native built-ins?
- Pin dependency versions.
- Never install a dependency "just in case".

## Code Organization
```
app/                   # Expo Router screens (file-based routing)
components/            # Reusable UI components (Button, LoadingSpinner, ErrorMessage)
hooks/                 # Custom React hooks
services/              # API calls to the Next.js backend
types/                 # Shared TypeScript types
utils/                 # Pure utility functions
constants/             # App-wide constants (colors, spacing, config)
assets/                # Images, fonts
```
