function unfoldLines(input) {
  const lines = String(input || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const unfolded = []

  for (const line of lines) {
    if (!line) continue
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1)
      continue
    }
    unfolded.push(line)
  }

  return unfolded
}

function parseContentLine(line) {
  let colonIndex = -1
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') inQuotes = !inQuotes
    if (char === ':' && !inQuotes) {
      colonIndex = i
      break
    }
  }

  if (colonIndex === -1) {
    return {
      name: line.trim().toUpperCase(),
      params: {},
      value: '',
    }
  }

  const head = line.slice(0, colonIndex)
  const value = line.slice(colonIndex + 1)
  const [name, ...rawParams] = head.split(';')
  const params = {}

  for (const entry of rawParams) {
    const eqIndex = entry.indexOf('=')
    if (eqIndex === -1) continue
    const key = entry.slice(0, eqIndex).trim().toUpperCase()
    const rawValue = entry.slice(eqIndex + 1).trim()
    params[key] = rawValue.replace(/^"|"$/g, '')
  }

  return {
    name: name.trim().toUpperCase(),
    params,
    value,
  }
}

function parseBasicDate(rawValue) {
  if (!/^\d{8}$/.test(rawValue)) return null
  return {
    year: Number(rawValue.slice(0, 4)),
    month: Number(rawValue.slice(4, 6)),
    day: Number(rawValue.slice(6, 8)),
    hour: 0,
    minute: 0,
    second: 0,
    isDate: true,
  }
}

function parseBasicDateTime(rawValue) {
  const match = rawValue.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/
  )
  if (!match) return null

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || '0'),
    isDate: false,
    isUtc: Boolean(match[7]),
  }
}

class Time {
  constructor(rawValue, params) {
    this.rawValue = rawValue || ''
    this.params = params || {}
    this.timezone = this.params.TZID || null

    const dateOnly = parseBasicDate(this.rawValue)
    const dateTime = parseBasicDateTime(this.rawValue)
    const parsed = dateOnly || dateTime

    this.year = parsed ? parsed.year : null
    this.month = parsed ? parsed.month : null
    this.day = parsed ? parsed.day : null
    this.hour = parsed ? parsed.hour : null
    this.minute = parsed ? parsed.minute : null
    this.second = parsed ? parsed.second : null
    this.isDate = parsed ? parsed.isDate : false
    this.isUtc = parsed ? Boolean(parsed.isUtc) : false
  }

  toJSDate() {
    if (
      this.year === null ||
      this.month === null ||
      this.day === null
    ) {
      return new Date(Number.NaN)
    }

    return new Date(
      Date.UTC(
        this.year,
        this.month - 1,
        this.day,
        this.hour || 0,
        this.minute || 0,
        this.second || 0
      )
    )
  }

  toString() {
    return this.rawValue
  }
}

class Property {
  constructor(data) {
    this.data = data
    this.name = data.name
  }

  getParameter(name) {
    return this.data.params[String(name || '').toUpperCase()] || null
  }

  getFirstValue() {
    const timeNames = new Set(['DTSTART', 'DTEND', 'DUE', 'RECURRENCE-ID'])
    if (timeNames.has(this.data.name)) {
      return new Time(this.data.value, this.data.params)
    }
    return this.data.value
  }
}

class Component {
  constructor(jcal) {
    this.jcal = jcal
  }

  getAllSubcomponents(name) {
    const wanted = name ? String(name).toUpperCase() : null
    const components = this.jcal.components || []
    return components
      .filter((component) => (wanted ? component.name === wanted : true))
      .map((component) => new Component(component))
  }

  getFirstProperty(name) {
    const wanted = String(name || '').toUpperCase()
    const property = (this.jcal.properties || []).find((entry) => entry.name === wanted)
    return property ? new Property(property) : null
  }

  getFirstPropertyValue(name) {
    const property = this.getFirstProperty(name)
    return property ? property.getFirstValue() : null
  }
}

class Event {
  constructor(component) {
    this.component = component
    this.uid = component.getFirstPropertyValue('uid')
    this.summary = component.getFirstPropertyValue('summary')
    this.description = component.getFirstPropertyValue('description')
    this.location = component.getFirstPropertyValue('location')
    this.startDate = component.getFirstPropertyValue('dtstart')
    this.endDate = component.getFirstPropertyValue('dtend')
  }
}

function parse(input) {
  const root = { name: 'ROOT', properties: [], components: [] }
  const stack = [root]

  for (const line of unfoldLines(input)) {
    const parsed = parseContentLine(line)
    if (parsed.name === 'BEGIN') {
      const component = {
        name: String(parsed.value || '').trim().toUpperCase(),
        properties: [],
        components: [],
      }
      stack[stack.length - 1].components.push(component)
      stack.push(component)
      continue
    }

    if (parsed.name === 'END') {
      if (stack.length > 1) stack.pop()
      continue
    }

    stack[stack.length - 1].properties.push(parsed)
  }

  return root.components[0] || { name: 'VCALENDAR', properties: [], components: [] }
}

const api = {
  parse,
  Component,
  Event,
  Property,
  Time,
}

module.exports = api
module.exports.default = api
