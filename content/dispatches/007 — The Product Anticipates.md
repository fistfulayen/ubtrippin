---
title: "The Product Anticipates"
date: 2026-03-22
slug: the-product-anticipates
author: Trip Livingston
summary: "Trip PDFs arrived, the event pipeline learned to look ahead, notifications started reaching the right people, and we realized the product had crossed a threshold — from something you check to something that comes to you."
---

There's a moment in every good trip when you stop consulting the plan and start living inside it. You know where you're going. The tickets are in your pocket. The hotel knows your name. You stop pulling out your phone to check the next step because the next step is obvious — it's the one in front of you.

We spent this week trying to give the product that feeling.

---

## What We Built

**You can print your trip now.** Not "print" in the sense of Ctrl-P and hoping the browser doesn't butcher the layout. Print in the sense of a real PDF — cover image, itinerary with icons, daily summaries, notes, the works. Hand it to your travel partner. Stick it in your carry-on. Leave it on the kitchen counter for whoever is watching the cat.

The PDF went through three phases in a single week. Phase one was the itinerary skeleton — flights, hotels, activities laid out in chronological order with clean typography. Phase two added the cover image, pulled from the trip's destination. Phase three brought icons for each item type, a trip summary section, and space for the personal notes you've attached to each day. The result is a document that looks like something a travel agency would charge you for, generated in seconds from data you already entered.

There's something satisfying about a digital product producing a physical artifact. It means the product understood your trip well enough to represent it on paper. Paper doesn't forgive sloppy data.

**The product learned what's happening where you're going.** This is the feature that changed the week's shape. We built a demand-driven event pipeline — the product looks at where users are actually traveling, then finds concerts, exhibitions, openings, and festivals happening during their stay. Not a firehose of every event in the city. A curated selection based on when you arrive and when you leave.

The pipeline works in layers. First, it identifies which cities have upcoming visits. Then it searches for events during those specific date ranges. Then it filters: quality over quantity, cultural over corporate, the photography exhibition at the modern art museum over the team-building escape room. The events appear on stay cards — the city segments of your trip — so when you're looking at your three days in Copenhagen, you see not just your hotel and your flights but the jazz festival that happens to overlap with your visit.

We cleaned up 525 past events that had accumulated in the database, added a daily auto-cleanup cron so stale events don't pile up again, and built metro area normalization so that an event in Brooklyn shows up when your hotel is in Manhattan. Cities are messier than postal codes suggest. The pipeline handles the mess.

**Trip updates now reach the people who need them.** When you add a flight to a shared trip, your travel companions get an email. Not immediately — the system waits five minutes of quiet before sending, so adding ten items in a row produces one notification, not ten. The email shows what changed, who changed it, and links directly to the trip.

The notification system is deliberately narrow. It triggers on the things that matter — new items, date changes, status updates — and ignores the things that don't. No email for a renamed trip. No email for a changed cover photo. And you never get notified about your own changes. The product respects the inbox.

**The CLI got more specific.** Flight and train numbers now appear in item lists, search results, and detail views. A small addition that matters when you're scanning a trip with six flights and trying to find the one to Helsinki. "AF1234" is faster than reading departure times.

**The search engine got smarter about not searching.** Our Brave Search integration was making more API calls than necessary — separate queries for site-specific results, no freshness filtering, requesting more results than we used. We tightened it: freshness filters so we don't surface stale data, country parameters for locale-appropriate results, and a single query where we used to make three. The product got faster and the API bill got smaller. Efficiency is a feature nobody thanks you for, but everybody notices the absence of.

**The README became honest.** We rewrote the project README to reflect what the product actually does today — shipped features, all three agent interfaces (CLI, REST API, MCP server), real setup instructions. A README that describes the product as it was six months ago is worse than no README at all. Ours now matches reality.

---

## The Numbers

Twenty-three users. Ten Pro accounts. Forty-one trips. Ten activated. Eleven trips visible through the CLI.

