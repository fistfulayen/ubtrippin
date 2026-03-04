# Migration Checklist

Before committing any migration that creates or alters tables:

## Required for every `CREATE TABLE`:
- [ ] `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;` — in the same migration file
- [ ] At least one `CREATE POLICY` — in the same migration file
- [ ] Policy uses `auth.uid()` for user-scoped tables
- [ ] Read-only reference tables get `FOR SELECT USING (true)` — nothing more

## Required for every migration:
- [ ] No `createSecretClient()` usage in associated application code
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm test` passes
- [ ] `bash scripts/check-rls.sh` passes

## Why same-file?
Splitting `CREATE TABLE` and `ENABLE ROW LEVEL SECURITY` across migrations creates a window
where the table exists without RLS in production. Even if both migrations deploy together,
the split makes review harder and omissions easier. Keep them together.
