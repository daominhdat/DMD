
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

  const displayScore = score;

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0c] flex flex-col items-center justify-center p-8 text-white font-game overflow-hidden">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-10 scale-x-[-1]" playsInline muted />
      
      <h2 className="relative z-10 text-[10rem] text-red-500 mb-12 animate-pulse drop-shadow-[0_0_50px_rgba(239,68,68,0.7)]">KẾT THÚC</h2>

      <div className="relative z-10 bg-white/5 backdrop-blur-3xl p-16 rounded-[4rem] border-4 border-white/10 flex flex-col items-center max-w-4xl w-full shadow-[0_0_100px_rgba(0,0,0,0.5)]">
          <div className="relative mb-12 scale-125">
              <img src={photo} alt="Face capture" className="w-[450px] h-[350px] object-cover rounded-[3rem] border-8 border-yellow-400 shadow-[0_0_60px_rgba(251,191,36,0.4)]" />
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-16 py-4 rounded-full text-7xl font-bold shadow-2xl">
                  {displayScore}
              </div>
          </div>

          <p className="text-gray-400 font-sans mb-16 text-3xl uppercase tracking-[0.5em] font-black">Ninja đã lưu kỷ lục</p>

          <div className="flex flex-col gap-10 w-full">
              <div 
                ref={el => { buttonRefs.current['restart'] = el; }}
                className={`group relative overflow-hidden w-full py-10 rounded-[3rem] text-6xl font-black text-center transition-all duration-300 ${hoveredId === 'restart' ? 'bg-white text-green-600 scale-105 shadow-2xl' : 'bg-gradient-to-r from-green-500 to-emerald-600'}`}
              >
                {hoveredId === 'restart' && isGrabbing ? `${Math.ceil(3 - (holdProgress * 0.03))}s...` : 'CHƠI LẠI'}
                {hoveredId === 'restart' && (
                  <div className="absolute bottom-0 left-0 h-4 bg-green-400 transition-all" style={{ width: `${holdProgress}%` }} />
                )}
              </div>

              <div 
                ref={el => { buttonRefs.current['home'] = el; }}
                className={`group relative overflow-hidden w-full py-8 rounded-[3rem] text-5xl font-black text-center transition-all duration-300 ${hoveredId === 'home' ? 'bg-white text-gray-900 scale-105' : 'bg-white/10 border-4 border-white/20'}`}
              >
                {hoveredId === 'home' && isGrabbing ? `${Math.ceil(3 - (holdProgress * 0.03))}s...` : 'VỀ MENU'}
                {hoveredId === 'home' && (
                  <div className="absolute bottom-0 left-0 h-4 bg-gray-400 transition-all" style={{ width: `${holdProgress}%` }} />
                )}
              </div>
          </div>
      </div>

      <div className="mt-16 bg-black/60 px-16 py-8 rounded-full border-4 border-white/20 flex items-center gap-8 animate-pulse z-10">
        <span className="text-6xl">✊</span>
        <p className="font-sans text-gray-200 text-3xl font-bold uppercase tracking-widest">NẮM CHẶT TAY TRONG 3 GIÂY ĐỂ CHỌN!</p>
      </div>

      {/* CURSOR */}
      <div 
        className="fixed z-[100] pointer-events-none transition-all duration-75 ease-out"
        style={{ left: cursorPos.x, top: cursorPos.y, transform: `translate(-50%, -50%) ${isGrabbing ? 'scale(0.8)' : 'scale(1.2)'}` }}
      >
        <div className={`relative w-32 h-32 rounded-full border-[10px] flex items-center justify-center ${isGrabbing ? 'bg-white border-white shadow-[0_0_80px_#fff]' : 'bg-transparent border-white shadow-[0_0_40px_#fff]'}`}>
          <div className="text-7xl">{isGrabbing ? '✊' : '🖐️'}</div>
        </div>
      </div>
    </div>
  );
};

export default GameOver;
