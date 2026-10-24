import "./GameBoot.css";

export default function GameBoot({ title, subtitle = "Loading game assets..." }) {
  return (
    <div className="game-boot" role="status" aria-live="polite" aria-label={`Loading ${title}`}>
      <div className="game-boot-card">
        <p className="game-boot-kicker">Get Ready</p>
        <h1>{title}</h1>
        <div className="game-boot-bar" aria-hidden="true">
          <span />
        </div>
        <p className="game-boot-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
