package dev.thehub.backend.widgets.countdown;

/**
 * DTO returned by the Countdown API.
 *
 * @param nowIso
 *            current server time in ISO-8601 format
 * @param nextIso
 *            next target time in ISO-8601 format, or null if not applicable
 * @param previousIso
 *            previous target time in ISO-8601 format, or null if not applicable
 * @param ongoing
 *            true if now is within the interval [previousIso..nextIso], meaning
 *            a window is currently ongoing
 */
public record CountdownDto(String nowIso, String nextIso, String previousIso, boolean ongoing) {
}
