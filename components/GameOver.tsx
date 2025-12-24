
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

    const video = videoRef.current;
    if (!video) return;

    let cameraStream: MediaStream | null = null;
    let animationFrameId: number;

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
        const indexTip = landmarks[8];
        const x = (1 - indexTip.x) * window.innerWidth;
        const y = indexTip.y * window.innerHeight;
        setCursorPos({ x, y });

        const grabbing = isFist(landmarks);
        setIsGrabbing(grabbing);

        let foundHover = null;
        for (const id in buttonRefs.current) {
          const el = buttonRefs.current[id];
          if (el) {
            const rect = el.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
              foundHover = id;
              break;
            }
          }
        }
        setHoveredId(foundHover);

        if (foundHover && grabbing) {
          if (!holdStartTimeRef.current) holdStartTimeRef.current = Date.now();
          const elapsed = Date.now() - holdStartTimeRef.current;
          const progress = Math.min(100, (elapsed / 3000) * 100);
          setHoldProgress(progress);
          if (progress >= 100) {
            if (foundHover === 'restart') onRestart();
            else if (foundHover === 'home') onHome();
            holdStartTimeRef.current = null;
          }
        } else {
          setHoldProgress(0);
          holdStartTimeRef.current = null;
        }
      } else {
        setCursorPos({ x: -200, y: -200 });
        setIsGrabbing(false);
        setHoveredId(null);
        setHoldProgress(0);
      }
    });

    const startCamera = async () => {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
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

    return () => {
        if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
        cancelAnimationFrame(animationFrameId);
    };
  }, [score, mode, photo]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0c] flex flex-col items-center justify-center p-8 text-white font-game overflow-hidden select-none">
      {/* Background Video - See yourself clearly */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-40 scale-x-[-1]" playsInline muted />
      
      {/* Top Section: Small Score and Photo (Glass Panel) */}
      <div className="absolute top-10 flex flex-col items-center z-10 animate-fade-in-down">
          <h2 className="text-7xl text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.7)] uppercase font-bold italic">KẾT THÚC</h2>
          <div className="flex items-center gap-6 bg-white/10 backdrop-blur-2xl p-6 rounded-[2.5rem] border-2 border-white/20 shadow-2xl">
            <img src={photo} alt="Face capture" className="w-40 h-32 object-cover rounded-2xl border-2 border-yellow-400 shadow-lg" />
            <div className="flex flex-col">
              <span className="text-gray-300 font-sans text-lg uppercase font-black tracking-widest">Điểm Ninja</span>
              <span className="text-7xl text-yellow-400 drop-shadow-md">{score}</span>
            </div>
          </div>
      </div>

      {/* Center Section: Huge Transparent Glass Buttons */}
      <div className="flex flex-col gap-10 w-full max-w-2xl z-20 mt-24">
          <div 
            ref={el => { buttonRefs.current['restart'] = el; }}
            className={`group relative overflow-hidden w-full h-52 flex items-center justify-center rounded-[4rem] text-8xl font-black transition-all duration-300 backdrop-blur-3xl border-4 ${hoveredId === 'restart' ? 'bg-white/30 border-white scale-105 shadow-[0_0_80px_rgba(255,255,255,0.3)]' : 'bg-white/10 border-white/20'}`}
          >
            <span className="relative z-10 drop-shadow-lg text-green-400">
                {hoveredId === 'restart' && isGrabbing ? `${Math.ceil(3 - (holdProgress * 0.03))}s...` : 'CHƠI LẠI'}
            </span>
            {hoveredId === 'restart' && (
              <div className="absolute bottom-0 left-0 h-full bg-green-500/20 transition-all ease-linear" style={{ width: `${holdProgress}%` }} />
            )}
          </div>

          <div 
            ref={el => { buttonRefs.current['home'] = el; }}
            className={`group relative overflow-hidden w-full h-44 flex items-center justify-center rounded-[4rem] text-7xl font-black transition-all duration-300 backdrop-blur-3xl border-4 ${hoveredId === 'home' ? 'bg-white/30 border-white scale-105 shadow-[0_0_60px_rgba(255,255,255,0.2)]' : 'bg-white/10 border-white/20'}`}
          >
            <span className="relative z-10 drop-shadow-lg text-white">
                {hoveredId === 'home' && isGrabbing ? `${Math.ceil(3 - (holdProgress * 0.03))}s...` : 'VỀ MENU'}
            </span>
            {hoveredId === 'home' && (
              <div className="absolute bottom-0 left-0 h-full bg-white/10 transition-all ease-linear" style={{ width: `${holdProgress}%` }} />
            )}
          </div>
      </div>

      {/* Instruction */}
      <div className="absolute bottom-10 bg-white/10 backdrop-blur-xl px-12 py-6 rounded-full border border-white/20 flex items-center gap-6 z-10">
        <span className="text-4xl">✊</span>
        <p className="font-sans text-gray-200 text-xl font-black uppercase tracking-widest">NẮM TAY ĐỂ CHỌN</p>
      </div>

      {/* Glass CURSOR */}
      <div 
        className="fixed z-[100] pointer-events-none transition-all duration-75 ease-out"
        style={{ left: cursorPos.x, top: cursorPos.y, transform: `translate(-50%, -50%) ${isGrabbing ? 'scale(0.8)' : 'scale(1.2)'}` }}
      >
        <div className={`relative w-24 h-24 rounded-full border-[8px] flex items-center justify-center backdrop-blur-md ${isGrabbing ? 'bg-white/60 border-white' : 'bg-white/10 border-white/40'}`}>
          <div className="text-5xl">{isGrabbing ? '✊' : '🖐️'}</div>
        </div>
      </div>
    </div>
  );
};

export default GameOver;
