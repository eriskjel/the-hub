package dev.thehub.backend.widgets.countdown;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.util.ArrayList;

/**
 * Utility for computing the next monthly occurrence based on a simple rule.
 * <p>
 * Supported settings:
 * <ul>
 * <li>time: "HH:mm" (default 08:00)</li>
 * <li>dayOfMonth: number 1..31 (clamped to the month's last day)</li>
 * <li>byWeekday: "MO","TU","WE","TH","FR","SA","SU" together with bySetPos</li>
 * <li>bySetPos: nth match within month (1..n) or negative for from-end (-1 =
 * last)</li>
 * </ul>
 * Notes: This utility is stateless and thread-safe. All calculations use
 * Europe/Oslo time.
 */
final class Monthly {
    private static final ZoneId ZONE = ZoneId.of("Europe/Oslo");

    /**
     * Calculates the next occurrence described by the settings at or after the
     * given time.
     *
     * @param now
     *            reference instant
     * @param s
     *            JSON settings node
     * @return ISO-8601 offset date-time string or null if no rule matched
     */
    static String nextOccurrenceIso(Instant now, JsonNode s) {
        var zNow = now.atZone(ZONE);

        String time = text(s, "time", "08:00");
        String[] hm = time.split(":");
        int H = Integer.parseInt(hm[0]), M = Integer.parseInt(hm[1]);

        Integer dayOfMonth = intOrNull(s, "dayOfMonth");
        String byWeekday = text(s, "byWeekday", null);
        Integer bySetPos = intOrNull(s, "bySetPos");

        var candidate = candidateInMonth(zNow, H, M, dayOfMonth, byWeekday, bySetPos);
        if (candidate == null || !candidate.isAfter(zNow)) {
            candidate = candidateInMonth(zNow.plusMonths(1), H, M, dayOfMonth, byWeekday, bySetPos);
        }
        return candidate == null ? null : candidate.toOffsetDateTime().toString();
    }

    private static ZonedDateTime candidateInMonth(ZonedDateTime base, int H, int M, Integer dom, String byWeekday,
            Integer bySetPos) {
        int y = base.getYear(), mo = base.getMonthValue();
        if (dom != null) {
            int last = YearMonth.of(y, mo).lengthOfMonth();
            int d = Math.min(Math.max(dom, 1), last);
            return ZonedDateTime.of(y, mo, d, H, M, 0, 0, ZONE);
        }
        if (byWeekday != null && bySetPos != null) {
            var dow = switch (byWeekday) {
                case "MO" -> DayOfWeek.MONDAY;
                case "TU" -> DayOfWeek.TUESDAY;
                case "WE" -> DayOfWeek.WEDNESDAY;
                case "TH" -> DayOfWeek.THURSDAY;
                case "FR" -> DayOfWeek.FRIDAY;
                case "SA" -> DayOfWeek.SATURDAY;
                case "SU" -> DayOfWeek.SUNDAY;
                default -> null;
            };
            if (dow == null)
                return null;
            var dates = new ArrayList<LocalDate>();
            var d = LocalDate.of(y, mo, 1);
            while (d.getMonthValue() == mo) {
                if (d.getDayOfWeek() == dow)
                    dates.add(d);
                d = d.plusDays(1);
            }
            LocalDate picked = (bySetPos > 0)
                    ? (bySetPos <= dates.size() ? dates.get(bySetPos - 1) : null)
                    : (-bySetPos <= dates.size() ? dates.get(dates.size() + bySetPos) : null);
            if (picked == null)
                return null;
            return picked.atTime(H, M).atZone(ZONE);
        }
        return null;
    }

    private static String text(JsonNode n, String k, String def) {
        return (n != null && n.hasNonNull(k)) ? n.get(k).asText() : def;
    }
    private static Integer intOrNull(JsonNode n, String k) {
        return (n != null && n.hasNonNull(k)) ? n.get(k).asInt() : null;
    }
}
