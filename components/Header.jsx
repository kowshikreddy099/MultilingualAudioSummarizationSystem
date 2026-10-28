export default function Header() {
  return (
    <header className="header" role="banner">
      <div className="header__logo" aria-label="MLYTAS">MLYTAS</div>
      <div className="header__divider" aria-hidden="true" />
      <span className="header__subtitle">YouTube Audio Summarizer</span>
    </header>
  );
}
