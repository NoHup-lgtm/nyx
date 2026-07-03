/**
 * Lê um corpo de resposta `text/event-stream` e emite cada bloco `data:`
 * como string. Para no `[DONE]` (convenção OpenAI). Funciona com o
 * ReadableStream web nativo do Node 20+.
 */
export async function* parseSSE(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<string> {
  if (!body) return;

  const decoder = new TextDecoder();
  let buffer = "";

  // ReadableStream é async-iterável no runtime do Node 20+.
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });

    let sep: number;
    // Eventos SSE são separados por linha em branco (\n\n).
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      for (const line of rawEvent.split("\n")) {
        const trimmed = line.trimStart();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;
        if (data) yield data;
      }
    }
  }
}
