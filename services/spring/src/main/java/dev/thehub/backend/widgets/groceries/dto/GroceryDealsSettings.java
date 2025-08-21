package dev.thehub.backend.widgets.groceries.dto;

/**
 * Settings used to query grocery deals.
 *
 * @param query
 *            search term (required by service)
 * @param maxResults
 *            optional maximum number of results
 * @param city
 *            optional city name used for location context
 * @param lat
 *            optional latitude
 * @param lon
 *            optional longitude
 */
public record GroceryDealsSettings(String query, Integer maxResults, String city, Double lat, Double lon) {
}