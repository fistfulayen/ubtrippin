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

| Category | Count | Target |
|----------|-------|--------|
| **Errors (RLS disabled)** | 0 ✅ | 0 |
| **Unindexed foreign keys** | 16 | 0 |
| **Duplicate indexes** | 4 (public) | 0 |
| **Security definer functions without search_path** | 5 | 0 |
| **Tables with RLS enabled but no policies** | 1 | 0 |
| **Extensions in public schema** | 3 | 0 |
| **Unused indexes** | 43 | Review & prune |

### Performance Baseline
- **Database size:** 16 MB
- **Cache hit rate:** 1.00 (table), 1.00 (index) — excellent
- **Index overhead:** 1304 kB total (3.3× table size of 392 kB)
- **Dead rows:** Healthy — autovacuum running
- **Top query:** Dashboard introspection (1.5s, 34.5% of exec time) — not app code

---

## Phase 1: Security (Critical) — Single Migration

### 1.1 Fix security definer functions without `search_path`

5 functions are `SECURITY DEFINER` without a pinned `search_path`. This is a privilege escalation vector — a malicious user could create objects in `public` schema that shadow system functions.

**Functions to fix:**
- `guides_nearby`
- `increment_example_usage`
- `notify_webhook_delivery`
- `update_feedback_votes_count`
- `update_guide_entry_count`

**Fix:** `ALTER FUNCTION public.<name>(...) SET search_path = public, extensions;`

### 1.2 Add RLS policy for `webhook_delivery_queue`

RLS is enabled but no policies exist — table is inaccessible via PostgREST (effectively locked). Either:
- Add appropriate policies (if API access is needed), or
- Confirm this is intentional (server-side only via service role)

### 1.3 Review security definer functions

16 `SECURITY DEFINER` functions in public schema. Audit each:
- Is `SECURITY DEFINER` actually needed?
- Can any be converted to `SECURITY INVOKER`?
- Do any contain unvalidated input?

**Functions to audit:**
- `auto_expand_trip_dates` — likely needs definer (cross-user trip logic?)
- `billing_pro_subscriber_count` — admin function, verify access control
- `expire_billing_grace_periods` — cron job, needs definer
- `handle_new_user` / `handle_user_updated` — auth triggers, needs definer
- `is_family_admin` / `is_family_member` / `is_family_member_of` — RLS helper functions, needs definer
- `is_trip_owner` / `trip_owner_user_id` — RLS helper, needs definer
- `set_request_user` — auth context setter, needs definer
- `notify_webhook_delivery` — trigger, needs definer
- `increment_example_usage` — could potentially be invoker
- `update_feedback_votes_count` / `update_guide_entry_count` — triggers, needs definer
- `guides_nearby` — spatial query, verify if definer needed

---

## Phase 2: Index Hygiene

### 2.1 Add indexes for unindexed foreign keys

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

### 2.2 Remove duplicate indexes

4 pairs of duplicate indexes in public schema (wasting ~128 KB, but the principle matters):

| Duplicate | Redundant With | Action |
|-----------|---------------|--------|
| `idx_trip_item_status_item` | `trip_item_status_item_id_key` (unique) | Drop the non-unique index |
| `idx_profiles_stripe_customer` | `profiles_stripe_customer_id_key` (unique) | Drop the non-unique index |
| `idx_api_keys_hash` | `api_keys_key_hash_key` (unique) | Drop the non-unique index |
| `idx_monthly_extractions_user_month` | `monthly_extractions_pkey` | Review — may differ if composite |

### 2.3 Review unused indexes

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

## Phase 3: Schema Hygiene

### 3.1 Move extensions out of public schema

3 extensions installed in `public` schema:
- `citext`
- `cube`
- `earthdistance`

**Fix:** Move to `extensions` schema. Requires:
1. `ALTER EXTENSION citext SET SCHEMA extensions;`
2. Update any SQL that references `citext` type with schema qualification
3. Test that `earthdistance` + `cube` functions still work for `guides_nearby`

**Risk:** Medium — `citext` is used for case-insensitive text. Moving it may affect column types. Test thoroughly.

### 3.2 Review broad RLS policies

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

### Migration 1: Security fixes (Phase 1.1 + 1.2)
- Pin `search_path` on 5 functions
- Add/confirm `webhook_delivery_queue` policy
- **File:** `20260305000000_security_definer_search_path.sql`

### Migration 2: Foreign key indexes (Phase 2.1)
- Add 16 indexes (all `CREATE INDEX CONCURRENTLY` where possible)
- **File:** `20260305000001_index_foreign_keys.sql`

### Migration 3: Drop duplicate indexes (Phase 2.2)
- Drop 3-4 redundant indexes
- **File:** `20260305000002_drop_duplicate_indexes.sql`

### Migration 4: Extension schema migration (Phase 3.1)
- Move `citext`, `cube`, `earthdistance` to `extensions` schema
- **File:** `20260305000003_move_extensions.sql`
- **Risk:** Highest — test locally first

### Script: Monthly health check
- **File:** `scripts/supabase-health.sh`
- Add to CI as monthly cron job or manual trigger

---

## Success Criteria

| Metric | Current | Target | Deadline |
|--------|---------|--------|----------|
| Supabase linter errors | 0 | 0 | Maintain |
| Supabase linter warnings | ~24 | 0 | 2026-03-15 |
| Unindexed foreign keys | 16 | 0 | 2026-03-15 |
| Duplicate indexes | 4 | 0 | 2026-03-15 |
| Insecure SECURITY DEFINER | 5 | 0 | 2026-03-10 |
| Extensions in public | 3 | 0 | 2026-03-31 |
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
