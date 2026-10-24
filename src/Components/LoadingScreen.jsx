import "./LoadingScreen.css";

export default function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite" aria-label="Loading Arcade Hub">
      <div className="loading-content">
        <p className="loading-kicker">Booting Cabinet</p>
        <h1>Arcade Hub</h1>
        <div className="loading-bar" aria-hidden="true">
          <span />
        </div>
        <p className="loading-subtitle">Loading players and game cartridges...</p>
      </div>

      <div className="loading-floaters" aria-hidden="true">
        <span className="loader-dot dot-a" />
        <span className="loader-dot dot-b" />
        <span className="loader-dot dot-c" />
      </div>
    </div>
  );
}
