import React from 'react';

const LoadingIndicator = ({ message = '加载中...' }) => {
  return (
    <div className="loading">
      <p>{message}</p>
    </div>
  );
};

export default LoadingIndicator; 