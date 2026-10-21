// Read state without touching other people's messages.
// RLS lets a user write only their own rows, so receipts live in the `notifications` table instead:
//   cursor  { action:'__cursor', sender=me, recipient=me, link_id:roomId, preview:<ISO of newest message I have read> }
//           one row per room, updated in place.
//   receipt { action:'__read',   sender=me, recipient=<author>, link_id:roomId, preview:<ISO of newest message I have read> }
//           new row per catch-up; the author reads them to show "Seen by" / blue ticks.
// The notification list only shows actions containing "mention"/"react", so these rows never appear there.

//   mute    { action:'__mute',   sender=me, recipient=me, link_id:roomId, preview:'forever' | <ISO until> }
//           one row per muted room; deleted to unmute.

export const CURSOR_ACTION = '__cursor';
export const RECEIPT_ACTION = '__read';
export const MUTE_ACTION = '__mute';

export const tsOf = (iso) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

// rows: notifications rows with action in (__cursor, __read) that involve me
// -> { cursors: { [roomId]: { id, upTo, ids } }, receipts: { [roomId]: { [userId]: [{ upTo, at }] } }, mutes: { [roomId]: { id, until, ids } } }
export function parseReadState(rows, myId) {
  const cursors = {};
  const receipts = {};
  const mutes = {};
  (rows || []).forEach(r => {
    if (!r.link_id || !r.preview) return;
    // `ids` lists every row of the same kind for the room. Duplicates can appear (e.g. two tabs creating the first row at
    // once), so writers update/delete all of them; otherwise a stale duplicate would win after a reload.
    if (r.action === MUTE_ACTION && r.sender_id === myId) {
      const cur = mutes[r.link_id];
      const ids = [...(cur?.ids || []), r.id];
      const keep = !cur || (cur.until !== 'forever' && (r.preview === 'forever' || tsOf(r.preview) > tsOf(cur.until)));
      mutes[r.link_id] = keep ? { id: r.id, until: r.preview, ids } : { ...cur, ids };
    } else if (r.action === CURSOR_ACTION && r.sender_id === myId) {
      const cur = cursors[r.link_id];
      const ids = [...(cur?.ids || []), r.id];
      cursors[r.link_id] = !cur || tsOf(r.preview) > tsOf(cur.upTo)
        ? { id: r.id, upTo: r.preview, ids }
        : { ...cur, ids };
    } else if (r.action === RECEIPT_ACTION && r.recipient_id === myId && r.sender_id !== myId) {
      const byUser = (receipts[r.link_id] = receipts[r.link_id] || {});
      (byUser[r.sender_id] = byUser[r.sender_id] || []).push({ upTo: r.preview, at: r.created_at });
    }
  });
  Object.values(receipts).forEach(byUser => Object.values(byUser).forEach(list => list.sort((a, b) => tsOf(a.at) - tsOf(b.at))));
  return { cursors, receipts, mutes };
}

// entry = { until: 'forever' | ISO string } or undefined
export const isMuteActive = (entry, now = Date.now()) => !!entry && (entry.until === 'forever' || tsOf(entry.until) > now);

export function addReceipt(receipts, row) {
  if (!row?.link_id || !row.preview || row.action !== RECEIPT_ACTION) return receipts;
  const roomMap = receipts[row.link_id] || {};
  const list = [...(roomMap[row.sender_id] || []), { upTo: row.preview, at: row.created_at }];
  list.sort((a, b) => tsOf(a.at) - tsOf(b.at));
  return { ...receipts, [row.link_id]: { ...roomMap, [row.sender_id]: list } };
}

// Receipts stored on the message itself (legacy read_by_users) plus cursor-based receipts from the notifications table.
// -> [{ user_id, read_at }]
export function receiptsForMessage(message, roomReceipts) {
  const out = [];
  const seen = new Set();
  (message.readByUsers || []).forEach(item => {
    let parsed = item;
    if (typeof item === 'string') {
      try { parsed = JSON.parse(item); } catch { parsed = null; }
    }
    if (parsed?.user_id && !seen.has(parsed.user_id)) {
      seen.add(parsed.user_id);
      out.push({ user_id: parsed.user_id, read_at: parsed.read_at });
    }
  });
  const created = tsOf(message.createdAt);
  Object.entries(roomReceipts || {}).forEach(([userId, list]) => {
    if (seen.has(userId)) return;
    const hit = list.find(e => tsOf(e.upTo) >= created);
    if (hit) {
      seen.add(userId);
      out.push({ user_id: userId, read_at: hit.at });
    }
  });
  return out;
}
