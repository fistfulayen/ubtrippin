import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
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
    color: '#92400e',
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
  itemConfirmation: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#92400e',
    marginTop: 4,
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

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  // Extract local time directly from ISO string to preserve timezone
  const timeMatch = dateStr.match(/T(\d{2}):(\d{2})/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10)
    const minutes = timeMatch[2]
    return `${hours}:${minutes}`
  }
  // Fallback
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
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

const kindLabels: Record<string, string> = {
  flight: 'FLIGHT',
  hotel: 'HOTEL',
  train: 'TRAIN',
  car: 'CAR RENTAL',
  restaurant: 'RESTAURANT',
  activity: 'ACTIVITY',
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

export function ItineraryDocument({ trip, items }: ItineraryDocumentProps) {
  const groupedItems = groupByDate(items)
  const sortedDates = Array.from(groupedItems.keys()).sort()

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
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
        {sortedDates.map((date, dayIndex) => {
          const dayItems = groupedItems.get(date) || []

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
                <Text style={styles.dayNumber}>Day {dayIndex + 1}</Text>
                <Text style={styles.dayDate}>{formatDate(date)}</Text>
              </View>

              {sortedDayItems.map((item, itemIndex) => (
                <View
                  key={itemIndex}
                  style={[styles.itemCard, getCardStyle(item.kind)]}
                >
                  <Text style={styles.itemKind}>{kindLabels[item.kind]}</Text>
                  <Text style={styles.itemProvider}>
                    {item.provider || item.summary || 'Untitled'}
                  </Text>

                  {/* Time */}
                  {item.start_ts && (
                    <Text style={styles.itemDetail}>
                      {formatTime(item.start_ts)}
                      {item.end_ts && ` - ${formatTime(item.end_ts)}`}
                    </Text>
                  )}

                  {/* Location */}
                  {(item.start_location || item.end_location) && (
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

                  {/* Confirmation code */}
                  {item.confirmation_code && (
                    <Text style={styles.itemConfirmation}>
                      Confirmation: {item.confirmation_code}
                    </Text>
                  )}

                  {/* Travelers */}
                  {item.traveler_names && item.traveler_names.length > 0 && (
                    <Text style={styles.itemDetail}>
                      Travelers: {item.traveler_names.join(', ')}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by UBTRIPPIN.XYZ
          </Text>
          <Text style={styles.footerText}>
            {new Date().toLocaleDateString()}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
