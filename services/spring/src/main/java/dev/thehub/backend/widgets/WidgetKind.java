package dev.thehub.backend.widgets;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Enumeration of supported widget kinds. The enum is serialized to its string
 * value for JSON.
 */
public enum WidgetKind {
    /** Server pings widget kind (value "server-pings"). */
    SERVER_PINGS("server-pings"),
    /** Raspberry Pi health widget kind (value "pi-health"). */
    PI_HEALTH("pi-health"),
    /** Grocery deals widget kind (value "grocery-deals"). */
    GROCERY_DEALS("grocery-deals"),
    /** Countdown widget kind (value "countdown"). */
    COUNTDOWN("countdown");

    private final String value;

    WidgetKind(String value) {
        this.value = value;
    }

    /** Returns the persisted/JSON value of the kind. */
    @JsonValue
    public String getValue() {
        return value;
    }

    /**
     * Parses a string value into a {@link WidgetKind} or throws an
     * {@link IllegalArgumentException} if unsupported.
     */
    @JsonCreator
    public static WidgetKind from(String value) {
        for (var kind : values())
            if (kind.value.equals(value))
                return kind;
        throw new IllegalArgumentException("unsupported_kind");
    }

    @Override
    public String toString() {
        return value;
    }
}
