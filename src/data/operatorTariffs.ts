import type { Station } from '../types/irve'

/**
 * Grilles tarifaires publiques par opérateur (CPO).
 *
 * Pourquoi ce fichier ?
 * QualiCharge ne renseigne pas (encore) le prix borne par borne : tous les
 * champs `summary.pricing_*` sont aujourd'hui `null`. Or de nombreux opérateurs
 * appliquent un **tarif national fixe** (identique sur tout leur réseau). Pour
 * ces opérateurs, le prix ne dépend pas de la borne : on peut donc le maintenir
 * dans une petite table de référence éditoriale, jointe aux stations sur
 * `nom_operateur` au moment de l'affichage, sans attendre la donnée point par
 * point.
 *
 * Provenance & fiabilité — À LIRE avant de se fier aux chiffres :
 * - Données collectées par recherche web en juin 2026, à partir des grilles
 *   publiques des opérateurs (et, à défaut, d'agrégateurs tiers).
 * - Ce sont des données ÉDITORIALES, pas une source live : elles doivent être
 *   datées (`checkedAt`), sourcées (`source`) et revérifiées régulièrement.
 * - `confidence` reflète la qualité du sourcing (high = grille officielle
 *   confirmée ; low = un seul extrait tiers, à revérifier).
 * - Les prix « accès direct » (CB / sans abonnement) sont privilégiés ; ils sont
 *   souvent plus élevés que les prix abonnés/badge.
 * - L'association puissance → tier est une approximation : on assimile ≤ 22 kW
 *   au tier AC et > 22 kW au tier DC quand l'opérateur ne distingue que ces deux
 *   familles.
 *
 * Stratégie d'affichage (cf. StationDetail) :
 *   summary.pricing_headline (point QualiCharge, si un jour renseigné)
 *     → tarif national fixe opérateur (cette table)
 *       → inconnu
 */

export type TariffAccess = 'direct' | 'subscriber'
export type TariffUnit = '€/kWh' | '€/min' | '€/session'
export type TariffConfidence = 'high' | 'medium' | 'low'

/**
 * - `national-fixed` : prix identique sur tout le réseau en France.
 * - `regional-fixed` : prix uniforme mais sur un périmètre régional/départemental.
 * - `varies-by-site` : prix défini borne par borne (réseaux municipaux, plateformes
 *   d'itinérance, tarification dynamique…). Aucun prix national affichable.
 * - `unknown` : opérateur réel mais aucune grille publique trouvée.
 */
export type PricingModel = 'national-fixed' | 'regional-fixed' | 'varies-by-site' | 'unknown'

export interface TariffTier {
  /** Borne inférieure de puissance en kW (incluse). `null` = non bornée. */
  powerMinKw: number | null
  /** Borne supérieure de puissance en kW (incluse). `null` = non bornée. */
  powerMaxKw: number | null
  value: number
  unit: TariffUnit
  access: TariffAccess
  /** Précision optionnelle (ex. « autoroute », « heures creuses »). */
  label?: string
}

export interface OperatorTariff {
  id: string
  label: string
  /** Valeurs `nom_operateur` (QualiCharge) couvertes par cette grille. */
  match: readonly string[]
  pricingModel: PricingModel
  /** Paiement CB direct au terminal sans abonnement. `null` = inconnu. */
  directCbAvailable: boolean | null
  /** Tarifs publics. Vide si `varies-by-site`/`unknown`. */
  tiers: readonly TariffTier[]
  /** Frais de session fixe éventuel (€), facturé en sus du €/kWh (ex. R3). */
  sessionFee?: number
  source: string
  /** Date de relevé (ISO `YYYY-MM-DD`). */
  checkedAt: string
  confidence: TariffConfidence
  notes?: string
}

const CHECKED_AT = '2026-06-03'

