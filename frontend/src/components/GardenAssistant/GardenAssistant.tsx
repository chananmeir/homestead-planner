import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Send, Sparkles, Square, AlertTriangle, Leaf } from 'lucide-react';
import { apiGet } from '../../utils/api';
import { useStreamingChat, ChatMessage } from './useStreamingChat';
import { useActivePlan } from '../../contexts/ActivePlanContext';
import { useSimulation } from '../../contexts/SimulationContext';

interface AssistantStatus {
  enabled: boolean;
  model: string | null;
}

const SUGGESTED_PROMPTS = [
  "What should I be doing in the garden this week?",
  "Which of my beds have free space right now?",
  "Suggest companion plants for my tomatoes.",
  "What can I succession-plant after my lettuce finishes?",
];

const STORAGE_KEY = 'homestead-assistant-open';

/**
 * How much horizontal space the panel occupies in each state. The app layout
 * reserves exactly this much via the --assistant-inset custom property so page
 * content is never rendered underneath the panel.
 *
 * Keep in sync with the `w-80` / `w-12` classes on the panel and rail below.
 */
const INSET_OPEN = '20rem'; // w-80
const INSET_COLLAPSED = '3rem'; // w-12
export const ASSISTANT_INSET_VAR = '--assistant-inset';

/**
 * Global chat sidebar that persists across all tabs.
 * Streams responses from the backend Garden Assistant (any OpenAI-compatible endpoint).
 * Reads its plan/date context from the app-wide contexts so it works on any page.
 */
const GardenAssistant: React.FC = () => {
  const { activePlanId } = useActivePlan();
  const { getToday } = useSimulation();
  // getToday() already returns a YYYY-MM-DD string for the backend's garden-context snapshot.
  const dateStr = getToday();
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);

  const { send, cancel, isStreaming, error } = useStreamingChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingAssistantRef = useRef<string>('');

  // Persist open/closed so a refresh keeps the user's preference.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isOpen));
    } catch {
      /* ignore quota errors */
    }
  }, [isOpen]);

  // Reserve layout space for the panel.
  //
  // The panel is position:fixed against the right edge, so without this the app
  // simply renders underneath it — anything in the rightmost 320px (or 48px when
  // collapsed) is visually covered AND unclickable, because the panel swallows
  // the pointer events. Publishing the width lets the app pad itself by exactly
  // the amount the panel covers.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(ASSISTANT_INSET_VAR, isOpen ? INSET_OPEN : INSET_COLLAPSED);
    return () => {
      // Unmounted (e.g. on logout) — the panel is gone, so reclaim the space.
      root.style.setProperty(ASSISTANT_INSET_VAR, '0px');
    };
  }, [isOpen]);

  // Check whether the backend has the LLM configured.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet('/api/ai-assistant/status');
        if (!res.ok) {
          if (!cancelled) setStatus({ enabled: false, model: null });
          return;
        }
        const data: AssistantStatus = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus({ enabled: false, model: null });
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll to the latest token / message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const handleSend = useCallback(
    (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || isStreaming) return;

      const nextHistory = [...messages, { role: 'user' as const, content: text }];
      setMessages(nextHistory);
      setInput('');
      setContextSummary(null);
      setShowContext(false);
      pendingAssistantRef.current = '';

      // Append an empty assistant message we mutate as tokens arrive.
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      send(
        text,
        // History excludes the just-added user turn (the backend re-adds it).
        messages,
        {
          onContext: (summary) => setContextSummary(summary),
          onToken: (delta) => {
            pendingAssistantRef.current += delta;
            const snapshot = pendingAssistantRef.current;
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: 'assistant', content: snapshot };
              return copy;
            });
          },
          onError: (errMsg) => {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === 'assistant' && last.content === '') {
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: `⚠️ ${errMsg}`,
                };
              }
              return copy;
            });
          },
        },
        { planId: activePlanId, date: dateStr },
      );
    },
    [input, isStreaming, messages, send, activePlanId, dateStr],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Collapsed rail --------------------------------------------------------
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-0 h-full w-12 flex flex-col items-center justify-start pt-4 bg-white border-l border-gray-200 shadow-lg hover:bg-green-50 transition-colors group z-40"
        title="Open Garden Assistant"
        aria-label="Open Garden Assistant"
      >
        <Sparkles className="w-5 h-5 text-green-600 mb-2" />
        <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-medium text-gray-600 group-hover:text-green-700 tracking-wide">
          Garden Assistant
        </span>
      </button>
    );
  }

  // Expanded panel --------------------------------------------------------
  return (
    <aside className="fixed right-0 top-0 h-full w-80 flex flex-col bg-white border-l border-gray-200 shadow-2xl z-40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-green-600 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 truncate">Garden Assistant</h3>
            {status?.enabled && status.model ? (
              <p className="text-[10px] text-gray-500 truncate">{status.model}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
          title="Collapse assistant"
          aria-label="Collapse assistant"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Not configured banner */}
      {!statusLoading && status && !status.enabled ? (
        <div className="flex-1 overflow-y-auto p-4 text-sm text-gray-600">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="font-medium text-gray-800">Assistant is not configured</p>
          </div>
          <p className="mb-3">
            Set these environment variables on the backend to enable it:
          </p>
          <pre className="bg-gray-900 text-gray-100 text-[11px] rounded p-2 overflow-x-auto leading-relaxed">
{`LLM_API_KEY=...
LLM_BASE_URL=https://...
LLM_MODEL=gpt-4o-mini`}
          </pre>
          <p className="mt-3 text-xs text-gray-500">
            Works with any OpenAI-compatible endpoint (OpenAI, OpenRouter, LiteLLM, Ollama, vLLM, …).
          </p>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="text-center py-6 px-2">
                <Leaf className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-700 font-medium mb-1">
                  Hi! I'm your garden helper.
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Ask me anything — I can see your current garden.
                </p>
                <div className="space-y-1.5">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      className="block w-full text-left text-xs px-3 py-2 bg-green-50 hover:bg-green-100 text-green-800 rounded-md border border-green-100 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'bg-green-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.content || (isStreaming && msg.role === 'assistant' && idx === messages.length - 1 ? (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
                      </span>
                    ) : '')}
                  </div>
                </div>
              ))
            )}

            {error && messages.length === 0 ? (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {error}
              </div>
            ) : null}
          </div>

          {/* Context preview */}
          {contextSummary ? (
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowContext((s) => !s)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <span>What the assistant sees</span>
                {showContext ? <ChevronRight className="w-3 h-3 rotate-90" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {showContext ? (
                <pre className="max-h-32 overflow-auto px-3 pb-2 text-[10px] text-gray-600 whitespace-pre-wrap bg-gray-50">
                  {contextSummary}
                </pre>
              ) : null}
            </div>
          ) : null}

          {/* Input */}
          <div className="border-t border-gray-200 p-2">
            <div className="flex items-end gap-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask your garden…"
                className="flex-1 resize-none max-h-32 text-sm px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                disabled={isStreaming}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={cancel}
                  className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
                  title="Stop"
                  aria-label="Stop"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                  title="Send"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

export default GardenAssistant;
