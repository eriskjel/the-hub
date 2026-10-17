-- Mutate the final definition, including the detail-column, note and removal migrations.
do $$
declare original text; broken text;
begin
    original := pg_get_functiondef('public.media_request_add(uuid,text,integer,integer,text,integer)'::regprocedure);
    assert position('remove_after_days' in original) > 0, 'mutation must run after the removal migration';
    broken := replace(original,
        'if v_used >= p_weekly_quota then return ''quota_exceeded''; end if;',
        'null; -- deliberately skip the quota check');
    assert broken <> original, 'quota mutation must change the function';
    execute broken;
end $$;
