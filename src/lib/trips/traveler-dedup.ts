const HONORIFICS = /\b(mr|mrs|ms|miss|mx|dr|prof|sir|madam)\.?\b/gi
const SUFFIXES = /\b(jr|sr|ii|iii|iv|phd|md|dds|esq)\.?\b/gi

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) =>
      part
        .split('-')
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join('-')
    )
    .join(' ')
}

function stripDecorations(value: string) {
  return normalizeWhitespace(
    value
      .replace(/,/g, ' ')
      .replace(HONORIFICS, ' ')
      .replace(SUFFIXES, ' ')
      .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
  )
}

function normalizedTokens(value: string) {
  return stripDecorations(value)
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
}

function canonicalizeName(value: string) {
  return titleCase(stripDecorations(value))
}

function firstAndLast(tokens: string[]) {
  if (tokens.length === 0) return ''
  if (tokens.length === 1) return tokens[0]
  return `${tokens[0]} ${tokens[tokens.length - 1]}`
}

function tokenSubset(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return false
  const smaller = left.length <= right.length ? left : right
  const larger = left.length <= right.length ? right : left
  return smaller.every((token) => larger.includes(token))
}

function isSuffixExtension(left: string, right: string) {
  const shorter = left.length <= right.length ? left : right
  const longer = left.length <= right.length ? right : left
  return longer.startsWith(shorter) && longer.length > shorter.length
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0
  if (left.length === 0) return right.length
  if (right.length === 0) return left.length

  const rows = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let previous = i - 1
    rows[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const current = rows[j]
      rows[j] = Math.min(
        rows[j] + 1,
        rows[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1)
      )
      previous = current
    }
  }
  return rows[right.length]
}

function areSimilar(left: string, right: string) {
  const leftTokens = normalizedTokens(left)
  const rightTokens = normalizedTokens(right)
  if (leftTokens.length === 0 || rightTokens.length === 0) return false

  if (firstAndLast(leftTokens) === firstAndLast(rightTokens)) return true
  if (tokenSubset(leftTokens, rightTokens)) return true

  if (leftTokens.length >= 2 && rightTokens.length >= 2) {
    const leftFirst = leftTokens[0]
    const rightFirst = rightTokens[0]
    const leftLast = leftTokens[leftTokens.length - 1]
    const rightLast = rightTokens[rightTokens.length - 1]

    if (leftLast === rightLast) {
      if (isSuffixExtension(leftFirst, rightFirst)) return false
      return levenshtein(leftFirst, rightFirst) <= 1
    }
  }

  const leftJoined = leftTokens.join(' ')
  const rightJoined = rightTokens.join(' ')
  return leftTokens.length === 1 && rightTokens.length === 1 && levenshtein(leftJoined, rightJoined) <= 2
}

export function deduplicateTravelers(names: string[]): string[] {
  const groups: string[][] = []

  for (const rawName of names) {
    const canonical = canonicalizeName(rawName)
    if (!canonical) continue

    const group = groups.find((existing) => existing.some((candidate) => areSimilar(candidate, canonical)))
    if (group) {
      group.push(canonical)
      continue
    }

    groups.push([canonical])
  }

  return groups.map((group) =>
    [...group].sort((left, right) => {
      if (right.length !== left.length) return right.length - left.length
      return left.localeCompare(right)
    })[0]
  )
}
