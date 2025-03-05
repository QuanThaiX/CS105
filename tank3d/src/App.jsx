import React, { useEffect, useState } from 'react';
import { Helmet } from "react-helmet";
import { Game } from './class/Game.js';

const App = () => {
  useEffect(()=>{
    const game = new Game();
    game.start();
  }, []);

  return (
    <div>
      <Helmet>
        <title>Tank3D</title>
      </Helmet>
      <HUD />
    </div>
  )
};

const HUD = () => {
  const [HUDData, setHUDData] = useState({
    playerHP: 0,
    ammo: 0,
  });

  useEffect(() => {
    const updateHUD = () => {
      if (Game.instance) {
        const data = Game.instance.getHUDData();
        setHUDData(data);
      }
      requestAnimationFrame(updateHUD);
    };

    updateHUD();
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      color: 'white',
      zIndex: 1000,
      fontSize: '18px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: '10px',
      borderRadius: '5px',
    }}>
      <div>HP: {HUDData.playerHP}</div>
      <div>Ammo: {HUDData.ammo}</div>
    </div>
  );
};

export default App;