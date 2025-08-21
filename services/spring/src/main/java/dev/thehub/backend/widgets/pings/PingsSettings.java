package dev.thehub.backend.widgets.pings;

import java.util.List;

/**
 * Settings for the server pings widget.
 *
 * @param targets
 *            list of target URLs to probe
 */
public record PingsSettings(List<String> targets) {
}