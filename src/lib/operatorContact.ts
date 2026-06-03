export type OperatorContactIssue = 'missing' | 'placeholder' | 'invalid' | 'ok'

/** Chiffres nationaux FR (0X…) à partir d’une valeur API (`tel:+33-…`, espaces, etc.). */
export function normalizeOperatorPhoneDigits(
  telephone: string | null | undefined,
): string | null {
  if (!telephone?.trim()) return null

  const raw = telephone.trim().replace(/^tel:/i, '')
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('33') && digits.length >= 11) {
    return `0${digits.slice(2)}`
  }

  if (digits.startsWith('0')) return digits

  return digits
}

export function formatOperatorPhoneDisplay(telephone: string | null | undefined): string | null {
  if (!telephone?.trim()) return null
  return telephone.replace(/^tel:/i, '').replace(/\+33-/g, '0').replace(/-/g, ' ')
}

/** Ex. `tel:+33-1-00-00-00-00` → placeholder. */
export function classifyOperatorContact(
  telephone: string | null | undefined,
): OperatorContactIssue {
  const digits = normalizeOperatorPhoneDigits(telephone)
  if (!digits) return 'missing'

  if (digits.length < 10 || digits.length > 10) {
    return 'invalid'
  }

  if (!/^0[1-9]\d{8}$/.test(digits)) {
    return 'invalid'
  }

  if (/^(\d)\1{9}$/.test(digits)) {
    return 'placeholder'
  }

  if (/000000/.test(digits) || /^0+1?0{8,}$/.test(digits)) {
    return 'placeholder'
  }

  if (/^(0123456789|0987654321|0600000000|0100000000)$/.test(digits)) {
    return 'placeholder'
  }

  return 'ok'
}

export function isSuspiciousOperatorContact(telephone: string | null | undefined): boolean {
  const issue = classifyOperatorContact(telephone)
  return issue === 'placeholder' || issue === 'invalid'
}
