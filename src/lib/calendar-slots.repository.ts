// src/lib/calendar-slots.repository.ts
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public calendar slot row type from the generated Supabase typings.
 */
type CalendarSlotRow = Database["public"]["Tables"]["calendar_slots"]["Row"];

/**
 * Returns a list of publicly available calendar slots.
 *
 * The query selects only the fields required for the public UI:
 *   - id
 *   - slot_date
 *   - start_time
 *   - end_time
 *
 * Filters applied:
 *   - published = true
 *   - status = "open"
 *   - deleted_at IS NULL (handled implicitly by the RLS policy)
 *
 * Results are ordered by slot_date ascending, then start_time ascending.
 */
export async function listPublicCalendarSlots(): Promise<
  Array<Pick<CalendarSlotRow, "id" | "slot_date" | "start_time" | "end_time">>
> {
  const { data, error } = await supabase
    .from("calendar_slots")
    .select("id,slot_date,start_time,end_time")
    .eq("published", true)
    .eq("status", "open")
    .is("deleted_at", null)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Failed to load public calendar slots:", error);
    return [];
  }

  // The shape returned by Supabase matches the Pick<> we declared.
  return data as Array<Pick<CalendarSlotRow, "id" | "slot_date" | "start_time" | "end_time">>;
}
