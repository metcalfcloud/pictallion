export async function invoke<T = unknown>(
  _cmd: string,
  _args?: Record<string, unknown>,
): Promise<T> {
  const details =
    typeof _args === "undefined" ? "" : ` args=${JSON.stringify(_args)}`;
  throw new Error(
    `Tauri API is not available in unit tests: cmd=${_cmd}${details}`,
  );
}

export default { invoke };
