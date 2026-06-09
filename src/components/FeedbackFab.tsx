interface FeedbackFabProps {
  onClick: () => void
}

export function FeedbackFab({ onClick }: FeedbackFabProps) {
  return (
    <button
      type="button"
      className="feedback-fab"
      onClick={onClick}
      title="Signaler un problème"
      aria-label="Signaler un problème"
    >
      <span className="feedback-fab__icon" aria-hidden="true">
        ⚠
      </span>
      <span className="feedback-fab__label">Signaler un problème</span>
    </button>
  )
}
