import React from 'react';

const FPSDisplay = ({ fps }) => {
  return (
    <div className="fps-display">
      FPS: {fps}
    </div>
  );
};

export default FPSDisplay; 