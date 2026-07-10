import { describe, it, expect } from 'vitest'
import { parseUserAgent, formatIP } from '@/features/settings/lib/parse-user-agent'

describe('parseUserAgent', () => {
  it('returns Unknown values for null input', () => {
    const result = parseUserAgent(null)
    expect(result).toEqual({ browser: 'Unknown', os: 'Unknown', deviceType: 'unknown' })
  })

  it('parses Chrome on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    const result = parseUserAgent(ua)
    expect(result.browser).toBe('Chrome')
    expect(result.os).toBe('Windows')
    expect(result.deviceType).toBe('desktop')
  })

  it('parses Safari on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    const result = parseUserAgent(ua)
    expect(result.browser).toBe('Safari')
    expect(result.os).toBe('macOS')
    expect(result.deviceType).toBe('desktop')
  })

  it('parses Chrome on Android mobile', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36'
    const result = parseUserAgent(ua)
    expect(result.browser).toBe('Chrome')
    expect(result.os).toBe('Android')
    expect(result.deviceType).toBe('mobile')
  })

  it('parses Safari on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    const result = parseUserAgent(ua)
    expect(result.browser).toBe('Safari')
    expect(result.os).toBe('iOS')
    expect(result.deviceType).toBe('mobile')
  })

  it('parses Edge on Windows (Edge must match before Chrome)', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
    const result = parseUserAgent(ua)
    expect(result.browser).toBe('Edge')
    expect(result.os).toBe('Windows')
    expect(result.deviceType).toBe('desktop')
  })

  it('parses Firefox on Linux', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'
    const result = parseUserAgent(ua)
    expect(result.browser).toBe('Firefox')
    expect(result.os).toBe('Linux')
    expect(result.deviceType).toBe('desktop')
  })

  it('detects iPad as tablet', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    const result = parseUserAgent(ua)
    expect(result.os).toBe('iPadOS')
    expect(result.deviceType).toBe('tablet')
  })

  it('detects ChromeOS', () => {
    const ua =
      'Mozilla/5.0 (X11; CrOS x86_64 14526.89.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Safari/537.36'
    const result = parseUserAgent(ua)
    expect(result.os).toBe('ChromeOS')
    expect(result.deviceType).toBe('desktop')
  })

  it('detects Opera', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/112.0.0.0'
    const result = parseUserAgent(ua)
    expect(result.browser).toBe('Opera')
  })

  it('returns unknown for unrecognizable UA strings', () => {
    const result = parseUserAgent('SomeBot/1.0')
    expect(result.browser).toBe('Unknown')
    expect(result.os).toBe('Unknown')
    expect(result.deviceType).toBe('unknown')
  })
})

describe('formatIP', () => {
  it('masks the last octet of IPv4 addresses', () => {
    expect(formatIP('192.168.1.42')).toBe('192.168.1.*')
  })

  it('truncates long IPv6 addresses', () => {
    expect(formatIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3:0000::*')
  })

  it('returns short IPv6 addresses as-is', () => {
    expect(formatIP('::1')).toBe('::1')
  })

  it('returns — for null', () => {
    expect(formatIP(null)).toBe('—')
  })

  it('returns non-IP strings as-is', () => {
    expect(formatIP('unknown')).toBe('unknown')
  })
})
