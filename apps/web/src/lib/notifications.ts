// Client-side notification read-state helper.
// Bildirishnomalarning o'qilgan holatini ham unikal ID lar ro'yxati,
// ham oxirgi o'qilgan vaqt (last_read_at) orqali localStorage'da mustahkam saqlaymiz.

const KEY_LAST_READ = 'prosals_notif_last_read_at';
const KEY_READ_IDS = 'prosals_read_notif_ids';

export function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY_READ_IDS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function saveReadId(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = getReadIds();
    set.add(id);
    // Limit to latest 500 ids to keep localStorage compact
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(KEY_READ_IDS, JSON.stringify(arr));
  } catch {}
}

export function getLastReadAt(): number {
  if (typeof window === 'undefined') return 0;
  const v = Number(localStorage.getItem(KEY_LAST_READ) || 0);
  return Number.isFinite(v) ? v : 0;
}

/** Barchasini o'qilgan deb belgilash (barcha ID larni saqlaydi va vaqtni yangilaydi). */
export function markAllNotificationsRead(items?: { id?: string }[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_LAST_READ, String(Date.now()));
  if (Array.isArray(items)) {
    try {
      const set = getReadIds();
      items.forEach((it) => {
        if (it.id) set.add(it.id);
      });
      const arr = Array.from(set).slice(-500);
      localStorage.setItem(KEY_READ_IDS, JSON.stringify(arr));
    } catch {}
  }
}

/** Bitta bildirishnomani o'qilgan deb belgilash. */
export function markNotificationRead(id?: string, created_at?: string): void {
  if (typeof window === 'undefined') return;
  if (id) {
    saveReadId(id);
  }
  if (created_at) {
    const ts = Date.parse(created_at);
    const last = getLastReadAt();
    if (Number.isFinite(ts) && ts > last) {
      localStorage.setItem(KEY_LAST_READ, String(ts + 1000));
    }
  }
}

/** Element o'qilmaganmi? ID, vaqt va server holatini birlashtiradi. */
export function isNotificationUnread(n: { id?: string; unread?: boolean; created_at?: string }): boolean {
  // 1. Agar ID avval o'qilganlar ro'yxatida bo'lsa -> o'qilgan
  if (n.id && getReadIds().has(n.id)) {
    return false;
  }

  // 2. Agar vaqti "barchasini o'qilgan qilish" vaqtidan oldin bo'lsa -> o'qilgan
  const last = getLastReadAt();
  const ts = n.created_at ? Date.parse(n.created_at) : 0;
  if (Number.isFinite(ts) && ts > 0 && last > 0 && ts <= last) {
    return false;
  }

  // 3. Agar server unread=false deb qaytargan bo'lsa (masalan unread_count=0 bo'lgan operator so'rovi) -> o'qilgan
  if (n.unread === false) {
    return false;
  }

  return Boolean(n.unread);
}
