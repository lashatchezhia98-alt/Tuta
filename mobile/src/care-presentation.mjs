/** @param {{ has_unread?: boolean }[]} threads
 * @param {{ status: string, consultation_slots?: { starts_at: string } | null }[]} bookings
 * @param {{ starts_at: string }[]} slots */
export function careOverview(threads, bookings, slots, now = Date.now()) {
  return {
    unread: threads.filter(thread => thread.has_unread === true).length,
    nextVisit: bookings.filter(booking => booking.status === "confirmed" &&
      Date.parse(booking.consultation_slots?.starts_at ?? "") >= now)
      .sort((a, b) => Date.parse(a.consultation_slots.starts_at) - Date.parse(b.consultation_slots.starts_at))[0] ?? null,
    openSlots: slots.filter(slot => Date.parse(slot.starts_at) >= now)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
  };
}
