
import React, { useRef, useEffect, useState } from 'react';
import { GameMode, ItemType, Entity, Particle, HandPoint, GameConfig } from '../types';
import { GRAVITY, FRUIT_TYPES, SPECIAL_ITEMS, BLADE_LENGTH, BLADE_WIDTH } from '../constants';
import { randomRange, pointInCircle } from '../utils';

declare const window: any;

interface GameCanvasProps {
  config: GameConfig;
  onGameOver: (score: number, mode: GameMode, photo: string) => void;
  onExit: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ config, onGameOver, onExit }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  
  const scoreRef = useRef(0);
  const startTimeRef = useRef(0);
  const livesRef = useRef(10);
  const timeLeftRef = useRef(config.duration || 60);
  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const handTrailRef = useRef<HandPoint[]>([]); 
  const frameCountRef = useRef(0);
  const difficultyMultiplierRef = useRef(1.0); 
  const lastSpawnTimeRef = useRef(0);
  const isPausedRef = useRef(false);
  const isGameOverRef = useRef(false);
  const calibrationFramesRef = useRef(0);
  const hasShownStartRef = useRef(false);

  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(10);
  const [uiTime, setUiTime] = useState(config.duration || 60);
  const [notif, setNotif] = useState<{ text: string, opacity: number, scale: number } | null>(null);

  const exitHoldProgressRef = useRef(0);
  const isGrabbingRef = useRef(false);
  const handPosRef = useRef({ x: 0, y: 0 });
  const handLandmarksRef = useRef<any>(null);
  const effectIceRef = useRef(0); 
  
  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]
  ];

  const showNotification = (text: string) => {
    if (text === "BẮT ĐẦU!" && hasShownStartRef.current) return;
    if (text === "BẮT ĐẦU!") hasShownStartRef.current = true;
    setNotif({ text, opacity: 1.0, scale: 1.0 });
    const duration = text === "BẮT ĐẦU!" ? 3000 : 2000;
    setTimeout(() => setNotif(null), duration);
  };

  const isFist = (lm: any) => {
    const fingers = [8, 12, 16, 20];
    const knuckles = [5, 9, 13, 17];
    let foldedCount = 0;
    for (let i = 0; i < fingers.length; i++) {
      if (lm[fingers[i]].y > lm[knuckles[i]].y) foldedCount++;
    }
    return foldedCount >= 3;
  };

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    scoreRef.current = 0;
    livesRef.current = 10; 
    if (config.mode === GameMode.TIME) livesRef.current = 0;
    if (config.mode === GameMode.TEST_HANDS) livesRef.current = 999;
    
    setUiLives(livesRef.current);
    timeLeftRef.current = config.duration || 60;
    entitiesRef.current = [];
    particlesRef.current = [];
    handTrailRef.current = [];
    isGameOverRef.current = false;

    let animationFrameId: number;
    let cameraStream: MediaStream | null = null;

    const hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1, 
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results: any) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const lm = results.multiHandLandmarks[0];
          handLandmarksRef.current = lm;
          const tip = lm[8]; 
          const x = (1 - tip.x) * canvas.width;
          const y = tip.y * canvas.height;
          handPosRef.current = { x, y };
          isGrabbingRef.current = isFist(lm);

          let updatedTrail = [{ x, y }, ...handTrailRef.current];
          if (updatedTrail.length > BLADE_LENGTH) updatedTrail.pop();
          handTrailRef.current = updatedTrail;

          if (!isCalibrated) {
              const targetX = canvas.width / 2;
              const targetY = canvas.height / 2;
              const dist = Math.hypot(x - targetX, y - targetY);
              if (dist < canvas.width / 12) calibrationFramesRef.current += 2;
              else calibrationFramesRef.current = Math.max(0, calibrationFramesRef.current - 1);
              const progress = Math.min(100, (calibrationFramesRef.current / 50) * 100);
              setCalibrationProgress(progress);
              if (progress >= 100) {
                  setIsCalibrated(true);
                  startTimeRef.current = Date.now();
                  showNotification("BẮT ĐẦU!");
              }
          }
      } else {
          handTrailRef.current = [];
          handLandmarksRef.current = null;
          isGrabbingRef.current = false;
          if (!isCalibrated) {
              calibrationFramesRef.current = Math.max(0, calibrationFramesRef.current - 1);
              setCalibrationProgress((calibrationFramesRef.current / 50) * 100);
          }
      }
    });

    const startCamera = async () => {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 } });
        if (videoRef.current) {
          videoRef.current.srcObject = cameraStream;
          videoRef.current.onloadedmetadata = () => {
            const send = async () => {
                if (videoRef.current) await hands.send({ image: videoRef.current });
                animationFrameId = requestAnimationFrame(send);
            };
            send();
          };
        }
      } catch (err) { console.error(err); }
    };
    startCamera();

    const loop = () => {
      if (!ctx || !canvas || isGameOverRef.current) return;
      const nowTs = Date.now();

      ctx.save();
      ctx.scale(-1, 1); ctx.translate(-canvas.width, 0);
      ctx.filter = 'brightness(1.1) contrast(1.1) saturate(1.3) blur(1px)';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const vignette = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.width/4, canvas.width/2, canvas.height/2, canvas.width);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      if (!isCalibrated) {
         drawCalibrationOverlay(ctx, canvas);
         requestAnimationFrame(loop); return;
      }

      const exitBtnWidth = canvas.width / 6;
      const exitBtnHeight = canvas.height / 10;
      const { x: hx, y: hy } = handPosRef.current;
      if (hx >= canvas.width - exitBtnWidth - 50 && hy <= exitBtnHeight + 50 && isGrabbingRef.current) {
        exitHoldProgressRef.current += 1.5;
        if (exitHoldProgressRef.current >= 100) { onExit(); return; }
      } else { exitHoldProgressRef.current = 0; }

      frameCountRef.current++;
      if (frameCountRef.current % 600 === 0 && !isPausedRef.current && config.mode !== GameMode.TEST_HANDS) {
          difficultyMultiplierRef.current *= 1.15;
          showNotification("TĂNG TỐC!");
      }
      
      if (config.mode === GameMode.TIME && frameCountRef.current % 60 === 0) {
          timeLeftRef.current -= 1; setUiTime(timeLeftRef.current);
          if (timeLeftRef.current <= 0) { triggerGameOver(); return; }
      }
      
      if (effectIceRef.current > 0) effectIceRef.current--;
      const isIceActive = effectIceRef.current > 0;

      if (!isPausedRef.current) {
          let spawnRate = (config.mode === GameMode.TEST_HANDS ? 40 : 80) / difficultyMultiplierRef.current; 
          if (isIceActive) spawnRate /= 4; 
          if (frameCountRef.current - lastSpawnTimeRef.current > spawnRate) {
              spawnEntity(canvas.width, canvas.height, config.mode);
              lastSpawnTimeRef.current = frameCountRef.current;
          }
      }

      const entitiesToRemove: number[] = [];
      const newEntities: Entity[] = [];

      entitiesRef.current.forEach(entity => {
          if (!isPausedRef.current) {
            const speedMod = isIceActive ? 0.6 : 1.0;
            entity.vy += (entity.isHalf ? GRAVITY * 0.8 : GRAVITY) * speedMod;
            entity.x += entity.vx * speedMod;
            entity.y += entity.vy * speedMod;
            entity.rotation += (entity.isHalf ? entity.rotationSpeed * 1.5 : entity.rotationSpeed) * speedMod;
          }

          let opacity = 1.0;
          if (entity.isHalf && entity.slicedAt) {
              const age = nowTs - entity.slicedAt;
              opacity = Math.max(0, 1 - age / 1000);
              if (opacity <= 0) entitiesToRemove.push(entity.id);
          }

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.translate(entity.x, entity.y);
          ctx.rotate(entity.rotation);
          ctx.scale(entity.scale, entity.scale);
          ctx.shadowBlur = 20; ctx.shadowColor = entity.color;
          ctx.font = `${canvas.width / 25}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (entity.isHalf) {
              ctx.beginPath();
              entity.isHalf === 'left' ? ctx.rect(-100, -100, 100, 200) : ctx.rect(0, -100, 100, 200);
              ctx.clip();
          }
          ctx.fillText(entity.emoji, 0, 0);
          if (!entity.isHalf) {
            const shiny = ctx.createRadialGradient(-15, -15, 2, -15, -15, 15);
            shiny.addColorStop(0, 'rgba(255,255,255,0.7)');
            shiny.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = shiny; ctx.beginPath(); ctx.arc(-15, -15, 15, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
          
          if (entity.y > canvas.height + 200) {
              entitiesToRemove.push(entity.id);
              if (config.mode === GameMode.SURVIVAL && entity.type === ItemType.FRUIT && !entity.isHalf) {
                  livesRef.current -= 1; setUiLives(livesRef.current); 
                  if (livesRef.current <= 0) { triggerGameOver(); return; }
              }
          }
      });

      const trail = handTrailRef.current;
      entitiesRef.current.forEach((entity) => {
          if (entitiesToRemove.includes(entity.id) || entity.isHalf) return;
          if (trail.length > 0 && pointInCircle(trail[0].x, trail[0].y, entity.x, entity.y, canvas.width / 18)) {
              handleHitStandard(entity, newEntities, nowTs);
              entitiesToRemove.push(entity.id);
          }
      });

      entitiesRef.current = entitiesRef.current.filter(e => !entitiesToRemove.includes(e.id)).concat(newEntities);

      if (handLandmarksRef.current) {
          const lm = handLandmarksRef.current;
          ctx.lineWidth = canvas.width / 400; ctx.strokeStyle = isGrabbingRef.current ? '#ff00ff' : '#00ffff';
          HAND_CONNECTIONS.forEach(([s, e]) => {
              ctx.beginPath();
              ctx.moveTo((1 - lm[s].x) * canvas.width, lm[s].y * canvas.height);
              ctx.lineTo((1 - lm[e].x) * canvas.width, lm[e].y * canvas.height);
              ctx.stroke();
          });
      }

      particlesRef.current.forEach(p => {
          p.x += p.vx; p.y += p.vy; p.life -= 0.06;
          ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      });

      if (trail.length >= 2) {
          ctx.shadowBlur = 20; ctx.shadowColor = '#00ffff'; ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = BLADE_WIDTH; ctx.beginPath();
          ctx.moveTo(trail[0].x, trail[0].y);
          for (let j = 1; j < trail.length; j++) ctx.lineTo(trail[j].x, trail[j].y);
          ctx.stroke();
      }

      if (scoreRef.current !== uiScore) setUiScore(scoreRef.current);
      requestAnimationFrame(loop);
    };

    const triggerGameOver = () => {
        if (isGameOverRef.current || config.mode === GameMode.TEST_HANDS) return;
        isGameOverRef.current = true;
        const cap = document.createElement('canvas'); cap.width = 400; cap.height = 300;
        const cctx = cap.getContext('2d');
        if (cctx && video) { cctx.scale(-1, 1); cctx.drawImage(video, -400, 0, 400, 300); onGameOver(scoreRef.current, config.mode, cap.toDataURL('image/jpeg', 0.8)); }
    };

    const drawCalibrationOverlay = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
        const cw = canvas.width, ch = canvas.height, targetX = cw / 2, targetY = ch / 2;
        ctx.font = `bold ${cw / 25}px Bangers`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText('PUT INDEX FINGER IN CIRCLE', cw / 2, ch / 2 - ch / 5);
        ctx.beginPath(); ctx.lineWidth = cw / 120; ctx.strokeStyle = calibrationProgress > 0 ? '#00ffff' : '#fff';
        ctx.arc(targetX, targetY, cw / 15, 0, Math.PI * 2); ctx.stroke();
    };

    const spawnEntity = (w: number, h: number, mode: GameMode) => {
        const id = Math.random(), side = Math.random() > 0.5 ? 'left' : 'right';
        const x = side === 'left' ? randomRange(100, w/3) : randomRange(2*w/3, w-100);
        const y = h + 150;
        const launchVelocity = Math.sqrt(2 * GRAVITY * (h + randomRange(100, 250)));
        let vx = Math.cos(Math.PI/2.4) * launchVelocity * (side === 'left' ? 0.45 : -0.45);
        let vy = -Math.sin(Math.PI/2.4) * launchVelocity;
        let type = ItemType.FRUIT; let data = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
        if (Math.random() < 0.12) type = ItemType.BOMB;
        let emoji = data.emoji, color = data.color, scoreVal = data.score;
        if (type === ItemType.BOMB) { emoji = SPECIAL_ITEMS.BOMB.emoji; color = SPECIAL_ITEMS.BOMB.color; scoreVal = SPECIAL_ITEMS.BOMB.score; }
        entitiesRef.current.push({ id, type, x, y, vx, vy, rotation: 0, rotationSpeed: randomRange(-0.1, 0.1), scale: 2.8, emoji, color, isSliced: false, scoreValue: scoreVal });
    };

    const handleHitStandard = (entity: Entity, newEntities: Entity[], ts: number) => {
        if (isGameOverRef.current) return;
        if (entity.type === ItemType.BOMB) {
            scoreRef.current = Math.max(0, scoreRef.current - 10); isPausedRef.current = true;
            showNotification("BOM! -10");
        } else {
            scoreRef.current += entity.scoreValue;
            newEntities.push({...entity, id: Math.random(), isHalf: 'left', vx: entity.vx - 4, vy: entity.vy - 3, slicedAt: ts});
            newEntities.push({...entity, id: Math.random(), isHalf: 'right', vx: entity.vx + 4, vy: entity.vy - 3, slicedAt: ts});
        }
        for (let i = 0; i < 15; i++) particlesRef.current.push({ id: Math.random(), x: entity.x, y: entity.y, vx: randomRange(-10, 10), vy: randomRange(-10, 10), color: entity.color, life: 1.0, size: randomRange(5, 12) });
        if (isPausedRef.current) setTimeout(() => isPausedRef.current = false, 1000);
    };

    requestAnimationFrame(loop);
    return () => { if (cameraStream) cameraStream.getTracks().forEach(t => t.stop()); cancelAnimationFrame(animationFrameId); };
  }, [config]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} width={1920} height={1080} className="w-full h-full object-cover" />
        
        {notif && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none font-game text-center z-50">
            <div className="text-6xl md:text-9xl lg:text-[14rem] text-white drop-shadow-[0_0_60px_rgba(0,255,255,1)] italic animate-pulse">
              {notif.text}
            </div>
          </div>
        )}

        <div className="absolute top-0 left-0 w-full p-4 md:p-10 flex justify-between items-start font-game pointer-events-none">
            <div className="bg-white/10 backdrop-blur-2xl p-4 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border-2 md:border-4 border-white/20 shadow-2xl">
                <div className="text-4xl md:text-7xl lg:text-9xl text-yellow-400 drop-shadow-md">SCORE: {uiScore}</div>
                {config.mode !== GameMode.TIME && <div className="text-2xl md:text-5xl text-red-500 mt-2 uppercase">LIVES: {uiLives}</div>}
            </div>

            <div className="flex flex-col items-end pointer-events-auto">
                <div className="bg-red-600/30 backdrop-blur-2xl px-6 py-3 md:px-12 md:py-6 rounded-[1.5rem] md:rounded-[3rem] border-2 md:border-4 border-white/30 text-2xl md:text-5xl font-black italic shadow-2xl">
                    EXIT ⚔️
                </div>
                {config.mode === GameMode.TIME && (
                    <div className="text-5xl md:text-8xl lg:text-[10rem] text-white drop-shadow-2xl mt-4 md:mt-8">{uiTime}S</div>
                )}
            </div>
        </div>
    </div>
  );
};

export default GameCanvas;
