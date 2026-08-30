// Client-side notification read-state helper.
// Backend /meta/notifications hisoblab bo'lmaydigan o'qilgan holatni
// localStorage'dagi "last read" vaqt belgisi orqali saqlaymiz.

const KEY = 'prosals_notif_last_read_at';

export function getLastReadAt(): number {
  if (typeof window === 'undefined') return 0;
  const v = Number(localStorage.getItem(KEY) || 0);
  return Number.isFinite(v) ? v : 0;
}

/** Barchasini o'qilgan deb belgilash (vaqt belgisini hozirgi vaqtga qo'yadi). */
export function markAllNotificationsRead(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, String(Date.now()));
}

/** Bitta bildirishnomani o'qilgan deb belgilash (shu va qadimgilari). */
export function markNotificationRead(created_at?: string): void {
  if (typeof window === 'undefined') return;
  const ts = created_at ? Date.parse(created_at) : Date.now();
  const last = getLastReadAt();
  if (!Number.isFinite(ts)) return;
  if (ts > last) localStorage.setItem(KEY, String(ts + 1));
}

/** Element o'qilmaganmi? last_read_at bilan server `unread` maydonini birlashtiradi. */
export function isNotificationUnread(n: { unread?: boolean; created_at?: string }): boolean {
  const last = getLastReadAt();
  const ts = n.created_at ? Date.parse(n.created_at) : 0;
  if (Number.isFinite(ts) && ts > 0) return ts > last;
  return Boolean(n.unread);
}
