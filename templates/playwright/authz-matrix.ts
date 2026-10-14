/**
 * Authorization matrix (see references/core/authz-matrix.md).
 *
 * Crosses every endpoint+method with every OWN test session and returns a
 * matrix plus mismatches. SAFE BY DEFAULT:
 *   - dryRun defaults to true (prints the plan, sends nothing)
 *   - only GET/HEAD/OPTIONS unless writeAllow + payloadFactory (TEST_ marked) are given
 *   - hard request budget, delay between requests
 *   - safety gates of references/load/safety-gates.md (allowlist, deny, LOAD_TARGET)
 *   - sessions come from environment variables only; values are never logged
 *
 * The function NEVER throws. Problems are recorded in `errors` / `gate.reasons`.
 */
import type { APIRequestContext } from '@playwright/test';

export type Method = 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Decision = 'allow' | 'deny';

export type Endpoint = {
  method: Method;
  /** Path such as /api/users/42 . Use ids of YOUR OWN TEST_ records. */
  path: string;
  /** Tenant that owns the resource, when known (enables cross-tenant checks). */
  tenant?: string;
  /** Optional UI visibility map: role -> does that role's UI offer this action? */
  uiVisible?: Record<string, boolean>;
};

export type SessionSpec = {
  /** Name of the environment variable that holds the credential. */
  envVar: string;
  /** Tenant of this own account (for cross-tenant checks). */
  tenant?: string;
  /** Header name, default 'Authorization'. */
  header?: string;
  /** Value prefix, default 'Bearer '. Use '' for cookies/API keys. */
  prefix?: string;
};

export type AuthzOptions = {
  baseUrl: string;
  endpoints: Endpoint[];
  /** role -> env var spec. Values are read from process.env, never logged. */
  sessions: Record<string, SessionSpec>;
  /** Also try each endpoint without credentials (role name 'anon'). */
  includeAnonymous?: boolean;
  /** Expectation map: 'METHOD /path' -> role -> allow|deny. Missing = unknown. */
  expectations?: Record<string, Record<string, Decision>>;
  /** Gate 1: allowed origins (supplied by the user). Required. */
  allow: string[];
  /** Gate 1: deny substrings (supplied by the user). */
  deny?: string[];
  /** Hard cap on requests actually sent. Default 50. */
  maxRequests?: number;
  /** Delay between requests in ms. Default 250. */
  delayMs?: number;
  /** Default true: print the plan, send nothing. */
  dryRun?: boolean;
  /** Write endpoints ('METHOD /path') that may be sent. Default none. */
  writeAllow?: string[];
  /** Builds the body of an allowed write. Output must contain 'TEST_'. */
  payloadFactory?: (e: Endpoint, role: string) => unknown;
  /** Injection point for tests; default uses Playwright's request context. */
  send?: SendFn;
  /** Environment object, default process.env. */
  env?: Record<string, string | undefined>;
};

export type SendFn = (r: {
  method: Method;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}) => Promise<{ status: number }>;

export type Observed = 'allow' | 'deny' | 'other' | 'skipped' | 'error';

export type Cell = {
  key: string; // 'METHOD /path'
  role: string;
  status: number | null;
  observed: Observed;
  expected: Decision | 'unknown';
  note?: string;
};

export type Mismatch = {
  kind:
    | 'EXPECTATION_MISMATCH'
    | 'ROLE_DIFFERENCE'
    | 'UI_HIDES_API_ALLOWS'
    | 'CROSS_TENANT_ALLOW';
  key: string;
  roles: string[];
  detail: string;
};

export type AuthzResult = {
  gate: { ok: boolean; reasons: string[] };
  dryRun: boolean;
  plan: string[];
  cells: Cell[];
  matrix: string;
  mismatches: Mismatch[];
  notTestable: string[];
  requestsSent: number;
  errors: string[];
};

