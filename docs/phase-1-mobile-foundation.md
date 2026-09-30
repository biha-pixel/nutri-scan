# NutriScan Mobile App — Phase 1 Complete

## What We Built

A working Expo mobile application with four screens:
1. **Home/Scan screen** — Take photo or choose from gallery
2. **Result screen** — Display food identification and nutrition facts
3. **History screen** — Show past scans (placeholder data)
4. **Settings screen** — App preferences

---

## Every Important File

### `/mobile/index.ts`
**What it does:** Entry point for the entire Expo app.  
**Contents:** One line: `import 'expo-router/entry';`  
**Why:** This tells Expo to use Expo Router's file-based routing system. The framework calls this file first, and Expo Router takes over from there.

---

### `/mobile/app.json`
**What it does:** Configuration file for the Expo app.  
**Contents:**
- App name: "NutriScan"
- App identifier (slug): "nutriscan"
- Icons and splash screen references
- Platform-specific settings (iOS, Android, Web)
- Plugins: `expo-router` for navigation

**Why:** Expo reads this file to know how to build and run your app. Every Expo app has one.

---

### `/mobile/app/_layout.tsx`
**What it does:** Root layout component. Wraps every screen in the app.  
**Contents:**
- A `<Stack>` navigator from Expo Router
- Screen configuration for each route (title, header style, transitions)

**Why:** This is where navigation structure is defined. Expo Router calls this layout first, then renders whichever screen matches the current route inside it.

**Key concept — Layout:** A layout is a component that wraps other components. It sets up things all screens share (like the navigation header).

---

### `/mobile/app/index.tsx`
**What it does:** The home screen (Scan screen). Route: `/`  
**Contents:**
- App title and description
- "Take Photo" button → requests camera permission, launches camera
- "Choose from Gallery" button → requests gallery permission, opens image picker
- Recent scans list (dummy data for now)
- Top navigation buttons to History and Settings

**State used:**
- `loading` — tracks whether the camera/gallery is currently open

**Props passed when navigating:**
- `imageUri` — the selected photo's URI
- `foodName` — a placeholder name (will come from AI later)

**Why this file is `index.tsx`:** Expo Router uses file-based routing. `app/index.tsx` becomes the root route `/`.

---

### `/mobile/app/result.tsx`
**What it does:** The result screen. Route: `/result`  
**Contents:**
- Displays the selected food image (or a placeholder emoji)
- Shows food name (passed as a route parameter)
- Displays mock nutrition data (calories, protein, fat, carbs)
- Shows a rule-based highlight badge ("High in Fiber & Healthy Fats")
- USDA disclaimer

**Props received:**
- `imageUri` (optional) — from `useLocalSearchParams()`
- `foodName` (optional) — from `useLocalSearchParams()`

**Why:** When the user takes a photo on the Scan screen, `router.push()` navigates here and passes the image URI. Expo Router automatically makes those values available through `useLocalSearchParams()`.

---

### `/mobile/app/history.tsx`
**What it does:** History screen. Route: `/history`  
**Contents:**
- A `FlatList` rendering past scan records
- Each item is tappable → navigates to `/result` with that food's name

**Why use `FlatList` instead of `.map()`?**  
`FlatList` is optimized for long lists. It only renders the items currently visible on screen. Mapping over an array with `ScrollView` renders everything at once, which kills performance for large lists.

---

### `/mobile/app/settings.tsx`
**What it does:** Settings screen. Route: `/settings`  
**Contents:**
- Toggle switches for "Save Scan History" and "Metric Units"
- Action rows for "Clear Local History" and "Privacy Policy" (not yet functional)
- App version and data source info

**State used:**
- `saveHistory` — controlled by a `Switch` component
- `metricUnits` — controlled by a `Switch` component

**Why:** This demonstrates how React state works with interactive controls. When the user toggles a switch, `setSaveHistory` updates the state, and React re-renders the component with the new value.

---

### `/mobile/components/Button.tsx`
**What it does:** A reusable button component.  
**Contents:**
- Accepts props: `title`, `onPress`, `variant` (primary/secondary/outline), `style`, `disabled`
- Renders a `TouchableOpacity` with consistent styling

**Why create a component for this?**  
Instead of writing the same button styles 10 times across different screens, we write it once here. Every screen imports `<Button />` and passes different props. This is **component reusability** — a core React principle.

**Props flow:** The parent component (e.g., Scan screen) passes `title="Take Photo"` and `onPress={handleTakePhoto}` down into `<Button>`. The Button component receives those as `props` and uses them.

---

### `/mobile/constants/theme.ts`
**What it does:** Centralized design tokens.  
**Contents:**
- `COLORS` object — primary green, background off-white, text colors, etc.
- `SPACING` object — consistent padding/margin values
- `RADIUS` object — border radius values

**Why:** When you want to change the app's primary color, you change it once here. Every component imports these constants, so the change applies everywhere. This is called a **design system** at its simplest level.

---

## Execution Flow: What Happens When You Launch the App

1. **React Native runtime starts** (Hermes on the phone, or Metro bundler in Expo Go during development).

2. **`index.ts` is executed** → imports `expo-router/entry`.

3. **Expo Router takes control** → looks inside the `app/` folder for routes.

4. **`app/_layout.tsx` is rendered first** → creates a `<Stack>` navigator.

5. **Expo Router matches the current route to a file:**
   - Route `/` → renders `app/index.tsx` inside the Stack.
   - User taps a button that calls `router.push('/result')` → Expo Router transitions to `app/result.tsx`.

