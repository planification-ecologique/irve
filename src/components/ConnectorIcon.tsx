import type { ConnectorType } from '../types/irve'

export type ConnectorIconType = ConnectorType | 'autre'

interface ConnectorIconProps {
  type: ConnectorIconType
  size?: number
}

export function ConnectorIcon({ type, size = 28 }: ConnectorIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  } as const

  switch (type) {
    case 'type2':
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="10" r="1.6" fill="currentColor" />
          <circle cx="20.5" cy="13" r="1.6" fill="currentColor" />
          <circle cx="20.5" cy="19" r="1.6" fill="currentColor" />
          <circle cx="16" cy="22" r="1.6" fill="currentColor" />
          <circle cx="11.5" cy="19" r="1.6" fill="currentColor" />
          <circle cx="11.5" cy="13" r="1.6" fill="currentColor" />
          <circle cx="16" cy="16" r="2.2" fill="currentColor" />
        </svg>
      )
    case 'ccs':
      return (
        <svg {...common}>
          <circle cx="16" cy="13" r="9" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="9" r="1.3" fill="currentColor" />
          <circle cx="19.5" cy="11.5" r="1.3" fill="currentColor" />
          <circle cx="19.5" cy="14.5" r="1.3" fill="currentColor" />
          <circle cx="16" cy="17" r="1.3" fill="currentColor" />
          <circle cx="12.5" cy="14.5" r="1.3" fill="currentColor" />
          <circle cx="12.5" cy="11.5" r="1.3" fill="currentColor" />
          <rect x="12" y="22" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <line x1="14" y1="22" x2="14" y2="19.5" stroke="currentColor" strokeWidth="1.8" />
          <line x1="18" y1="22" x2="18" y2="19.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'chademo':
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" />
          <rect x="13.5" y="13.5" width="5" height="5" rx="0.8" fill="currentColor" />
          <circle cx="10" cy="10" r="1.8" fill="currentColor" />
          <circle cx="22" cy="10" r="1.8" fill="currentColor" />
          <circle cx="10" cy="22" r="1.8" fill="currentColor" />
          <circle cx="22" cy="22" r="1.8" fill="currentColor" />
        </svg>
      )
    case 'ef':
      return (
        <svg {...common}>
          <rect x="7" y="9" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="13" cy="17" r="2.2" fill="currentColor" />
          <circle cx="19" cy="17" r="2.2" fill="currentColor" />
          <rect x="14.5" y="21" width="3" height="2.5" rx="0.5" fill="currentColor" />
        </svg>
      )
    case 'autre':
      return (
        <svg {...common}>
          <rect x="9" y="8" width="14" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="13" cy="14" r="1.5" fill="currentColor" />
          <circle cx="19" cy="14" r="1.5" fill="currentColor" />
          <circle cx="16" cy="19" r="1.5" fill="currentColor" />
          <path
            d="M12 26h8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
  }
}
