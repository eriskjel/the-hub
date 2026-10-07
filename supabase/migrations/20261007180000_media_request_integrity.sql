-- Keep a shared request when its requester's account is deleted: followers
-- still want it, and fulfilled requests are history. The requester becomes
-- null instead of the whole request (and its followers) being removed.
alter table public.media_request alter column requested_by drop not null;

alter table public.media_request drop constraint if exists media_request_requested_by_fkey;
alter table public.media_request
    add constraint media_request_requested_by_fkey
    foreign key (requested_by) references public.profiles(id) on delete set null;

-- An approved choice must point at an option that exists, and that option
-- can't be deleted while it is chosen. The worker can only insert and delete
-- options, so a chosen option can't change under an approval. Admins clear
-- chosen_rank before re-queueing.
alter table public.media_request drop constraint if exists mr_chosen_option_fk;
alter table public.media_request
    add constraint mr_chosen_option_fk
    foreign key (id, chosen_rank)
    references public.media_request_option (request_id, rank);
