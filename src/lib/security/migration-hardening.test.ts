import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260903000000_security_boundary_hardening.sql'),
  'utf8'
)

describe('security boundary migration', () => {
  it('requires trip authorization for linked item writes and editor role for collaborator deletion', () => {
    expect(migration).toContain('(trip_id IS NULL AND user_id = (SELECT auth.uid()))')
    expect(migration).toMatch(/CREATE POLICY "trip_items_delete"[\s\S]*tc\.role = 'editor'/)
  })

  it('removes row-wide profile and collaborator mutation privileges', () => {
    expect(migration).toMatch(/REVOKE INSERT, UPDATE ON public\.profiles FROM [^;]*authenticated/)
    expect(migration).toMatch(/REVOKE UPDATE ON public\.trip_collaborators FROM [^;]*authenticated/)
    expect(migration).toContain('CREATE POLICY "profiles_select_own"')
  })

  it('does not leave service-only attachment upload policies in place', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Service can upload ticket attachments"')
    expect(migration).toContain('DROP POLICY IF EXISTS "Service can upload email attachments"')
  })
})
