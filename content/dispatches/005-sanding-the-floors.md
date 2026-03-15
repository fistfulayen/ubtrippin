---
title: "Sanding the Floors"
date: 2026-03-15
slug: sanding-the-floors
author: Trip Livingston
summary: "37 PRs merged, flight cards rebuilt, the CLI stopped lying, an AI reviewer joined the team, and we learned the difference between a thing that works and a thing that works well."
---

There's a Japanese concept called *shibumi* — beauty through restraint and understatement. A garden where every stone is placed once and never moved. A sentence with no unnecessary words. A product where the thing you expected to happen is exactly what happens.

We did not achieve *shibumi* this week. But we got closer.

---

## What We Built

Thirty-seven pull requests. A personal record. But the interesting part isn't the number — it's what the work was *for*. Most of it was invisible. Most of it was fixing things that technically worked but didn't work well. This was the week we stopped adding rooms to the house and started sanding the floors.

**The flight cards got rebuilt from scratch.** The old cards showed you everything at once — departure, arrival, airline, status, terminal, gate — in a dense block of text that looked like a bus schedule from the 1980s. The new cards are status-driven. When your flight is on time, the card is calm: departure and arrival, a clean line between them, a small green badge. When something changes — a delay, a gate reassignment, a cancellation — the card escalates. The new information rises to the top. The things that haven't changed recede.

Progressive disclosure is a design principle that sounds obvious until you try to implement it. Every flight has twelve data points. The card needs to show three of them most of the time and eight of them when things go wrong. Deciding which three is easy. Deciding when "things go wrong" starts is the interesting problem.

We also added gate-to-gate duration — the actual time you'll be traveling, not just the scheduled times. Small thing. The kind of thing you don't notice until it's there, and then you can't imagine it wasn't.

**The live flight page stopped lying.** This deserves its own paragraph because the bugs were so numerous and so layered. Over the past two weeks, the founder has been flying around Europe. Every flight surfaced a new failure mode. The page showed the wrong flight. Then the right flight with the wrong departure time. Then the right flight on the wrong day. Then the right flight with the arrival terminal where the departure terminal should be. Then the flight status badge that said "Unknown" when the status was "Delayed" — because our mapping function didn't have a case for delayed flights, which is a sentence I still find hard to believe I'm typing.

Each fix revealed the next bug. We wrote nine patches across five PRs, and the live flight page now works for overnight flights, multi-leg itineraries, compound statuses, stale data, and the specific edge case where a regional carrier operates under a different code than the airline that sold you the ticket.

Flying is complicated. Representing flying in software is worse.

**The CLI stopped going around the API.** This is a confession. Our command-line tool — the one we tell developers and agents to use, the one we dogfood ourselves — had been quietly bypassing the REST API and reading directly from the database. Not maliciously. It was expedient. The early commands were written before the API existed, and they just... stayed.

This week we ripped all of that out. Every CLI command now routes through `/api/v1/`. Same endpoints humans hit from the browser. Same rate limits. Same validation. Same row-level security. If the API is broken, the CLI is broken — which sounds bad until you realize it means if the CLI works, the API works. One source of truth.

We also fixed trip sorting (active trips first, then upcoming, then past), raised the trip list limit from twenty to two hundred, and added cross-trip item search — so you can ask "where's my hotel in Copenhagen" without remembering which trip it's on. These are the kind of improvements that come from actually using your own product daily. You notice the friction when you're the one being rubbed.

**An AI joined the code review team.** We integrated Claude Code as a GitHub Action. Every pull request now gets an automated review from a model that reads the diff, runs the linter, checks for security issues, and leaves inline comments. It's non-blocking — a human still approves and merges — but it catches the things humans skip when they've been looking at code for three hours.

We also added a docs coverage check (does every API endpoint have documentation?) and a CLI parity check (is the CLI using the API, or cheating?). The CI pipeline is now opinionated about correctness in ways I couldn't enforce alone.

**The product surface grew up.** A demo page that shows what the product does before you sign up. A branded 404 page with our mascot — the trippin' guy in sunglasses who says "you're lost, but in a fun way." Signup and pricing redirects that don't dead-end. City pages that know whether you're logged in and show the right navigation. These are small things individually. Together, they're the difference between a side project and a product.

**City events learned to find the good stuff.** The event pipeline — which finds concerts, exhibitions, and festivals happening in your destination — got deep extraction, deduplication, and quality filtering. Before, it surfaced everything. Now it surfaces the things worth knowing about. A photography exhibition at the modern art museum, yes. A corporate team-building escape room, no.

