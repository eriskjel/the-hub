/**
 * A small in-memory stand-in for a supabase-js client, for tests that care
 * about the resulting rows rather than the exact query chain. It supports the
 * builder subset the app uses: select (with `count`/`head` and simple
 * one-level embeds), insert, update, upsert (`onConflict`, `ignoreDuplicates`),
 * delete, the filters eq/neq/in/is/gte/not-is, order, limit, maybeSingle and
 * single, plus `rpc` with test-supplied stand-ins. There is no RLS: give each
 * test the rows its caller could see.
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;
type DbError = { code?: string; message: string };
type Result = { data: unknown; error: DbError | null; count?: number | null };

export type FakeDbOptions = {
    /** Unique keys per table (each a list of columns), checked on insert and update. */
    unique?: Record<string, string[][]>;
    /** Tables with a generated `id` (like `generated always as identity`). */
    identity?: string[];
    /** Embeddable child tables: `child(cols)` in a select attaches rows whose `foreignKey` equals the parent's id. */
    embeds?: Record<string, { foreignKey: string }>;
    /** Column defaults applied on insert, per table. Functions are called per row. */
    defaults?: Record<string, Record<string, unknown | (() => unknown)>>;
    /** Stand-ins for database functions called with `rpc`; they get the args and the tables. */
    rpc?: Record<string, (args: Record<string, unknown>, tables: Tables) => unknown>;
};

export type FakeDb = {
    tables: Tables;
    /** Make the next matching operation fail with this error. */
    failNext: (table: string, op: Op, error?: DbError) => void;
    /** Run `fn` right before the next matching operation, e.g. to simulate a concurrent write. */
    beforeNext: (table: string, op: Op, fn: () => void) => void;
    from: (table: string) => Query;
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<Result>;
};

type Op = "select" | "insert" | "update" | "upsert" | "delete" | "rpc";

export function fakeDb(tables: Tables, options: FakeDbOptions = {}): FakeDb {
    const failures: { table: string; op: Op; error: DbError }[] = [];
    const hooks: { table: string; op: Op; fn: () => void }[] = [];
    const nextId: Record<string, number> = {};

    const db: FakeDb = {
        tables,
        failNext: (table, op, error = { message: `${op} on ${table} failed` }) =>
            failures.push({ table, op, error }),
        beforeNext: (table, op, fn) => hooks.push({ table, op, fn }),
        from: (table) => new Query(table, run),
        rpc: async (fn, args = {}) => {
            const hook = hooks.findIndex((h) => h.table === fn && h.op === "rpc");
            if (hook >= 0) hooks.splice(hook, 1)[0].fn();
            const failure = failures.findIndex((f) => f.table === fn && f.op === "rpc");
            if (failure >= 0) return { data: null, error: failures.splice(failure, 1)[0].error };
            const handler = options.rpc?.[fn];
            if (!handler) return { data: null, error: { message: `fakeDb: no rpc ${fn}` } };
            return { data: handler(args, tables), error: null };
        },
    };

    function run(q: Query): Result {
        const hook = hooks.findIndex((h) => h.table === q.table && h.op === q.op);
        if (hook >= 0) hooks.splice(hook, 1)[0].fn();
        const failure = failures.findIndex((f) => f.table === q.table && f.op === q.op);
        if (failure >= 0) return { data: null, error: failures.splice(failure, 1)[0].error };

        const rows = (tables[q.table] ??= []);
        const matches = rows.filter((r) => q.filters.every((f) => f(r)));

        switch (q.op) {
            case "select": {
                let out = sortRows(matches, q.orders);
                if (q.limitN !== null) out = out.slice(0, q.limitN);
                const data = q.head ? null : out.map((r) => withEmbeds(r, q.columns));
                return { data, error: null, count: q.count ? matches.length : null };
            }
            case "insert":
            case "upsert": {
                const created: Row[] = [];
                for (const input of q.payloads) {
                    const row = withDefaults(q.table, input);
                    const conflict = findConflict(q.table, row, rows);
                    if (conflict) {
                        if (q.op === "upsert" && q.ignoreDuplicates) continue;
                        if (q.op === "upsert") {
                            Object.assign(conflict, input);
                            created.push(conflict);
                            continue;
                        }
                        return uniqueViolation(q.table);
                    }
                    rows.push(row);
                    created.push(row);
                }
                return { data: q.returning ? created.map((r) => ({ ...r })) : null, error: null };
            }
            case "update": {
                for (const row of matches) {
                    const updated = { ...row, ...q.payloads[0] };
                    if (findConflict(q.table, updated, rows, row)) return uniqueViolation(q.table);
                }
                for (const row of matches) Object.assign(row, q.payloads[0]);
                return { data: q.returning ? matches.map((r) => ({ ...r })) : null, error: null };
            }
            case "delete": {
                tables[q.table] = rows.filter((r) => !matches.includes(r));
                return { data: q.returning ? matches.map((r) => ({ ...r })) : null, error: null };
            }
            case "rpc":
                throw new Error("fakeDb: functions are called with db.rpc, not from()");
        }
    }

    function withDefaults(table: string, input: Row): Row {
        const row: Row = {};
        for (const [k, v] of Object.entries(options.defaults?.[table] ?? {})) {
            row[k] = typeof v === "function" ? (v as () => unknown)() : v;
        }
        if (options.identity?.includes(table)) {
            const max = Math.max(0, ...(tables[table] ?? []).map((r) => Number(r.id) || 0));
            nextId[table] = Math.max(nextId[table] ?? 0, max) + 1;
            row.id = nextId[table];
        }
        return { ...row, ...input };
    }

    function findConflict(table: string, row: Row, rows: Row[], self?: Row): Row | undefined {
        for (const key of options.unique?.[table] ?? []) {
            const hit = rows.find((r) => r !== self && key.every((c) => r[c] === row[c]));
            if (hit) return hit;
        }
        return undefined;
    }

    function withEmbeds(row: Row, columns: string): Row {
        const out = { ...row };
        for (const [child, { foreignKey }] of Object.entries(options.embeds ?? {})) {
            if (columns.includes(`${child}(`)) {
                out[child] = (tables[child] ?? [])
                    .filter((c) => c[foreignKey] === row.id)
                    .map((c) => ({ ...c }));
            }
        }
        return out;
    }

    return db;
}

