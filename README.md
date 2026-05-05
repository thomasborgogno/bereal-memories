# BeReal Memories Downloader

A personal Angular web app that lets you log in to your BeReal account and download all your memories (photos + videos) locally.

## What it does

- Authenticates with your BeReal account via phone number + OTP (one-time password)
- Fetches all your memories from the BeReal API
- Lets you browse and filter memories by date range
- Downloads memories as a ZIP archive directly in the browser

## How it works

The app communicates with the private BeReal mobile API (reverse-engineered from the iOS app) through a local development proxy (`proxy.conf.json`) that forwards requests to BeReal's servers. Authentication uses Firebase phone-number OTP, followed by BeReal token exchange.

> **Note:** This app uses BeReal's unofficial private API. It is intended for personal use only. Use it to back up your own memories. Respect BeReal's Terms of Service.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Angular CLI](https://angular.dev/tools/cli) 21+

```bash
npm install -g @angular/cli
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure secrets

Copy the example environment file and fill in the real values:

```bash
cp src/environments/environment.example.ts src/environments/environment.ts
cp src/environments/environment.example.ts src/environments/environment.prod.ts
```

Edit both files and replace the placeholder strings with the actual values. The secrets needed are publicly available in open-source BeReal reverse-engineering projects (e.g. [userbradley/BeReal-API](https://github.com/userbradley/BeReal-API)).

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

Build artifacts are placed in `dist/`. The production build automatically uses `environment.prod.ts`.

> **Hosting warning:** The proxy only works with the dev server. A production deployment requires a separate backend proxy (e.g. Nginx, Cloudflare Worker, or a Node server) to forward BeReal API requests, since browsers cannot call those endpoints directly due to CORS restrictions.

## Running tests

```bash
ng test
```

## Tech stack

- [Angular 21](https://angular.dev/) (standalone components, signals)
- [TypeScript](https://www.typescriptlang.org/)
- [RxJS](https://rxjs.dev/)
- [JSZip](https://stuk.github.io/jszip/) + [FileSaver.js](https://github.com/eligrey/FileSaver.js/) for in-browser ZIP download

## Security & Privacy

- Your BeReal token is stored in `localStorage` for session persistence and is never sent to any server other than BeReal's own endpoints.
- This app is client-side only — no backend collects or stores your data.
- For personal / local use only. Do not deploy publicly without understanding the implications (see hosting warning above).
