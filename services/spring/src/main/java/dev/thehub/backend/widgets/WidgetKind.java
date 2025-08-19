package dev.thehub.backend.widgets;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum WidgetKind {
    SERVER_PINGS("server-pings"),
    PI_HEALTH("pi-health");

    private final String value;

    WidgetKind(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    @JsonCreator
    public static WidgetKind from(String value) {
        for (var kind : values()) if (kind.value.equals(value)) return kind;
        throw new IllegalArgumentException("unsupported_kind");
    }

    @Override public String toString() { return value; }
}