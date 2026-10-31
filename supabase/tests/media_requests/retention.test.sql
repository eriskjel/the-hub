\set ON_ERROR_STOP 1
\echo '== admin retention: precedence, timing, approval and request cycles'
begin;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-0000000000a9'),
 ('00000000-0000-0000-0000-0000000000b9'),
 ('00000000-0000-0000-0000-0000000000c9');
insert into public.media_member(user_id, library_account) values
 ('00000000-0000-0000-0000-0000000000a9', 'retention-requester'),
 ('00000000-0000-0000-0000-0000000000b9', 'retention-follower');
set local role service_role;
do $$
declare
 a uuid := '00000000-0000-0000-0000-0000000000a9';
 b uuid := '00000000-0000-0000-0000-0000000000b9';
 admin_id uuid := '00000000-0000-0000-0000-0000000000c9';
 r public.media_request;
 deadline timestamptz;
 changed_at timestamptz;
begin
 -- Fredrik asks to keep it; the admin approves a release and removes it after 30 days.
 assert public.media_request_add(a, 'movie', 990001, null) = 'requested';
 assert public.media_request_add(b, 'movie', 990001, null) = 'followed';
 update public.media_request set status = 'proposed', detail_code = 'needs_choice', detail_args = '{}'
  where tmdb_id = 990001 returning * into r;
 insert into public.media_request_option(request_id, rank, label) values (r.id, 1, 'Release');
 assert public.media_request_approve_with_retention(r.id, 2, r.updated_at, admin_id, 'remove', 30) = 'not_allowed';
 assert (select admin_retention is null from public.media_request where id = r.id), 'a failed approval changes nothing';
 begin
  perform public.media_request_approve_with_retention(r.id, 1, r.updated_at, admin_id, 'remove', 0);
  assert false, 'an invalid duration must fail';
 exception when raise_exception then null;
 end;
 assert (select status = 'proposed' from public.media_request where id = r.id), 'and roll back the approval';
 assert public.media_request_approve_with_retention(r.id, 1, r.updated_at, admin_id, 'remove', 30) = 'approved';
 select * into r from public.media_request where id = r.id;
 assert r.status = 'approved' and r.chosen_rank = 1 and r.status_detail = 'Release' and r.detail_code is null;
 assert r.remove_after_days = 30 and r.remove_at is null and r.requester_remove_after_days is null;
 assert public.media_request_keep(a, r.id) = 'changed', 'the requester cannot undo the admin';

 -- Available: the date waits for the worker to confirm it added the release, and then
 -- runs from the admin's change, which came later than nothing. A +1 doesn't keep it.
 update public.media_request set status = 'available', fulfilled_at = now() where id = r.id returning * into r;
 assert r.remove_at is null and r.retention_deadline is null;
 update public.media_request set removal_eligible = true where id = r.id returning * into r;
 assert r.retention_deadline = r.retention_changed_at + interval '30 days' and r.remove_at = r.retention_deadline;
 deadline := r.retention_deadline;
 update public.media_request set remove_at = remove_at + interval '1 hour' where id = r.id returning * into r;
 assert r.retention_deadline = deadline, 'a retry does not move the date shown';

 -- Keep, then Remove on a title added months ago: a full new countdown.
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'keep') = 'retention_saved';
 select * into r from public.media_request where id = r.id;
 assert r.admin_retention = 'keep' and r.remove_after_days is null and r.remove_at is null;
 update public.media_request set fulfilled_at = now() - interval '90 days' where id = r.id returning * into r;
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'remove', 7) = 'retention_saved';
 select * into r from public.media_request where id = r.id;
 assert r.remove_at = r.retention_changed_at + interval '7 days';
 assert public.media_request_set_retention(r.id, r.updated_at - interval '1 second', admin_id, 'keep') = 'changed';
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'remove', 0) = 'not_allowed';
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'keep', 7) = 'not_allowed';
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'requester') = 'retention_saved';
 select * into r from public.media_request where id = r.id;
 assert r.admin_retention is null and r.remove_after_days is null, 'back to what Fredrik chose';
 update public.media_request set removal_eligible = false where id = r.id returning * into r;
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'remove', 30) = 'not_removable';

 -- Approving with the decision unchanged doesn't start it over.
 assert public.media_request_add(a, 'movie', 990002, null) = 'requested';
 select * into r from public.media_request where tmdb_id = 990002;
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'remove', 30) = 'retention_saved';
 update public.media_request set status = 'proposed' where id = r.id returning * into r;
 insert into public.media_request_option(request_id, rank, label) values (r.id, 1, 'Release');
 changed_at := r.retention_changed_at;
 assert public.media_request_approve_with_retention(r.id, 1, r.updated_at, admin_id, 'remove', 30) = 'approved';
 assert (select retention_changed_at = changed_at from public.media_request where id = r.id);

 -- "Search again" after a removal keeps the decision and Fredrik's own choice.
 update public.media_request set status = 'removed' where id = r.id returning * into r;
 assert public.media_request_admin_update(r.id, 'requeue', r.updated_at) = 'requeued';
 select * into r from public.media_request where id = r.id;
 assert r.admin_retention = 'remove' and r.remove_after_days = 30 and r.requester_remove_after_days is null;
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'requester') = 'retention_saved';
 assert (select remove_after_days is null from public.media_request where id = r.id), 'Fredrik asked to keep it';

 -- Asking again after a removal is a new request, without the old decision.
 update public.media_request set status = 'removed', created_at = now() - interval '1 day' where id = r.id;
 assert public.media_request_set_retention(r.id, (select updated_at from public.media_request where id = r.id),
  admin_id, 'remove', 30) = 'not_allowed', 'a removed title has no decision to change';
 update public.media_request set admin_retention = 'remove', admin_remove_after_days = 30,
  retention_changed_at = clock_timestamp() where id = r.id;
 assert public.media_request_add(a, 'movie', 990002, null) = 'reopened';
 select * into r from public.media_request where id = r.id;
 assert r.admin_retention is null and r.retention_changed_at is null and r.remove_after_days is null;

 -- The inverse: Fredrik wants it gone, the admin keeps it through a hand-over.
 assert public.media_request_add(a, 'movie', 990003, null, null, 30) = 'requested';
 assert public.media_request_add(b, 'movie', 990003, null) = 'followed';
 select * into r from public.media_request where tmdb_id = 990003;
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'keep') = 'retention_saved';
 assert public.media_request_cancel(a, r.id) = 'handed_over';
 select * into r from public.media_request where id = r.id;
 assert r.requested_by = b and r.admin_retention = 'keep' and r.remove_after_days is null;
 update public.media_request set status = 'cancelled', created_at = now() - interval '1 day' where id = r.id;
 assert public.media_request_add(a, 'movie', 990003, null, null, 30) = 'reopened';
 select * into r from public.media_request where id = r.id;
 assert r.admin_retention is null and r.remove_after_days = 30 and r.requester_remove_after_days = 30;

 -- "Mark available" under an admin's decision keeps the requester's own choice.
 assert public.media_request_add(a, 'movie', 990005, null, null, 30) = 'requested';
 select * into r from public.media_request where tmdb_id = 990005;
 assert public.media_request_set_retention(r.id, r.updated_at, admin_id, 'remove', 7) = 'retention_saved';
 select * into r from public.media_request where id = r.id;
 assert public.media_request_admin_update(r.id, 'available', r.updated_at) = 'available';
 select * into r from public.media_request where id = r.id;
 assert r.remove_after_days = 7 and r.requester_remove_after_days = 30;
