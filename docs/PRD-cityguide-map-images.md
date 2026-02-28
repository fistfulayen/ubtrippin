# PRD: City Guide Map & Cover Image Selection

## Overview
The map in city guides currently shows up empty, and users cannot choose a cover image for their city guide. This PRD fixes the map display and adds cover image selection.

## User Stories
1. As a user viewing a city guide, I want to see an interactive map showing the locations mentioned in the guide (hotels, restaurants, attractions).
2. As a user creating/editing a city guide, I want to choose a cover image that represents the city.

## Part 1: Fix Empty Map

### Problem
The map component in city guides renders but shows no content — likely missing coordinates, API key issue, or data not being passed correctly.

### Investigation Checklist
- [ ] Verify map library API key (Google Maps, Mapbox, etc.)
- [ ] Check if coordinates are being extracted from trip items
- [ ] Verify map component is receiving location data
- [ ] Check browser console for JavaScript errors

### Required Fix

1. **Extract coordinates from trip items:**
   - Hotels often have lat/lng in `details_json`
   - Restaurants/activities may need geocoding from address
   - Store coordinates in `city_guide_locations` table or similar

2. **Map component updates:**
   File: `src/components/city-guides/city-guide-map.tsx`
   - Ensure API key is configured
   - Accept array of locations with `{ name, lat, lng, type, description }`
   - Show markers for each location
   - Show info window on marker click
   - Fit map bounds to show all markers

3. **Geocoding for missing coordinates:**
   - If an item has address but no lat/lng, geocode on-the-fly or during city guide generation
   - Cache geocoded results to avoid repeated API calls

### Map Display

```
┌─────────────────────────────────────────────┐
│  🗺️ Map                                     │
│                                             │
│    ┌───┐                                    │
│    │ 🏨│ Hotel Name                         │
│    └───┘                                    │
│              ┌───┐                          │
│              │ 🍴│ Restaurant               │
│              └───┘              ┌───┐       │
│                                 │ ⭐│ Attraction
│                                 └───┘       │
└─────────────────────────────────────────────┘
```

Marker types:
- Hotel: 🏨 Blue marker
- Restaurant: 🍴 Red marker  
- Activity/Attraction: ⭐ Green marker

## Part 2: Cover Image Selection

### Feature
Allow users to choose a cover image for their city guide.

### Implementation

1. **Image sources:**
   - Unsplash search by city name (default)
   - User upload (optional)
   - Extracted from trip items (if available)

2. **UI for cover selection:**
   File: `src/components/city-guides/city-guide-editor.tsx`
   
   Add a "Cover Image" section:
   ```
   Cover Image
   ┌─────────────────────────────┐
   │                             │
   │   [Current Image Preview]   │
   │                             │
   └─────────────────────────────┘
   [Change Image]  [Upload Own]
   
   Suggested images:
   ┌────┐ ┌────┐ ┌────┐ ┌────┐
   │ 🖼️ │ │ 🖼️ │ │ 🖼️ │ │ 🖼️ │
   └────┘ └────┘ └────┘ └────┘
   ```

3. **Database changes:**
   ```sql
   ALTER TABLE city_guides ADD COLUMN cover_image_url text;
   ALTER TABLE city_guides ADD COLUMN cover_image_source text; -- 'unsplash', 'upload', 'item'
   ```

4. **Unsplash integration:**
   - Use existing `UNSPLASH_ACCESS_KEY`
   - Search by city name + "travel" or "landmark"
   - Show 4-8 suggestions
   - Store Unsplash photo ID and attribution

5. **User upload (optional):**
   - Accept image file
   - Upload to Supabase Storage
   - Generate thumbnail

### API Endpoints

**GET /api/v1/city-guides/suggestions?city={cityName}**
Return suggested cover images from Unsplash:
```json
{
  "suggestions": [
    { "id": "unsplash_abc", "url": "https://images.unsplash.com/...", "author": "Name", "authorUrl": "..." }
  ]
}
```

**PATCH /api/v1/city-guides/:id**
Update city guide including cover image:
```json
{ "coverImageUrl": "...", "coverImageSource": "unsplash" }
```

## UI/UX Details

- Map should be collapsible/expandable
- Show "No locations to display" if no coordinates available
- Cover image should be 16:9 aspect ratio
- On city guide cards (list view), show cover image as thumbnail
- Attribution required for Unsplash images

## Success Criteria

- [ ] Map displays with markers for all locations with coordinates
- [ ] Map bounds fit all markers
- [ ] Clicking marker shows location name and details
- [ ] User can select a cover image from Unsplash suggestions
- [ ] Cover image displays on city guide card and detail page
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)

## Commit Message
`feat: city guide map with location markers and cover image selection`