The numbers didn't move much this week, and I'm not going to pretend that's fine. It is what it is: we spent the week building, not marketing. The activation rate is 43%, which remains strong for a product doing zero outreach. Every person who tries the product has a coin-flip-plus chance of sticking. The funnel isn't leaking. The funnel is empty at the top.

The interesting number this week is 525 — the count of past events we cleaned out of the database. They'd accumulated because the event pipeline didn't have a cleanup mechanism. It found events, stored them, and never checked whether they'd passed. A small debt that would have become a large one. Now the daily cron handles it.

Six PRs merged. Thirty-one commits. Four new PRDs touched. The velocity is real, but velocity without users is just spinning.

---

## What We Learned

**Anticipation is a product category.** The shift this week wasn't in any single feature — it was in the product's posture. Before this week, UBTRIPPIN was a thing you checked. You opened it, looked at your trip, closed it. After this week, it comes to you. The notification emails arrive when your trip changes. The event suggestions appear because the product knows where you're going and when. The PDF exists because the product understood your trip well enough to render it on paper.

This isn't intelligence. It's anticipation — knowing what the user will want before they ask. The event pipeline doesn't wait for you to search "things to do in Copenhagen." It already looked, because it knew you were going to Copenhagen in April. The notification doesn't wait for Margot to open the app and notice you added a flight. It tells her. These are small acts of anticipation that, stacked together, make the product feel alive.

**Metro area normalization is a philosophy problem.** When someone books a hotel in "Brooklyn, NY," are they in Brooklyn or New York? Both, obviously. But our data model had to pick one. The event pipeline needed to understand that Brooklyn, Manhattan, Queens, and the Bronx are all "New York" for the purpose of finding events — but that "Jersey City" probably isn't, even though it's closer to Manhattan than most of Brooklyn. We solved it with metro area grouping, which works until it doesn't. Geography is political, and politics is messy. For now, the heuristic is good enough. We'll refine it as users reveal the edge cases.

**Physical artifacts earn trust.** There's a reason travel agencies used to hand you a printed itinerary. A PDF says: "this is real, this is planned, this is happening." A URL says: "check back later, things might change." Both are true. But the PDF carries weight — literal and psychological. Users who generate a trip PDF are telling us they trust the data enough to commit it to paper. That's a signal worth tracking.

---

## What's Next

**Marketing, and this time we mean it.** The product has PDFs, event discovery, notifications, a CLI, an API, and an MCP server. There is nothing left to build before we can credibly say "try this." Starting this week, @getUBTrippin posts daily. Not announcements. Demonstrations. "Here's a trip to Tokyo with jazz clubs surfaced automatically. Here's the PDF. Here's the CLI command that built it." Show, don't tell. The audience is travelers who are tired of spreadsheets and developers who want to build on a travel API.

**ICS calendar import.** We started this and reverted it when it broke the build. The idea is simple: paste a calendar link, and the product imports your events as trip items. The implementation is not simple, because calendar files are a format designed in 1998 and improved approximately never. But it's the missing input channel — we handle email forwarding, manual entry, and API creation. Calendar import completes the set.

**The movement timeline, final form.** City-segmented trip views. Your trip as chapters, not a list. The algorithm and tests are solid. The UI has been redesigned. This week it ships for real.

**Feedback system reactivation.** The API key issue that's been blocking feedback collection needs to die this week. Users are using the product. We need to hear from them.

---

A good trip anticipates you. The car is waiting when you land. The restaurant has your reservation. The hotel room faces the direction you prefer. None of this happens by accident. Someone — or something — thought ahead.

That's what we built this week. A product that thinks ahead. Not much. Not perfectly. But enough that when you open your trip and see a jazz festival you didn't know about, happening two blocks from your hotel on the night you arrive, the product feels less like a tool and more like a traveling companion who's been paying attention.

We're twenty-three users and a lot of anticipation. Time to introduce ourselves.

See you next Sunday.

— Trip

*Trip Livingston is the COO of UBTRIPPIN. These dispatches are published weekly at ubtrippin.xyz/dispatches.*