const SAFE: Method[] = ['GET', 'HEAD', 'OPTIONS'];
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Build endpoints from an OpenAPI/Swagger object. Unresolved {params} are skipped by the caller via pathParams. */
export function endpointsFromOpenApi(
  spec: unknown,
  pathParams: Record<string, string> = {},
): { endpoints: Endpoint[]; unresolved: string[] } {
  const endpoints: Endpoint[] = [];
  const unresolved: string[] = [];
  try {
    const paths = ((spec as { paths?: Record<string, Record<string, unknown>> })?.paths ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    for (const p of Object.keys(paths)) {
      let missing = false;
      const resolved = p.replace(/\{([^}]+)\}/g, (_m, name: string) => {
        if (name in pathParams) return pathParams[name];
        missing = true;
        return `{${name}}`;
      });
      for (const m of Object.keys(paths[p] ?? {})) {
        const up = m.toUpperCase() as Method;
        if (!['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(up)) continue;
        if (missing) unresolved.push(`${up} ${p}`);
        else endpoints.push({ method: up, path: resolved });
      }
    }
  } catch {
    /* never throw */
  }
  return { endpoints, unresolved };
}

const classify = (status: number): Observed =>
  status >= 200 && status < 400 ? 'allow' : status === 401 || status === 403 ? 'deny' : 'other';

const originOf = (u: string): string | null => {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
};

function checkGates(o: AuthzOptions, env: Record<string, string | undefined>): string[] {
  const reasons: string[] = [];
  const origin = originOf(o.baseUrl);
  if (!origin) return ['baseUrl is not a valid URL'];
  if (!o.allow || !o.allow.includes(origin)) reasons.push(`gate 1: origin ${origin} not in allowlist`);
  for (const d of o.deny ?? []) if (d && o.baseUrl.includes(d)) reasons.push(`gate 1: matches deny entry "${d}"`);
  if (env.LOAD_TARGET !== origin) reasons.push('gate 2: LOAD_TARGET does not equal the target origin');
  if (!(o.maxRequests === undefined || o.maxRequests > 0)) reasons.push('gate 4: maxRequests must be > 0');
  if (Object.keys(o.sessions).length < 2) reasons.push('two-user rule: need at least two own test sessions');
  return reasons;
}

async function defaultSender(errors: string[]): Promise<{ send: SendFn; close: () => Promise<void> } | null> {
  try {
    const pw = await import('@playwright/test');
    const ctx: APIRequestContext = await pw.request.newContext();
    return {
      send: async (r) => {
        const res = await ctx.fetch(r.url, {
          method: r.method,
          headers: r.headers,
          data: r.body as never,
          maxRedirects: 0,
          failOnStatusCode: false,
          timeout: 15000,
        });
        return { status: res.status() };
      },
      close: () => ctx.dispose(),
    };
  } catch (e) {
    errors.push(`sender: ${msg(e)}`);
    return null;
  }
}

function renderMatrix(cells: Cell[], roles: string[]): string {
  const keys = Array.from(new Set(cells.map((c) => c.key)));
  const w = Math.max(8, ...keys.map((k) => k.length));
  const col = (s: string): string => s.padEnd(26);
  const lines = [`${'endpoint'.padEnd(w)} | ${roles.map(col).join('')}`];
  lines.push('-'.repeat(w + 3 + roles.length * 26));
  for (const k of keys) {
    const row = roles.map((r) => {
      const c = cells.find((x) => x.key === k && x.role === r);
      if (!c) return col('-');
      return col(`${c.observed}${c.status !== null ? ' ' + c.status : ''}${c.expected !== 'unknown' ? ' (exp ' + c.expected + ')' : ''}`);
    });
    lines.push(`${k.padEnd(w)} | ${row.join('')}`);
  }
  return lines.join('\n');
}

export async function runAuthzMatrix(o: AuthzOptions): Promise<AuthzResult> {
  const errors: string[] = [];
  const result: AuthzResult = {
    gate: { ok: false, reasons: [] },
    dryRun: o.dryRun ?? true,
    plan: [],
    cells: [],
    matrix: '',
    mismatches: [],
    notTestable: [],
    requestsSent: 0,
    errors,
  };
  try {
    const env = o.env ?? (process.env as Record<string, string | undefined>);
    const budget = o.maxRequests ?? 50;
    const delay = o.delayMs ?? 250;
    const reasons = checkGates(o, env);
    result.gate = { ok: reasons.length === 0, reasons };
    if (reasons.length) return result;

    // Resolve sessions from env only. Names are reported, values never.
    const creds: Record<string, { headers: Record<string, string>; tenant?: string }> = {};
    for (const [role, s] of Object.entries(o.sessions)) {
      const v = env[s.envVar];
      if (!v) {
        errors.push(`session ${role}: env var ${s.envVar} is not set (skipped)`);
        continue;
      }
      creds[role] = { headers: { [s.header ?? 'Authorization']: `${s.prefix ?? 'Bearer '}${v}` }, tenant: s.tenant };
    }
    if (o.includeAnonymous) creds['anon'] = { headers: {} };
    const roles = Object.keys(creds);
    if (Object.keys(creds).filter((r) => r !== 'anon').length < 2) {
      errors.push('fewer than two usable own sessions; two-user rule not met');
      result.gate = { ok: false, reasons: ['two-user rule: fewer than two usable sessions'] };
      return result;
    }

    const writeAllow = new Set(o.writeAllow ?? []);
    const base = o.baseUrl.replace(/\/+$/, '');
    type Job = { e: Endpoint; role: string; key: string; skip?: string };
    const jobs: Job[] = [];
    for (const e of o.endpoints) {
      const key = `${e.method} ${e.path}`;
      for (const role of roles) {
        let skip: string | undefined;
        if (!SAFE.includes(e.method)) {
          if (!writeAllow.has(key)) skip = 'write method not in writeAllow';
          else if (!o.payloadFactory) skip = 'write requires payloadFactory';
        }
        if (/\{[^}]+\}/.test(e.path)) skip = 'unresolved path parameter';
        jobs.push({ e, role, key, skip });
      }
      const tenants = new Set(Object.values(creds).map((c) => c.tenant).filter((t): t is string => !!t));
      if (e.tenant && tenants.size < 2) result.notTestable.push(`${key}: cross-tenant (needs a second-tenant own account)`);
    }

    let sendable = 0;
    for (const j of jobs) {
      if (!j.skip && sendable >= budget) j.skip = 'budget exhausted';
      if (!j.skip) sendable++;
      result.plan.push(`${j.skip ? 'SKIP' : 'SEND'} ${j.key} as ${j.role}${j.skip ? ' (' + j.skip + ')' : ''}`);
    }

    let sender: { send: SendFn; close: () => Promise<void> } | null = null;
    if (!result.dryRun) {
      sender = o.send ? { send: o.send, close: async () => undefined } : await defaultSender(errors);
      if (!sender) {
        result.gate = { ok: false, reasons: ['no HTTP sender available'] };
        return result;
      }
    }

    let first = true;
    for (const j of jobs) {
      const expected: Decision | 'unknown' = o.expectations?.[j.key]?.[j.role] ?? 'unknown';
      const cell: Cell = { key: j.key, role: j.role, status: null, observed: 'skipped', expected };
      if (j.skip) cell.note = j.skip;
      else if (result.dryRun) cell.note = 'dry-run';
      else if (sender) {
        let body: unknown;
        let bodyOk = true;
        if (!SAFE.includes(j.e.method) && o.payloadFactory) {
          try {
            body = o.payloadFactory(j.e, j.role);
            if (!JSON.stringify(body ?? '').includes('TEST_')) {
              bodyOk = false;
              cell.note = 'payload lacks TEST_ marker; not sent';
            }
          } catch (e) {
            bodyOk = false;
            cell.note = `payloadFactory: ${msg(e)}`;
          }
        }
        if (bodyOk) {
          if (!first) await sleep(delay);
          first = false;
          try {
            const r = await sender.send({
              method: j.e.method,
              url: `${base}${j.e.path}`,
              headers: { ...creds[j.role].headers },
              body,
            });
            result.requestsSent++;
            cell.status = r.status;
            cell.observed = classify(r.status);
          } catch (e) {
            cell.observed = 'error';
            cell.note = msg(e);
          }
        }
      }
      result.cells.push(cell);
    }
    if (sender) await sender.close().catch(() => undefined);

    // Mismatches.
    for (const e of o.endpoints) {
      const key = `${e.method} ${e.path}`;
      const row = result.cells.filter((c) => c.key === key && c.observed !== 'skipped' && c.observed !== 'error');
      for (const c of row) {
        if (c.expected !== 'unknown' && (c.observed === 'allow' || c.observed === 'deny') && c.observed !== c.expected) {
          result.mismatches.push({
            kind: 'EXPECTATION_MISMATCH',
            key,
            roles: [c.role],
            detail: `expected ${c.expected}, observed ${c.observed} (${c.status})`,
          });
        }
        if (e.uiVisible && e.uiVisible[c.role] === false && c.observed === 'allow') {
          result.mismatches.push({
            kind: 'UI_HIDES_API_ALLOWS',
            key,
            roles: [c.role],
            detail: `UI hides the action for ${c.role} but the API returned ${c.status}`,
          });
        }
        const t = creds[c.role]?.tenant;
        if (e.tenant && t && t !== e.tenant && c.observed === 'allow') {
          result.mismatches.push({
            kind: 'CROSS_TENANT_ALLOW',
            key,
            roles: [c.role],
            detail: `session tenant ${t} got ${c.status} on a resource of tenant ${e.tenant}`,
          });
        }
      }
      // Unknown expectations: report only differences between roles; never a defect without an oracle.
      const unknownCells = row.filter((c) => c.expected === 'unknown' && (c.observed === 'allow' || c.observed === 'deny'));
      const classes = new Set(unknownCells.map((c) => c.observed));
      if (classes.size > 1) {
        result.mismatches.push({
          kind: 'ROLE_DIFFERENCE',
          key,
          roles: unknownCells.map((c) => `${c.role}=${c.observed}`),
          detail: 'roles differ and no expectation is defined: a lead only, ask what is intended',
        });
      }
    }
    result.matrix = renderMatrix(result.cells, roles);
  } catch (e) {
    errors.push(`runAuthzMatrix: ${msg(e)}`);
  }
  return result;
}
