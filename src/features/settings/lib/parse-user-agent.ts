// Consider replacing with the 'lightua' npm package for broader coverage if needed.

export interface ParsedUserAgent {
  browser: string
  os: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
}

const BROWSER_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /Edg\/([\d.]+)/i, name: 'Edge' },
  { pattern: /OPR\/([\d.]+)/i, name: 'Opera' },
  { pattern: /Chrome\/([\d.]+)/i, name: 'Chrome' },
  { pattern: /Firefox\/([\d.]+)/i, name: 'Firefox' },
  { pattern: /Safari\/([\d.]+)/i, name: 'Safari' },
]

const OS_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /Windows NT\s([\d.]+)/i, name: 'Windows' },
  { pattern: /Mac OS X\s([\d._]+)/i, name: 'macOS' },
  { pattern: /Android\s([\d.]+)/i, name: 'Android' },
  { pattern: /iPhone OS\s([\d_]+)/i, name: 'iOS' },
  { pattern: /iPad.*OS\s([\d_]+)/i, name: 'iPadOS' },
  { pattern: /CrOS/i, name: 'ChromeOS' },
  { pattern: /Linux/i, name: 'Linux' },
]

function detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  const ua = userAgent.toLowerCase()

  if (/tablet|ipad|android(?!.*mobile)/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod/i.test(ua)) return 'mobile'
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'desktop'

  return 'unknown'
}

/**
 * Parse a User-Agent string into browser, OS, and device type.
 * Returns "Unknown" values when the UA is null or unrecognized.
 */
export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown', deviceType: 'unknown' }
  }

  let browser = 'Unknown'
  for (const { pattern, name } of BROWSER_PATTERNS) {
    if (pattern.test(userAgent)) {
      browser = name
      break
    }
  }

  let os = 'Unknown'
  for (const { pattern, name } of OS_PATTERNS) {
    if (pattern.test(userAgent)) {
      os = name
      break
    }
  }

  return {
    browser,
    os,
    deviceType: detectDeviceType(userAgent),
  }
}

/**
 * Format an IP address for display, masking the last octet of IPv4
 * and truncating IPv6 for privacy.
 */
export function formatIP(ip: string | null): string {
  if (!ip) return '—'

  // IPv4: mask last octet
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const parts = ip.split('.')
    return `${parts[0]}.${parts[1]}.${parts[2]}.*`
  }

  // IPv6: show first 4 segments
  if (ip.includes(':')) {
    const segments = ip.split(':')
    return segments.length > 4 ? `${segments.slice(0, 4).join(':')}::*` : ip
  }

  return ip
}
