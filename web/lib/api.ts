export const API_BASE = "https://excess-craftwork-uranium.ngrok-free.dev";
export function currentApiBase() { return API_BASE; }
export async function resolveApiBase() { return API_BASE; }
export async function backendSiap(_base?: string) { return true; }
