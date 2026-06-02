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

const CHECKED_AT = '2026-06-02'

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
    confidence: 'medium',
    notes:
      'Tarif unifié (déploiement 6 pays). Surstationnement ~0,25 €/min après 45 min sur HPC. CB sans contact.',
  },
  {
    id: 'driveco',
    label: 'Driveco',
    match: ['DRIVECO'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: 22, powerMaxKw: 100, value: 0.49, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 100, powerMaxKw: null, value: 0.54, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://driveco.com/cout-recharge-voiture-electrique-2025/',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes: 'Grille réseau unifiée. CB acceptée directement sur les bornes DC.',
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
      { powerMinKw: 22, powerMaxKw: null, value: 0.49, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://www.evzen.com/fr/recharger-mon-vehicule',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Grille publiée AC 0,39 / DC 0,49 €/kWh, « révisable » et pouvant varier selon la borne. CB avec pré-autorisation 50 €.',
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
    source:
      'https://www.totalenergies.fr/particuliers/recharge-voiture-electrique/cout-recharge-electrique',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Grille des stations-service HPC (en vigueur 05/03/2025) : 0,52 €/kWh ≤50 kW, 0,62 €/kWh >50 kW en CB directe. Carte TotalEnergies (gratuite) : 0,35 €/kWh sur bornes propres. Surstationnement ~+0,40 €/min après 45 min. Certaines sources citent 0,49/0,59.',
  },
  {
    id: 'nw-iecharge',
    label: 'NW IECharge',
    match: ['NW IECharge'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.3, unit: '€/kWh', access: 'direct' }],
    source: 'https://iecharge.io/',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes: 'Prix national unique 0,30 €/kWh (DC jusqu’à ~320 kW), sans distinction de puissance.',
  },
  {
    id: 'r3',
    label: 'R3',
    match: ['R3'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.39, unit: '€/kWh', access: 'direct' }],
    sessionFee: 1.0,
    source: 'https://www.dbt.fr/r3/',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes: 'Prix national 0,39 €/kWh + 1 € fixe par recharge réussie. CB sans contact + QR sur chaque borne.',
  },
  {
    id: 'engie-vianeo',
    label: 'Engie Vianeo',
    match: ['ENGIE Vianeo'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.69, unit: '€/kWh', access: 'direct' }],
    source: 'https://www.engie-vianeo.com/en/ev-charging-cost/',
    checkedAt: CHECKED_AT,
    confidence: 'low',
    notes:
      'Tarif standard cité ~0,69 €/kWh, mais incohérence entre sources (0,48–0,54 €/kWh ailleurs) — À REVÉRIFIER. Offres « Super Heures Creuses » 22h-8h à 0,29 €/kWh sur bornes sélectionnées. Sans frais de connexion/surstationnement.',
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
      { powerMinKw: 22, powerMaxKw: 75, value: 0.65, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 75, powerMaxKw: null, value: 0.85, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://www.eniplenitude.fr/mobilite-electrique/tarifs',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Grille nationale (bornes propres). Fast DC ≤75 kW : 0,65 €/kWh ; Fast+/Ultra >75 kW : 0,85 €/kWh. Frais de stationnement après 60 min gratuites. Tier Quick AC ≤22 kW non trouvé.',
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
    source: 'https://www.dream-energy.fr/en/tarifs/',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Réseau propre ~0,59 €/kWh en CB/direct ; sites partenaires (ex. Super U) ~0,39 €/kWh. CB sans abonnement partout. Frais après 1 h.',
  },
  {
    id: 'bp-pulse',
    label: 'bp pulse',
    match: ['bp Pulse', 'bp pulse'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [{ powerMinKw: 50, powerMaxKw: null, value: 0.43, unit: '€/kWh', access: 'direct' }],
    source: 'https://www.bppulse.com/fr-fr/Tarifs',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Grille nationale par vitesse (en vigueur depuis juillet 2024). Entrée à 0,43 €/kWh en CB sans contact ; pré-autorisation 49 €. Détail 100–400 kW non capturé (page bloquée).',
  },
  {
    id: 'zunder',
    label: 'Zunder',
    match: ['Zunder'],
    pricingModel: 'national-fixed',
    directCbAvailable: true,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.3, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 22, powerMaxKw: 150, value: 0.5, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 150, powerMaxKw: null, value: 0.54, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://www.zunder.com/fr/utilisateur-ve/',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes: 'Grille nationale sans abonnement 0,30 / 0,50 / 0,54 €/kWh. CB Visa/Mastercard. Chiffres à reconfirmer.',
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
    source:
      'https://stations-e.com/fr/blog/guide-complet-des-tarifs-de-recharge-comment-economiser-avec-stations-e',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Tarifs uniformisés au niveau national. Sans abonnement : AC 0,36 / DC 50 kW 0,39 €/kWh (0,29/0,35 avec forfait). CB + QR + appli.',
  },
  {
    id: 'zen',
    label: 'Z-E-N',
    match: ['Z-E-N'],
    pricingModel: 'national-fixed',
    directCbAvailable: null,
    tiers: [{ powerMinKw: null, powerMaxKw: null, value: 0.42, unit: '€/kWh', access: 'direct' }],
    source: 'https://z-e-n.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Réseau Proviridis (stations V-GAS). Prix réseau ~0,42 €/kWh. Accès principalement via badges d’itinérance ; CB en déploiement. À reconfirmer.',
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
    confidence: 'low',
    notes:
      'Réseau HPC Oreve (≤400 kW), prix réseau ~0,55 €/kWh, CB acceptée. Pré-autorisation 49/149 €. Source unique — à revérifier.',
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
    pricingModel: 'national-fixed',
    directCbAvailable: null,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.29, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 22, powerMaxKw: null, value: 0.39, unit: '€/kWh', access: 'direct' },
    ],
    source: 'https://www.greenspot.fr/borne-recharge',
    checkedAt: CHECKED_AT,
    confidence: 'low',
    notes:
      'AC 0,29 / DC 0,39 €/kWh — chiffres uniquement issus d’agrégateurs tiers, grille nationale non confirmée officiellement. À REVÉRIFIER.',
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
    confidence: 'medium',
    notes:
      'Réseau AlterBase (Deux-Sèvres), uniforme mais régional. Direct : 0,528 €/kWh ≤24 kW, 0,612 >24 kW + 0,996 €/session. Abonnement 18 €/an.',
  },
  {
    id: 'e-charge50',
    label: 'e-charge50 (SDEM50, Manche)',
    match: ['e-charge50'],
    pricingModel: 'regional-fixed',
    directCbAvailable: null,
    tiers: [
      { powerMinKw: 0, powerMaxKw: 22, value: 0.47, unit: '€/kWh', access: 'direct' },
      { powerMinKw: 0, powerMaxKw: 22, value: 0.38, unit: '€/kWh', access: 'subscriber' },
    ],
    source: 'https://www.sdem50.fr/changement-de-tarification-du-service-e-charge50-1',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes:
      'Réseau départemental Manche. AC ≤22 kW : 0,47 €/kWh (non-abonné) / 0,38 (abonné, 1 €/mois). Tier DC rapide non trouvé.',
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
    confidence: 'medium',
    notes:
      'Prix par site (0,30–0,53 €/kWh selon site/puissance), passage à une tarification dynamique « Plunge Pricing » en 2026.',
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
    confidence: 'medium',
    notes: 'Prix par station (0,40–0,55 €/kWh selon site). Izivia renvoie au prix affiché borne par borne. CB sur bornes équipées.',
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
    confidence: 'medium',
    notes:
      'Tarification dynamique (par station et par heure) généralisée en 2026. Membres (11,99 €/mois) ~0,15 €/kWh moins cher. CB seulement sur bornes V4/V5.',
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
    confidence: 'medium',
    notes:
      'Depuis le 12/02/2026 : tarification par station (ad hoc + nouveaux abonnements). Représentatif : ~0,51 €/kWh hors autoroute, ~0,59 sur autoroute. CB sans contact.',
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
    confidence: 'low',
    notes:
      'Service de mobilité/itinérance (MB.CHARGE) et non un réseau propre à prix unique : le prix est celui du CPO sous-jacent. Forfaits S/M/L ; en « S » (sans abonnement) le prix varie selon la borne.',
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
    confidence: 'medium',
    notes:
      'Exploite de nombreux réseaux municipaux ; prix défini par réseau/collectivité (ex. Saint-Étienne 0,37 €/kWh). Facturation au kWh. Pas de grille nationale.',
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
    confidence: 'medium',
    notes: 'CPO B2B/flottes/parkings : prix fixé par site (affiché dans l’appli Bump avant la recharge). CB sur >50 kW (AFIR).',
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
    confidence: 'low',
    notes: 'Réseaux territoriaux/régionaux (ex. Oscéa 64) ; prix par contrat régional (~0,40–0,50 €/kWh, source tierce).',
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
    confidence: 'medium',
    notes: 'Prix défini par le propriétaire de la borne, affiché dans l’appli Sowatt. Carte gratuite, pas de frais à la minute. Pas de grille nationale.',
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
    confidence: 'low',
    notes: 'Réseau régional (Vienne). Remise 20 % au kWh avec carte gratuite ; prix par station affiché sur la carte du réseau.',
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
    confidence: 'medium',
    notes: 'CPO + plateforme d’itinérance : le CPO hôte fixe le prix, affiché par station dans l’appli. Pas de grille nationale.',
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
    confidence: 'low',
    notes: 'Éditeur de supervision + opérateur ; tarifs des stations clientes fixés par site. Aucune grille nationale publiée.',
  },
  {
    id: 'geeve',
    label: 'GEEVE',
    match: ['GEEVE'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://geeve.fr/faq/',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes: 'Marque liée à GreenYellow (sites retail). Tarifs « selon la puissance », affichés dans l’appli/sur le totem ; pas de chiffre national.',
  },
  {
    id: 'shell-recharge',
    label: 'Shell Recharge',
    match: ['Shell Recharge'],
    pricingModel: 'varies-by-site',
    directCbAvailable: true,
    tiers: [],
    source: 'https://shellrecharge.com/fr-fr/en-deplacement/tarifs-de-la-recharge-publique',
    checkedAt: CHECKED_AT,
    confidence: 'medium',
    notes: 'Largement un réseau d’itinérance : chaque CPO partenaire fixe son tarif. Frais de transaction 0,35 €/session (plafond 7 €/mois).',
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
    confidence: 'low',
    notes: 'CPO + MSP : tarifs par opérateur/station, affichés dans l’appli ZEENCO. Pas de prix national.',
  },
  {
    id: 'qowatt',
    label: 'QoWatt',
    match: ['QoWatt'],
    pricingModel: 'varies-by-site',
    directCbAvailable: null,
    tiers: [],
    source: 'https://qowatt.com/en/',
    checkedAt: CHECKED_AT,
    confidence: 'low',
    notes: 'Copropriétés/parcs d’activité : l’économie est fixée par le site. Paiement crypto/appli/QR. Pas de grille nationale.',
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
    confidence: 'medium',
    notes: 'Prix par station (0,30 €/kWh sur sites éoliens directs, plus cher ailleurs). Sans abonnement, CB directe.',
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
    confidence: 'medium',
    notes: 'Concessions de parkings municipaux : prix par site/opérateur.',
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
    confidence: 'low',
    notes: 'Opérateur parking (appli de charge). Un prix de référence 0,50 €/kWh HT cité, sans détail par palier ni confirmation d’uniformité.',
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
    pricingModel: 'unknown',
    directCbAvailable: true,
    tiers: [],
    source: 'https://eoliberty.fr/',
    checkedAt: CHECKED_AT,
    confidence: 'low',
    notes: 'CPO + MSP (Liberty Pass), ~50 kW DC en supermarchés. Prix par station dans l’appli ; grille nationale non confirmée.',
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
