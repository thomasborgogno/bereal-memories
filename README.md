# BeReal Memories Downloader

> **Live:** [https://bereal-memories-downloader.web.app](https://bereal-memories-downloader.web.app)

Browse and download all your BeReal memories — no subscription, no third-party fee, runs entirely in your browser.

## Features

- **ZIP Import** ✅ works on the hosted site — upload your GDPR data export and browse/download memories without signing in
- **BeReal Sign-in** ⚠️ local dev only — authenticate via phone + OTP to fetch memories live from the BeReal API (requires the dev proxy; not available on static hosting)
- Browse and filter memories by date range
- Download as ZIP — choose BeReal picture-in-picture format or separate front/back photos

## How to get your BeReal data export (ZIP Import)

1. Open the **BeReal app** → tap your profile picture (bottom right)
2. Tap the **⚙️ gear icon** (top right) → Settings
3. Navigate: **Help → Contact us → Ask a Question → Troubleshooting → Other → Still need help?**
4. Tap **Select Topic** → choose *"I'd like to request a copy of my data"*
5. Paste the following and send:
   > Under GDPR Article 15 and Article 20, I am requesting a complete copy of all personal data you hold about me, including all my BeReal photos and associated metadata. Please provide this data in a commonly used, machine-readable format (such as JSON or ZIP) within the 30-day period required by law. Thank you.
6. Wait **2–48 hours** for an email from BeReal
7. Download **`BeReal Profile Activity&Data.zip`** (not the `.json.gz`)
8. Go to [bereal-memories-downloader.web.app](https://bereal-memories-downloader.web.app), choose **Use Data Export**, and upload the ZIP

The help steps are also available inline in the app.

## Support / Donate

If this tool saved you time or money, consider buying me a coffee:

- ☕ [Ko-fi — ko-fi.com/thomasborgogno](https://ko-fi.com/thomasborgogno)
- 💙 [PayPal — paypal.me/thomasborgogno](https://paypal.me/thomasborgogno)

## How it works (BeReal Sign-in mode)

The app communicates with the private BeReal mobile API (reverse-engineered from the iOS app) through a local development proxy (`proxy.conf.json`) that forwards requests to BeReal's servers. Authentication uses Firebase phone-number OTP, followed by BeReal token exchange.

> **Note:** This app uses BeReal's unofficial private API. It is intended for personal use only. Use it to back up your own memories. Respect BeReal's Terms of Service.

## Prerequisites (local development)

- [Node.js](https://nodejs.org/) 18+
- [Angular CLI](https://angular.dev/tools/cli) 21+
- [Firebase CLI](https://firebase.google.com/docs/cli) (for deployment)

```bash
npm install -g @angular/cli firebase-tools
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure secrets

```bash
cp src/environments/environment.example.ts src/environments/environment.ts
cp src/environments/environment.example.ts src/environments/environment.prod.ts
```

If not working, try replacing the secrets with the publicly available in open-source BeReal reverse-engineering projects (e.g. [userbradley/BeReal-API](https://github.com/userbradley/BeReal-API)).

## Running the app

```bash
ng serve
```

Open your browser at `http://localhost:4200/`.

The dev server proxies all BeReal API calls through `proxy.conf.json`, which is required to avoid CORS errors.

## Building for production

```bash
ng build
```

Build artifacts are placed in `dist/bereal-memories/browser/`.

## Deploying to Firebase Hosting

```bash
firebase login
ng build
firebase deploy --only hosting
```

The site is hosted at [https://bereal-memories-downloader.web.app](https://bereal-memories-downloader.web.app).

> **Note:** The hosted version only supports **ZIP Import** mode. The BeReal Sign-in mode requires the local dev proxy and cannot work on a static host.

## Running tests

```bash
ng test
```

## Tech stack

- [Angular 21](https://angular.dev/) (standalone components, signals)
- [TypeScript](https://www.typescriptlang.org/)
- [RxJS](https://rxjs.dev/)
- [JSZip](https://stuk.github.io/jszip/) + [FileSaver.js](https://github.com/eligrey/FileSaver.js/) for in-browser ZIP download
- [Firebase Hosting](https://firebase.google.com/docs/hosting)

## Security & Privacy

- Your BeReal token is stored in `localStorage` for session persistence and is never sent to any server other than BeReal's own endpoints.
- This app is client-side only — no backend collects or stores your data.
- ZIP files are processed entirely in your browser and never uploaded anywhere.

