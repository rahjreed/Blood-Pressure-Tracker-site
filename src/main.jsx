import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import '@fontsource-variable/inter';
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      const signalUpdate = () => window.dispatchEvent(new Event('pressure-update'))
      if (registration.waiting && navigator.serviceWorker.controller) signalUpdate()
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) signalUpdate()
        })
      })
    } catch (error) {
      console.warn('PRESSURE could not prepare offline files.', error)
    }
  })
}
