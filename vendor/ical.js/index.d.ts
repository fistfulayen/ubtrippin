export interface ParsedComponent {
  name: string
  properties: ParsedProperty[]
  components: ParsedComponent[]
}

export interface ParsedProperty {
  name: string
  params: Record<string, string>
  value: string
}

export class Time {
  constructor(rawValue: string, params?: Record<string, string>)
  rawValue: string
  params: Record<string, string>
  timezone: string | null
  year: number | null
  month: number | null
  day: number | null
  hour: number | null
  minute: number | null
  second: number | null
  isDate: boolean
  isUtc: boolean
  toJSDate(): Date
  toString(): string
}

export class Property {
  constructor(data: ParsedProperty)
  name: string
  getParameter(name: string): string | null
  getFirstValue(): string | Time
}

export class Component {
  constructor(jcal: ParsedComponent)
  getAllSubcomponents(name?: string): Component[]
  getFirstProperty(name: string): Property | null
  getFirstPropertyValue(name: string): string | Time | null
}

export class Event {
  constructor(component: Component)
  component: Component
  uid: string | null
  summary: string | null
  description: string | null
  location: string | null
  startDate: Time | null
  endDate: Time | null
}

export function parse(input: string): ParsedComponent

declare const _default: {
  parse: typeof parse
  Component: typeof Component
  Event: typeof Event
  Property: typeof Property
  Time: typeof Time
}

export default _default