6. **Each screen component renders:**
   - Reads any props from `useLocalSearchParams()` if navigated with parameters.
   - Renders JSX → React Native translates `<View>`, `<Text>`, `<TouchableOpacity>` into native iOS/Android UI components.
   - If the component has state (`useState`), React tracks it. When state changes (e.g., `setLoading(true)`), React re-renders that component.

7. **User interaction:**
   - User taps "Take Photo" → `handleTakePhoto` is called → requests camera permission → launches camera.
   - If the user takes a photo, `router.push('/result', { params: { imageUri, foodName } })` navigates to the Result screen.
   - The Result screen reads those params and displays the image and mock nutrition data.

---

## What You Learned About Frameworks and Components

### Framework vs Library (Revisited with Real Code)

- **Expo (framework):** You didn't write `main()`. Expo did. You wrote screen components (`index.tsx`, `result.tsx`), and Expo Router called them at the right time. The framework is in control.

- **Zod (library, future):** When we add Zod for validation, *you* will call it: `foodSchema.parse(data)`. You're in control.

### Component Hierarchy (The Tree)

Our app is a tree:

```
<Stack> (from _layout.tsx)
  ├─ <ScanScreen> (app/index.tsx)
  │    ├─ <Button title="Take Photo" />
  │    ├─ <Button title="Choose from Gallery" />
  │    └─ <FlatList renderItem={...} />
  │
  ├─ <ResultScreen> (app/result.tsx)
  │    ├─ <Image source={{ uri }} />
  │    └─ <Button title="Scan Another Food" />
  │
  ├─ <HistoryScreen> (app/history.tsx)
  │    └─ <FlatList renderItem={...} />
  │
  └─ <SettingsScreen> (app/settings.tsx)
       └─ <Switch value={saveHistory} onValueChange={...} />
```

**The key insight:** Big components are made of smaller components. The `Button` component is reused across multiple screens. The `ScanScreen` is a component. The entire app is one big component tree.

### State (Revisited with Real Examples)

From `app/index.tsx`:

```typescript
const [loading, setLoading] = useState(false);
```

- `loading` starts as `false`.
- When the camera opens, we call `setLoading(true)`.
- React sees the state changed → re-renders the component.
- The button's `disabled` prop is bound to `loading`, so the button becomes disabled while the camera is open.

**State is local** — the `loading` state in the Scan screen does not affect the Result screen. They are separate components with separate state.

### Props (Revisited with Real Examples)

From `app/index.tsx`:

```typescript
<Button
  title="Take Photo"
  onPress={handleTakePhoto}
  style={styles.actionButton}
  disabled={loading}
/>
```

We pass four props into `<Button>`. Inside `Button.tsx`, the component receives them:

```typescript
export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  style,
  disabled,
}) => {
  return <TouchableOpacity onPress={onPress} disabled={disabled} style={style}>
    <Text>{title}</Text>
  </TouchableOpacity>;
};
```

**Props flow downward** — from parent (Scan screen) to child (Button).

### Routing (Revisited with Real Examples)

File-based routing in action:

- `app/index.tsx` → Route: `/` (home)
- `app/result.tsx` → Route: `/result`
- `app/history.tsx` → Route: `/history`
- `app/settings.tsx` → Route: `/settings`

To navigate:

```typescript
router.push('/result');
```

To navigate with parameters:

```typescript
router.push({
  pathname: '/result',
  params: { imageUri: 'file://...', foodName: 'Avocado' },
});
```

The Result screen reads them:

```typescript
const params = useLocalSearchParams<{ imageUri?: string; foodName?: string }>();
```

**The router is a framework feature** — Expo Router manages the navigation stack, the back button, and the screen transitions. You just call `router.push()`.

---

## How to Run the App on Your Phone

### Option 1: Expo Go (Fastest, Recommended for Development)

1. **Install Expo Go on your phone:**
   - iOS: App Store → search "Expo Go"
   - Android: Play Store → search "Expo Go"

2. **Start the development server:**
   ```powershell
   cd "C:\Users\bihal\Documents\claude code free\nutrition app\nutrition-app\mobile"
   npm start
   ```

3. **Scan the QR code:**
   - On iOS: Open the Camera app → point at the QR code in the terminal → tap the notification
   - On Android: Open Expo Go → tap "Scan QR code" → scan the code in the terminal

4. **The app loads on your phone.** Changes you make in the code will hot-reload automatically.

### Option 2: Build a Standalone App (Production-Like)

This creates a real `.apk` (Android) or `.ipa` (iOS) file, but takes longer.

```powershell
cd "C:\Users\bihal\Documents\claude code free\nutrition app\nutrition-app\mobile"
npx eas-cli build --platform android --profile preview
```

(Requires an Expo account and EAS setup — we'll cover this when we deploy.)

---

## What We Didn't Implement Yet

- ❌ Backend server (Next.js)
- ❌ AI vision (Gemini)
- ❌ Real nutrition lookup (USDA)
- ❌ Supabase authentication
- ❌ Persistent scan history storage

All of those come in later phases. Right now, you have a working mobile app with navigation, camera access, and placeholder screens.

---

## Summary

You now have:

✅ A functional Expo mobile app  
✅ Four screens with navigation  
✅ Camera and gallery access  
✅ Reusable components  
✅ TypeScript strict mode (zero errors)  
✅ A clean, modern UI  
✅ Real understanding of React, React Native, Expo, components, state, props, and routing

**Next steps (future phases):**
- Build the Next.js backend
- Integrate Gemini for food recognition
- Connect USDA for nutrition data
- Add Supabase for user authentication and scan history

But first: **run the app** and see it working on your phone.
