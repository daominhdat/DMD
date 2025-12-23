import React, { useState } from 'react';
import Menu from './components/Menu';
import GameCanvas from './components/GameCanvas';
import GameOver from './components/GameOver';
import { GameState, GameConfig, GameMode } from './types';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [gameConfig, setGameConfig] = useState<GameConfig>({ mode: GameMode.TIME, duration: 60 });
  const [lastScore, setLastScore] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState('');

  const handleStartGame = (config: GameConfig) => {
    setGameConfig(config);
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (score: number, mode: GameMode, photo: string) => {
    setLastScore(score);
    setCapturedPhoto(photo);
    setGameState(GameState.GAME_OVER);
  };

  const handleExit = () => {
    setGameState(GameState.MENU);
  };

  return (
    <div className="w-full h-full">
      {gameState === GameState.MENU && (
        <Menu onStart={handleStartGame} />
      )}
      
      {gameState === GameState.PLAYING && (
        <GameCanvas 
          config={gameConfig} 
          onGameOver={handleGameOver}
          onExit={handleExit}
        />
      )}

      {gameState === GameState.GAME_OVER && (
        <GameOver 
          score={lastScore} 
          mode={gameConfig.mode}
          photo={capturedPhoto}
          onRestart={() => setGameState(GameState.PLAYING)}
          onHome={() => setGameState(GameState.MENU)}
        />
      )}
    </div>
  );
};

export default App;