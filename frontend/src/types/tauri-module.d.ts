// Minimal type shim for '@tauri-apps/api/core' so TS can compile in web builds
declare module "@tauri-apps/api/core" {
  export function invoke<T = unknown>(
    cmd: string,
    args?: Record<string, unknown>,
  ): Promise<T>;
  export function convertFileSrc(path: string): string;
}


declare module '@tauri-apps/api/tauri' {
  export function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  export function convertFileSrc(path: string): string;
}
