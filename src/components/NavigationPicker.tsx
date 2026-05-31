import type { NavigationProvider } from '../lib/navigation'
import { NAVIGATION_PROVIDER_OPTIONS } from '../lib/navigation'
import { NavigationProviderIcon } from './NavigationIcons'

interface NavigationPickerProps {
  selected: NavigationProvider | null
  onSelect: (provider: NavigationProvider) => void
}

export function NavigationPicker({ selected, onSelect }: NavigationPickerProps) {
  return (
    <div className="nav-picker" role="listbox" aria-label="Application de navigation">
      <ul className="nav-picker__list">
        {NAVIGATION_PROVIDER_OPTIONS.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              role="option"
              aria-selected={selected === option.id}
              aria-label={option.label}
              title={option.description}
              className={`nav-picker__option${selected === option.id ? ' nav-picker__option--selected' : ''}`}
              onClick={() => onSelect(option.id)}
            >
              <span className="nav-picker__option-icon">
                <NavigationProviderIcon provider={option.id} size={22} />
              </span>
              <span className="nav-picker__option-copy">
                <span className="nav-picker__option-label">{option.label}</span>
                <span className="nav-picker__option-desc">{option.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
