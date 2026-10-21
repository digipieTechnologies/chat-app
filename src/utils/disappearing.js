// Disappearing messages need no schema changes.
// The per-chat timer is stored as a system text message with JSON body:
//   {"__disappear":1,"secs":86400}   (secs = 0 turns the timer off)
// The latest such message decides how long messages sent AFTER it live. Every client hides expired messages,
// and the sender's client also soft-deletes its own expired messages (is_deleted) so they vanish everywhere.

export const DISAPPEAR_OPTIONS = [
  { label: 'Off', secs: 0 },
  { label: '1 minute', secs: 60 },
  { label: '1 hour', secs: 3600 },
  { label: '24 hours', secs: 86400 },
  { label: '7 days', secs: 604800 },
  { label: '30 days', secs: 2592000 },
];

export function parseDisappearing(text) {
  if (typeof text !== 'string' || !text.startsWith('{"__disappear"')) return null;
  try {
    const data = JSON.parse(text);
    if (!data || data.__disappear !== 1 || !Number.isFinite(data.secs) || data.secs < 0) return null;
    return { secs: data.secs };
  } catch {
    return null;
  }
}

export function buildDisappearingMessage(secs) {
  return JSON.stringify({ __disappear: 1, secs });
}

export function durationLabel(secs) {
  const known = DISAPPEAR_OPTIONS.find(o => o.secs === secs);
  if (known) return known.label;
  if (secs % 86400 === 0) return `${secs / 86400} days`;
  if (secs % 3600 === 0) return `${secs / 3600} hours`;
  if (secs % 60 === 0) return `${secs / 60} minutes`;
  return `${secs} seconds`;
}

export function disappearingNotice(secs, who) {
  return secs > 0
    ? `${who} set disappearing messages to ${durationLabel(secs)}. New messages will disappear after that.`
    : `${who} turned off disappearing messages.`;
}

export function disappearingPreview(text) {
  const d = parseDisappearing(text);
  if (!d) return text;
  return d.secs > 0 ? `⏱ Disappearing messages: ${durationLabel(d.secs)}` : '⏱ Disappearing messages turned off';
}

// messages must be in chronological order (they are loaded ascending).
// -> { currentSecs, expiresAt: Map<messageId, epochMs> }
export function computeExpiries(messages) {
  const expiresAt = new Map();
  let secs = 0;
  (messages || []).forEach(m => {
    const setting = m.type === 'text' ? parseDisappearing(m.text) : null;
    if (setting) {
      secs = setting.secs;
      return;
    }
    if (secs > 0 && m.createdAt) expiresAt.set(m.id, new Date(m.createdAt).getTime() + secs * 1000);
  });
  return { currentSecs: secs, expiresAt };
}
