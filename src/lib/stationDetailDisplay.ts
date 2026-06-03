import { formatOperatorPhoneDisplay } from './operatorContact'
import type { StationDetail } from '../types/irve'

export function formatPaymentMethods(detail: StationDetail): string | null {
  const methods: string[] = []
  if (detail.paiement_cb) methods.push('CB')
  if (detail.paiement_acte) methods.push('App')
  if (detail.paiement_autre) methods.push('Autre')
  return methods.length > 0 ? methods.join(', ') : null
}

export function formatOperatorPhone(telephone: string | null): string | null {
  return formatOperatorPhoneDisplay(telephone)
}
