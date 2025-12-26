
import React, { useEffect, useRef, useState } from 'react';
import { GameMode, LeaderboardEntry } from '../types';

declare const window: any;

interface GameOverProps {
  score: number;
  mode: GameMode;
  photo: string;
  onRestart: () => void;
  onHome: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ score, mode, photo, onRestart, onHome }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: -200, y: -200 });
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const holdStartTimeRef = useRef<number | null>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLElement | null }>({});

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
    const saveResult = () => {
      const saved = localStorage.getItem('ddfruit_leaderboard');
      const leaderboard: LeaderboardEntry[] = saved ? JSON.parse(saved) : [];
      const newEntry: LeaderboardEntry = {
        id: Date.now().toString(),
        score: score,
        mode: mode,
        photo: photo,
        date: Date.now()
      };
      const updated = [newEntry, ...leaderboard].sort((a, b) => parseFloat(b.score.toString()) - parseFloat(a.score.toString())).slice(0, 10);
      localStorage.setItem('ddfruit_leaderboard', JSON.stringify(updated));
    };
    saveResult();

    let cameraStream: MediaStream | null = null;
    let animationFrameId: number;
    const hands = new window.Hands({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    hands.onResults((results: any) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        const x = (1 - lm[8].x) * window.innerWidth;
        const y = lm[8].y * window.innerHeight;
        setCursorPos({ x, y });
        const grabbing = isFist(lm); setIsGrabbing(grabbing);
        let foundHover = null;
        for (const id in buttonRefs.current) {
          const el = buttonRefs.current[id];
          if (el) {
            const rect = el.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) { foundHover = id; break; }
          }
        }
        setHoveredId(foundHover);
        if (foundHover && grabbing) {
          if (!holdStartTimeRef.current) holdStartTimeRef.current = Date.now();
          const progress = Math.min(100, ((Date.now() - holdStartTimeRef.current) / 2000) * 100);
          setHoldProgress(progress);
          if (progress >= 100) { if (foundHover === 'restart') onRestart(); else onHome(); holdStartTimeRef.current = null; }
        } else { setHoldProgress(0); holdStartTimeRef.current = null; }
      } else { setIsGrabbing(false); setHoveredId(null); setHoldProgress(0); }
    });

    const startCamera = async () => {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = cameraStream; await videoRef.current.play();
          const send = async () => { if (videoRef.current) await hands.send({ image: videoRef.current }); animationFrameId = requestAnimationFrame(send); };
          send();
        }
      } catch (err) { console.error(err); }
    };
    startCamera();
    return () => { if (cameraStream) cameraStream.getTracks().forEach(t => t.stop()); cancelAnimationFrame(animationFrameId); };
  }, [score, mode, photo]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0c] flex flex-col items-center justify-center p-4 md:p-8 text-white font-game overflow-hidden select-none">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-30 scale-x-[-1]" playsInline muted />
      
      <div className="absolute top-4 md:top-10 flex flex-col items-center z-10 text-center">
          <h2 className="text-5xl md:text-7xl lg:text-8xl text-red-500 mb-4 md:mb-8 drop-shadow-2xl uppercase font-black italic">GAME OVER</h2>
          <div className="flex items-center gap-4 md:gap-8 bg-white/10 backdrop-blur-3xl p-4 md:p-8 rounded-[1.5rem] md:rounded-[3rem] border-2 md:border-4 border-white/20 shadow-2xl">
            <img src={photo} alt="Face" className="w-24 h-20 md:w-48 md:h-36 object-cover rounded-xl md:rounded-3xl border-2 md:border-4 border-yellow-400" />
            <div className="flex flex-col text-left">
              <span className="text-gray-300 font-sans text-xs md:text-xl uppercase font-black tracking-widest">FINAL SCORE</span>
              <span className="text-4xl md:text-7xl lg:text-9xl text-yellow-400 drop-shadow-md">{score}</span>
            </div>
          </div>
      </div>

      <div className="flex flex-col gap-4 md:gap-8 w-full max-w-xl md:max-w-2xl lg:max-w-3xl z-20 mt-20 md:mt-40">
          <div 
            ref={el => { buttonRefs.current['restart'] = el; }}
            className={`group relative overflow-hidden w-full h-24 md:h-44 flex items-center justify-center rounded-[2rem] md:rounded-[4rem] text-4xl md:text-7xl lg:text-8xl font-black transition-all duration-300 backdrop-blur-3xl border-2 md:border-4 ${hoveredId === 'restart' ? 'bg-white/20 border-white scale-105' : 'bg-white/5 border-white/10'}`}
          >
            <span className="relative z-10 text-green-400">AGAIN ⚔️</span>
            {hoveredId === 'restart' && <div className="absolute bottom-0 left-0 h-full bg-green-500/20 transition-all ease-linear" style={{ width: `${holdProgress}%` }} />}
          </div>

          <div 
            ref={el => { buttonRefs.current['home'] = el; }}
            className={`group relative overflow-hidden w-full h-20 md:h-36 flex items-center justify-center rounded-[2rem] md:rounded-[4rem] text-3xl md:text-6xl lg:text-7xl font-black transition-all duration-300 backdrop-blur-3xl border-2 md:border-4 ${hoveredId === 'home' ? 'bg-white/20 border-white scale-105' : 'bg-white/5 border-white/10'}`}
          >
            <span className="relative z-10 text-white">MENU 🏠</span>
            {hoveredId === 'home' && <div className="absolute bottom-0 left-0 h-full bg-white/10 transition-all ease-linear" style={{ width: `${holdProgress}%` }} />}
          </div>
      </div>

      <div className="absolute bottom-6 md:bottom-12 bg-white/10 backdrop-blur-2xl px-6 py-3 md:px-10 md:py-5 rounded-full border border-white/20 flex items-center gap-4 z-10">
        <span className="text-2xl md:text-4xl">✊</span>
        <p className="font-sans text-gray-300 text-sm md:text-xl font-black uppercase tracking-widest">FIST TO SELECT</p>
      </div>

      <div className="fixed z-[100] pointer-events-none transition-all duration-75 ease-out" style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}>
        <div className={`w-16 h-16 md:w-24 md:h-24 rounded-full border-[6px] md:border-[10px] flex items-center justify-center backdrop-blur-md ${isGrabbing ? 'bg-white/60 border-white scale-75' : 'bg-white/10 border-white/40'}`}>
          <div className="text-2xl md:text-5xl">{isGrabbing ? '✊' : '🖐️'}</div>
        </div>
      </div>
    </div>
  );
};

export default GameOver;
