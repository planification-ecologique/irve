export type ConnectorType = 'ccs' | 'type2' | 'chademo' | 'ef'

export interface StationSummary {
  max_power: number
  total_power: number
  has_prise_type_ef: boolean
  has_prise_type_2: boolean
  has_prise_type_combo_ccs: boolean
  has_prise_type_chademo: boolean
  has_prise_type_autre: boolean
  price_per_kwh: number | null
  pricing_value: number | null
  pricing_dimension: string | null
  pricing_unit: string | null
  pricing_status: string
  pricing_headline: string | null
  applicable_tariff_count: number
}

export interface DynamicSummary {
  pdcs_with_dynamic_count: number
  en_service_count: number
  libre_count: number
  occupied_count: number
  reserved_count: number
  available_count: number
}

export interface PdcDynamic {
  id_pdc_itinerance: string
  horodatage: string | null
  etat_pdc: string | null
  occupation_pdc: string | null
  etat_prise_type_ef: string | null
  etat_prise_type_2: string | null
  etat_prise_type_combo_ccs: string | null
  etat_prise_type_chademo: string | null
}

export interface PdcDetail {
  id_pdc_itinerance: string
  puissance_nominale: number
  prise_type_ef: boolean
  prise_type_2: boolean
  prise_type_combo_ccs: boolean
  prise_type_chademo: boolean
  prise_type_autre: boolean
  dynamic: PdcDynamic | null
}

export interface Station {
  station_key: string
  id: number
  lat: number
  lng: number
  id_station_itinerance: string
  nom_station: string
  nom_amenageur: string
  nom_operateur: string
  condition_acces: string
  accessibilite_pmr: string
  gratuit: boolean | null
  paiement_acte: boolean
  paiement_cb: boolean | null
  reservation: boolean
  station_deux_roues: boolean
  pdc_count: number
  pdc_itinerance_ids: string[]
  has_tarification: boolean
  summary: StationSummary
  dynamic_summary: DynamicSummary
}

export interface IrvePointsResponse {
  stations: Station[]
  total: number
  updatedAt: string
}

/** Détail station QualiCharge (`/api/irve/stations/{id}/`). */
export interface StationDetail {
  id_station_itinerance: string
  nom_station: string
  adresse_station: string | null
  implantation_station: string | null
  code_insee_commune: string | null
  horaires: string | null
  telephone_operateur: string | null
  restriction_gabarit: string | null
  cable_t2_attache: boolean | null
  paiement_acte: boolean
  paiement_cb: boolean | null
  paiement_autre: boolean | null
  reservation: boolean
  station_deux_roues: boolean
  summary: StationSummary
  pdcs: PdcDetail[]
}

export interface StationFeatureProperties {
  station_key: string
  nom_station: string
  nom_operateur: string
  nom_amenageur: string
  pdc_count: number
  max_power: number
  available_count: number
  has_ccs: boolean
  has_type2: boolean
  has_chademo: boolean
}
