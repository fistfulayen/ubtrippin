import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Path,
} from '@react-pdf/renderer'
import type { Trip, TripItem } from '@/types/database'

const ICON_COLOR = '#6b7280'
const ICON_SIZE = 12

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  coverHero: {
    width: 515,
    height: 180,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginBottom: 15,
    objectFit: 'cover',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #f59e0b',
    borderTop: '2 solid #4338ca',
    paddingBottom: 20,
    paddingTop: 10,
  },
  headerLogo: {
    height: 40,
    width: 40,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  travelers: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 8,
  },
  summaryBlock: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#1a1a1a',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  summaryText: {
    fontSize: 9,
    color: '#4b5563',
    marginLeft: 4,
  },
  daySection: {
    marginBottom: 20,
  },
  dayHeader: {
    backgroundColor: '#fef3c7',
    padding: 10,
    marginBottom: 10,
    borderRadius: 4,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4338ca',
  },
  dayDate: {
    fontSize: 10,
    color: '#78350f',
  },
  itemCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    marginBottom: 8,
    borderRadius: 4,
    borderLeft: '3 solid #d1d5db',
  },
  itemKindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemKind: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 3,
  },
  itemProvider: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 9,
    color: '#4b5563',
    marginBottom: 2,
  },
  itemDetailSmall: {
    fontSize: 8,
    color: '#9ca3af',
    marginBottom: 2,
  },
  itemConfirmationWrapper: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: 4,
  },
  itemConfirmation: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4338ca',
  },
  itemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  arrow: {
    color: '#9ca3af',
    marginHorizontal: 4,
  },
  notesSection: {
    marginBottom: 20,
  },
  notesHeader: {
    backgroundColor: '#f3f4f6',
    padding: 10,
    marginBottom: 10,
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  notesBody: {
    fontSize: 10,
    color: '#4b5563',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #e5e7eb',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLogo: {
    height: 20,
    width: 20,
    marginRight: 4,
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  flightCard: {
    borderLeftColor: '#3b82f6',
  },
  hotelCard: {
    borderLeftColor: '#8b5cf6',
  },
  trainCard: {
    borderLeftColor: '#10b981',
  },
  carCard: {
    borderLeftColor: '#f97316',
  },
  restaurantCard: {
    borderLeftColor: '#ef4444',
  },
  activityCard: {
    borderLeftColor: '#ec4899',
  },
})

// ─── SVG Icon helpers ──────────────────────────────────────────────────────────
// Each icon uses a 24×24 viewBox with a single Material Design path, rendered at
// ICON_SIZE × ICON_SIZE points. All icons are monochrome (ICON_COLOR fill).

function KindIcon({ kind }: { kind: string }) {
  const fill = ICON_COLOR
  const s = ICON_SIZE
  switch (kind) {
    case 'flight':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path fill={fill} d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </Svg>
      )
    case 'hotel':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path fill={fill} d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z" />
        </Svg>
      )
    case 'car':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path fill={fill} d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
        </Svg>
      )
    case 'train':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path fill={fill} d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </Svg>
      )
    case 'restaurant':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path fill={fill} d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
        </Svg>
      )
    case 'activity':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path fill={fill} d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </Svg>
      )
    case 'ticket':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path fill={fill} d="M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-1.99.9-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2z" />
        </Svg>
      )
    default: // 'other'
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path fill={fill} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </Svg>
      )
  }
}

// ─── Date / time helpers ───────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  if (/^\d{1,2}:\d{2}$/.test(dateStr)) return dateStr
  const timeMatch = dateStr.match(/T(\d{2}):(\d{2})/)
  if (timeMatch) {
    return `${parseInt(timeMatch[1], 10)}:${timeMatch[2]}`
  }
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function getItemLocalTimes(item: { start_ts: string | null; end_ts: string | null; details: Record<string, unknown> | null }): [string, string] {
  const details = item.details || {}
  const startTime = (details.departure_local_time as string) || (details.check_in_time as string) || formatTime(item.start_ts)
  const endTime = (details.arrival_local_time as string) || (details.check_out_time as string) || formatTime(item.end_ts)
  return [startTime || '', endTime || '']
}

