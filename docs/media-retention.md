# Admin library retention

An admin decides whether a requested movie stays in the library: **Keep in
library**, **Remove after 1–365 days** (presets 7, 30 and 90; 30 by default), or
**Use requester's choice**. It can be set while approving a release, or later
from the request's menu ("Library retention…"), including once it's available.

## Rules

- The admin's decision beats the requester's choice, the requester's Keep, and
  every +1. Without one, the existing rule applies: any +1 keeps a temporary title.
- It lasts through a hand-over and "Search again". A member who asks again after
  a removal or cancellation starts a new request, which starts without it.
- The removal date is N days after the movie became available, or after the
  admin's change if that came later. Saving Remove again starts a new countdown.
  Keep clears the date. Use requester's choice on a movie that's already
  available also counts from the change, never from the original add.
- Only movies the worker added itself for the request can be removed: not ones
  that were already in the library, packs, or releases other requests use. The
  worker publishes this as `removal_eligible`; until it's true, an available
  movie can't be set to Remove, and an earlier Remove is shown as on hold.
- A removal the worker has started wins over a Keep saved at the same time.

## Storage

`remove_after_days` stays the choice that applies, so readers need no change.
`requester_remove_after_days` keeps the requester's own choice, and
`admin_retention`/`admin_remove_after_days` the admin's. A trigger keeps them in
step whoever writes the row. `retention_deadline` is the date the hub shows; a
retry moves `remove_at`, not the deadline.

`media_request_set_retention` and `media_request_approve_with_retention` are
service-role only. The server action checks the admin and passes their id, and
the displayed `updated_at` stops a stale page.

## Rollout

1. The migration (additive; makes nothing temporary).
2. The worker change, which needs the new columns. Its first run publishes
   `removal_eligible` for what's in the library.
3. The hub. Before the new worker runs, a Remove on an available movie is
   refused and an approval-time Remove waits as "checking".

Notifications to the requester and +1s are not part of this change.
