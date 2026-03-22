import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { Trip, TripItem } from '@/types/database'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #f59e0b',
    paddingBottom: 20,
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
  itemKind: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
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

interface ItineraryDocumentProps {
  trip: Trip
  items: TripItem[]
  logoDataUri?: string
}

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
  // If plain HH:MM, return as-is
  if (/^\d{1,2}:\d{2}$/.test(dateStr)) return dateStr
  // Extract local time from ISO string
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
    case 'flight':
      return styles.flightCard
    case 'hotel':
      return styles.hotelCard
    case 'train':
      return styles.trainCard
    case 'car':
      return styles.carCard
    case 'restaurant':
      return styles.restaurantCard
    case 'activity':
      return styles.activityCard
    default:
      return {}
  }
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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

        {/* Timeline */}
        {sortedDates.map((date) => {
          const dayItems = groupedItems.get(date) || []

          // Calculate calendar day number from trip start
          const dayNumber = Math.floor(
            (new Date(date).getTime() - tripStartDate.getTime()) / 86400000
          ) + 1

          // Sort by time within day
          const sortedDayItems = [...dayItems].sort((a, b) => {
            if (!a.start_ts && !b.start_ts) return 0
            if (!a.start_ts) return 1
            if (!b.start_ts) return -1
            return new Date(a.start_ts).getTime() - new Date(b.start_ts).getTime()
          })

          return (
            <View key={date} style={styles.daySection} wrap={false}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayNumber}>Day {dayNumber}</Text>
                <Text style={styles.dayDate}>{formatDate(date)}</Text>
              </View>

              {sortedDayItems.map((item, itemIndex) => {
                const det = item.details_json as Record<string, unknown> | null
                const flightNumber = det?.flight_number as string | undefined

                // Determine if item travelers differ from trip travelers
                const showItemTravelers =
                  item.traveler_names &&
                  item.traveler_names.length > 0 &&
                  !arraysEqual(item.traveler_names, trip.travelers)

                return (
                  <View
                    key={itemIndex}
                    style={[styles.itemCard, getCardStyle(item.kind)]}
                  >
                    <Text style={styles.itemKind}>{kindLabels[item.kind] ?? item.kind.toUpperCase()}</Text>

                    {/* Provider + flight number */}
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
