#!/usr/bin/env bash
set -euo pipefail

if [[ "${DETECT_RESULT:-}" != success ]]; then
  echo "Backend change detection did not succeed." >&2
  exit 1
fi

case "${EVENT_NAME:-}" in
  workflow_dispatch) build=true ;;
  push|pull_request)
    case "${CHANGED:-}" in
      true|false) build="$CHANGED" ;;
      *) echo "Backend change detection returned no valid decision." >&2; exit 1 ;;
    esac
    ;;
  *) echo "Unexpected workflow event." >&2; exit 1 ;;
esac

if [[ "$build" == true && "${VERIFY_RESULT:-}" != success ]]; then
  echo "Backend verification did not succeed." >&2
  exit 1
fi
if [[ "$build" == false && "${VERIFY_RESULT:-}" != skipped ]]; then
  echo "Unexpected verification result for an unchanged backend." >&2
  exit 1
fi

echo "build=$build"