function uniqueViolation(table: string): Result {
    return {
        data: null,
        error: {
            code: "23505",
            message: `duplicate key value violates unique constraint on ${table}`,
        },
    };
}

function sortRows(rows: Row[], orders: { column: string; ascending: boolean }[]): Row[] {
    return [...rows].sort((a, b) => {
        for (const { column, ascending } of orders) {
            const x = a[column] as string | number;
            const y = b[column] as string | number;
            if (x === y) continue;
            return (x < y ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
    });
}

class Query implements PromiseLike<Result> {
    op: Op = "select";
    filters: ((r: Row) => boolean)[] = [];
    orders: { column: string; ascending: boolean }[] = [];
    limitN: number | null = null;
    payloads: Row[] = [];
    columns = "*";
    returning = false;
    count = false;
    head = false;
    ignoreDuplicates = false;

    constructor(
        readonly table: string,
        private readonly run: (q: Query) => Result
    ) {}

    select(columns = "*", opts?: { count?: string; head?: boolean }) {
        if (this.op === "select") {
            this.count = !!opts?.count;
            this.head = !!opts?.head;
        } else {
            this.returning = true;
        }
        this.columns = columns;
        return this;
    }
    insert(payload: Row | Row[]) {
        this.op = "insert";
        this.payloads = Array.isArray(payload) ? payload : [payload];
        return this;
    }
    upsert(payload: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        this.op = "upsert";
        this.payloads = Array.isArray(payload) ? payload : [payload];
        this.ignoreDuplicates = !!opts?.ignoreDuplicates;
        return this;
    }
    update(payload: Row) {
        this.op = "update";
        this.payloads = [payload];
        return this;
    }
    delete() {
        this.op = "delete";
        return this;
    }
    eq(column: string, value: unknown) {
        this.filters.push((r) => r[column] === value);
        return this;
    }
    neq(column: string, value: unknown) {
        this.filters.push((r) => r[column] !== value);
        return this;
    }
    in(column: string, values: readonly unknown[]) {
        this.filters.push((r) => values.includes(r[column]));
        return this;
    }
    is(column: string, value: null) {
        this.filters.push((r) => (r[column] ?? null) === value);
        return this;
    }
    not(column: string, operator: "is", value: null) {
        if (operator !== "is") throw new Error(`fakeDb: not.${operator} is not supported`);
        this.filters.push((r) => (r[column] ?? null) !== value);
        return this;
    }
    gte(column: string, value: string | number) {
        this.filters.push((r) => (r[column] as string | number) >= value);
        return this;
    }
    order(column: string, opts?: { ascending?: boolean }) {
        this.orders.push({ column, ascending: opts?.ascending ?? true });
        return this;
    }
    limit(n: number) {
        this.limitN = n;
        return this;
    }
    async maybeSingle(): Promise<Result> {
        const result = this.run(this);
        if (result.error || !Array.isArray(result.data)) return result;
        if (result.data.length > 1) {
            return { data: null, error: { message: "fakeDb: more than one row for maybeSingle" } };
        }
        return { data: result.data[0] ?? null, error: null };
    }
    async single(): Promise<Result> {
        const result = await this.maybeSingle();
        if (!result.error && result.data === null) {
            return {
                data: null,
                error: { code: "PGRST116", message: "fakeDb: no rows for single" },
            };
        }
        return result;
    }
    then<A = Result, B = never>(
        onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
        onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null
    ): PromiseLike<A | B> {
        return Promise.resolve()
            .then(() => this.run(this))
            .then(onFulfilled, onRejected);
    }
}
