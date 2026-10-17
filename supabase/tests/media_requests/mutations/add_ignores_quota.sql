-- Mutate the final definition, including the detail-column migration.
do $$
declare original text; broken text;
begin
    original := pg_get_functiondef('public.media_request_add(uuid,text,integer,integer)'::regprocedure);
    assert position('detail_code' in original) > 0, 'mutation must run after the detail migration';
    broken := replace(original,
        'if v_used >= p_weekly_quota then return ''quota_exceeded''; end if;',
        'null; -- deliberately skip the quota check');
    assert broken <> original, 'quota mutation must change the function';
    execute broken;
end $$;
