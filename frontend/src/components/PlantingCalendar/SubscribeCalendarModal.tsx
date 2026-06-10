import React, { useEffect, useState } from 'react';
import { X, Copy, Check, RefreshCw, Download } from 'lucide-react';
import { apiGet, apiPost } from '../../utils/api';

interface SubscribeCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * "Subscribe on your phone" modal: surfaces the user's secret iCalendar feed
 * URL (GET /api/calendar/feed-info), with copy / download / regenerate
 * actions and per-provider subscription instructions. Subscribing turns the
 * phone's native calendar into the app's reminder channel.
 */
const SubscribeCalendarModal: React.FC<SubscribeCalendarModalProps> = ({ isOpen, onClose }) => {
  const [feedUrl, setFeedUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCopied(false);
    setConfirmRegenerate(false);
    setError('');
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiGet('/api/calendar/feed-info');
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data = await response.json();
        setFeedUrl(data.feedUrl || '');
      } catch (err) {
        console.error('Failed to load calendar feed info:', err);
        setError('Could not load your feed URL. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. http on LAN) — select the input instead.
      const input = document.getElementById('ics-feed-url') as HTMLInputElement | null;
      input?.select();
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError('');
    try {
      const response = await apiPost('/api/calendar/feed-token/regenerate', {});
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data = await response.json();
      setFeedUrl(data.feedUrl || '');
      setConfirmRegenerate(false);
      setCopied(false);
    } catch (err) {
      console.error('Failed to regenerate feed token:', err);
      setError('Could not regenerate the feed URL. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="subscribe-calendar-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">📲 Subscribe on your phone</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm text-gray-700">
          <p>
            Subscribe your phone or computer calendar to this feed and every garden task —
            seed starts, transplants, direct seeding, and harvest dates — appears there
            automatically, with your calendar's own reminders. The feed updates whenever
            your plan changes.
          </p>

          {/* Feed URL + actions */}
          {loading ? (
            <p className="text-gray-500">Loading your feed URL…</p>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  id="ics-feed-url"
                  type="text"
                  readOnly
                  value={feedUrl}
                  data-testid="ics-feed-url"
                  className="flex-1 text-xs border border-gray-300 rounded px-2 py-2 bg-gray-50 font-mono"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={handleCopy}
                  disabled={!feedUrl}
                  className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs"
                  title="Copy feed URL"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={feedUrl || '#'}
                  download="homestead-planner.ics"
                  className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs"
                  title="Download a one-time .ics snapshot"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>

              {/* Regenerate (revoke) */}
              <div className="text-xs text-gray-500">
                {confirmRegenerate ? (
                  <span className="flex items-center gap-2">
                    This invalidates the current URL everywhere it's subscribed. Continue?
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {regenerating ? '…' : 'Yes, regenerate'}
                    </button>
                    <button
                      onClick={() => setConfirmRegenerate(false)}
                      className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmRegenerate(true)}
                    className="flex items-center gap-1 text-gray-500 hover:text-gray-700 underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate secret URL (revokes the old one)
                  </button>
                )}
              </div>
            </>
          )}

          {error && <p className="text-red-600 text-xs">{error}</p>}

          {/* Provider instructions */}
          <div className="border-t pt-3 space-y-2 text-xs text-gray-600">
            <p className="font-semibold text-gray-700">How to subscribe:</p>
            <p><span className="font-medium">Google Calendar:</span> Settings → Add calendar → From URL → paste the link.</p>
            <p><span className="font-medium">iPhone / iPad:</span> Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar.</p>
            <p><span className="font-medium">Outlook:</span> Add calendar → Subscribe from web.</p>
            <p className="text-gray-400">
              Note: the device must be able to reach this address. If the URL says
              "localhost", subscribe from this computer, or replace the host with this
              machine's LAN IP for phones on your network. Treat the URL like a password —
              anyone with it can read your garden schedule.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscribeCalendarModal;
