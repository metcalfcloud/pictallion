export async function invoke<T = unknown>(
  _cmd: string,
  _args?: Record<string, unknown>,
): Promise<T> {
  // Reference parameters to avoid unused-var lint and aid debugging
  const details =
    typeof _args === "undefined" ? "" : ` args=${JSON.stringify(_args)}`;
  throw new Error(
    `Tauri API shim used (stubbed for web/test builds): cmd=${_cmd}${details}`,
  );
}

export default { invoke };
