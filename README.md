# PRESSURE

PRESSURE is a local-first adult blood pressure log by Callista Digital. It uses React, Vite, IndexedDB, and a versioned service worker. It runs without accounts, API keys, or external runtime services.

## Develop and verify

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite starts a local production preview by default. Set `PRESSURE_TEST_URL` to a reachable preview origin to run the same desktop and mobile Chromium tests there. Browser tests use isolated contexts and their own data. The application starts with an empty record.

## Storage and calculations

- A reading stores a stable ID, timestamp, and the UTC offset at recording time. Range filters use the local day where each reading was recorded. Rolling windows include today and the preceding calendar days.
- Dashboard, insights, checkup, and report averages weight each individual reading equally. Pulse averages include only readings with pulse. Guided sessions have derived average records persisted alongside their individual readings in a single transaction. Edits, deletes, and imports update affected session summaries.
- IndexedDB schema changes belong in explicit version upgrades. The storage interface in `src/storage.js` keeps persistence separate from the measurement and presentation modules. The stable IDs and explicit timestamp and offset fields can support future synchronization through that interface.
- JSON v1 is a validated, additive backup for readings and checkup dates. Import skips existing reading IDs and keeps an existing checkup. Theme and reminder times are local preferences.
- The production build precaches the app and report generator. The first visit needs a connection. An updated service worker waits until the previous version’s tabs are closed before switching app files. Storage depends on the browser profile and origin.
- Reminders are in-app only. Native scheduled notifications and background delivery are outside this version.
