
import React, { useRef, useEffect, useState } from 'react';
import { GameMode, GameConfig, LeaderboardEntry } from '../types';

declare const window: any;

interface MenuProps {
  onStart: (config: GameConfig) => void;
}

const Menu: React.FC<MenuProps> = ({ onStart }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: -200, y: -200 });
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState(60);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [holdProgress, setHoldProgress] = useState(0);

  const holdStartTimeRef = useRef<number | null>(null);
  const lastHoveredIdRef = useRef<string | null>(null);
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
    const saved = localStorage.getItem('ddfruit_leaderboard');
    if (saved) setLeaderboard(JSON.parse(saved).slice(0, 5));

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
          if (lastHoveredIdRef.current !== foundHover) {
            holdStartTimeRef.current = Date.now();
            lastHoveredIdRef.current = foundHover;
          }
          const elapsed = Date.now() - (holdStartTimeRef.current || 0);
          const progress = Math.min(100, (elapsed / 3000) * 100);
          setHoldProgress(progress);

          if (progress >= 100) {
            handleVirtualClick(foundHover);
            holdStartTimeRef.current = null;
            setHoldProgress(0);
          }
        } else {
          setHoldProgress(0);
          holdStartTimeRef.current = null;
          lastHoveredIdRef.current = null;
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
  }, [selectedTime]);

  const handleVirtualClick = (id: string) => {
    if (id === 'mode-time') onStart({ mode: GameMode.TIME, duration: selectedTime });
    if (id === 'mode-survival') onStart({ mode: GameMode.SURVIVAL });
    if (id === 'mode-dodge') onStart({ mode: GameMode.DODGE });
    if (id.startsWith('time-')) {
      setSelectedTime(parseInt(id.split('-')[1]));
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050507] flex flex-col items-center justify-center py-12 px-4 text-white font-game overflow-hidden select-none">
      {/* Background Video - More visible for interaction feedback */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-30 scale-x-[-1]" playsInline muted />
      
      {/* Top Left Leaderboard - Glassmorphism style */}
      <div className="absolute top-8 left-8 z-20 w-80 bg-white/10 backdrop-blur-2xl p-4 rounded-[2rem] border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
        <h3 className="text-2xl text-yellow-300 mb-4 text-center tracking-widest uppercase font-bold">Top Ninja</h3>
        <div className="flex flex-col gap-3">
          {leaderboard.length > 0 ? leaderboard.map((entry, idx) => (
            <div key={entry.id} className="flex items-center bg-white/10 p-2 rounded-xl border border-white/10 gap-3">
              <img src={entry.photo} className="w-12 h-10 object-cover rounded-lg border border-white/20" alt="Face" />
              <div className="flex-grow">
                <div className="text-lg">#{idx + 1} Ninja</div>
                <div className="text-[10px] text-gray-300 font-sans uppercase font-bold">{entry.mode === GameMode.DODGE ? 'SINH TỒN' : (entry.mode === GameMode.SURVIVAL ? 'CỔ ĐIỂN' : 'THỜI GIAN')}</div>
              </div>
              <div className="text-xl text-yellow-300">{entry.score}</div>
            </div>
          )) : (
            <div className="text-center text-gray-400 font-sans py-4">Chưa có kỷ lục</div>
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center mb-8">
        <h1 className="text-[11rem] leading-none font-bold tracking-tighter text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.3)] italic">ARFruit</h1>
        <p className="text-2xl text-cyan-400 tracking-[1em] uppercase font-sans font-black ml-4">Augmented Reality</p>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-[95%] w-full">
        {['mode-time', 'mode-survival', 'mode-dodge'].map((modeId, idx) => {
          const config = [
            { title: 'Thời Gian', icon: '⏱️', desc: 'Phá kỷ lục nhanh tay!', color: 'from-yellow-400/40 to-orange-500/40' },
            { title: 'Cổ Điển', icon: '⚔️', desc: 'Đừng để rơi trái cây!', color: 'from-red-500/40 to-pink-600/40' },
            { title: 'Sinh Tồn', icon: '❤️', desc: 'Bảo vệ trái tim!', color: 'from-blue-400/40 to-indigo-600/40' }
          ][idx];

          return (
            <div 
              key={modeId}
              ref={el => { buttonRefs.current[modeId] = el; }}
              className={`group relative backdrop-blur-2xl p-10 h-[520px] rounded-[4rem] border-4 transition-all duration-500 flex flex-col items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] ${hoveredId === modeId ? `bg-white/20 border-white scale-105` : 'bg-white/5 border-white/10'}`}
            >
              <div className="text-[10rem] mb-2 group-hover:scale-110 transition-transform drop-shadow-2xl">{config.icon}</div>
              <div className="text-center">
                <h2 className="text-5xl font-bold mb-2 uppercase tracking-tighter">{config.title}</h2>
                <p className="text-gray-300 font-sans text-xl mb-6">{config.desc}</p>
              </div>

              {modeId === 'mode-time' && (
                <div className="flex gap-4 mb-4">
                  {[60, 120, 180].map(t => (
                    <div 
                      key={t}
                      ref={el => { buttonRefs.current[`time-${t}`] = el; }}
                      className={`px-8 py-3 rounded-2xl font-sans font-black text-2xl transition-all border-2 backdrop-blur-md ${selectedTime === t ? 'bg-yellow-400 text-black border-yellow-400 scale-110' : 'bg-white/5 border-white/20 hover:bg-white/10'} ${hoveredId === `time-${t}` ? 'ring-4 ring-white' : ''}`}
                    >
                      {t / 60}p
                    </div>
                  ))}
                </div>
              )}
              
              <div className={`w-full py-6 rounded-[2rem] font-bold text-4xl shadow-2xl text-center transition-all bg-gradient-to-r ${config.color} border-2 border-white/20`}>
                {hoveredId === modeId && isGrabbing ? `${Math.ceil(3 - (holdProgress * 0.03))}s...` : 'NẮM ĐỂ CHỌN'}
              </div>

              {hoveredId === modeId && (
                <div className="absolute bottom-0 left-0 h-4 bg-white/60 transition-all duration-100 rounded-b-[4rem]" style={{ width: `${holdProgress}%` }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer DMD - Hologram */}
      <div className="absolute bottom-8 w-full text-center z-10">
        <p className="hologram-text text-4xl font-game tracking-widest italic font-bold">
          Develop by DMD. Have a good time
        </p>
      </div>

      {/* CURSOR - Transparent glass look */}
      <div 
        className="fixed z-[100] pointer-events-none transition-all duration-75 ease-out"
        style={{ left: cursorPos.x, top: cursorPos.y, transform: `translate(-50%, -50%) ${isGrabbing ? 'scale(0.8)' : 'scale(1.2)'}` }}
      >
        <div className={`relative w-24 h-24 rounded-full border-[6px] flex items-center justify-center transition-all duration-200 backdrop-blur-md ${isGrabbing ? 'bg-white/80 border-white shadow-[0_0_60px_rgba(255,255,255,0.5)]' : 'bg-white/10 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.2)]'}`}>
          <div className="text-5xl drop-shadow-md">{isGrabbing ? '✊' : '🖐️'}</div>
          {holdProgress > 0 && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle cx="48" cy="48" r="44" fill="none" stroke="cyan" strokeWidth="6" strokeDasharray="276" strokeDashoffset={276 - (276 * holdProgress) / 100} strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

export default Menu;