// Phase 3.2 — flight times with optional timezone labels
function formatFlightTimes(item: TripItem): string | null {
  const det = item.details_json as Record<string, unknown> | null
  const depTime = (det?.departure_local_time as string) || formatTime(item.start_ts)
  const arrTime = (det?.arrival_local_time as string) || formatTime(item.end_ts)
  if (!depTime && !arrTime) return null
  const depTZ = det?.departure_timezone as string | undefined
  const arrTZ = det?.arrival_timezone as string | undefined
  const depStr = depTime ? (depTZ ? `${depTime} (${depTZ})` : depTime) : ''
  const arrStr = arrTime ? (arrTZ ? `${arrTime} (${arrTZ})` : arrTime) : ''
  if (depStr && arrStr) return `${depStr} → ${arrStr}`
  return depStr || arrStr || null
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  const startDate = new Date(start)
  const startStr = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  if (!end || start === end) {
    return `${startStr}, ${startDate.getFullYear()}`
  }
  const endDate = new Date(end)
  const endStr = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startStr} - ${endStr}`
}

function groupByDate(items: TripItem[]): Map<string, TripItem[]> {
  const grouped = new Map<string, TripItem[]>()
  for (const item of items) {
    const date = item.start_date
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date)!.push(item)
  }
  return grouped
}

function arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const arrA = a || []
  const arrB = b || []
  if (arrA.length !== arrB.length) return false
  const sortedA = [...arrA].sort()
  const sortedB = [...arrB].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}

// Route string used in the quick reference summary (e.g. "LTN → MXP")
function getSummaryRoute(item: TripItem): string {
  const start = item.start_location
  const end = item.end_location
  if (start && end && end !== start) return `${start} → ${end}`
  if (start) return start
  if (end) return end
  return ''
}

const kindLabels: Record<string, string> = {
  flight: 'FLIGHT',
  hotel: 'HOTEL',
  train: 'TRAIN',
  car: 'CAR RENTAL',
  restaurant: 'RESTAURANT',
  activity: 'ACTIVITY',
  ticket: 'TICKET',
  other: 'OTHER',
}

function getCardStyle(kind: string) {
  switch (kind) {
    case 'flight':    return styles.flightCard
    case 'hotel':     return styles.hotelCard
    case 'train':     return styles.trainCard
    case 'car':       return styles.carCard
    case 'restaurant': return styles.restaurantCard
    case 'activity':  return styles.activityCard
    default:          return {}
  }
}

// ─── Main component ────────────────────────────────────────────────────────────

interface ItineraryDocumentProps {
  trip: Trip
  items: TripItem[]
  logoDataUri?: string
}

export function ItineraryDocument({ trip, items, logoDataUri }: ItineraryDocumentProps) {
  const groupedItems = groupByDate(items)
  const sortedDates = Array.from(groupedItems.keys()).sort()

  const tripStartDate = trip.start_date
    ? new Date(trip.start_date)
    : sortedDates.length > 0 ? new Date(sortedDates[0]) : new Date()

  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const itemsWithConfirmation = items.filter(item => item.confirmation_code)

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* 2.0 — Cover hero image */}
        {trip.cover_image_url && (
          <Image style={styles.coverHero} src={trip.cover_image_url} />
        )}

        {/* Header */}
        <View style={styles.header}>
          {logoDataUri && (
            <Image style={styles.headerLogo} src={logoDataUri} />
          )}
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.subtitle}>
            {formatDateRange(trip.start_date, trip.end_date)}
          </Text>
          {trip.primary_location && (
            <Text style={styles.subtitle}>{trip.primary_location}</Text>
          )}
          {trip.travelers && trip.travelers.length > 0 && (
            <Text style={styles.travelers}>
              Travelers: {trip.travelers.join(', ')}
            </Text>
          )}
        </View>

        {/* 2.2 — Quick reference summary block */}
        {itemsWithConfirmation.length > 0 && (
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryTitle}>Quick Reference</Text>
            {itemsWithConfirmation.map((item, idx) => {
              const route = getSummaryRoute(item)
              const provider = item.provider || item.summary || ''
              const label = [provider, route].filter(Boolean).join(' ')
              const text = label
                ? `${label}: ${item.confirmation_code}`
                : item.confirmation_code!
              return (
                <View key={idx} style={styles.summaryRow}>
                  <KindIcon kind={item.kind} />
                  <Text style={styles.summaryText}>{text}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Timeline */}
        {sortedDates.map((date) => {
          const dayItems = groupedItems.get(date) || []

          const dayNumber = Math.floor(
            (new Date(date).getTime() - tripStartDate.getTime()) / 86400000
          ) + 1

          const sortedDayItems = [...dayItems].sort((a, b) => {
            if (!a.start_ts && !b.start_ts) return 0
            if (!a.start_ts) return 1
            if (!b.start_ts) return -1
            return new Date(a.start_ts).getTime() - new Date(b.start_ts).getTime()
          })

          return (
            // 2.4 — wrap removed so day sections can break across pages
            <View key={date} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayNumber}>Day {dayNumber}</Text>
                <Text style={styles.dayDate}>{formatDate(date)}</Text>
              </View>

              {sortedDayItems.map((item, itemIndex) => {
                const det = item.details_json as Record<string, unknown> | null
                const flightNumber = det?.flight_number as string | undefined

                const showItemTravelers =
                  item.traveler_names &&
                  item.traveler_names.length > 0 &&
                  !arraysEqual(item.traveler_names, trip.travelers)

                // 3.3 — contact info from details_json
                const contactPhone = det?.contact_phone as string | undefined
                const address = det?.address as string | undefined

                return (
                  // 2.4 — minPresenceAhead keeps orphaned cards from appearing alone at page bottom
                  <View
                    key={itemIndex}
                    style={[styles.itemCard, getCardStyle(item.kind)]}
                    minPresenceAhead={50}
                  >
                    {/* 2.1 — Icon + kind label row */}
                    <View style={styles.itemKindRow}>
                      <KindIcon kind={item.kind} />
                      <Text style={styles.itemKind}>
                        {kindLabels[item.kind] ?? item.kind.toUpperCase()}
                      </Text>
                    </View>

                    {/* Provider + flight/train number */}
                    <Text style={styles.itemProvider}>
                      {item.provider || item.summary || 'Untitled'}
                      {item.kind === 'flight' && flightNumber ? ` — ${flightNumber}` : ''}
                    </Text>

                    {/* Kind-specific details */}
                    {item.kind === 'car' ? (
                      (() => {
                        const pickupDate = item.start_date ? formatDateShort(item.start_date) : ''
                        const dropoffDate = item.end_date ? formatDateShort(item.end_date) : ''
                        const pickupTime = formatTime(item.start_ts) || (det?.pickup_time as string) || ''
                        const dropoffTime = formatTime(item.end_ts) || (det?.dropoff_time as string) || ''
                        const pickupLocation = item.start_location || (det?.pickup_location as string) || ''
                        const dropoffLocation = item.end_location || (det?.dropoff_location as string) || ''
                        return (
                          <>
                            <Text style={styles.itemDetail}>
                              Pickup: {pickupDate}{pickupTime ? ` at ${pickupTime}` : ''}{pickupLocation ? ` — ${pickupLocation}` : ''}
                            </Text>
                            <Text style={styles.itemDetail}>
                              Drop-off: {dropoffDate}{dropoffTime ? ` at ${dropoffTime}` : ''}{dropoffLocation ? ` — ${dropoffLocation}` : ''}
                            </Text>
                          </>
                        )
                      })()
                    ) : item.kind === 'hotel' ? (
                      (() => {
                        const checkinDate = item.start_date ? formatDateShort(item.start_date) : ''
                        const checkoutDate = item.end_date ? formatDateShort(item.end_date) : ''
                        const nights =
                          item.start_date && item.end_date
                            ? Math.round(
                                (new Date(item.end_date).getTime() - new Date(item.start_date).getTime()) /
                                  86400000
                              )
                            : null
                        return (
                          <>
                            <Text style={styles.itemDetail}>Check-in: {checkinDate}</Text>
                            <Text style={styles.itemDetail}>
                              Check-out: {checkoutDate}
                              {nights !== null && nights > 0 ? `  (${nights} night${nights !== 1 ? 's' : ''})` : ''}
                            </Text>
                          </>
                        )
                      })()
                    ) : item.kind === 'flight' ? (
                      // 3.2 — flight times with timezone labels
                      (() => {
                        const timeStr = formatFlightTimes(item)
                        if (!timeStr) return null
                        return <Text style={styles.itemDetail}>{timeStr}</Text>
                      })()
                    ) : (
                      (() => {
                        if (!item.start_ts && !det?.departure_local_time) return null
                        const [start, end] = getItemLocalTimes({ start_ts: item.start_ts, end_ts: item.end_ts, details: det })
                        return (
                          <Text style={styles.itemDetail}>
                            {start}
                            {end && ` - ${end}`}
                          </Text>
                        )
                      })()
                    )}

                    {/* Location (skip for car — already in pickup/drop-off lines) */}
                    {item.kind !== 'car' && (item.start_location || item.end_location) && (
                      <View style={styles.itemLocation}>
                        <Text style={styles.itemDetail}>
                          {item.start_location}
                          {item.end_location &&
                            item.end_location !== item.start_location && (
                              <>
                                <Text style={styles.arrow}> → </Text>
                                {item.end_location}
                              </>
                            )}
                        </Text>
                      </View>
                    )}

                    {/* Confirmation code — visually prominent */}
                    {item.confirmation_code && (
                      <View style={styles.itemConfirmationWrapper}>
                        <Text style={styles.itemConfirmation}>
                          Confirmation: {item.confirmation_code}
                        </Text>
                      </View>
                    )}

                    {/* 3.3 — Contact info for hotels and cars */}
                    {address && (
                      <Text style={styles.itemDetailSmall}>{address}</Text>
                    )}
                    {contactPhone && (
                      <Text style={styles.itemDetailSmall}>{contactPhone}</Text>
                    )}

                    {/* Travelers — only if different from trip-level travelers */}
                    {showItemTravelers && (
                      <Text style={styles.itemDetail}>
                        Travelers: {item.traveler_names!.join(', ')}
                      </Text>
                    )}
                  </View>
                )
              })}
            </View>
          )
        })}

        {/* 3.1 — Trip notes section */}
        {trip.notes && trip.notes.trim() && (
          <View style={styles.notesSection}>
            <View style={styles.notesHeader}>
              <Text style={styles.notesTitle}>Trip Notes</Text>
            </View>
            <Text style={styles.notesBody}>{trip.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerLeft}>
            {logoDataUri && (
              <Image style={styles.footerLogo} src={logoDataUri} />
            )}
            <Text style={styles.footerText}>UBTRIPPIN.XYZ</Text>
          </View>
          <Text style={styles.footerText}>Generated {generatedDate}</Text>
        </View>
      </Page>
    </Document>
  )
}
