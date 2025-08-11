// Ambient declarations to make TS happy when building for the web
// These may be provided by Tauri at runtime in the desktop app.
declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    __TAURI_IPC__?: unknown;
  }
}

export {};
