import { ProviderError } from "./types.js";

/** Extrai a causa real de um erro de fetch do Node (undici embrulha em `cause`). */
export function describeFetchError(err: unknown): string {
  const e = err as any;
  const cause = e?.cause;
  if (cause?.code) {
    return `${cause.code}${cause.hostname ? ` (${cause.hostname})` : ""}`;
  }
  if (cause?.message) return cause.message;
  return e?.message ?? String(err);
}

/**
 * Faz um fetch e, se a conexão falhar (rede/DNS/TLS), lança um ProviderError com
 * a causa legível em vez do genérico "fetch failed".
 */
export async function safeFetch(
  url: string,
  init: RequestInit,
  providerId: string,
  label: string,
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new ProviderError(
      `falha de rede ao chamar ${label} (${url}): ${describeFetchError(err)}`,
      providerId,
    );
  }
}
