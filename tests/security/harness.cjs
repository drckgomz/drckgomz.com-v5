/* eslint-disable @typescript-eslint/no-require-imports */
// Load real TS handlers/services with a closed set of in-memory SDK boundaries.
// Unexpected imports/network calls fail the test; provider SDKs are never loaded.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function harness({ actor = null, profile = null, tables = {}, errors = {}, authError = false, allowInsert = false, framework = false, allowDelete = false, allowUpload = false, cmsDisabled = false } = {}) {
  const state = { actor, profile, tables: structuredClone(tables), errors, authError, queries: [], writes: [] };
  if (profile) state.tables.user_profiles = [structuredClone(profile), ...(state.tables.user_profiles || []).filter(row => row.id !== profile.id)];
  const deniedNetwork = () => { throw new Error('Network access forbidden in security tests'); };
  class NextResponse extends Response {
    static json(body, init = {}) {
      return new NextResponse(JSON.stringify(body), {
        ...init, headers: { 'content-type': 'application/json', ...init.headers },
      });
    }
    static next() { return new NextResponse(null); }
  }
  const redirect = (url) => { throw new Error(`REDIRECT:${url}`); };
  const notFound = () => { throw new Error('NOT_FOUND'); };
  const syntheticProfile = () => state.tables.user_profiles?.find(row => row.id === state.actor) || state.profile || (state.actor ? {
    id: state.actor, username: 'synthetic', email: 'person@example.invalid', role: 'user', enabled: true,
    is_banned: false, is_owner: false, is_whitelist_admin: false, can_view_private: false,
  } : null);
  // Synthetic Better Auth + Drizzle contract. Supabase-shaped query adapters
  // below remain only for legacy CMS validator tests; production config never
  // selects them.
  const backendConfig = Object.freeze({ auth: 'better-auth', blogReads: 'drizzle', projectReads: 'drizzle', privateMedia: 'drizzle', cmsMutations: cmsDisabled ? 'disabled' : 'supabase' });
  const testSql = (strings, ...values) => ({ text: strings.reduce((out, part, index) => out + part + (index < values.length ? '?' : ''), ''), values });
  const queryBuilder = (projection) => {
    const query = { projection, table: null, joins: [], filter: null, limitCount: null };
    const builder = {
      from(table) { query.table = table; return builder; },
      innerJoin(table, condition) { query.joins.push({ table, condition }); return builder; },
      where(condition) { query.filter = condition; return builder; },
      limit(count) { query.limitCount = count; return builder; },
      then(resolve, reject) {
        try {
          state.drizzleQueries ||= [];
          state.drizzleQueries.push({ table: query.table?.__name, filter: query.filter });
          const mediaRows = state.tables.media || [];
          const postRows = state.tables.posts || [];
          let rows = query.table?.__name === 'app.media' ? mediaRows.map(item => {
            const post = postRows.find(value => (value.id ?? value.postId) === item.post_id || value.id === item.postId);
            if (!post) return null;
            const status = post.status ?? (post.publicationState === 'published' ? post.visibility : post.publicationState);
            const row = { id: item.id, postId: item.post_id ?? item.postId, url: item.url, publicationState: post.publicationState ?? (status === 'public' || status === 'private' ? 'published' : status), visibility: post.visibility ?? status, deletedAt: post.deleted_at ?? null, deletionDate: post.deletion_date ?? null };
            return { item, post, row };
          }).filter(Boolean) : [];
          if (query.filter?.field === 'media.id') rows = rows.filter(({ item }) => item.id === query.filter.value);
          const result = rows.slice(0, query.limitCount ?? rows.length).map(({ row }) => query.projection ? Object.fromEntries(Object.entries(query.projection).map(([key, field]) => {
            const fieldName = String(field).split('.').at(-1);
            return [key, row[fieldName]];
          })) : row);
          resolve(result);
        } catch (error) { reject(error); }
      },
    };
    return builder;
  };
  const contentSession = {
    withCurrentContentSession: async (read) => read({
      execute: async () => ({ rows: [{ has_restricted: (state.tables.posts || []).some(post => post.status === 'private' || post.visibility && post.visibility !== 'public') }] }),
      select: (projection) => queryBuilder(projection),
    }),
    withContentSession: async (_digest, read) => contentSession.withCurrentContentSession(read),
  };
  const blogRepository = {
    getDrizzleReadablePosts: async (requested, profile) => {
      const active = profile?.enabled === true && profile.is_banned === false;
      const elevated = active && (profile.is_owner === true || ['admin', 'owner', 'content_admin'].includes(String(profile.role || '').toLowerCase()));
      const canPrivate = elevated || (active && profile.can_view_private === true);
      const permitted = requested === 'all' ? (canPrivate ? ['public', 'private'] : ['public']) : requested === 'public' ? ['public'] : requested === 'private' && canPrivate ? ['private'] : [];
      return (state.tables.posts || []).filter(post => permitted.includes(post.status ?? (post.publicationState === 'published' ? post.visibility : post.publicationState)) && !post.deleted_at && !post.deletion_date && post.is_deleted !== true)
        .slice(0, 25).map(post => blogRepository.serialize(post));
    },
    getDrizzleReadablePost: async (slug, profile) => {
      const active = profile?.enabled === true && profile.is_banned === false;
      const elevated = active && (profile.is_owner === true || ['admin', 'owner', 'content_admin'].includes(String(profile.role || '').toLowerCase()));
      const canPrivate = elevated || (active && profile.can_view_private === true);
      const candidates = state.tables.posts || [];
      const post = candidates.find(row => row.slug === slug && !row.deleted_at && !row.deletion_date && row.is_deleted !== true) ||
        candidates.find(row => row.id === slug && !row.deleted_at && !row.deletion_date && row.is_deleted !== true);
      if (!post) return null;
      const status = post.status ?? (post.publicationState === 'published' ? post.visibility : post.publicationState);
      if (status !== 'public' && !(status === 'private' && canPrivate)) return null;
      return blogRepository.serialize(post);
    },
    serialize: (post) => {
      const status = post.status ?? (post.publicationState === 'published' ? post.visibility : post.publicationState);
      const content = require('sanitize-html')(String(post.content || ''), { allowedTags: ['p','br','strong','em','b','i','ul','ol','li','h1','h2','h3','pre','code','blockquote','a','img'], allowedAttributes: { a: ['href','rel','target'], img: ['src','alt'] }, allowedSchemes: ['http','https'] });
      return { id: post.id, slug: post.slug, title: post.title, excerpt: post.excerpt, content, status, date: post.date, thumbnail_url: status === 'public' ? post.thumbnail_url ?? null : null, created_at: post.created_at ?? post.createdAt ?? null, updated_at: post.updated_at ?? post.updatedAt ?? null, media: status === 'public' ? (post.media || []).map(item => ({ id: item.id, type: item.type, url: item.url, caption: item.caption, idx: item.idx })) : [] };
    },
  };
  const projectRepository = {
    getDrizzlePublicProjectAndMedia: async (slugOrId) => {
      const project = (state.tables.home_projects || []).find(row => (row.slug === slugOrId || row.id === slugOrId) && row.status === 'public' && !row.deleted_at && !row.deletion_date && row.is_deleted !== true);
      if (!project) return { project: null, media: [] };
      const sanitizer = load('src/lib/content/projectHtml.ts');
      return { project: { id: project.id, idx: project.idx, slug: project.slug, title: project.title, excerpt: project.excerpt,
        href: sanitizer.safeProjectUrl(project.href, true), color: project.color, image_url: sanitizer.safeProjectUrl(project.image_url),
        content: sanitizer.sanitizeProjectHtml(project.content), status: 'public' }, media: (state.tables.home_project_media || []).map(row => ({
        id: row.id, type: row.type, url: sanitizer.safeProjectUrl(row.url), caption: row.caption ?? null,
        idx: row.idx ?? 0, created_at: row.created_at ?? null, meta: null,
      })) };
    },
    getDrizzlePublicProjects: async (limit = 12, offset = 0) => {
      const rows = (state.tables.home_projects || []).filter(row => row.status === 'public' && !row.deleted_at && !row.deletion_date).sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
      state.queries.push({ table: 'home_projects', bounds: [offset, offset + limit], limit: limit + 1 });
      const candidates = rows.slice(offset, offset + limit + 1);
      return { items: candidates.slice(0, limit), hasMore: candidates.length > limit };
    },
  };
  function project(row, selection) {
    if (!selection || selection.startsWith('*')) return { ...row };
    const names = selection.replace(/\([^)]*\)/g, '').split(',').map(x => x.trim()).filter(Boolean);
    return Object.fromEntries(names.filter(n => n in row).map(n => [n, row[n]]));
  }
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.selection = '*'; this.orders = []; state.queries.push(this); }
    select(selection) { this.selection = selection; return this; }
    eq(key, value) { this.filters.push(r => r[key] === value); return this; }
    is(key, value) { this.filters.push(r => value === null ? r[key] == null : r[key] === value); return this; }
    ilike(key, pattern) {
      let source = '^';
      const special = new Set([46, 42, 43, 63, 94, 36, 123, 125, 40, 41, 124, 91, 93, 92]);
      const escape = char => special.has(char.charCodeAt(0)) ? String.fromCharCode(92) + char : char;
      for (let i = 0; i < pattern.length; i++) {
        if (pattern.charCodeAt(i) === 92 && i + 1 < pattern.length) source += escape(pattern[++i]);
        else source += pattern[i] === '%' ? '.*' : pattern[i] === '_' ? '.' : escape(pattern[i]);
      }
      const regex = new RegExp(source + '$', 'i');
      this.filters.push(r => typeof r[key] === 'string' && regex.test(r[key]));
      return this;
    }
    regexIMatch(key, pattern) {
      const regex = new RegExp(pattern, 'i');
      this.filters.push(r => typeof r[key] === 'string' && regex.test(r[key]));
      return this;
    }
    neq(key, value) { this.filters.push(r => r[key] !== value); return this; }
    in(key, values) { this.filters.push(r => values.includes(r[key])); return this; }
    order(key, options = {}) {
      if (!options.referencedTable && !options.foreignTable) this.orders.push({ key, ...options });
      return this;
    }
    limit(limit) { this.bounds = [0, limit - 1]; return this; }
    range(start, end) { this.bounds = [start, end]; return this; }
    returns() { return this; }
    update(patch) { this.patch = patch; return this; }
    insert(row) { if (!allowInsert) throw new Error('Unexpected insertion'); this.insertRow = row; return this; }
    delete() { if (!allowDelete) throw new Error('Unexpected deletion'); this.deletion = true; return this; }
    upsert() { throw new Error('Unexpected upsert'); }
    async execute(single = false) {
      if (state.beforeQuery) await state.beforeQuery(this);
      if (state.errors[this.table]) return { data: null, error: { message: 'synthetic database error', ...state.errors[this.table] } };
      if (this.patch && state.beforeWrite) state.beforeWrite(state.tables);
      if (this.insertRow) {
        const row = { id: 'synthetic-new', ...this.insertRow };
        (state.tables[this.table] ||= []).push(row);
        state.writes.push({ table: this.table, patch: { ...row }, ids: [row.id] });
        return { data: project(row, this.selection), error: null };
      }
      let rows = (state.tables[this.table] || []).filter(r => this.filters.every(f => f(r)));
      if (this.deletion) {
        const ids = new Set(rows.map(row => row.id));
        state.tables[this.table] = (state.tables[this.table] || []).filter(row => !ids.has(row.id));
        state.writes.push({ table: this.table, deletion: true, ids: [...ids] });
      }
      if (this.patch) {
        state.writes.push({ table: this.table, patch: { ...this.patch }, ids: rows.map(r => r.id) });
        rows.forEach(r => Object.assign(r, this.patch));
      }
      rows.sort((a, b) => {
        for (const { key, ascending = true, nullsFirst = false } of this.orders) {
          const av = a[key], bv = b[key];
          if (av == null && bv == null) continue;
          if (av == null) return nullsFirst ? -1 : 1;
          if (bv == null) return nullsFirst ? 1 : -1;
          if (av !== bv) return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
      });
      const count = rows.length;
      if (this.bounds) rows = rows.slice(this.bounds[0], this.bounds[1] + 1);
      if (single && (rows.length > 1 || (single === 'required' && !rows.length))) {
        return { data: null, error: { code: 'PGRST116', message: 'Synthetic single-row cardinality error' } };
      }
      rows = rows.map(r => project(r, this.selection));
      return { data: single ? rows[0] || null : rows, error: null, count };
    }
    maybeSingle() { return this.execute(true); }
    single() { return this.execute('required'); }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
  }
  const db = { from: table => new Query(table) };
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const source = fs.readFileSync(file, 'utf8');
    // Client components are render leaves; server pages and guards remain real.
    if (/(?:^|\n)["']use client["'];/.test(source)) return { __esModule: true, default: () => null };
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(source, {
      fileName: file, compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    }).outputText;
    const imports = (name) => {
      if (name === 'server-only') return {};
      if (name === 'zod') return require('zod'); // Real validation, never mocked.
      if (name === 'react') return require('react'); // Server cache primitive; no auth behavior is replaced.
      if (name === 'node:path') return require('node:path');
      if (name === 'node:fs/promises') return { readFile: async (file, encoding) => {
        const theme = path.join(root, 'src/styles/themes.css');
        if (path.resolve(file) !== theme || encoding !== 'utf8') throw new Error('Unexpected filesystem read in security test');
        return fs.promises.readFile(theme, 'utf8');
      } };

      if (name === 'sanitize-html') return require('sanitize-html'); // Real parser/sanitizer, never mocked.
      if (name === '@/lib/backend-configuration') return { getBackendConfiguration: () => backendConfig, BackendConfigurationError: class BackendConfigurationError extends Error {} };
      if (name === '@/lib/auth/viewer') return { getViewer: async () => {
        if (state.authError) return { userId: null, profile: null };
        if (state.errors.user_profiles) throw new Error('Synthetic profile lookup failure');
        return { userId: state.actor, profile: syntheticProfile() };
      } };
      if (name === '@/lib/auth/get-better-auth-viewer') return { getBetterAuthViewer: async () => ({ userId: state.actor, profile: syntheticProfile() }) };
      if (name === '@/lib/db/repositories/blog') return blogRepository;
      if (name === '@/lib/db/repositories/projects') return projectRepository;
      if (name === '@/lib/db/content-session') return contentSession;
      // Legacy contract tests must never initialize a real owner pool or request
      // context. New local CMS integration is exercised against PostgreSQL.
      if (name === '@/lib/db/owner-session') return {
        withCurrentOwnerSession: async () => { throw new Error('Owner database access requires the local PostgreSQL integration harness'); },
      };
      if (name === 'drizzle-orm') return { sql: testSql, eq: (field, value) => ({ field, value }), and: (...parts) => parts, isNull: field => ({ field, value: null }), inArray: (field, values) => ({ field, values }) };
      if (name === '@/lib/db/schema') return {
        media: { __name: 'app.media', id: 'media.id', postId: 'media.postId', url: 'media.url' },
        posts: { __name: 'app.posts', publicationState: 'posts.publicationState', visibility: 'posts.visibility', deletedAt: 'posts.deletedAt', deletionDate: 'posts.deletionDate' },
      };
      if (name === '@clerk/nextjs/server') return {
        auth: async () => { if (state.authError) throw new Error('Synthetic auth error'); return { userId: state.actor }; },
        currentUser: async () => state.actor ? { id: state.actor } : null,
        clerkMiddleware: fn => fn,
        createRouteMatcher: () => req => /^\/(blog|admin)(\/|$)/.test(req.nextUrl.pathname),
      };
      if (name === '@supabase/supabase-js') return { createClient: () => db };
      if (name === 'next/server') return framework ? require('next/server') : { NextResponse };
      if (name === 'next/navigation') return { redirect, notFound };
      if (name === '@/components/auth/AuthSessionContext') return { useAuthSession: () => ({ isLoaded: true, isSignedIn: Boolean(state.actor), user: state.actor ? { email: 'synthetic@example.invalid' } : null, getToken: async () => null, signOut: async () => {} }) };
      if (name === 'crypto') return { randomUUID: () => '2f0338c1-ec1a-4fd9-a35a-8e195d9327d0' };
      if (name === '@aws-sdk/client-s3') {
        class GetObjectCommand { constructor(input) { this.input = input; } }
        return { S3Client: class { constructor() { if (!allowUpload) throw new Error('Unexpected S3 access'); } async send(command) { if (command instanceof GetObjectCommand) { state.downloads ||= []; state.downloads.push(command.input); if (state.downloadError) throw new Error('synthetic private retrieval failure'); const bytes = Uint8Array.from([137, 80, 78, 71]); return { Body: { transformToByteArray: async () => bytes }, ContentType: 'image/png', ContentLength: bytes.length }; } if (state.uploadError) throw new Error('synthetic private storage failure'); state.uploads ||= []; state.uploads.push(command.input); } destroy() {} }, PutObjectCommand: class { constructor(input) { this.input = input; } }, GetObjectCommand };
      }
      if (name === '@aws-sdk/s3-request-presigner') return { getSignedUrl: deniedNetwork };
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name.startsWith('@/components/') || name === 'next/link' || /page\.client$/.test(name)) return { __esModule: true, default: () => null };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(file), name);
        const target = ['', '.ts', '.tsx'].map(ext => base + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile());
        if (target) return load(path.relative(root, target));
      }
      throw new Error(`Unmocked import: ${name}`);
    };
  const sandbox = { module: mod, exports: mod.exports, require: imports, URL, Request, Response, Headers, File, FormData, Uint8Array, AbortController, TextDecoder,
      console: { error() {}, log() {}, warn() {} }, fetch: deniedNetwork,
    process: { env: {
        SUPABASE_URL: 'https://database.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-key',
        S3_BUCKET: 'synthetic-bucket', S3_PRIVATE_JOURNAL_BUCKET: 'synthetic-private-bucket', S3_PRIVATE_JOURNAL_PREFIX: 'journal-private', AWS_REGION: 'us-east-2', NEXT_PUBLIC_SUPABASE_URL: 'https://database.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon-key',
      } },
    };
    new vm.Script(code, { filename: file }).runInNewContext(sandbox);
    return mod.exports;
  }
  return { state, load };
}
const member = (overrides = {}) => ({
  id: 'member', username: 'synthetic', email: 'person@example.invalid', role: 'user',
  enabled: true, is_banned: false, is_owner: false, is_whitelist_admin: false, can_view_private: false,
  ...overrides,
});
const request = (url, body) => new Request(`https://site.invalid${url}`, body === undefined ? undefined : {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
module.exports = { harness, member, request, root };
