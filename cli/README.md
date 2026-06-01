# @ubtrippin/cli

Command-line access to UBTRIPPIN trips, itinerary items, tickets, guides, family travel, loyalty programs, notifications, webhooks, and account settings.

## Install

```bash
npm install -g @ubtrippin/cli
```

## Login

Generate a revocable API key in UBTRIPPIN Settings, then run:

```bash
ubt login
```

Paste the `ubt_k1_...` key when prompted. The CLI stores it in `~/.ubt/config` as `UBT_API_KEY`.

You can also provide the key per environment:

```bash
export UBT_API_KEY=ubt_k1_...
ubt whoami
```

Supabase URLs, Supabase keys, and repo `.env.local` files are not used by the public CLI.

## Quick Checks

```bash
ubt version
ubt help
ubt whoami
ubt selftest
ubt trips list
FORMAT=json ubt items search --limit 1
```

All data commands call `https://www.ubtrippin.xyz/api/v1` by default. For local development against another deployment, set `UBT_API_URL`.
