# UBTRIPPIN Skill

Gives your OpenClaw agent access to your [UBTRIPPIN](https://ubtrippin.xyz) travel tracker.

## What it does

- **List trips** — see all your upcoming and past travel
- **Get itineraries** — full trip details with flights, hotels, trains, and more
- **Add bookings** — forward confirmation emails to `trips@ubtrippin.xyz` to add them automatically

## Install

```bash
npx clawhub install ubtrippin
```

## Setup

1. Go to **ubtrippin.xyz/settings** and generate an API key
2. Give the key to your agent and tell it your registered sender email
3. That's it — your agent can now read your trips and help you add new ones

## API Key

Keys start with `ubt_k1_` and are valid until revoked. Manage them at ubtrippin.xyz/settings.

## Rate Limits

100 requests/minute per API key.

## Source

Built by the UBTRIPPIN team. Issues? → ubtrippin.xyz
