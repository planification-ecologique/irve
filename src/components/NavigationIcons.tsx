import type { NavigationProvider } from '../lib/navigation'

interface IconProps {
  size?: number
}

const svgProps = (size: number) =>
  ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  }) as const

export function RouteIcon({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M12 4v11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="m8.5 10.5 3.5-3.5 3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 20h12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CopyIcon({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M7 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CheckIcon({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M5 12.5 9.5 17 19 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ChevronDownIcon({ size = 14 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function NavigationProviderIcon({
  provider,
  size = 20,
}: IconProps & { provider: NavigationProvider }) {
  switch (provider) {
    case 'google-maps':
      return <GoogleMapsIcon size={size} />
    case 'cartes-app':
      return <CartesAppIcon size={size} />
    default:
      return <DefaultMapsIcon size={size} />
  }
}

function GoogleMapsIcon({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M12 21s6.5-4.5 6.5-10a6.5 6.5 0 1 0-13 0c0 5.5 6.5 10 6.5 10Z"
        fill="#EA4335"
      />
      <circle cx="12" cy="11" r="2.5" fill="#fff" />
    </svg>
  )
}

function CartesAppIcon({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="3" y="5" width="18" height="14" rx="3" fill="#1B9E77" />
      <path
        d="M7 15 10 10l3 3 4-6"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="9" r="1.25" fill="#fff" />
    </svg>
  )
}

function DefaultMapsIcon({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="11" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 13.25V17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8.5 17h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
