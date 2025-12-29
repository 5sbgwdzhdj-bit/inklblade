
export interface Vector2 {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface Stain {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
}

export interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

export interface Leaf {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  vx: number;
  vy: number;
  phase: number;
}

export enum EntityState {
  IDLE,
  CHARGING,
  SLASHING,
  COOLDOWN
}

export interface Entity {
  id: string;
  pos: Vector2;
  hp: number;
  maxHp: number;
  state: EntityState;
  chargeTime: number;
  targetAngle: number;
  isPlayer: boolean;
  scoreValue?: number;
  cooldown?: number;
  dashCooldown?: number;
  isElite?: boolean;
  attackCount?: number;
}

export interface Item {
  id: string;
  pos: Vector2;
  type: 'HEALTH';
  pulse: number;
}

export interface GameState {
  player: Entity;
  enemies: Entity[];
  particles: Particle[];
  stains: Stain[];
  rain: RainDrop[];
  leaves: Leaf[];
  items: Item[];
  score: number;
  gameStatus: 'START' | 'PLAYING' | 'GAMEOVER';
  evaluationText?: string;
  flashOpacity: number;
}
