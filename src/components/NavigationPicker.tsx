import type { NavigationProvider } from '../lib/navigation'
import { NAVIGATION_PROVIDER_OPTIONS } from '../lib/navigation'

interface NavigationPickerProps {
  onSelect: (provider: NavigationProvider) => void
  onCancel: () => void
}

export function NavigationPicker({ onSelect, onCancel }: NavigationPickerProps) {
  return (
    <div className="nav-picker" role="dialog" aria-labelledby="nav-picker-title">
      <p id="nav-picker-title" className="nav-picker__title">
        Ouvrir l’itinéraire avec
      </p>
      <ul className="nav-picker__list">
        {NAVIGATION_PROVIDER_OPTIONS.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              className="nav-picker__option"
              onClick={() => onSelect(option.id)}
            >
              <span className="nav-picker__option-label">{option.label}</span>
              <span className="nav-picker__option-desc">{option.description}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="nav-picker__cancel" onClick={onCancel}>
        Annuler
      </button>
    </div>
  )
}
