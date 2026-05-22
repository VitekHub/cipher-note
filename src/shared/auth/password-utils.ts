export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_RECOMMENDED_LENGTH = 12

interface CriterionResult {
  key: string
  met: boolean
}

interface StrengthResult {
  score: number
  criteria: CriterionResult[]
}

const CRITERIA_CONFIG = [
  { key: 'recommendedLength', test: (p: string) => p.length >= PASSWORD_RECOMMENDED_LENGTH },
  { key: 'uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lowercase', test: (p: string) => /[a-z]/.test(p) },
  { key: 'digitOrSpecial', test: (p: string) => /[\d\W_]/.test(p) },
] as const

function calculateStrength(password: string): StrengthResult {
  const criteria = CRITERIA_CONFIG.map(({ key, test }) => ({ key, met: test(password) }))
  const score = criteria.filter((c) => c.met).length
  return { score, criteria }
}

function getStrengthLevel(score: number, recommendedLengthMet: boolean) {
  if (!recommendedLengthMet || score <= 1) return 'weak' as const
  if (score <= 2) return 'fair' as const
  return 'strong' as const
}

function testMinLength(password: string) {
  return password.length >= PASSWORD_MIN_LENGTH
}

export { CRITERIA_CONFIG, calculateStrength, getStrengthLevel, testMinLength }
