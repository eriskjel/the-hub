package dev.thehub.backend.widgets.cinemateket.dto;

/**
 * Data transfer object representing a single film showing at Cinemateket.
 *
 * @param title
 *            film title
 * @param director
 *            director name (nullable)
 * @param year
 *            release year (nullable)
 * @param showTime
 *            ISO datetime of the showing
 * @param ticketUrl
 *            optional URL to purchase tickets
 * @param filmUrl
 *            optional URL to film details page
 * @param organizer
 *            optional organizer/film club name (e.g., "Psykolosjen filmklubb")
 */
public record FilmShowingDto(String title, String director, Integer year, String showTime, String ticketUrl,
        String filmUrl, String organizer) {
}
