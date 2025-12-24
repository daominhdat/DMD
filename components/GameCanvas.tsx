
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
  const isGameOverRef = useRef(false); // New Ref to lock score
  const calibrationFramesRef = useRef(0);
  const bombExplosionRef = useRef(0); 
  const hasShownStartRef = useRef(false);

  // Combo & Multiplier state
  const comboHitsRef = useRef(0);
  const multiplierRef = useRef(1);
  const [uiCombo, setUiCombo] = useState(0);
  const [uiMultiplier, setUiMultiplier] = useState(1);

  // Gesture/Exit state
  const exitHoldProgressRef = useRef(0);
  const [uiExitHold, setUiExitHold] = useState(0);
  const isGrabbingRef = useRef(false);
  const handPosRef = useRef({ x: 0, y: 0 });
  
  const missedFruitsRef = useRef<{ x: number, y: number, life: number }[]>([]);
  const [notif, setNotif] = useState<{ text: string, opacity: number, scale: number } | null>(null);
  const notifTimeoutRef = useRef<number | null>(null);
  const effectIceRef = useRef(0); 
  
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(10);
  const [uiTime, setUiTime] = useState(config.duration || 60);
  const [levelProgress, setLevelProgress] = useState(0);

  const heartPulseRef = useRef(0);

  const showNotification = (text: string) => {
    if (text === "BẮT ĐẦU!" && hasShownStartRef.current) return;
    if (text === "BẮT ĐẦU!") hasShownStartRef.current = true;
    if (notifTimeoutRef.current) window.clearInterval(notifTimeoutRef.current);
    
    setNotif({ text, opacity: 1.0, scale: 1.0 });
    const startTime = Date.now();
    const duration = text === "BẮT ĐẦU!" ? 4000 : 2500; 
    
    notifTimeoutRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      if (progress >= 1) {
        if (notifTimeoutRef.current) window.clearInterval(notifTimeoutRef.current);
        notifTimeoutRef.current = null;
        setNotif(null);
      } else {
        setNotif({ text, opacity: Math.max(0, 1 - progress), scale: 1 + progress * 1.5 });
      }
    }, 16);
  };

  const isFist = (landmarks: any) => {
    const fingers = [8, 12, 16, 20];
    const knuckles = [5, 9, 13, 17];
    let foldedCount = 0;
    for (let i = 0; i < fingers.length; i++) {
      if (landmarks[fingers[i]].y > landmarks[knuckles[i]].y) foldedCount++;
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
    
    setUiLives(livesRef.current);
    timeLeftRef.current = config.duration || 60;
    entitiesRef.current = [];
    particlesRef.current = [];
    handTrailRef.current = [];
    frameCountRef.current = 0;
    difficultyMultiplierRef.current = 1.0;
    missedFruitsRef.current = [];
    comboHitsRef.current = 0;
    multiplierRef.current = 1;
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
          const landmarks = results.multiHandLandmarks[0];
          const tip = landmarks[8]; 
          const x = (1 - tip.x) * canvas.width;
          const y = tip.y * canvas.height;
          handPosRef.current = { x, y };

          const grabbing = isFist(landmarks);
          isGrabbingRef.current = grabbing;

          let updatedTrail = [{ x, y }, ...handTrailRef.current];
          if (updatedTrail.length > BLADE_LENGTH) updatedTrail.pop();
          handTrailRef.current = updatedTrail;

          if (!isCalibrated) {
              const targetX = canvas.width / 2;
              const targetY = canvas.height / 2;
              const dist = Math.hypot(x - targetX, y - targetY);
              
              if (dist < 80) {
                calibrationFramesRef.current += 1.5;
              } else {
                calibrationFramesRef.current = Math.max(0, calibrationFramesRef.current - 1);
              }
              const progress = Math.min(100, (calibrationFramesRef.current / 45) * 100);
              setCalibrationProgress(progress);
              if (progress >= 100) {
                  setIsCalibrated(true);
                  startTimeRef.current = Date.now();
                  showNotification("BẮT ĐẦU!");
              }
          }
      } else {
          handTrailRef.current = [];
          isGrabbingRef.current = false;
          if (!isCalibrated) {
              calibrationFramesRef.current = Math.max(0, calibrationFramesRef.current - 1);
              setCalibrationProgress((calibrationFramesRef.current / 45) * 100);
          }
      }
    });

    const startCamera = async () => {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = cameraStream;
          await videoRef.current.play();
          
          const sendToMediaPipe = async () => {
             if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
                 await hands.send({ image: videoRef.current });
             }
             if (cameraStream) animationFrameId = requestAnimationFrame(sendToMediaPipe);
          };
          sendToMediaPipe();
        }
      } catch (err) {
        console.error("Camera access error:", err);
      }
    };
    startCamera();

    const loop = () => {
      if (!ctx || !canvas) return;
      if (isGameOverRef.current) return; // Stop loop logic if game over triggered

      const nowTs = Date.now();

      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (!isCalibrated) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0,0, canvas.width, canvas.height);
      }
      ctx.restore();

      if (!isCalibrated) {
         drawCalibrationOverlay(ctx, canvas);
         requestAnimationFrame(loop); 
         return;
      }

      // Exit gesture check
      const exitBtnRect = { x: canvas.width - 250, y: 20, w: 220, h: 80 };
      const { x: hx, y: hy } = handPosRef.current;
      if (hx >= exitBtnRect.x && hx <= exitBtnRect.x + exitBtnRect.w && hy >= exitBtnRect.y && hy <= exitBtnRect.y + exitBtnRect.h && isGrabbingRef.current) {
        exitHoldProgressRef.current += 1.2;
        setUiExitHold(Math.min(100, exitHoldProgressRef.current));
        if (exitHoldProgressRef.current >= 100) { onExit(); return; }
      } else {
        exitHoldProgressRef.current = 0;
        setUiExitHold(0);
      }

      frameCountRef.current++;
      const cycle = frameCountRef.current % 600;
      setLevelProgress((cycle / 600) * 100);
      
      if (config.mode === GameMode.DODGE) {
        heartPulseRef.current = (Math.sin(nowTs / 200) + 1) * 0.1 + 1; 
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(heartPulseRef.current, heartPulseRef.current);
        ctx.font = '100px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'red';
        ctx.fillText('❤️', 0, 0);
        ctx.restore();
      }

      if (cycle === 0 && !isPausedRef.current) {
          difficultyMultiplierRef.current *= 1.2;
          showNotification("TĂNG TỐC!");
      }
      
      if (config.mode === GameMode.TIME) {
          if (frameCountRef.current % 60 === 0 && !isPausedRef.current) {
            timeLeftRef.current -= 1;
            setUiTime(timeLeftRef.current);
            if (timeLeftRef.current <= 0) { triggerGameOver(); return; }
          }
      }
      
      if (effectIceRef.current > 0) effectIceRef.current--;
      const isIceActive = effectIceRef.current > 0;

      if (!isPausedRef.current) {
          // GIẢM MỘT NỬA TỐC ĐỘ XUẤT HIỆN: 
          // Trước đây 35 -> Giờ tăng lên 70 (số càng lớn, thời gian giữa các lần spawn càng lâu)
          let spawnRate = 70 / difficultyMultiplierRef.current; 
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

            if (entity.x < 50 || entity.x > canvas.width - 50) {
                entity.vx *= -0.5;
                entity.x = entity.x < 50 ? 51 : canvas.width - 51;
            }
          }

          let opacity = 1.0;
          if (entity.isHalf && entity.slicedAt) {
              const age = nowTs - entity.slicedAt;
              opacity = Math.max(0, 1 - age / 1500);
              if (opacity <= 0) entitiesToRemove.push(entity.id);
          }

          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.translate(entity.x, entity.y);
          ctx.rotate(entity.rotation);
          ctx.scale(entity.scale, entity.scale);
          ctx.shadowBlur = entity.isHalf ? 0 : 25; 
          ctx.shadowColor = entity.color;
          ctx.font = '50px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (entity.isHalf) {
              ctx.beginPath();
              entity.isHalf === 'left' ? ctx.rect(-50, -50, 50, 100) : ctx.rect(0, -50, 50, 100);
              ctx.clip();
          }
          ctx.fillText(entity.emoji, 0, 0);
          ctx.restore();
          
          if (config.mode === GameMode.DODGE && !entity.isHalf && !entity.isSliced) {
              const distToHeart = Math.hypot(entity.x - canvas.width / 2, entity.y - canvas.height / 2);
              if (distToHeart < 80) { 
                  if (entity.type === ItemType.BOMB) {
                      livesRef.current -= 1; setUiLives(livesRef.current);
                      showNotification("BOM NỔ! -1 HP");
                      createExplosion(entity.x, entity.y, '#000', 20);
                  } else {
                      livesRef.current -= 1; setUiLives(livesRef.current);
                      showNotification("ĐAU TIM QUÁ! -1");
                      createExplosion(entity.x, entity.y, '#ff0000', 10);
                  }
                  entitiesToRemove.push(entity.id);
                  if (livesRef.current <= 0) { triggerGameOver(); return; }
              }
          }

          if (entity.y > canvas.height + 300) {
              entitiesToRemove.push(entity.id);
              if (config.mode === GameMode.SURVIVAL && entity.type === ItemType.FRUIT && !entity.isHalf) {
                  livesRef.current -= 1; setUiLives(livesRef.current); 
                  showNotification("TRƯỢT!");
                  missedFruitsRef.current.push({ x: entity.x, y: canvas.height - 50, life: 1.0 });
                  
                  comboHitsRef.current = 0; multiplierRef.current = 1;
                  setUiCombo(0); setUiMultiplier(1);

                  if (livesRef.current <= 0) { triggerGameOver(); return; }
              }
          }
      });

      missedFruitsRef.current = missedFruitsRef.current.filter(m => m.life > 0);
      missedFruitsRef.current.forEach(m => {
          ctx.save(); ctx.globalAlpha = m.life; ctx.strokeStyle = 'red'; ctx.lineWidth = 10;
          const size = 30; ctx.beginPath();
          ctx.moveTo(m.x - size, m.y - size); ctx.lineTo(m.x + size, m.y + size);
          ctx.moveTo(m.x + size, m.y - size); ctx.lineTo(m.x - size, m.y + size);
          ctx.stroke(); ctx.restore(); m.life -= 0.02;
      });

      const trail = handTrailRef.current;
      entitiesRef.current.forEach((entity) => {
          if (entitiesToRemove.includes(entity.id) || entity.isHalf) return;
          if (trail.length > 0 && pointInCircle(trail[0].x, trail[0].y, entity.x, entity.y, 80)) {
              handleHitStandard(entity, newEntities, nowTs);
              entitiesToRemove.push(entity.id);
          }
      });

      entitiesRef.current = entitiesRef.current.filter(e => !entitiesToRemove.includes(e.id)).concat(newEntities);

      particlesRef.current.forEach(p => {
          p.x += p.vx; p.y += p.vy; p.life -= 0.04;
          ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1.0;
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      if (trail.length >= 2) {
          ctx.shadowBlur = 20; ctx.shadowColor = '#00ffff'; ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = BLADE_WIDTH; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y);
          for (let j = 1; j < trail.length; j++) ctx.lineTo(trail[j].x, trail[j].y);
          ctx.stroke(); ctx.shadowBlur = 0;
      }

      if (scoreRef.current !== uiScore) setUiScore(scoreRef.current);
      requestAnimationFrame(loop);
    };

    const triggerGameOver = () => {
        if (isGameOverRef.current) return; // Prevent multiple triggers
        isGameOverRef.current = true; // Lock scoring
        
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = 400; captureCanvas.height = 300;
        const cctx = captureCanvas.getContext('2d');
        if (cctx && video) {
            cctx.scale(-1, 1); cctx.drawImage(video, -400, 0, 400, 300);
            const photo = captureCanvas.toDataURL('image/jpeg', 0.8);
            onGameOver(scoreRef.current, config.mode, photo);
        }
    };

    const drawCalibrationOverlay = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
        const cw = canvas.width; const ch = canvas.height;
        const targetX = cw / 2; const targetY = ch / 2;
        ctx.font = 'bold 50px Bangers'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText('ĐƯA NGÓN TRỎ VÀO VÒNG TRÒN ĐỂ BẮT ĐẦU', cw / 2, ch / 2 - 150);
        ctx.save();
        ctx.lineWidth = 8; ctx.strokeStyle = calibrationProgress > 0 ? '#00ffff' : '#fff';
        ctx.beginPath(); ctx.arc(targetX, targetY, 80, 0, Math.PI * 2); ctx.stroke();
        if (calibrationProgress > 0) {
          ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 12; ctx.beginPath();
          ctx.arc(targetX, targetY, 80, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * calibrationProgress / 100));
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill(); ctx.restore();
        ctx.font = '60px serif'; ctx.fillText('☝️', targetX, targetY + 20);
    };

    const spawnEntity = (w: number, h: number, mode: GameMode) => {
        const id = Math.random();
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const x = side === 'left' ? randomRange(100, w/3) : randomRange(2*w/3, w-100);
        const y = h + 100;
        const angleDeg = randomRange(45, 80);
        const angleRad = (angleDeg * Math.PI) / 180;
        const targetHeight = h + randomRange(50, 150);
        const launchVelocity = Math.sqrt(2 * GRAVITY * targetHeight);
        
        // GIẢM NHẸ VẬN TỐC để trái cây bay chậm hơn chút (x0.9)
        let vx = Math.cos(angleRad) * launchVelocity * (side === 'left' ? 0.6 : -0.6) * 0.9;
        let vy = -Math.sin(angleRad) * launchVelocity * 0.9;

        if (mode === GameMode.DODGE) {
           const timeToCenter = 60; 
           const centerX = w/2;
           const requiredVx = (centerX - x) / timeToCenter;
           vx = vx * 0.3 + requiredVx * 0.7;
        }
        
        let type = ItemType.FRUIT;
        let data = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
        const rand = Math.random();
        if (rand < 0.08) type = ItemType.BOMB;
        else if (rand < 0.12) type = ItemType.ICE;
        else if (rand < 0.15) type = ItemType.BASKET;
        let emoji = data.emoji; let color = data.color; let scoreVal = data.score;
        if (type === ItemType.BOMB) { emoji = SPECIAL_ITEMS.BOMB.emoji; color = SPECIAL_ITEMS.BOMB.color; scoreVal = SPECIAL_ITEMS.BOMB.score; }
        if (type === ItemType.ICE) { emoji = SPECIAL_ITEMS.ICE.emoji; color = SPECIAL_ITEMS.ICE.color; scoreVal = SPECIAL_ITEMS.ICE.score; }
        if (type === ItemType.BASKET) { emoji = SPECIAL_ITEMS.BASKET.emoji; color = SPECIAL_ITEMS.BASKET.color; scoreVal = SPECIAL_ITEMS.BASKET.score; }
        entitiesRef.current.push({ id, type, x, y, vx, vy, rotation: 0, rotationSpeed: randomRange(-0.1, 0.1), scale: 2.2, emoji, color, isSliced: false, scoreValue: scoreVal });
    };

    const handleHitStandard = (entity: Entity, newEntities: Entity[], ts: number) => {
        if (isGameOverRef.current) return; // Không tính điểm nếu game đã hết
        
        if (entity.type === ItemType.BOMB) {
            scoreRef.current = Math.max(0, scoreRef.current - 5); 
            bombExplosionRef.current = 1.0; isPausedRef.current = true;
            showNotification("BOM! -5");
            comboHitsRef.current = 0; multiplierRef.current = 1;
            setUiCombo(0); setUiMultiplier(1);
        } else if (entity.type === ItemType.ICE) {
            effectIceRef.current = 300; 
            showNotification("BĂNG GIÁ x4!");
        } else if (entity.type === ItemType.BASKET) {
            showNotification("BÙNG NỔ!");
            for(let i=0; i<6; i++) spawnEntity(canvasRef.current!.width, canvasRef.current!.height, config.mode);
        } else {
            comboHitsRef.current += 1;
            if (comboHitsRef.current > 0 && comboHitsRef.current % 10 === 0) {
              multiplierRef.current += 1;
              showNotification(`COMBO x${multiplierRef.current}!`);
            }
            scoreRef.current += entity.scoreValue * multiplierRef.current;
            setUiCombo(comboHitsRef.current % 10 === 0 ? 10 : comboHitsRef.current % 10);
            setUiMultiplier(multiplierRef.current);
            newEntities.push({...entity, id: Math.random(), isHalf: 'left', vx: entity.vx - 3, vy: entity.vy - 1, slicedAt: ts});
            newEntities.push({...entity, id: Math.random(), isHalf: 'right', vx: entity.vx + 3, vy: entity.vy - 1, slicedAt: ts});
        }
        createExplosion(entity.x, entity.y, entity.color, 15);
        if (isPausedRef.current) setTimeout(() => isPausedRef.current = false, 800);
    };

    const createExplosion = (x: number, y: number, color: string, count: number) => {
        for (let i = 0; i < count; i++) {
            particlesRef.current.push({ id: Math.random(), x, y, vx: randomRange(-8, 8), vy: randomRange(-8, 8), color, life: 1.0, size: randomRange(5, 10) });
        }
    };

    requestAnimationFrame(loop);
    return () => { 
        if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
        cancelAnimationFrame(animationFrameId); 
    };
  }, [config, isCalibrated]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-cover" />
        
        {notif && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none font-game select-none text-center z-50">
            <div className="text-9xl md:text-[12rem] text-white drop-shadow-[0_0_50px_rgba(0,255,255,0.8)] italic animate-pulse" style={{ opacity: notif.opacity, transform: `scale(${notif.scale})` }}>
              {notif.text}
            </div>
          </div>
        )}

        {isCalibrated && (
          <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none font-game">
              <div>
                  <div className="text-7xl text-yellow-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]">SCORE: {uiScore}</div>
                  {config.mode !== GameMode.TIME && <div className="text-4xl text-red-500 drop-shadow-lg mt-2">LIVES: {uiLives}</div>}
                  {uiMultiplier > 1 && <div className="text-6xl text-cyan-400 mt-4 animate-bounce">x{uiMultiplier} Active</div>}
              </div>

              <div className="flex flex-col items-center">
                  <div className="text-5xl text-cyan-400 font-bold uppercase tracking-wider px-10 py-3 bg-black/60 rounded-3xl border-4 border-cyan-400 mb-4">
                    LV {difficultyMultiplierRef.current.toFixed(1)}
                  </div>
                  <div className="w-80 h-8 bg-gray-900 rounded-full border-2 border-cyan-400/50 overflow-hidden relative">
                      <div className="h-full bg-cyan-400 transition-all duration-100" style={{ width: `${levelProgress}%` }}></div>
                  </div>
                  {/* Combo Progress */}
                  <div className="w-64 h-4 mt-3 bg-gray-900 rounded-full border border-yellow-500 overflow-hidden relative">
                      <div className="h-full bg-yellow-400 transition-all" style={{ width: `${(uiCombo/10)*100}%` }}></div>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-sans font-black">COMBO NEXT x{uiMultiplier+1}</span>
                  </div>
              </div>

              <div className="flex flex-col items-end pointer-events-auto">
                  <div className="relative group">
                    <div className={`px-10 py-5 rounded-3xl border-4 border-white/20 font-sans text-3xl font-black transition-all ${uiExitHold > 0 ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}>
                      {uiExitHold > 0 ? `GIỮ ${Math.ceil(3 - (uiExitHold * 0.03))}s` : 'THOÁT'}
                      {uiExitHold > 0 && <div className="absolute bottom-0 left-0 h-2 bg-red-400" style={{ width: `${uiExitHold}%` }}></div>}
                    </div>
                  </div>
                  {config.mode === GameMode.TIME && <div className="text-7xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] mt-6">{uiTime}s</div>}
              </div>
          </div>
        )}
    </div>
  );
};

export default GameCanvas;
