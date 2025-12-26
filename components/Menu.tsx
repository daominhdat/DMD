
import React, { useRef, useEffect, useState } from 'react';
import { GameMode, GameConfig, LeaderboardEntry } from '../types';

declare const window: any;

interface MenuProps {
  onStart: (config: GameConfig) => void;
}

const Menu: React.FC<MenuProps> = ({ onStart }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [landmarks, setLandmarks] = useState<any>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState(60);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [holdProgress, setHoldProgress] = useState(0);

  const holdStartTimeRef = useRef<number | null>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]
  ];

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
    const saved = localStorage.getItem('ddfruit_leaderboard');
    if (saved) setLeaderboard(JSON.parse(saved).slice(0, 5));

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
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      // Draw background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      
      if (videoRef.current) {
        ctx.filter = 'brightness(1.1) contrast(1.1) saturate(1.2) blur(3px)';
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-in';
        const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.width/6, canvas.width/2, canvas.height/2, canvas.height);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(0, 255, 255, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        setLandmarks(lm);
        
        // --- Fix Coordinates Mapping ---
        // Calculate screen coordinates based on object-cover sizing
        const rect = canvas.getBoundingClientRect();
        const clientW = rect.width;
        const clientH = rect.height;
        const renderW = 1920; // Canvas internal width
        const renderH = 1080; // Canvas internal height
        
        const clientAspect = clientW / clientH;
        const renderAspect = renderW / renderH;
        
        let scale, offsetX, offsetY;
        
        if (clientAspect > renderAspect) {
             // Screen is wider: Canvas fits width, crops height
             scale = clientW / renderW;
             offsetX = 0;
             offsetY = (clientH - (renderH * scale)) / 2;
        } else {
             // Screen is taller: Canvas fits height, crops width
             scale = clientH / renderH;
             offsetX = (clientW - (renderW * scale)) / 2;
             offsetY = 0;
        }

        // Calculate visual X on screen (mirroring handled by drawing logic on canvas, but for interaction we need 1-x)
        const screenX = (1 - lm[8].x) * renderW * scale + offsetX;
        const screenY = lm[8].y * renderH * scale + offsetY;
        
        const grabbing = isFist(lm);
        setIsGrabbing(grabbing);

        // Draw Skeleton (Canvas Space)
        ctx.lineWidth = canvas.width / 300;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = grabbing ? '#ff00ff' : '#00ffff';
        ctx.strokeStyle = grabbing ? '#ff00ff' : '#00ffff';

        HAND_CONNECTIONS.forEach(([s, e]) => {
            ctx.beginPath();
            ctx.moveTo((1 - lm[s].x) * canvas.width, lm[s].y * canvas.height);
            ctx.lineTo((1 - lm[e].x) * canvas.width, lm[e].y * canvas.height);
            ctx.stroke();
        });

        lm.forEach((pt: any) => {
            ctx.beginPath();
            ctx.arc((1 - pt.x) * canvas.width, pt.y * canvas.height, canvas.width / 400, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        });

        // Hover Detection
        let foundHover = null;
        for (const id in buttonRefs.current) {
          const el = buttonRefs.current[id];
          if (el) {
            const elRect = el.getBoundingClientRect();
            // Use screenX/screenY relative to viewport
            // Canvas might be offset if parent has padding, but here it is fixed/absolute. 
            // Better to assume screenX/screenY are relative to canvas container (which is window due to fixed/absolute).
            // But getBoundingClientRect returns viewport coordinates.
            // If canvas is absolute top-0 left-0, rect.left is 0.
            
            // Adjust for canvas position (usually 0,0)
            const globalX = screenX + rect.left;
            const globalY = screenY + rect.top;

            if (globalX >= elRect.left && globalX <= elRect.right && globalY >= elRect.top && globalY <= elRect.bottom) {
              foundHover = id; break;
            }
          }
        }
        setHoveredId(foundHover);

        if (foundHover && grabbing) {
          if (!holdStartTimeRef.current) holdStartTimeRef.current = Date.now();
          const progress = Math.min(100, ((Date.now() - holdStartTimeRef.current) / 1500) * 100);
          setHoldProgress(progress);
          if (progress >= 100) { handleVirtualClick(foundHover); holdStartTimeRef.current = null; setHoldProgress(0); }
        } else { setHoldProgress(0); holdStartTimeRef.current = null; }
      } else {
        setLandmarks(null); setIsGrabbing(false); setHoveredId(null); setHoldProgress(0);
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
    return () => { if (cameraStream) cameraStream.getTracks().forEach(t => t.stop()); cancelAnimationFrame(animationFrameId); };
  }, []);

  const handleVirtualClick = (id: string) => {
    if (id === 'mode-time') onStart({ mode: GameMode.TIME, duration: selectedTime });
    if (id === 'mode-survival') onStart({ mode: GameMode.SURVIVAL });
    if (id === 'mode-dodge') onStart({ mode: GameMode.DODGE });
    if (id === 'mode-test') onStart({ mode: GameMode.TEST_HANDS });
    if (id.startsWith('time-')) setSelectedTime(parseInt(id.split('-')[1]));
  };

  return (
    <div className="relative min-h-screen bg-[#050507] flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 text-white font-game overflow-hidden select-none">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" width={1920} height={1080} />
      
      {/* Test Tay Button - Scaled */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-30">
        <div 
          ref={el => { buttonRefs.current['mode-test'] = el; }}
          className={`px-6 py-3 md:px-12 md:py-6 rounded-[1.5rem] md:rounded-[2.5rem] border-2 md:border-4 backdrop-blur-3xl transition-all duration-300 ${hoveredId === 'mode-test' ? 'bg-cyan-400 text-black border-white scale-110 shadow-[0_0_40px_rgba(34,211,238,0.5)]' : 'bg-white/5 border-white/10'}`}
        >
          <span className="text-xl md:text-3xl lg:text-5xl font-black italic">TEST ✋🤚</span>
          {hoveredId === 'mode-test' && holdProgress > 0 && (
            <div className="absolute bottom-0 left-0 h-1 md:h-2 bg-white/50" style={{ width: `${holdProgress}%` }} />
          )}
        </div>
      </div>

      {/* Sidebar Leaderboard - Responsive Width */}
      <div className="hidden xl:flex absolute top-10 left-10 z-20 w-[300px] 2xl:w-[400px] bg-black/20 backdrop-blur-2xl p-6 2xl:p-10 rounded-[3rem] border-4 border-white/5 shadow-2xl flex-col">
        <h3 className="text-3xl 2xl:text-4xl text-yellow-300 mb-6 text-center tracking-widest uppercase font-bold drop-shadow-md">BXH</h3>
        <div className="flex flex-col gap-4">
          {leaderboard.map((entry, idx) => (
            <div key={entry.id} className="flex items-center bg-white/5 p-3 rounded-2xl border border-white/10 gap-4">
              <img src={entry.photo} className="w-16 h-14 2xl:w-20 2xl:h-16 object-cover rounded-xl border-2 border-white/10" alt="Face" />
              <div className="flex-grow">
                <div className="text-xl 2xl:text-2xl font-black">#{idx + 1} NINJA</div>
                <div className="text-[10px] 2xl:text-xs text-cyan-400 font-sans font-black opacity-60 uppercase">{entry.mode}</div>
              </div>
              <div className="text-2xl 2xl:text-4xl text-yellow-300">{entry.score}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center mb-8 lg:mb-16 pointer-events-none text-center">
        <h1 className="text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-[#ff00ff] via-[#00ffff] to-[#ffff00] drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] italic transform skew-x-[-10deg]">
          ARFRUIT
        </h1>
        <div className="mt-2 px-6 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md shadow-lg">
           <p className="text-sm md:text-xl lg:text-2xl text-cyan-300 font-black tracking-[0.3em] uppercase">
            DEVELOPED BY DMD
          </p>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-12 xl:gap-20 max-w-full lg:max-w-[95%] w-full">
        {['mode-time', 'mode-survival', 'mode-dodge'].map((modeId, idx) => {
          const config = [
            { title: 'THỜI GIAN', icon: '⏱️', color: 'from-yellow-400/40 to-orange-600/40' },
            { title: 'CỔ ĐIỂN', icon: '⚔️', color: 'from-red-500/40 to-pink-700/40' },
            { title: 'SINH TỒN', icon: '❤️', color: 'from-blue-500/40 to-indigo-800/40' }
          ][idx];

          return (
            <div 
              key={modeId}
              ref={el => { buttonRefs.current[modeId] = el; }}
              className={`group relative backdrop-blur-2xl p-6 lg:p-12 min-h-[400px] lg:h-[600px] xl:h-[700px] rounded-[3rem] lg:rounded-[5rem] border-[4px] lg:border-[8px] transition-all duration-500 flex flex-col items-center justify-between shadow-2xl ${hoveredId === modeId ? `bg-white/10 border-white scale-105` : 'bg-black/10 border-white/5'}`}
            >
              <div className="relative mb-6 group-hover:-translate-y-4 transition-transform duration-500">
                <div className={`absolute inset-0 bg-gradient-to-br ${config.color} blur-[60px] opacity-40 rounded-full animate-pulse`}></div>
                <div className="relative text-8xl md:text-9xl lg:text-[10rem] xl:text-[12rem] drop-shadow-[0_20px_20px_rgba(0,0,0,0.7)] filter contrast-125 saturate-150">
                    {config.icon}
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-3xl lg:text-5xl xl:text-6xl font-black mb-2 lg:mb-4 uppercase tracking-tighter drop-shadow-md">{config.title}</h2>
                <p className="text-gray-400 font-sans text-sm lg:text-xl xl:text-2xl font-black italic opacity-80">CHOOSE YOUR PATH</p>
              </div>

              {modeId === 'mode-time' && (
                <div className="flex gap-2 lg:gap-4 mb-4 lg:mb-8">
                  {[60, 120].map(t => (
                    <div 
                      key={t} ref={el => { buttonRefs.current[`time-${t}`] = el; }}
                      className={`px-4 py-2 lg:px-8 lg:py-4 rounded-[1rem] lg:rounded-[2rem] font-sans font-black text-xl lg:text-4xl transition-all border-2 backdrop-blur-3xl ${selectedTime === t ? 'bg-yellow-400 text-black border-yellow-100 scale-110' : 'bg-white/10 border-white/20'}`}
                    >
                      {t / 60}P
                    </div>
                  ))}
                </div>
              )}
              
              <div className={`w-full py-4 lg:py-8 rounded-[2rem] lg:rounded-[4rem] font-black text-xl lg:text-3xl xl:text-5xl shadow-2xl text-center transition-all bg-gradient-to-br ${config.color} border-2 lg:border-4 border-white/20 uppercase italic`}>
                {hoveredId === modeId && isGrabbing ? 'HOLDING...' : 'NẮM ĐỂ CHỌN'}
              </div>

              {hoveredId === modeId && (
                <div className="absolute bottom-0 left-0 h-2 lg:h-4 bg-cyan-400/60 transition-all duration-100 rounded-b-[3rem] lg:rounded-b-[5rem]" style={{ width: `${holdProgress}%` }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Menu;
