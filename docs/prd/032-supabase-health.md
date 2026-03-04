# PRD 032 — Supabase Health: Monthly Database Hygiene

**Status:** Active (recurring monthly)  
**Owner:** Jacques Cousteau  
**Created:** 2026-03-04  
**Triggered by:** RLS incident on `provider_catalog` (2026-03-04)

---

## Objective

Zero errors, zero warnings from Supabase linter. Measurable performance improvements in query execution. Monthly cadence.

---

## Baseline Snapshot (2026-03-04)

**Source:** Supabase Dashboard Linter (176 total findings) + `supabase inspect db` CLI

| Category | Level | Count | Target |
|----------|-------|-------|--------|
| **Errors (RLS disabled)** | ERROR | 0 ✅ | 0 |
| **Multiple permissive policies** | WARN | 70 | 0 |
| **Auth RLS InitPlan (per-row re-eval)** | WARN | 55 | 0 |
| **Function search_path mutable** | WARN | 8 | 0 |
| **Extensions in public schema** | WARN | 3 | 0 |
| **Leaked password protection disabled** | WARN | 1 | 0 |
| **Unused indexes** | INFO | 20 | Review & prune |
| **Unindexed foreign keys** | INFO | 17 | 0 |
| **RLS enabled, no policies** | INFO | 1 | 0 |
| **Auth DB connections (config)** | INFO | 1 | Review |
| **Duplicate indexes** (from CLI) | — | 4 | 0 |

### Performance Baseline
- **Database size:** 16 MB
- **Cache hit rate:** 1.00 (table), 1.00 (index) — excellent
- **Index overhead:** 1304 kB total (3.3× table size of 392 kB)
- **Dead rows:** Healthy — autovacuum running
- **Top query:** Dashboard introspection (1.5s, 34.5% of exec time) — not app code
- **Full linter JSON:** Obsidian `UB Trippin/Supabase Warnings and Suggestions.md`

---

## Phase 1: Security (Critical)

### 1.1 Fix function `search_path` mutable (8 functions)

Functions without a pinned `search_path` are a privilege escalation vector — a malicious user could create objects in `public` schema that shadow system functions.

**Functions to fix:**
- `increment_example_usage`
- `touch_trip_collaborator`
- `update_guide_entry_count`
- `set_updated_at`
- `guides_nearby`
- `notify_webhook_delivery`
- `update_feedback_votes_count`
- `update_updated_at_column`

**Fix:** `ALTER FUNCTION public.<name>(...) SET search_path = public, extensions;`

### 1.2 Add RLS policy for `webhook_delivery_queue`

RLS is enabled but no policies exist — table is inaccessible via PostgREST (effectively locked). Either:
- Add appropriate policies (if API access is needed), or
- Confirm this is intentional (server-side only via service role)

### 1.3 Enable leaked password protection

Dashboard toggle: Auth → Settings → Enable HaveIBeenPwned check. No migration needed.

### 1.4 Review auth DB connections config

Auth server capped at 10 connections. Verify this is adequate. Dashboard setting, not migration.

---

## Phase 2: RLS Performance (55 warnings)

### 2.1 Fix `auth_rls_initplan` — wrap auth calls in subselect

Every RLS policy using `auth.uid()` directly re-evaluates it per row. At scale, this is O(n) function calls instead of O(1). Fix by wrapping in a subselect.

**Before:** `USING (user_id = auth.uid())`
**After:** `USING (user_id = (SELECT auth.uid()))`

**Tables affected (55 policies across these tables):**
- `profiles` (3 policies: view, update, insert)
- `allowed_senders`
- `trips`
- `trip_items`
- `source_emails`
- `audit_logs`
- `trip_pdfs`
- `city_guides`
- `guide_entries`
- `extraction_examples`
- `extraction_corrections`
- `api_keys`
- `notifications`
- `imports`
- `loyalty_programs`
- `user_profiles`
- `feedback`
- `feedback_votes`
- `feedback_comments`
- `families`
- `family_members`
- `trip_collaborators`
- `webhooks`
- `webhook_deliveries`
- `webhook_delivery_queue`
- `trip_item_status`

**Approach:** Single migration that drops and recreates all affected policies with `(SELECT auth.uid())` and `(SELECT auth.jwt())` wrappers. Must preserve exact same access logic.