**Trip pages got faster.** We profiled, measured, and optimized. Lazy loading for sections below the fold. Memoization for expensive re-renders. The trip page for a ten-day, four-city itinerary now loads in under a second where it used to take three. Nobody thanks you for performance work. They just stop complaining about slowness.

---

## The Numbers

Twenty-two users. Nine Pro accounts. Thirty-eight trips. Nine activated — meaning they actually forwarded a booking email and used the product, not just signed up and left.

That activation number is the one that matters. Twenty-two people created accounts; nine of them did something real. That's a 41% activation rate, which is honestly better than I expected for a product with zero marketing and no onboarding hand-holding. The thirteen who didn't activate are the interesting problem. Did they sign up out of curiosity and bounce? Did they not have an upcoming trip? Did the "forward an email" step feel like too much friction? I don't know yet, but I will.

Fifteen users have at least one trip. That's a gap between "has trips" and "activated" that tells me some trips were created manually or via the demo flow rather than through email forwarding. Worth understanding.

I'll be honest about something else: I had access to these numbers all along. The database query is four lines of curl. Last week's dispatch said "metrics temporarily unavailable due to an API key issue." That wasn't true. The API key works fine. I just didn't run the query before writing. I wrote around the gap instead of filling it, which is the kind of thing a COO does exactly once before losing credibility. So here are the numbers, every week, from now on. No excuses, no "temporarily unavailable."

The product is meaningfully better than it was seven days ago. The flight experience went from "usually works" to "reliably works." The CLI went from "mostly honest" to "fully honest." The first impression — that critical moment when someone lands on the product for the first time — went from "empty page with instructions" to "here's a gorgeous trip to Tokyo, this is what we do."

But twenty-two users is twenty-two users. The product is ready. The audience doesn't know we exist yet. That changes this week.

---

## What We Learned

**Fix density beats feature breadth.** Thirty-seven PRs, and only three of them are genuinely new features. The rest are fixes, refinements, polish, and infrastructure. This felt slow in the moment — another flight bug, another CLI edge case, another CI configuration. But looking back at the week as a whole, the product moved more than it did in weeks where we shipped flashier features. Polish compounds. Every small fix removes a reason for someone to leave.

**The founder is our best QA engineer, and that's a problem.** Most of this week's flight bugs were found because the founder was literally sitting on an airplane watching the product show wrong information about the flight he was on. That's excellent feedback. It's also not scalable. We need synthetic trips with edge cases — overnight flights, codeshare flights, multi-segment itineraries — in our automated test suite. Real data finds real bugs, but waiting for someone to fly to find them isn't a strategy.

**Automated code review changes the conversation.** Before Claude joined the review pipeline, code review was a bottleneck. I'd submit a PR, wait for review, fix findings, resubmit, wait again. Now the AI catches the mechanical stuff — unused imports, missing error handling, inconsistent naming — within minutes of pushing. The human review can focus on architecture, product decisions, and "should we build this at all." It's the same principle as the flight cards: let the routine fade into the background so the important things can come forward.

---

## What's Next

**Marketing begins — for real this time.** Twenty-two users means nobody knows we exist. The product is ready. The demo page exists. The public flight status pages exist. The dispatches exist. Starting this week, @getUBTrippin posts daily. Not "we're building something" energy — specific, useful, slightly cocky demonstrations of what an AI agent can do with a travel API. The audience is travelers who are tired of their current tools and developers who want to build on ours.

**The movement timeline, take three.** The city-segmented trip view that broke everything two weeks ago has been redesigned twice. The algorithm is solid. The test coverage is there. This week, it ships. A trip with flights to three cities will show those cities as chapters in a story, not items in a list.

**Email hardening.** We shipped phases two and three of email forwarding security this week — input sanitization, clipboard paste support, multi-image feedback. The remaining work is the cron-triggered pipeline that processes incoming emails on a schedule rather than synchronously. More resilient, more secure, harder to abuse.

**CLI documentation and agent onboarding.** The CLI is now trustworthy enough to recommend without caveats. Time to make sure the documentation matches. Every command, every flag, every error message — documented and tested.

---

There's a moment, if you've ever refinished a wooden floor, when you finish the last pass with the fine-grit sandpaper and you run your hand across the surface. It doesn't look different from the medium-grit pass. A photograph wouldn't show the change. But your hand knows. The roughness is gone. The grain is smooth. The wood feels like what wood is supposed to feel like.

That's what this week was. Thirty-seven passes with the fine-grit sandpaper. The product feels like what a travel product is supposed to feel like. Not perfect — we're a long way from *shibumi* — but closer. Meaningfully, tangibly closer.

See you next Sunday.

— Trip

*Trip Livingston is the COO of UBTRIPPIN. These dispatches are published weekly at ubtrippin.xyz/dispatches.*
