
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Entity, EntityState, GameState, Vector2, Particle, Stain, RainDrop, Leaf, Item } from './types';
import { generateGamePoem } from './services/geminiService';

const PLAYER_RADIUS = 24; 
const ENEMY_RADIUS = 20;  
const ELITE_RADIUS = 28;
const ITEM_RADIUS = 18;
const CHARGE_TIME_PLAYER = 400; 
const CHARGE_TIME_ENEMY = 1200; 
const CHARGE_TIME_ELITE = 800; 
const SLASH_DISTANCE = 320; 
const SLASH_DURATION = 150; 
const SLASH_COOLDOWN = 200; 
const DASH_COOLDOWN = 2000; 
const SPAWN_INTERVAL = 1800; 
const ELITE_SPAWN_INTERVAL = 20000; 
const ITEM_SPAWN_INTERVAL = 15000; // 15 seconds for a health pack

const RAIN_COUNT = 100;
const LEAF_COUNT = 25;

// Colors
const COLOR_ENEMY = '#9b1c1c';
const COLOR_ELITE = '#4c1d95'; 
const COLOR_BLOOD = '#5b0707'; 
const COLOR_PLAYER = '#1a1a1a';
const COLOR_HEALTH = '#2d5a27'; // Jade Green for health packs
const COLOR_HEALTH_GLOW = '#66bb6a';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    player: {
      id: 'player',
      pos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      hp: 3,
      maxHp: 3,
      state: EntityState.IDLE,
      chargeTime: 0,
      targetAngle: 0,
      isPlayer: true,
      cooldown: 0,
      dashCooldown: 0
    },
    enemies: [],
    particles: [],
    stains: [],
    rain: [],
    leaves: [],
    items: [],
    score: 0,
    gameStatus: 'START',
    flashOpacity: 0
  });

  const [mousePos, setMousePos] = useState<Vector2>({ x: 0, y: 0 });
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const eliteSpawnTimerRef = useRef<number>(0);
  const itemSpawnTimerRef = useRef<number>(0);
  const isMouseDown = useRef<boolean>(false);
  const [poem, setPoem] = useState<string>('');
  const [isLoadingPoem, setIsLoadingPoem] = useState(false);

  useEffect(() => {
    const rain: RainDrop[] = Array.from({ length: RAIN_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      length: Math.random() * 20 + 10,
      speed: Math.random() * 15 + 10,
      opacity: Math.random() * 0.3 + 0.1
    }));

    const leaves: Leaf[] = Array.from({ length: LEAF_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 6 + 4,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      vx: Math.random() * 1 + 0.5,
      vy: Math.random() * 1.5 + 1,
      phase: Math.random() * Math.PI * 2
    }));

    setGameState(prev => ({ ...prev, rain, leaves }));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current[e.key.toLowerCase()] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current[e.key.toLowerCase()] = false;
    const handleMouseDown = () => { isMouseDown.current = true; };
    const handleMouseUp = () => { isMouseDown.current = false; };
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const createInkSplash = (x: number, y: number, color: string, count: number = 20) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: Math.random() * 50 + 50,
        size: Math.random() * 8 + 3,
        color
      });
    }
    return newParticles;
  };

  const createStains = (x: number, y: number, color: string): Stain[] => {
    const count = Math.floor(Math.random() * 4) + 4;
    const result: Stain[] = [];
    for (let i = 0; i < count; i++) {
      result.push({
        x: x + (Math.random() - 0.5) * 80,
        y: y + (Math.random() - 0.5) * 80,
        size: Math.random() * 50 + 20,
        alpha: Math.random() * 0.5 + 0.3,
        color,
        rotation: Math.random() * Math.PI * 2
      });
    }
    return result;
  };

  const spawnEnemy = useCallback((p: Entity, isElite = false): Entity => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(window.innerWidth, window.innerHeight) / 2 + 150;
    return {
      id: Math.random().toString(36).substr(2, 9),
      pos: {
        x: p.pos.x + Math.cos(angle) * dist,
        y: p.pos.y + Math.sin(angle) * dist
      },
      hp: isElite ? 3 : 1,
      maxHp: isElite ? 3 : 1,
      state: EntityState.IDLE,
      chargeTime: 0,
      targetAngle: 0,
      isPlayer: false,
      scoreValue: isElite ? 25 : 5,
      isElite: isElite,
      attackCount: isElite ? 2 : 1
    };
  }, []);

  const spawnHealthPack = useCallback((): Item => {
    const margin = 100;
    return {
      id: Math.random().toString(36).substr(2, 9),
      pos: {
        x: margin + Math.random() * (window.innerWidth - margin * 2),
        y: margin + Math.random() * (window.innerHeight - margin * 2)
      },
      type: 'HEALTH',
      pulse: 0
    };
  }, []);

  const update = (time: number) => {
    const deltaTime = Math.min(time - lastTimeRef.current, 50); 
    lastTimeRef.current = time;

    setGameState(prev => {
      const newGameState = { ...prev };

      newGameState.rain.forEach(drop => {
        drop.y += drop.speed;
        drop.x += 1;
        if (drop.y > window.innerHeight) {
          drop.y = -drop.length;
          drop.x = Math.random() * window.innerWidth;
        }
      });

      newGameState.leaves.forEach(leaf => {
        leaf.y += leaf.vy;
        leaf.x += leaf.vx + Math.sin(time / 500 + leaf.phase) * 1.5;
        leaf.rotation += leaf.rotationSpeed;
        if (leaf.y > window.innerHeight + 20 || leaf.x > window.innerWidth + 20) {
          leaf.y = -20;
          leaf.x = Math.random() * window.innerWidth;
        }
      });

      if (prev.gameStatus !== 'PLAYING') return newGameState;

      const { player, enemies, particles, items } = newGameState;

      if (newGameState.flashOpacity > 0) {
        newGameState.flashOpacity -= 0.005 * deltaTime;
        if (newGameState.flashOpacity < 0) newGameState.flashOpacity = 0;
      }

      // 0. Update Player Cooldowns
      if (player.cooldown && player.cooldown > 0) {
        player.cooldown -= deltaTime;
        if (player.cooldown <= 0) {
          player.cooldown = 0;
          if (player.state === EntityState.COOLDOWN) player.state = EntityState.IDLE;
        }
      }

      if (player.dashCooldown && player.dashCooldown > 0) {
        player.dashCooldown -= deltaTime;
        if (player.dashCooldown < 0) player.dashCooldown = 0;
      }

      // 1. Shift Dash Mechanic
      const isDashing = keysPressed.current['shift'] && (!player.dashCooldown || player.dashCooldown <= 0);
      if (isDashing && player.state !== EntityState.SLASHING) {
        let dx = 0;
        let dy = 0;
        if (keysPressed.current['w']) dy -= 1;
        if (keysPressed.current['s']) dy += 1;
        if (keysPressed.current['a']) dx -= 1;
        if (keysPressed.current['d']) dx += 1;

        let dashAngle = player.targetAngle; 
        if (dx !== 0 || dy !== 0) {
            dashAngle = Math.atan2(dy, dx);
        }

        const destX = player.pos.x + Math.cos(dashAngle) * SLASH_DISTANCE;
        const destY = player.pos.y + Math.sin(dashAngle) * SLASH_DISTANCE;

        const hitEnemies: string[] = [];
        enemies.forEach(en => {
          const steps = 20;
          for(let i=0; i<=steps; i++){
              const lx = player.pos.x + (destX - player.pos.x) * (i/steps);
              const ly = player.pos.y + (destY - player.pos.y) * (i/steps);
              const dist = Math.hypot(en.pos.x - lx, en.pos.y - ly);
              if(dist < (en.isElite ? ELITE_RADIUS : ENEMY_RADIUS) + 30){ 
                  hitEnemies.push(en.id);
                  break;
              }
          }
        });

        hitEnemies.forEach(id => {
          const index = enemies.findIndex(e => e.id === id);
          if (index !== -1) {
            const en = enemies[index];
            en.hp -= 1;
            newGameState.particles.push(...createInkSplash(en.pos.x, en.pos.y, COLOR_BLOOD, 120)); 
            newGameState.stains.push(...createStains(en.pos.x, en.pos.y, COLOR_BLOOD));
            if (en.hp <= 0) {
              newGameState.score += en.scoreValue || 5;
              enemies.splice(index, 1);
            }
          }
        });

        player.pos.x = destX;
        player.pos.y = destY;
        player.dashCooldown = DASH_COOLDOWN;
        player.state = EntityState.IDLE;
        newGameState.flashOpacity = 0.8; 
        newGameState.particles.push(...createInkSplash(player.pos.x, player.pos.y, COLOR_PLAYER, 50));
      }

      // 2. Regular Player Movement
      if (player.state !== EntityState.SLASHING && player.state !== EntityState.CHARGING) {
        const moveSpeed = 0.22 * deltaTime;
        let dx = 0;
        let dy = 0;
        if (keysPressed.current['w']) dy -= 1;
        if (keysPressed.current['s']) dy += 1;
        if (keysPressed.current['a']) dx -= 1;
        if (keysPressed.current['d']) dx += 1;

        if (dx !== 0 || dy !== 0) {
          const mag = Math.sqrt(dx * dx + dy * dy);
          player.pos.x += (dx / mag) * moveSpeed;
          player.pos.y += (dy / mag) * moveSpeed;
        }
      }

      // 3. Slashing logic
      player.targetAngle = Math.atan2(mousePos.y - player.pos.y, mousePos.x - player.pos.x);
      
      if (isMouseDown.current && (player.state === EntityState.IDLE || player.state === EntityState.COOLDOWN) && (!player.cooldown || player.cooldown <= 0)) {
        player.state = EntityState.CHARGING;
        player.chargeTime = 0;
      }

      if (player.state === EntityState.CHARGING) {
        if (!isMouseDown.current) {
          player.state = EntityState.IDLE;
          player.chargeTime = 0;
        } else {
          player.chargeTime += deltaTime;
          if (player.chargeTime >= CHARGE_TIME_PLAYER) {
            player.state = EntityState.SLASHING;
            player.chargeTime = 0;
            newGameState.flashOpacity = 0.7; 

            const destX = player.pos.x + Math.cos(player.targetAngle) * SLASH_DISTANCE;
            const destY = player.pos.y + Math.sin(player.targetAngle) * SLASH_DISTANCE;
            
            const hitEnemies: string[] = [];
            enemies.forEach(en => {
              const steps = 20;
              for(let i=0; i<=steps; i++){
                  const lx = player.pos.x + (destX - player.pos.x) * (i/steps);
                  const ly = player.pos.y + (destY - player.pos.y) * (i/steps);
                  const dist = Math.hypot(en.pos.x - lx, en.pos.y - ly);
                  if(dist < (en.isElite ? ELITE_RADIUS : ENEMY_RADIUS) + 25){
                      hitEnemies.push(en.id);
                      break;
                  }
              }
            });

            hitEnemies.forEach(id => {
              const index = enemies.findIndex(e => e.id === id);
              if (index !== -1) {
                const en = enemies[index];
                en.hp -= 1;
                newGameState.particles.push(...createInkSplash(en.pos.x, en.pos.y, COLOR_BLOOD, 100)); 
                newGameState.stains.push(...createStains(en.pos.x, en.pos.y, COLOR_BLOOD));
                if (en.hp <= 0) {
                  newGameState.score += en.scoreValue || 5;
                  enemies.splice(index, 1);
                }
              }
            });

            player.pos.x = destX;
            player.pos.y = destY;
            newGameState.particles.push(...createInkSplash(player.pos.x, player.pos.y, COLOR_PLAYER, 40)); 
            
            setTimeout(() => {
              setGameState(p => ({
                  ...p,
                  player: { ...p.player, state: EntityState.COOLDOWN, cooldown: SLASH_COOLDOWN }
              }));
            }, SLASH_DURATION);
          }
        }
      }

      // 4. Spawning
      spawnTimerRef.current += deltaTime;
      if (spawnTimerRef.current > SPAWN_INTERVAL) {
        enemies.push(spawnEnemy(player));
        spawnTimerRef.current = 0;
      }

      eliteSpawnTimerRef.current += deltaTime;
      if (eliteSpawnTimerRef.current > ELITE_SPAWN_INTERVAL) {
        enemies.push(spawnEnemy(player, true));
        eliteSpawnTimerRef.current = 0;
      }

      itemSpawnTimerRef.current += deltaTime;
      if (itemSpawnTimerRef.current > ITEM_SPAWN_INTERVAL) {
        items.push(spawnHealthPack());
        itemSpawnTimerRef.current = 0;
      }

      // 5. Items Logic (Collection & Animation)
      newGameState.items = items.filter(item => {
        item.pulse += deltaTime * 0.005;
        const d = Math.hypot(player.pos.x - item.pos.x, player.pos.y - item.pos.y);
        if (d < PLAYER_RADIUS + ITEM_RADIUS) {
            if (player.hp < player.maxHp) {
                player.hp += 1;
                newGameState.particles.push(...createInkSplash(item.pos.x, item.pos.y, COLOR_HEALTH, 30));
                return false; // Collected
            }
        }
        return true;
      });

      // 6. Enemies AI
      enemies.forEach(en => {
        const dist = Math.hypot(player.pos.x - en.pos.x, player.pos.y - en.pos.y);
        const curChargeLimit = en.isElite ? CHARGE_TIME_ELITE : CHARGE_TIME_ENEMY;
        
        if (en.state === EntityState.IDLE) {
          const angle = Math.atan2(player.pos.y - en.pos.y, player.pos.x - en.pos.x);
          const enemySpeed = (en.isElite ? 0.1 : 0.08) * deltaTime;
          en.pos.x += Math.cos(angle) * enemySpeed;
          en.pos.y += Math.sin(angle) * enemySpeed;
          
          if (dist < SLASH_DISTANCE * (en.isElite ? 1.0 : 0.7)) {
            en.state = EntityState.CHARGING;
            en.chargeTime = 0;
            en.targetAngle = angle;
          }
        } else if (en.state === EntityState.CHARGING) {
          en.chargeTime += deltaTime;
          if (en.chargeTime >= curChargeLimit) {
            en.state = EntityState.SLASHING;
            en.chargeTime = 0;
            const destX = en.pos.x + Math.cos(en.targetAngle) * SLASH_DISTANCE;
            const destY = en.pos.y + Math.sin(en.targetAngle) * SLASH_DISTANCE;

            const steps = 20;
            let hitPlayer = false;
            for(let i=0; i<=steps; i++){
                const lx = en.pos.x + (destX - en.pos.x) * (i/steps);
                const ly = en.pos.y + (destY - en.pos.y) * (i/steps);
                const d = Math.hypot(player.pos.x - lx, player.pos.y - ly);
                if(d < PLAYER_RADIUS + 15){
                    hitPlayer = true;
                    break;
                }
            }

            if(hitPlayer && player.state !== EntityState.SLASHING) {
                player.hp -= 1;
                newGameState.flashOpacity = 0.5;
                newGameState.particles.push(...createInkSplash(player.pos.x, player.pos.y, COLOR_PLAYER, 80));
                newGameState.stains.push(...createStains(player.pos.x, player.pos.y, COLOR_PLAYER));
                if (player.hp <= 0) {
                    newGameState.gameStatus = 'GAMEOVER';
                }
            }

            en.pos.x = destX;
            en.pos.y = destY;
            
            if (en.isElite && en.attackCount && en.attackCount > 1) {
                setTimeout(() => {
                    setGameState(p => ({
                        ...p,
                        enemies: p.enemies.map(e => e.id === en.id ? { 
                            ...e, 
                            state: EntityState.CHARGING, 
                            attackCount: (e.attackCount || 1) - 1,
                            targetAngle: Math.atan2(p.player.pos.y - e.pos.y, p.player.pos.x - e.pos.x) 
                        } : e)
                    }));
                }, SLASH_DURATION + 100);
            } else {
                setTimeout(() => {
                    setGameState(p => ({
                        ...p,
                        enemies: p.enemies.map(e => e.id === en.id ? { 
                            ...e, 
                            state: EntityState.IDLE,
                            attackCount: e.isElite ? 2 : 1 
                        } : e)
                    }));
                }, SLASH_DURATION);
            }
          }
        }
      });

      newGameState.particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.vx *= 0.94;
        p.vy *= 0.94;
        return p.life < p.maxLife;
      });

      if (newGameState.stains.length > 300) {
        newGameState.stains.shift();
      }

      return newGameState;
    });

    requestAnimationFrame(update);
  };

  useEffect(() => {
    const animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(40, 40, 40, 0.15)';
    ctx.lineWidth = 1;
    gameState.rain.forEach(drop => {
      ctx.globalAlpha = drop.opacity;
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + 1, drop.y + drop.length);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    gameState.stains.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2;
          const radius = s.size * (0.7 + Math.random() * 0.6);
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    gameState.leaves.forEach(leaf => {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.rotation);
      ctx.fillStyle = 'rgba(60, 50, 40, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size, leaf.size / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render Health Items (Jade Green Glow)
    gameState.items.forEach(item => {
        ctx.save();
        const glow = 5 + Math.sin(item.pulse) * 5;
        ctx.shadowBlur = 15 + glow;
        ctx.shadowColor = COLOR_HEALTH_GLOW;
        ctx.fillStyle = COLOR_HEALTH;
        ctx.beginPath();
        ctx.arc(item.pos.x, item.pos.y, ITEM_RADIUS + Math.sin(item.pulse) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Jade texture detail
        ctx.beginPath();
        ctx.strokeStyle = COLOR_HEALTH_GLOW;
        ctx.lineWidth = 2;
        ctx.arc(item.pos.x, item.pos.y, (ITEM_RADIUS / 2) + Math.cos(item.pulse) * 1, 0, Math.PI * 2);
        ctx.stroke();
    });

    gameState.particles.forEach(p => {
      ctx.beginPath();
      const alpha = 1 - (p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.arc(p.x, p.y, p.size * (1 - p.life / p.maxLife * 0.5), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    gameState.enemies.forEach(en => {
      if (en.state === EntityState.CHARGING) {
        ctx.setLineDash([15, 10]);
        ctx.strokeStyle = en.isElite ? 'rgba(76, 29, 149, 0.4)' : 'rgba(155, 28, 28, 0.4)';
        ctx.lineWidth = en.isElite ? 40 : 30; 
        ctx.beginPath();
        ctx.moveTo(en.pos.x, en.pos.y);
        ctx.lineTo(en.pos.x + Math.cos(en.targetAngle) * SLASH_DISTANCE, en.pos.y + Math.sin(en.targetAngle) * SLASH_DISTANCE);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.fillStyle = en.isElite ? COLOR_ELITE : COLOR_ENEMY;
      ctx.arc(en.pos.x, en.pos.y, en.isElite ? ELITE_RADIUS : ENEMY_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = en.isElite ? '#2e1065' : '#7f1d1d';
      ctx.lineWidth = 4; 
      ctx.stroke();

      if (en.isElite && en.hp < en.maxHp) {
          const hpWidth = 40;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(en.pos.x - hpWidth/2, en.pos.y - 45, hpWidth, 6);
          ctx.fillStyle = COLOR_ELITE;
          ctx.fillRect(en.pos.x - hpWidth/2, en.pos.y - 45, hpWidth * (en.hp / en.maxHp), 6);
      }
    });

    const p = gameState.player;
    
    // UI Cooldown indicators
    if (p.dashCooldown && p.dashCooldown > 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(91, 7, 7, 0.4)';
      ctx.lineWidth = 6;
      ctx.arc(p.pos.x, p.pos.y, PLAYER_RADIUS + 25, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * (p.dashCooldown / DASH_COOLDOWN)));
      ctx.stroke();
    }

    if (p.state === EntityState.CHARGING) {
      ctx.setLineDash([12, 18]);
      ctx.strokeStyle = 'rgba(26, 26, 26, 0.4)';
      ctx.lineWidth = 40; 
      ctx.beginPath();
      ctx.moveTo(p.pos.x, p.pos.y);
      ctx.lineTo(p.pos.x + Math.cos(p.targetAngle) * SLASH_DISTANCE, p.pos.y + Math.sin(p.targetAngle) * SLASH_DISTANCE);
      ctx.stroke();
      ctx.setLineDash([]);

      const progress = Math.min(p.chargeTime / CHARGE_TIME_PLAYER, 1);
      ctx.beginPath();
      ctx.strokeStyle = COLOR_PLAYER;
      ctx.lineWidth = 6;
      ctx.arc(p.pos.x, p.pos.y, PLAYER_RADIUS + 15, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * progress));
      ctx.stroke();
    }

    if (p.state === EntityState.COOLDOWN && p.cooldown && p.cooldown > 0) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 4;
      ctx.arc(p.pos.x, p.pos.y, PLAYER_RADIUS + 15, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * (p.cooldown / SLASH_COOLDOWN)));
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = COLOR_PLAYER;
    ctx.arc(p.pos.x, p.pos.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.arc(p.pos.x, p.pos.y, PLAYER_RADIUS + 5, Math.random() * Math.PI, Math.random() * Math.PI + Math.PI);
    ctx.stroke();

    if (gameState.flashOpacity > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${gameState.flashOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

  }, [gameState, mousePos]);

  const startGame = () => {
    setGameState(prev => ({
      ...prev,
      player: {
        id: 'player',
        pos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        hp: 3,
        maxHp: 3,
        state: EntityState.IDLE,
        chargeTime: 0,
        targetAngle: 0,
        isPlayer: true,
        cooldown: 0,
        dashCooldown: 0
      },
      enemies: [],
      particles: [],
      stains: [],
      items: [],
      score: 0,
      gameStatus: 'PLAYING',
      flashOpacity: 0
    }));
    setPoem('');
    spawnTimerRef.current = 0;
    eliteSpawnTimerRef.current = 0;
    itemSpawnTimerRef.current = 0;
  };

  useEffect(() => {
    if (gameState.gameStatus === 'GAMEOVER') {
        setIsLoadingPoem(true);
        generateGamePoem(gameState.score).then(text => {
            setPoem(text);
            setIsLoadingPoem(false);
        });
    }
  }, [gameState.gameStatus, gameState.score]);

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#f4f1ea]">
      <canvas
        ref={canvasRef}
        className="block"
      />

      {gameState.gameStatus === 'PLAYING' && (
        <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
          <div className="text-5xl chinese-font text-stone-800 drop-shadow-sm">
            積分: {gameState.score}
          </div>
          <div className="flex gap-4">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i} 
                className={`w-10 h-10 rounded-full border-4 border-stone-800 transition-colors duration-300 ${i < gameState.player.hp ? 'bg-red-800' : 'bg-transparent border-stone-400'}`}
              />
            ))}
          </div>
        </div>
      )}

      {gameState.gameStatus === 'START' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-100/60 backdrop-blur-sm">
          <h1 className="text-[12rem] chinese-font mb-8 text-stone-900 tracking-widest drop-shadow-2xl">墨劍</h1>
          <p className="text-2xl mb-12 text-stone-700 italic">WASD 移動 | 长按鼠标左键指向蓄力 | Shift 瞬间爆发斩击</p>
          <div className="text-stone-500 mb-8 italic">每 20 秒會出現強大的紫色精英 | 尋找翠綠色的玉佩恢復體力</div>
          <button
            onClick={startGame}
            className="px-20 py-6 bg-stone-900 text-stone-100 text-4xl chinese-font hover:bg-stone-700 transition-all rounded-sm shadow-2xl active:scale-95"
          >
            入 阵
          </button>
        </div>
      )}

      {gameState.gameStatus === 'GAMEOVER' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-lg transition-all duration-1000">
          <h2 className="text-[10rem] chinese-font mb-4 text-stone-900">墨盡</h2>
          <p className="text-5xl chinese-font mb-8 text-stone-700">最終得分: {gameState.score}</p>
          
          <div className="max-w-2xl text-center px-10 py-12 border-y-2 border-stone-300 mb-10 min-h-[160px] flex items-center justify-center">
            {isLoadingPoem ? (
              <div className="animate-pulse text-stone-400 italic text-2xl">正在撰寫輓歌...</div>
            ) : (
              <p className="text-2xl text-stone-800 leading-relaxed font-serif whitespace-pre-wrap italic">{poem}</p>
            )}
          </div>

          <button
            onClick={startGame}
            className="px-20 py-6 bg-stone-900 text-stone-100 text-4xl chinese-font hover:bg-stone-700 transition-all rounded-sm shadow-2xl"
          >
            再 續 前 缘
          </button>
        </div>
      )}

      <div className="absolute bottom-6 right-6 text-stone-500 text-sm font-serif uppercase tracking-[0.3em] pointer-events-none opacity-60">
        Ink Wash Wuxia Engine v1.7
      </div>
    </div>
  );
};

export default App;
