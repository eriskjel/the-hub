\set ON_ERROR_STOP 1
\echo '== lifecycle: handover protection and fresh request cycles'
begin;
insert into auth.users (id) values
 ('00000000-0000-0000-0000-0000000000a7'),
 ('00000000-0000-0000-0000-0000000000b7');
insert into public.media_member (user_id, library_account) values
 ('00000000-0000-0000-0000-0000000000a7', 'lifecycle-alice'),
 ('00000000-0000-0000-0000-0000000000b7', 'lifecycle-bob');
set local role service_role;
do $$
declare
 alice constant uuid := '00000000-0000-0000-0000-0000000000a7';
 bob constant uuid := '00000000-0000-0000-0000-0000000000b7';
 r public.media_request;
begin
 perform public.media_request_add(alice, 'movie', 970001, null, 'Old cut', 30);
 perform public.media_request_add(bob, 'movie', 970001, null, 'My cut');
 select * into r from public.media_request where tmdb_id = 970001;
 assert public.media_request_cancel(alice, r.id) = 'handed_over';
 select * into r from public.media_request where id = r.id;
 assert r.requested_by = bob and r.remove_after_days is null and r.remove_at is null;
 assert r.generation = 1;
 assert (select count(*) from public.media_request_follower where request_id = r.id) = 0;
 assert (select note from public.media_request_note where request_id = r.id) = 'My cut';

 -- Ordinary retries retain the note and cycle.
 assert public.media_request_admin_update(r.id, 'requeue', r.updated_at) = 'requeued';
 assert (select generation from public.media_request where id = r.id) = 1;
 assert (select note from public.media_request_note where request_id = r.id) = 'My cut';

 update public.media_request set status = 'removed' where id = r.id;
 assert public.media_request_add(alice, 'movie', 970001, null) = 'reopened';
 assert (select generation from public.media_request where id = r.id) = 2;
 assert not exists (select 1 from public.media_request_note where request_id = r.id);

 update public.media_request set status = 'removed' where id = r.id;
 assert public.media_request_add(bob, 'movie', 970001, null, 'New cycle note') = 'reopened';
 assert (select note from public.media_request_note where request_id = r.id) = 'New cycle note';
 assert (select generation from public.media_request where id = r.id) = 3;

 -- Admin reopening must also invalidate the previous cycle's worker receipts.
 update public.media_request set status = 'removed' where id = r.id returning * into r;
 assert public.media_request_admin_update(r.id, 'requeue', r.updated_at) = 'requeued';
 assert (select generation from public.media_request where id = r.id) = 4;
 assert (select note from public.media_request_note where request_id = r.id) = 'New cycle note',
     'admin Search again retains the requester instruction';
 -- A revoked follower may remain attached when the requester cancels.
 -- Reopening changes the requester cycle without discarding that follower's note.
 perform public.media_request_add(alice, 'movie', 970002, null, 'Previous instruction', 30);
 perform public.media_request_add(bob, 'movie', 970002, null, 'Follower instruction');
 select * into r from public.media_request where tmdb_id = 970002;
 update public.media_member set revoked_at = now() where user_id = bob;
 assert public.media_request_cancel(alice, r.id) = 'cancelled';
 assert public.media_request_add(alice, 'movie', 970002, null) = 'reopened';
 assert (select generation from public.media_request where id = r.id) = 2;
 assert (select note from public.media_request_note where request_id = r.id and user_id = bob) = 'Follower instruction';
 assert exists (select 1 from public.media_request_follower where request_id = r.id and user_id = bob);
 assert not exists (select 1 from public.media_request_note where request_id = r.id and user_id = alice);
end $$;
rollback;