end $$;
reset role;
do $$
begin
 assert has_column_privilege('media_worker', 'public.media_request', 'removal_eligible', 'UPDATE');
 assert not has_column_privilege('media_worker', 'public.media_request', 'admin_retention', 'UPDATE');
 assert not has_column_privilege('media_worker', 'public.media_request', 'retention_deadline', 'UPDATE');
 assert not has_function_privilege('media_worker',
  'public.media_request_set_retention(bigint,timestamptz,uuid,text,int)', 'EXECUTE');
 assert not has_function_privilege('authenticated',
  'public.media_request_set_retention(bigint,timestamptz,uuid,text,int)', 'EXECUTE');
 assert not has_function_privilege('authenticated',
  'public.media_request_approve_with_retention(bigint,int,timestamptz,uuid,text,int)', 'EXECUTE');
end $$;

-- Publishing eligibility alone isn't a change, so the admin page keeps its order.
-- The removal date it brings for an admin's Remove is one.
do $$
declare r public.media_request;
begin
 assert public.media_request_add('00000000-0000-0000-0000-0000000000a9', 'movie', 990006, null) = 'requested';
 select * into r from public.media_request where tmdb_id = 990006;
 assert public.media_request_set_retention(r.id, r.updated_at, '00000000-0000-0000-0000-0000000000c9',
  'remove', 30) = 'retention_saved';
 update public.media_request set status = 'available', fulfilled_at = now() where id = r.id;
end $$;
alter table public.media_request disable trigger mr_touch_updated_at;
update public.media_request set updated_at = now() - interval '1 hour' where tmdb_id = 990006;
alter table public.media_request enable trigger mr_touch_updated_at;
update public.media_request set removal_eligible = false where tmdb_id = 990006;
do $$
begin
 assert (select updated_at < now() from public.media_request where tmdb_id = 990006);
end $$;
update public.media_request set removal_eligible = true where tmdb_id = 990006;
do $$
begin
 assert (select updated_at = now() and retention_deadline is not null
           from public.media_request where tmdb_id = 990006);
end $$;
rollback;
