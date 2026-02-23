import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// GET /api/keys — list all API keys for the authenticated user (with masked previews)
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_preview, created_at, last_used_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ keys: data })
}

// POST /api/keys — generate a new API key, store the hash, return plaintext once
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const name = (body.name ?? '').trim()

  if (!name) {
    return NextResponse.json({ error: 'Key name is required' }, { status: 400 })
  }

  // Generate plaintext key: ubt_k1_ + 40 random hex chars
  const rawSuffix = crypto.randomBytes(20).toString('hex') // 40 hex chars
  const plaintextKey = `ubt_k1_${rawSuffix}`

  // Hash with SHA-256 — only this goes in the DB
  const keyHash = crypto.createHash('sha256').update(plaintextKey).digest('hex')

  // Build a human-friendly masked preview: first 7 chars + "..." + last 4 chars
  // Full key length: 7 ("ubt_k1_") + 40 = 47 chars
  const keyPreview = `${plaintextKey.slice(0, 7)}...${plaintextKey.slice(-4)}`

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      key_hash: keyHash,
      name,
      key_preview: keyPreview,
    })
    .select('id, name, key_preview, created_at, last_used_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return the plaintext key ONCE — we will never show it again
  return NextResponse.json({
    key: data,
    plaintext: plaintextKey,
  })
}

// DELETE /api/keys?id=<uuid> — revoke a key (RLS ensures it belongs to the user)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
