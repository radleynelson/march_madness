import type { Team } from '../../types/bracket';
import type { EspnBracketPick } from '../../types/espn-bracket';
import styles from './TeamRow.module.css';

interface TeamRowProps {
  team: Team | null;
  score: number | null;
  isWinner: boolean | null; // null = game not decided, true = won, false = lost
  isLive: boolean;
  probability?: number;
  position: 'top' | 'bottom';
  isOnPath?: boolean;
  pathColor?: string;
  isUserPick?: boolean;
  espnPick?: EspnBracketPick | null;
  showMyPicks?: boolean;
}

export function TeamRow({ team, score, isWinner, isLive, probability, position, isOnPath = false, pathColor, isUserPick = false, espnPick, showMyPicks = false }: TeamRowProps) {
  if (!team) {
    return (
      <div className={`${styles.row} ${styles.tbd} ${styles[position]}`}>
        <span className={styles.seed}>-</span>
        <span className={styles.name}>TBD</span>
      </div>
    );
  }

  const isEliminated = isWinner === false;
  const isPickedTeam = showMyPicks && espnPick && espnPick.side === position;

  return (
    <div
      className={`${styles.row} ${styles[position]} ${isEliminated ? styles.eliminated : ''} ${isWinner ? styles.winner : ''} ${isLive ? styles.live : ''} ${isOnPath ? styles.pathHighlight : ''} ${isUserPick ? styles.userPicked : ''}`}
      style={isOnPath && pathColor ? {
        background: pathColor,
        color: '#fff',
      } : undefined}
    >
      {isPickedTeam && (
        <span className={`${styles.pickDot} ${
          espnPick!.result === 'CORRECT' ? styles.pickCorrect :
          espnPick!.result === 'INCORRECT' ? styles.pickIncorrect :
          styles.pickPending
        }`} />
      )}
      <span
        className={styles.seed}
        data-seed={team.seed}
        style={isOnPath && pathColor ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : undefined}
      >
        {team.seed}
      </span>
      <img
        className={styles.logo}
        src={team.logoUrl}
        alt=""
        width={16}
        height={16}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <span className={styles.name} title={team.name}>
        {team.shortName}
      </span>
      <span className={styles.spacer} />
      {score !== null ? (
        <span
          className={`${styles.score} ${isWinner ? styles.scoreWinner : ''}`}
          style={isOnPath && pathColor ? { color: '#fff' } : undefined}
        >
          {score}
        </span>
      ) : probability !== undefined && probability > 0 ? (
        <span
          className={styles.probability}
          style={isOnPath && pathColor ? { color: 'rgba(255,255,255,0.9)' } : undefined}
        >
          {probability < 0.01 ? '<1' : Math.round(probability * 100)}%
        </span>
      ) : null}
    </div>
  );
}
