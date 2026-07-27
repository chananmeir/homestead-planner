import { useCallback, useRef, useState } from 'react';
import { API_BASE_URL } from '../../config';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface AssistantStreamCallbacks {
  onContext?: (summary: string) => void;
  onToken: (delta: string) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export interface SendOptions {
  planId?: number | null;
  date?: string | null;
}

interface SSEFrame {
  type: 'context' | 'token' | 'done' | 'error';
  delta?: string;
  summary?: string;
  error?: string;
}

/**
 * Parses raw SSE bytes from a Response body into discrete JSON frames.
 * Each SSE message is one or more lines starting with "data: ".
 */
async function* parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<SSEFrame> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal.aborted) return;
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by a blank line.
      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawMessage = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);

        const dataLines = rawMessage
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim());

        if (dataLines.length === 0) continue;
        const payload = dataLines.join('\n');
        if (!payload) continue;

        try {
          yield JSON.parse(payload) as SSEFrame;
        } catch {
          // Skip malformed frames (e.g. proxy keepalive comments).
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

export interface UseStreamingChatResult {
  send: (
    message: string,
    history: ChatMessage[],
    callbacks: AssistantStreamCallbacks,
    opts?: SendOptions,
  ) => Promise<void>;
  cancel: () => void;
  isStreaming: boolean;
  error: string | null;
}

/**
 * Streams a chat completion from the Garden Assistant SSE endpoint.
 *
 * Uses fetch directly so we can read the body as a stream while still sending
 * credentials (cookies) for authentication.
 */
export function useStreamingChat(): UseStreamingChatResult {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (
      message: string,
      history: ChatMessage[],
      callbacks: AssistantStreamCallbacks,
      opts: SendOptions = {},
    ) => {
      // Abort any in-flight stream before starting a new one.
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/ai-assistant/chat`, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            history,
            planId: opts.planId ?? null,
            date: opts.date ?? null,
          }),
        });

        if (!response.ok) {
          let detail = `Request failed (${response.status})`;
          try {
            const body = await response.json();
            if (body && body.error) detail = body.error;
          } catch {
            /* ignore parse error */
          }
          setError(detail);
          callbacks.onError?.(detail);
          return;
        }

        if (!response.body) {
          const msg = 'No response body from assistant.';
          setError(msg);
          callbacks.onError?.(msg);
          return;
        }

        const reader = response.body.getReader();
        for await (const frame of parseSseStream(reader, controller.signal)) {
          if (controller.signal.aborted) return;
          switch (frame.type) {
            case 'context':
              if (frame.summary) callbacks.onContext?.(frame.summary);
              break;
            case 'token':
              if (frame.delta) callbacks.onToken(frame.delta);
              break;
            case 'done':
              callbacks.onDone?.();
              return;
            case 'error': {
              const errMsg = frame.error || 'Assistant error.';
              setError(errMsg);
              callbacks.onError?.(errMsg);
              return;
            }
          }
        }
        // Stream ended without an explicit done frame.
        callbacks.onDone?.();
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Network error talking to assistant.';
        setError(msg);
        callbacks.onError?.(msg);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    [],
  );

  return { send, cancel, isStreaming, error };
}