### 2.2 Consolidate multiple permissive policies (70 warnings)

When multiple permissive policies exist for the same role+action, Postgres ORs them. This works but:
1. Makes access logic harder to audit
2. Can cause unintended access via OR combinations
3. Generates linter noise

**Tables with multiple permissive policies:**
- `city_guides` — owner + family + collaborator read policies
- `families` — creator + member select
- `guide_entries` — owner + family + shared entries
- `loyalty_programs` — owner + family read
- `profiles` — own profile + collaborator visibility
- `trips` — owner + collaborator + family access
- `trip_items` — owner + collaborator + family access
- `source_emails` — owner + various access patterns
- And more...

**Approach:** For each table, merge multiple permissive policies for the same role+action into a single policy with OR conditions. E.g.:
```sql
-- Before: 3 separate SELECT policies that get ORed
-- After: 1 policy with explicit OR
CREATE POLICY "select_access" ON public.trips FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR id IN (SELECT trip_id FROM trip_collaborators WHERE user_id = (SELECT auth.uid()))
  OR user_id IN (SELECT user_id FROM family_members WHERE family_id IN (...))
);
```

**Risk:** HIGH — this is the most dangerous phase. Every policy merge must be tested to ensure identical access. Do this table by table, not all at once.

---

## Phase 3: Index Hygiene

### 3.1 Add indexes for unindexed foreign keys

16 foreign keys without indexes. These cause sequential scans on `JOIN` and `DELETE CASCADE` operations. At current scale it's invisible, but it's a ticking bomb.

**Foreign keys to index:**

| Table | Column | Priority |
|-------|--------|----------|
| `trip_items` | `source_email_id` | HIGH — hot table, 47 rows growing |
| `trip_pdfs` | `trip_id` | MEDIUM |
| `trip_pdfs` | `user_id` | MEDIUM |
| `notifications` | `trip_id` | MEDIUM — notification queries |
| `notifications` | `actor_id` | LOW |
| `feedback_comments` | `feedback_id` | MEDIUM |
| `feedback_comments` | `user_id` | LOW |
| `families` | `created_by` | LOW |
| `family_members` | `invited_by` | LOW |
| `trip_collaborators` | `invited_by` | LOW |
| `audit_logs` | `user_id` | LOW |
| `extraction_examples` | `source_email_id` | LOW |
| `extraction_examples` | `user_id` | LOW |
| `guide_entries` | `recommended_by_user_id` | LOW |
| `imports` | `user_id` | LOW |
| `trip_item_status_refresh_logs` | `item_id` | LOW |

### 3.2 Remove duplicate indexes

4 pairs of duplicate indexes in public schema (wasting ~128 KB, but the principle matters):

| Duplicate | Redundant With | Action |
|-----------|---------------|--------|
| `idx_trip_item_status_item` | `trip_item_status_item_id_key` (unique) | Drop the non-unique index |
| `idx_profiles_stripe_customer` | `profiles_stripe_customer_id_key` (unique) | Drop the non-unique index |
| `idx_api_keys_hash` | `api_keys_key_hash_key` (unique) | Drop the non-unique index |
| `idx_monthly_extractions_user_month` | `monthly_extractions_pkey` | Review — may differ if composite |

### 3.3 Review unused indexes

43 indexes show 0% usage since stats reset (31 days). Many are primary keys on low-traffic tables (expected). Review candidates for removal:

**Likely safe to drop (non-PK, non-unique, 0 scans):**
- `idx_webhook_deliveries_status_created` — 0 webhook deliveries exist
- `idx_trip_item_status_checked` — 0 scans
- `idx_feedback_user` — 0 scans
- `idx_corrections_user` — 0 scans
- `idx_corrections_email` — 0 scans
- `idx_examples_provider` — 0 scans
- `idx_guide_entries_geo` — 0 scans (geo index, may be needed)
- `idx_city_guides_user` — 0 scans
- `idx_source_emails_from` — 0 scans

**Keep despite 0 scans (needed for uniqueness or share tokens):**
- `*_pkey` indexes — always keep
- `*_key` unique indexes — always keep
- `*_share_token*` / `*_invite_token*` — needed for link sharing

---

## Phase 4: Schema Hygiene

### 4.1 Move extensions out of public schema

