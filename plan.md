# PWA + Logo Integration Plan

## 1. Generate PWA Icons from Logo

- Install `sharp` as a dev dependency
- Write a Node script (`scripts/generate-icons.js`) that:
  - Loads `/public/ubtrippin_logo.png`
  - Extracts the character portion (center-crop to roughly square)
  - Places it on a cream (`#ede6cf`) background
  - Outputs: `icon-192x192.png`, `icon-512x512.png`, `apple-touch-icon.png` (180x180) into `/public/icons/`
- Run the script once, commit the generated icons

## 2. Create Web App Manifest

Create `/public/manifest.json`:
```json
{
  "name": "UBTRIPPIN - Travel Itineraries",
  "short_name": "UBTRIPPIN",
  "description": "Turn booking emails into beautiful itineraries",
  "start_url": "/trips",
  "display": "standalone",
  "background_color": "#ede6cf",
  "theme_color": "#2a2419",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## 3. Create Minimal Service Worker

Create `/public/sw.js` — a lightweight service worker that:
- Caches the app shell (HTML, CSS, JS) on install
- Uses network-first strategy for API calls
- Falls back to cache for static assets
- This is the minimum needed for Android "Add to Homescreen" prompt

## 4. Register Service Worker + PWA Meta Tags

Update `/src/app/layout.tsx`:
- Add `<link rel="manifest" href="/manifest.json">`
- Add `<meta name="theme-color" content="#2a2419">`
- Add `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`
- Add `<meta name="apple-mobile-web-app-capable" content="yes">`
- Register the service worker via an inline script or small client component

## 5. Integrate Logo into Dashboard Nav

Update `/src/components/dashboard-nav.tsx`:
- Replace the plain text `<span>UBTRIPPIN</span>` with the logo image
- Use `next/image` with the existing `/ubtrippin_logo.png`
- Size: ~40px height, auto width, with `blend-multiply` class
- The logo will show the character + "U B TRIPPIN" speech bubble in the nav
- Works on both mobile and desktop layouts

## 6. Add Logo to Login Page

Update the login page to also use the logo image instead of plain text, for brand consistency across the app.

## Files Changed

| File | Action |
|------|--------|
| `package.json` | Add `sharp` dev dependency |
| `scripts/generate-icons.js` | New - icon generation script |
| `public/icons/*.png` | New - generated PWA icons |
| `public/manifest.json` | New - web app manifest |
| `public/sw.js` | New - service worker |
| `src/app/layout.tsx` | Update metadata + SW registration |
| `src/components/dashboard-nav.tsx` | Replace text logo with image |
| `src/app/(auth)/login/page.tsx` | Add logo image |