export const OPERATOR_TARIFFS: readonly OperatorTariff[] = [
  // ─── Tarifs nationaux fixes ────────────────────────────────────────────────
  {
    id: 'lidl',
    label: 'Lidl France',
    match: ['Lidl France'],
    pricingModel: 'national-fixed',
    directCbAvailable: null,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.29, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 22, powerMaxKw: null, value: 0.39, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://www.lidl.fr/c/tarifs-bornes/s10027299',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes: 'Grille nationale unique. AC 0,29 / DC 0,39 €/kWh. Sans abonnement.',
  },
  {
    id: 'allego',
    label: 'Allego',
    match: ['Allego'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.39, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 22, powerMaxKw: 150, value: 0.49, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 150, powerMaxKw: null, value: 0.59, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://www.allego.eu/pricing/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Grille France (TTC, janv.–déc. 2025) : régulier 0,39 ; rapide 0,49 ; ultra-rapide 0,59 €/kWh. Surstationnement ~0,25 €/min après 45 min (1ʳᵉ h exemptée). CB sans contact.',
  },
  {
    id: 'driveco',
    label: 'Driveco',
    match: ['DRIVECO'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://driveco.com/dco001-rechargez-vous-chez-driveco/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Prix affiché avant chaque session (borne par borne). Réf. réseau Carrefour Énergies : 0,30 €/kWh (22 kW), 0,49 (50 kW), 0,54 (150 kW). CB sur bornes ≥50 kW.',
  },
  {
    id: 'electra',
    label: 'Electra',
    match: ['Electra'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.49, unit: '€/kWh', access: 'direct' }],
    source: 'https://www.go-electra.com/en/price/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Prix de base unifié 0,49 €/kWh (DC uniquement). Certaines stations très fréquentées appliquent un tarif horaire (0,39 creux / 0,61 pointe). Abonnement Boost : 0,29 €/kWh.',
  },
  {
    id: 'evzen',
    label: 'EVzen',
    match: ['EVzen'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.39, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 50, powerMaxKw: null, value: 0.49, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://www.evzen.com/fr/recharger-mon-vehicule',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Grille nationale : accélérée 3–22 kW 0,39 €/kWh ; rapide/ultra >50 kW 0,49 €/kWh (peut varier par station). CB, badge ou appli. Pré-autorisation 50 €.',
  },
  {
    id: 'totalenergies',
    label: 'TotalEnergies',
    match: ['TotalEnergies Marketing France', 'TotalEnergies Charging Services'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: 22, powerMaxKw: 50, value: 0.52, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 50, powerMaxKw: null, value: 0.62, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://chargeplus.totalenergies.com/fr/conseils-recharge-electrique/cout-recharge-voiture-electrique/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Grille stations-service HPC (en vigueur 05/03/2025, confirmée Charge+) : 0,52 €/kWh ≤50 kW, 0,62 €/kWh >50 kW en CB directe. Carte Charge+ : 0,35 €/kWh sur bornes propres. Surstationnement +0,40 €/min après 45 min. Exceptions locales (ex. 7 relais à 0,50/0,60).',
  },
  {
    id: 'nw-iecharge',
    label: 'NW IECharge',
    match: ['NW IECharge'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.25, unit: '€/kWh', access: 'direct' }],
    source: 'https://iecharge.io/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Prix national unique 0,25 €/kWh (HPC, électricité renouvelable certifiée), sans palier de puissance. CB, appli ou badge.',
  },
  {
    id: 'r3',
    label: 'R3',
    match: ['R3'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.35, unit: '€/kWh', access: 'direct', label: 'bornes lentes' },
      { powerMinKw: 22, powerMaxKw: null, value: 0.55, unit: '€/kWh', access: 'direct', label: 'bornes rapides' },
    ],
    source: 'https://www.dbt.fr/proprietaire-foncier/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Grille nationale 2026 : 0,55 €/kWh sur bornes rapides (≥150–180 kW), 0,35 €/kWh sur bornes lentes le cas échéant. CB, QR ou badge. (Ancien tarif 0,39 + 1 €/session obsolète.)',
  },
  {
    id: 'engie-vianeo',
    label: 'Engie Vianeo',
    match: ['ENGIE Vianeo'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.6, unit: '€/kWh', access: 'direct' }],
    source: 'https://www.engie-vianeo.com/tarifs-recharge-voiture-electrique/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Page tarifs officielle : prix affichés totem/borne ; CB = tarif public (~0,60 €/kWh réseau standard). Appli −10 %. ~16 stations CERTAS à 0,69 €/kWh. Autoroutes ~0,57 €/kWh. Super Heures Creuses 22h–8h : 0,29 €/kWh (Vianeo+).',
  },
  {
    id: 'atlante',
    label: 'Atlante',
    match: ['Atlante France'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.29, unit: '€/kWh', access: 'direct' }],
    source: 'https://atlante.energy/fr/myatlante-app/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      '« 0,29 €/kWh partout en France » sur les bornes propres Atlante (via appli myAtlante ou abonnement Atlante Go). Réseaux partenaires à tarif différent.',
  },
  {
    id: 'plenitude',
    label: 'Plenitude On The Road',
    match: ['Plenitude On The Road'],
    pricingModel: 'national-fixed',
    directCbAvailable: null,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.45, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 22, powerMaxKw: 75, value: 0.55, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 75, powerMaxKw: null, value: 0.55, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://www.eniplenitude.fr/mobilite-electrique/tarifs',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Grille nationale France paiement à l’acte (bornes propres) : Quick AC ≤22 kW 0,45 €/kWh ; Fast DC ≤75 kW et Fast+/Ultra ≥75 kW 0,55 €/kWh. Surstationnement après 60 min : 0,12–0,30 €/min selon borne. Prises AC sur bornes DC facturées au tarif de la borne hôte.',
  },
  {
    id: 'plug-inn',
    label: 'Plug Inn fast charge',
    match: ['Plug Inn fast charge'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: null, powerMaxKw: null, value: 0.46, unit: '€/kWh', access: 'direct', label: 'appli/pass BASIC' },
      { powerMinKw: null, powerMaxKw: null, value: 0.59, unit: '€/kWh', access: 'direct', label: 'CB au terminal' },
      { powerMinKw: null, powerMaxKw: null, value: 0.39, unit: '€/kWh', access: 'subscriber', label: 'INTENSE 5,99 €/mois' },
    ],
    source: 'https://www.renault.fr/solutions-de-recharge/plug-inn-fast-charge.html',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Réseau ultra-rapide Renault Group (≤320 kW), prix national unique. CB au terminal 0,59 €/kWh, appli/pass 0,46, abonné 0,39. Stationnement 0,30 €/min après 1 h.',
  },
  {
    id: 'fastned',
    label: 'Fastned',
    match: ['Fastned France'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: null, powerMaxKw: null, value: 0.61, unit: '€/kWh', access: 'direct' },
      { powerMinKw: null, powerMaxKw: null, value: 0.41, unit: '€/kWh', access: 'subscriber', label: 'Gold 11,99 €/mois' },
    ],
    source: 'https://www.fastnedcharging.com/en/charging/tariffs',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Prix unique €/kWh quelle que soit la puissance. Standard 0,61 €/kWh (hausse au 01/04/2026, ex-0,59). Appli : -10 %. CB partout, Autocharge en CCS.',
  },
  {
    id: 'dream-energy',
    label: 'Dream Energy',
    match: ['DREAM ENERGY'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.59, unit: '€/kWh', access: 'direct' }],
    source: 'https://www.dream-energy.fr/support-faq/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Réseau propre 0,59 €/kWh en CB/badge/QR (FAQ officielle). Surfacturation si station occupée après fin de charge. Sites partenaires à tarif distinct.',
  },
  {
    id: 'bp-pulse',
    label: 'bp pulse',
    match: ['bp Pulse', 'bp pulse'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 44, value: 0.43, unit: '€/kWh', access: 'direct', label: 'Standard' },
      { powerMinKw: 45, powerMaxKw: 149, value: 0.46, unit: '€/kWh', access: 'direct', label: 'Rapide' },
      { powerMinKw: 150, powerMaxKw: 400, value: 0.59, unit: '€/kWh', access: 'direct', label: 'Ultra-rapide' },
    ],
    source: 'https://www.bppulse.com/fr-fr/Tarifs',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Grille nationale CB sans contact sur bornes bp pulse : Standard 0–44 kW 0,43 €/kWh ; Rapide 45–149 kW 0,46 ; Ultra-rapide 150–400 kW 0,59. Pré-autorisation bancaire possible. Tarifs RFID = opérateur eMSP.',
  },
  {
    id: 'zunder',
    label: 'Zunder',
    match: ['Zunder'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.4, unit: '€/kWh', access: 'direct', label: 'AC' },
      { powerMinKw: 22, powerMaxKw: 50, value: 0.44, unit: '€/kWh', access: 'direct', label: 'DC ≤50 kW' },
      { powerMinKw: 50, powerMaxKw: null, value: 0.6, unit: '€/kWh', access: 'direct', label: 'DC >50 kW' },
    ],
    source: 'https://www.zunder.com/fr/utilisateur-ve/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Grille nationale hors abonnement (TTC) : AC 0,40 ; DC ≤50 kW 0,44 ; DC >50 kW 0,60 €/kWh. Exceptions sur certaines aires autoroutières. CB TPV ou appli.',
  },
  {
    id: 'stations-e',
    label: 'STATIONS-E',
    match: ['STATIONS-E'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.36, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 22, powerMaxKw: null, value: 0.39, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://www.stations-e.com/fr/tarification',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Badge universel gratuit : 0,36 €/kWh (22 AC / 24 DC), 0,39 (50 DC). CB sans badge : 0,45 / 0,48 €/kWh + 0,50 €/session. Forfaits Express-e / Access-e dès 0,29 / 0,35.',
  },
  {
    id: 'zen',
    label: 'Z-E-N',
    match: ['Z-E-N'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://z-e-n.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Réseau Proviridis (V-GAS, PL). Tarifs contractuels non publiés au kWh ; appli Z-E-N affiche prix par station.',
  },
  {
    id: 'obornes',
    label: 'OBORNES (Oreve)',
    match: ['OBORNES'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.55, unit: '€/kWh', access: 'direct' }],
    source: 'https://oreve.com/en/pricing/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Réseau HPC Oreve (≤400 kW) : 0,55 €/kWh TTC (grille publiée 16/01/2025). CB, appli et pass PRO. Pré-autorisation 49/149 €.',
  },
  {
    id: 'milence',
    label: 'Milence',
    match: ['Milence'],
    pricingModel: 'national-fixed',
    directCbAvailable: null,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.339, unit: '€/kWh', access: 'direct', label: 'HT' }],
    source: 'https://milence.com/charging-tariffs/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Hubs poids lourds (HPC/MCS). Prix national France 0,339 €/kWh HORS TAXES (depuis 01/01/2026). Accès via appli/cartes/eMSP ; prix final variable selon l’eMSP.',
  },
  {
    id: 'greenspot',
    label: 'Greenspot',
    match: ['Greenspot'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://www.greenspot.fr/borne-recharge',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Site Greenspot : pas de grille nationale. Tarifs par site (ex. ~0,42–0,45 €/kWh HT + frais/min possibles après 90 min). CB sur bornes équipées.',
  },

  // ─── Tarifs régionaux/départementaux fixes ─────────────────────────────────
  {
    id: 'seolis',
    label: 'Séolis (AlterBase, Deux-Sèvres)',
    match: ['SEOLIS'],
    pricingModel: 'regional-fixed',
    directCbAvailable: null,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 24, value: 0.528, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 24, powerMaxKw: null, value: 0.612, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 0, powerMaxKw: 24, value: 0.432, unit: '€/kWh', access: 'subscriber' },
      { powerMinKw: 24, powerMaxKw: null, value: 0.528, unit: '€/kWh', access: 'subscriber' },
    ],
    sessionFee: 0.996,
    source: 'https://www.seolis.net/alterbase/nos-tarifs/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Réseau AlterBase (Deux-Sèvres), tarif au kWh depuis 2026. Occasionnel : 0,528 €/kWh ≤24 kW, 0,612 >25 kW + frais session variable. Abonné 18 €/an : 0,432 / 0,528 €/kWh.',
  },
  {
    id: 'e-charge50',
    label: 'e-charge50 (SDEM50, Manche)',
    match: ['e-charge50'],
    pricingModel: 'regional-fixed',
    directCbAvailable: null,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.47, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 0, powerMaxKw: 30, value: 0.5, unit: '€/kWh', access: 'direct', label: 'DC ≤30 kW' },
      { powerMinKw: 30, powerMaxKw: null, value: 0.55, unit: '€/kWh', access: 'direct', label: 'DC >30 kW' },
      { powerMinKw: 0, powerMaxKw: 22, value: 0.38, unit: '€/kWh', access: 'subscriber' },
      { powerMinKw: 0, powerMaxKw: 30, value: 0.4, unit: '€/kWh', access: 'subscriber', label: 'DC ≤30 kW' },
      { powerMinKw: 30, powerMaxKw: null, value: 0.45, unit: '€/kWh', access: 'subscriber', label: 'DC >30 kW' },
    ],
    source: 'https://www.e-charge50.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Réseau départemental Manche (juillet 2024). Sans abonnement : AC ≤22 kW 0,47 ; DC ≤30 kW 0,50 ; DC >30 kW 0,55 €/kWh. Abonnement 1 €/mois : 0,38 / 0,40 / 0,45. Pénalité « ventouse » après 15 min fin de charge.',
  },

  // ─── Prix défini borne par borne (aucun prix national affichable) ──────────
  {
    id: 'powerdot',
    label: 'Power Dot France',
    match: ['Power Dot France'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://powerdot.eu/fr/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Prix par site (Plunge Pricing / tarification dynamique 2026). Fourchette indicative 0,30–0,53 €/kWh selon site et heure. Appli Powerdot avant session.',
  },
  {
    id: 'izivia',
    label: 'Izivia',
    match: ['IZIVIA'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://izivia.com/blog/questions-frequentes/prix-recharge-bornes-electriques',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Prix par station sur carte Izivia / appli (fourchette ~0,40–0,55 €/kWh). CB via Paynow ou TPE sur bornes équipées. Pré-autorisation 5–100 €.',
  },
  {
    id: 'tesla',
    label: 'Tesla',
    match: ['Tesla'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.tesla.com/support/charging/supercharger/fees',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Documentation Supercharger officielle : tarification dynamique par station/heure (2026). Membres (11,99 €/mois) ~0,15 €/kWh moins cher. CB sur bornes V4/V5 uniquement.',
  },
  {
    id: 'ionity',
    label: 'Ionity',
    match: ['Ionity'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://www.ionity.eu/network/access-and-payments',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Depuis le 12/02/2026 : prix par station (minimum affiché ~0,39 €/kWh, souvent plus élevé selon site/autoroute). CB, appli ou abonnement. Pas de grille nationale.',
  },
  {
    id: 'easycharge',
    label: 'Mercedes easy charge',
    match: ['EASYCHARGE'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://eu.charge.mercedes-benz.com/web/fr/mb-fr/tariffs',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'MSP Mercedes (MB.CHARGE), pas CPO : tarif = CPO hôte + forfait S/M/L. Page tarifs officielle ; prix affiché dans l’appli avant session.',
  },
  {
    id: 'e-totem',
    label: 'E-Totem',
    match: ['E-Totem'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://www.e-totem.eu/utilisateurs-particuliers/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Page utilisateurs officielle : tarifs par réseau/collectivité (ex. Saint-Étienne 0,37 €/kWh). Facturation au kWh. Pas de grille nationale E-Totem.',
  },
  {
    id: 'citeos-cogelum',
    label: 'Citeos / Cogelum IDF',
    match: ['Citeos Mobilité Electrique Paris - Cogelum IDF'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.citeos.fr/nos-expertises/mobilite-decarbonee/mobilite-electrique/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes: 'Exploitant/installateur de réseaux municipaux (VINCI Energies) ; chaque collectivité fixe son tarif.',
  },
  {
    id: 'bump',
    label: 'Bump',
    match: ['Bump'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://www.bump-charge.com/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes: 'Site officiel : prix fixé par site, affiché dans l’appli Bump avant recharge. CB sur bornes >50 kW (AFIR).',
  },
  {
    id: 'spie-citynetworks',
    label: 'SPIE CityNetworks',
    match: ['SPIE CityNetworks'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.spie.fr/fr/transition-energetique/transport-et-mobilite/bornes-de-recharge-pour-vehicules-electriques',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Site SPIE : réseaux territoriaux (ex. Oscéa 64) ; tarif par contrat régional/collectivité. Pas de grille nationale groupe.',
  },
  {
    id: 'sowatt',
    label: 'Sowatt Solutions',
    match: ['Sowatt Solutions'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.sowattsolutions.com/carte-de-recharge-sowatt/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Prix hôte sur bornes tierces ; sur réseau Sowatt propre : ~0,56 €/kWh CB, ~0,54 RFID (juin 2025). Carte gratuite. Appli affiche tarif avant session.',
  },
  {
    id: 'soregies',
    label: 'Sorégies',
    match: ['Soregies'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.soregies.fr/offre-mobilite-electrique/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Offre officielle Sorégies : tarif par borne (carte/appli). Mobilités+ : −20 % sur réseau Sorégies (~500 PDC, Vienne). Carte gratuite.',
  },
  {
    id: 'bouygues-es',
    label: 'Bouygues Energies & Services (alizé)',
    match: ['Bouygues Energies & Services'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://alizecharge.com/tarifs-alize/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes: '« Chaque propriétaire de bornes définit ses tarifs » (marque alizé, réseaux de collectivités). Prix dans l’appli alizé.',
  },
  {
    id: 'freshmile',
    label: 'Freshmile',
    match: ['Freshmile'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://www.freshmile.com/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'CPO + MSP : prix fixé par l’hôte, affiché par station dans l’appli Freshmile avant session. CB sur bornes équipées. Pas de grille nationale.',
  },
  {
    id: 'load-stations',
    label: 'Load Stations',
    match: ['Load Stations'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://load-stations.com/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Exploitant/supervision : tarifs fixés par chaque site client. Pas de grille €/kWh nationale sur load-stations.com.',
  },
  {
    id: 'geeve',
    label: 'GEEVE',
    match: ['GEEVE'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.geeve.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Marque GreenYellow (retail). Tarifs selon puissance, affichés appli/totem ; pas de grille nationale (geeve.fr).',
  },
  {
    id: 'shell-recharge',
    label: 'Shell Recharge',
    match: ['Shell Recharge'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://www.shell.fr/recharge-electrique/tarifs-de-shell-recharge.html',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Réseau Shell Recharge : tarifs €/kWh par station dans l’appli Shell (page FR officielle). Frais transaction 0,35 €/session (carte Shell). Partenaires : tarif CPO + 0,35 €. Pré-auth. 45 € (carte/appli) ou 65 € (CB).',
  },
  {
    id: 'zeenco',
    label: 'ZEENCO e-mobility',
    match: ['ZEENCO e-mobility'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://zeenco.tech/questions-frequentes/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'FAQ ZEENCO officielle : tarifs par opérateur/station dans l’appli. Pas de grille nationale.',
  },
  {
    id: 'qowatt',
    label: 'QoWatt',
    match: ['QoWatt'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://qowatt.com/',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Copropriétés/parcs : tarif fixé par le syndic/site (pas de grille nationale). Appli/QR/crypto. Page tarifs FR introuvable (404) — modèle par site confirmé par positionnement produit.',
  },
  {
    id: 'yaway',
    label: 'Yaway',
    match: ['Yaway'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://yaway-recharge.eu/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'Site officiel : prix par station (ex. ~0,30 €/kWh sur sites éoliens Yaway, plus élevé ailleurs). CB sans abonnement.',
  },
  {
    id: 'we-go',
    label: 'We-Go',
    match: ['We-Go'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://chargemap.com/fr-fr/networks/we-go',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes: 'Réseau parkings municipaux : prix par site/opérateur (pas de grille nationale We-Go).',
  },
  {
    id: 'eparck',
    label: 'Eparck',
    match: ['Eparck'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://eparck.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Opérateur parking (appli). Référence tierce ~0,50 €/kWh HT ; site eparck.fr sans grille détaillée — prix probablement par parking/contrat.',
  },

  // ─── Opérateurs réels sans grille publique trouvée / non grand public ──────
  {
    id: 'sorel-energies',
    label: 'Sorel Energies',
    match: ['Sorel energies'],
    pricingModel: 'unknown',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.sorelenergies.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'low',
    notes: 'Principalement installateur IRVE/solaire. Petit réseau à prix fixé par hôte. Pas de grille nationale publiée.',
  },
  {
    id: 'autorecharge',
    label: 'AUTORECHARGE SAS',
    match: ['AUTORECHARGE SAS'],
    pricingModel: 'unknown',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.gireve.com/autorecharge-chooses-gireve-to-open-its-charging-points-to-all-users/',
    checkedAt: CHECKED_AT,
    confidence: 'low',
    notes: 'CPO connecté à l’itinérance (GIREVE). Aucun tarif public au kWh trouvé.',
  },
  {
    id: 'alterna',
    label: 'Alterna Énergie',
    match: ['Alterna Énergie'],
    pricingModel: 'unknown',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.alterna-energie.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'low',
    notes: 'Fournisseur d’électricité/gaz (groupement d’ELE), pas un réseau public à prix national. IRVE pour collectivités : prix par réseau local.',
  },
  {
    id: 'paragon',
    label: 'Paragon Mobility',
    match: ['Paragon Mobility'],
    pricingModel: 'unknown',
    directCbAvailable: null,
    tiers: [],
    source: 'https://www.paragonmobility.com/',
    checkedAt: CHECKED_AT,
    confidence: 'low',
    notes: 'CPO « Pods » ultra-rapides à batterie tampon (22–200 kW). Modèle clé-en-main, aucun tarif public publié.',
  },
  {
    id: 'zetra',
    label: 'ZETRA Distribution',
    match: ['ZETRA Distribution'],
    pricingModel: 'unknown',
    directCbAvailable: false,
    tiers: [],
    source: 'https://zetra.com/offres',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes: 'Électrification poids lourds en dépôt (contrats par flotte, €/kWh ou €/km négociés). Pas un réseau public ad hoc.',
  },
  {
    id: 'oya-energies',
    label: 'Oya Énergies',
    match: ['Oya Énergies'],
    pricingModel: 'unknown',
    directCbAvailable: null,
    tiers: [],
    source: 'https://oya-energies.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'low',
    notes: 'ELE locale (Vendée). Aucun réseau de recharge public à tarif publié identifié.',
  },
  {
    id: 'eoliberty',
    label: 'Eoliberty',
    match: ['Eoliberty'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://eoliberty.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'high',
    notes:
      'CPO + MSP (Liberty Pass). Prix par station dans Liberty App ; pas de grille nationale. Bornes ~50 kW DC (enseignes partenaires). CB + itinérance.',
  },
]

const tariffByOperatorName = new Map<string, OperatorTariff>()
for (const tariff of OPERATOR_TARIFFS) {
  for (const name of tariff.match) {
    tariffByOperatorName.set(name, tariff)
  }
}

/** Grille tarifaire connue pour un `nom_operateur` QualiCharge, sinon `null`. */
export function getOperatorTariff(nomOperateur: string | null | undefined): OperatorTariff | null {
  if (!nomOperateur) return null
  return tariffByOperatorName.get(nomOperateur) ?? null
}

/**
 * Sélectionne le tier « accès direct » applicable à une puissance donnée.
 * À défaut de borne de puissance correspondante, retombe sur le premier tier direct.
 */
export function pickDirectTier(
  tariff: OperatorTariff,
  maxPowerKw: number | null,
): TariffTier | null {
  const directTiers = tariff.tiers.filter((t) => t.access === 'direct')
  if (directTiers.length === 0) return null

  if (maxPowerKw != null) {
    const match = directTiers.find((t) => {
      const aboveMin = t.powerMinKw == null || maxPowerKw >= t.powerMinKw
      const belowMax = t.powerMaxKw == null || maxPowerKw <= t.powerMaxKw
      return aboveMin && belowMax
    })
    if (match) return match
  }

  return directTiers[0]
}

const PRICE_FMT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
})

export interface OperatorTariffHeadline {
  /** Ex. « ≈ 0,49 €/kWh ». */
  text: string
  /** Ex. « Tarif national opérateur · accès direct · relevé le 02/06/2026 ». */
  provenance: string
  confidence: TariffConfidence
  source: string
}

/**
 * Construit un libellé de tarif national/régional pour une station, à utiliser
 * en repli quand QualiCharge ne fournit pas `pricing_headline`.
 * Renvoie `null` si l'opérateur n'a pas de prix fixe affichable (varies-by-site,
 * unknown, ou aucun tier direct).
 */
export function getStationOperatorTariffHeadline(station: Station): OperatorTariffHeadline | null {
  const tariff = getOperatorTariff(station.nom_operateur)
  if (!tariff) return null
  if (tariff.pricingModel !== 'national-fixed' && tariff.pricingModel !== 'regional-fixed') {
    return null
  }

  const tier = pickDirectTier(tariff, station.summary?.max_power ?? null)
  if (!tier) return null

  let text = `≈ ${PRICE_FMT.format(tier.value)} ${tier.unit}`
  if (tier.label) text += ` (${tier.label})`
  if (tariff.sessionFee) {
    text += ` + ${PRICE_FMT.format(tariff.sessionFee)} €/session`
  }

  const scope = tariff.pricingModel === 'national-fixed' ? 'national' : 'régional'
  const checked = new Date(tariff.checkedAt).toLocaleDateString('fr-FR')
  const provenance = `Tarif ${scope} opérateur · accès direct · relevé le ${checked}`

  return { text, provenance, confidence: tariff.confidence, source: tariff.source }
}
