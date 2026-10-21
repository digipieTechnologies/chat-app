// Polls are stored as ordinary text messages whose body is JSON:
//   {"__poll":1,"q":"Question","opts":["A","B"],"multi":false}
// Votes live in the message's existing reaction_by_users column as { user_id, reaction: "poll:<optionIndex>" }.
// No schema changes are needed, and old clients just see the JSON as text.

import { disappearingPreview } from './disappearing';

export const POLL_VOTE_PREFIX = 'poll:';
export const POLL_MAX_OPTIONS = 6;
export const POLL_MIN_OPTIONS = 2;

export function parsePoll(text) {
  if (typeof text !== 'string' || !text.startsWith('{"__poll"')) return null;
  try {
    const data = JSON.parse(text);
    if (!data || data.__poll !== 1 || typeof data.q !== 'string' || !Array.isArray(data.opts) || data.opts.length < 2) return null;
    return { question: data.q, options: data.opts.map(String), multi: !!data.multi };
  } catch {
    return null;
  }
}

export function buildPollMessage({ question, options, multi }) {
  return JSON.stringify({ __poll: 1, q: question.trim(), opts: options.map(o => o.trim()), multi: !!multi });
}

// Text shown wherever a message is previewed (chat list, replies, pinned banner).
// Also covers the disappearing-messages system message, which is JSON too.
export function pollPreview(text) {
  const poll = parsePoll(text);
  return poll ? `📊 ${poll.question}` : disappearingPreview(text);
}

export function isPollVote(reaction) {
  const parsed = typeof reaction === 'string' ? safeParse(reaction) : reaction;
  return typeof parsed?.reaction === 'string' && parsed.reaction.startsWith(POLL_VOTE_PREFIX);
}

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

// -> { counts: number[], total: number (distinct voters), mine: Set<number>, voters: Record<number, string[]> (user ids) }
export function tallyPoll(poll, reactions, myUserId) {
  const counts = poll.options.map(() => 0);
  const voters = {};
  const mine = new Set();
  const everyone = new Set();
  (reactions || []).forEach(r => {
    const parsed = typeof r === 'string' ? safeParse(r) : r;
    if (!parsed || typeof parsed.reaction !== 'string' || !parsed.reaction.startsWith(POLL_VOTE_PREFIX)) return;
    const idx = Number(parsed.reaction.slice(POLL_VOTE_PREFIX.length));
    if (!Number.isInteger(idx) || idx < 0 || idx >= counts.length) return;
    counts[idx] += 1;
    (voters[idx] = voters[idx] || []).push(parsed.user_id);
    everyone.add(parsed.user_id);
    if (parsed.user_id === myUserId) mine.add(idx);
  });
  return { counts, total: everyone.size, mine, voters };
}