3 extensions installed in `public` schema:
- `citext`
- `cube`
- `earthdistance`

**Fix:** Move to `extensions` schema. Requires:
1. `ALTER EXTENSION citext SET SCHEMA extensions;`
2. Update any SQL that references `citext` type with schema qualification
3. Test that `earthdistance` + `cube` functions still work for `guides_nearby`

**Risk:** Medium — `citext` is used for case-insensitive text. Moving it may affect column types. Test thoroughly.

### 4.2 Review broad RLS policies

`provider_catalog` has `USING (true)` for SELECT — this is intentional (public reference data). No other tables have overly broad policies. ✅

---

## Monthly Audit Script

Create `scripts/supabase-health.sh` that runs all checks and outputs a scorecard.

**Checks to automate:**
1. RLS disabled on any public table → ERROR
2. RLS enabled but no policies → WARNING
3. Unindexed foreign keys → WARNING
4. Duplicate indexes → WARNING
5. Security definer without search_path → ERROR
6. Extensions in public schema → INFO
7. Cache hit rates < 99% → WARNING
8. Dead tuple ratio > 10% → WARNING

**Output:** JSON scorecard saved to `docs/health/YYYY-MM-DD.json`

**Schedule:** Run monthly, first week. Compare against previous month.

---

## Implementation Plan

### Sprint 1: Security (Phase 1) — Target: 2026-03-07
**Migration A:** `20260305000000_fix_search_path.sql`
- Pin `search_path` on 8 functions
- Add/confirm `webhook_delivery_queue` policy
- **Risk:** Low — additive change

**Dashboard actions:**
- Enable leaked password protection (Auth → Settings)
- Review auth DB connections config

### Sprint 2: RLS Performance (Phase 2) — Target: 2026-03-14
**Migration B:** `20260308000000_rls_initplan_fix.sql`
- Rewrite 55 RLS policies to wrap `auth.uid()` / `auth.jwt()` in `(SELECT ...)`
- **Risk:** Medium — must preserve identical access logic
- **Test:** Verify all API routes still work after migration

**Migration C:** `20260310000000_consolidate_rls_policies.sql` (table by table)
- Merge 70 multiple permissive policies into consolidated single policies
- **Risk:** HIGH — most dangerous change. Test each table individually.
- **Approach:** Do in sub-migrations per table if needed

### Sprint 3: Index Hygiene (Phase 3) — Target: 2026-03-15
**Migration D:** `20260312000000_index_foreign_keys.sql`
- Add 17 indexes for unindexed foreign keys

**Migration E:** `20260312000001_drop_duplicate_indexes.sql`
- Drop 4 redundant indexes

### Sprint 4: Schema Hygiene (Phase 4) — Target: 2026-03-31
**Migration F:** `20260320000000_move_extensions.sql`
- Move `citext`, `cube`, `earthdistance` to `extensions` schema
- **Risk:** Highest — test locally first, may affect column types

### Ongoing: Monthly health script
- **File:** `scripts/supabase-health.sh`
- Add to CI as monthly cron or manual trigger workflow

---

## Success Criteria

| Metric | Current | Target | Deadline |
|--------|---------|--------|----------|
| Supabase linter errors | 0 | 0 | Maintain |
| Supabase linter warnings | 137 | 0 | 2026-03-31 |
| Supabase linter info | 39 | 0 | 2026-03-15 |
| Multiple permissive policies | 70 | 0 | 2026-03-14 |
| Auth RLS InitPlan (perf) | 55 | 0 | 2026-03-14 |
| Function search_path mutable | 8 | 0 | 2026-03-07 |
| Extensions in public | 3 | 0 | 2026-03-31 |
| Unindexed foreign keys | 17 | 0 | 2026-03-15 |
| Duplicate indexes | 4 | 0 | 2026-03-15 |
| Leaked password protection | Off | On | 2026-03-07 |
| Monthly audit | None | Automated | 2026-03-15 |

---

## Recurring Schedule

**Monthly, first week:**
1. Run `scripts/supabase-health.sh`
2. Compare scorecard against previous month
3. File issues for any regressions
4. Update this PRD with new baseline numbers

**Quarterly:**
- Review `pg_stat_statements` for slow queries
- Review table/index bloat
- Consider `VACUUM FULL` on tables with >20% dead tuples
- Review if any unused indexes should be dropped
