# Media request detail contract

Services report a code and values; the hub owns display text in `requests.detail`
in `no.json` and `en.json`. `lib/media/detail.ts` validates arguments and applies
the display policy. Status badges remain independent of detail messages.

## Wire format

Write `status_detail`, `detail_code` and `detail_args` in the same update:

```json
{
  "status_detail": "Waiting for digital release, 12 Nov",
  "detail_code": "waiting_release",
  "detail_args": { "date": "2026-11-12" }
}
```

- `status_detail` remains the English fallback (maximum 300 characters).
- `detail_code` matches `^[a-z][a-z0-9_]{0,39}$`. The database accepts future codes.
- `detail_args` is a flat object of strings, at most 4096 bytes when rendered as
  JSONB text. Current argument values are at most 300 UTF-16 code units, matching
  the worker's clipping and the hub's validation. Use `{}` for no arguments.
  Readers discard extra keys on known codes, so services can add values without
  replacing a valid translation with its fallback.
- Clear code and arguments together to SQL `NULL`; JSON `null` is not valid.
- Values are plain text, never HTML or translation templates. Labels, release
  names and cut names retain their original spelling.

## Codes

| Code | Required values | Display |
| --- | --- | --- |
| `paused` | none | Member and admin |
| `waiting_release` | `date` | Member and admin |
| `no_releases` | `next` | Member and admin |
| `only_low_quality` | `next` | Member and admin |
| `unwanted` | none | Member and admin |
| `search_failed` | none | Member and admin |
| `in_library` | `release` | Member and admin; raw name only on admin page |
| `suggested` | `label` | Admin |
| `choice_no_listed_remux` | none | Admin |
| `choice_4k_missing` | none | Admin |
| `choice_cuts` | `group`, `cuts` | Admin |
| `choice_ambiguous` | `group` | Admin |
| `choice_sizes` | `group` | Admin |
| `release` | `label` | Member and admin |
| `not_cached` | `label` | Admin |
| `choice_unmatched` | none | Admin |
| `no_longer_wanted` | none | Admin |
| `add_failed` | none | Member and admin |

Members never see details on `proposed` rows, including dry-run library matches.
The audience rules control presentation; the existing member read grants and RLS
remain in effect.

Rows without a code use the old text. Unknown codes fall back for admins and are
hidden from members. Known admin-only codes are hidden from members even if their
arguments are invalid. Invalid arguments for otherwise visible codes use the old
text; they cannot crash the queue. No fallback text means no detail line.

`date` is a valid `YYYY-MM-DD` calendar date, displayed without timezone shifting.
`next` is an ISO timestamp including seconds and `Z` or an explicit offset. Format
it in `Europe/Oslo`, using `nb-NO` for `no` and `en-GB` for `en`. For example,
`2026-10-17T12:00:00Z` becomes `lør. 17. okt.` or `Sat 17 Oct`.
Dates outside the current Oslo year include their year, for example `12. feb. 2027`.
The registry declares which fields are dates, and formatters are reused across rows.

## Transitions and rollout

1. Merge the hub migration and renderer first. Use **Push migrations to dev** for
   the preview environment, and verify production migration completion before the
   worker deployment. If the renderer deploys before the new columns are available,
   it retries the old select and shows existing English text. Permission errors and
   unrelated missing columns still fail normally. The next request attempts the new
   columns again, so translations start working once the schema is ready.
   Apply the follow-up validator-permission migration too; it removes member access
   to the validator on databases that already applied the first migration.
2. Deploy the worker that writes all three fields. Its database CI must use a hub
   revision containing the migration. A new search clears previous details;
   claiming an approval sets `release` and its chosen label, replacing retry errors.
3. Keep dual writing while older hub versions and historical rows need fallback.
   Option reasons and heartbeat text are separate follow-up work.

Approval clears code/arguments and writes the selected label as the fallback.
This works with both worker versions: an old worker can replace it with an error
without leaving a stale `release` code. Requeue, decline, manual completion,
reopening and actual cancellation clear all three fields. Ownership handover
preserves the current detail.

For a worker rollback after structured messages have been written, stop that
worker and clear `detail_code`/`detail_args` on its requests before starting an
older text-only version. Keep `status_detail`. Otherwise old writes could leave
new codes describing an earlier outcome. The additive migration stays installed.

Validate both locales, legacy rows, unknown codes, malformed arguments, literal
markup values, Oslo date boundaries, worker grants, and transition/lease races.
Do not infer codes by parsing historical English sentences.

`supabase/tests/media_requests/check-mutations.sh` verifies that deliberately
removing the quota check or detail clearing fails the behavioral tests. Function
overrides run after all migrations and their idempotency pass; a later definition
cannot repair a mutation before the tests see it. The existing
`TRANSITION_MIGRATION`, `ADMIN_QUEUE_MIGRATION` and `WORKER_ACCESS_MIGRATION`
switches now apply their SQL last. `FUNCTION_OVERRIDES` accepts other function
overrides. Prefer small overrides of current functions over historical schema files.
