-- Members read requests but never write them, so only writers need the validator.
-- Separate migration also removes the grant on databases that already applied it.
revoke execute on function public.media_detail_args_valid(jsonb) from authenticated;
