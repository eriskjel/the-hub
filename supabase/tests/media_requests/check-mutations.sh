#!/usr/bin/env bash
# Run after the normal suite. Each deliberately broken function must fail its
# behavioral assertion, not fail during setup or be repaired by a later migration.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
output="$(mktemp)"
trap 'rm -f "$output"' EXIT

check_mutation() {
    local variable="$1" file="$2" expected="$3"
    if env "$variable=$here/mutations/$file" bash "$here/run.sh" >"$output" 2>&1; then
        echo "mutation survived: $file" >&2
        exit 1
    fi
    if ! grep -Fq "ERROR:  $expected" "$output"; then
        cat "$output" >&2
        echo "mutation failed for an unexpected reason: $file" >&2
        exit 1
    fi
    echo "== caught $file: $expected"
}

check_mutation TRANSITION_MIGRATION add_ignores_quota.sql 'a request over the quota is refused'
check_mutation ADMIN_QUEUE_MIGRATION admin_keeps_detail.sql 'requeue clears all detail fields'
