-- Keep the transition and English-text clearing, but leave a stale structured detail.
do $$
declare original text; broken text;
begin
    original := pg_get_functiondef('public.media_request_admin_update(bigint,text,timestamptz)'::regprocedure);
    broken := replace(original,
        'status_detail = null, detail_code = null, detail_args = null',
        'status_detail = null');
    assert broken <> original, 'detail mutation must run after the final function definition';
    execute broken;
end $$;
