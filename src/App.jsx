import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Camera from './components/Camera'
import SemanticSegmentation from './components/SemanticSegmentation'
import './App.css'

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 检测设备类型
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <Router>
      <div className="App">
        <header>
          <h1>WebAR 演示</h1>
          <nav className="nav-menu">
            <Link to="/person" className="nav-link">
              <span className="icon">👤</span>
              <span className="text">人像分割</span>
            </Link>
            <Link to="/semantic" className="nav-link">
              <span className="icon">🌍</span>
              <span className="text">语义分割</span>
            </Link>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/person" element={<Camera />} />
            <Route path="/semantic" element={<SemanticSegmentation />} />
            <Route path="/" element={
              <div className="welcome">
                <h2>欢迎使用 WebAR 演示</h2>
                <p>
                  本应用演示了基于网页端的增强现实技术，无需安装任何应用，直接在浏览器中体验。
                  请点击上方按钮选择要体验的分割模式：
                </p>
                <div className="feature-list">
                  <div className="feature">
                    <div className="feature-icon">👤</div>
                    <div className="feature-text">
                      <h3>人像分割</h3>
                      <p>提取视频中的人像，并叠加3D模型</p>
                    </div>
                  </div>
                  <div className="feature">
                    <div className="feature-icon">🌍</div>
                    <div className="feature-text">
                      <h3>语义分割</h3>
                      <p>识别视频中的物体类别，并以不同颜色显示</p>
                    </div>
                  </div>
                </div>
                <div className="device-tip">
                  {isMobile ? 
                    <p>💡 提示：为获得更好体验，请确保相机已授权并保持设备稳定</p> :
                    <p>💡 提示：确保您的设备有摄像头并已授权访问</p>
                  }
                </div>
              </div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer>
          <p>© {new Date().getFullYear()} WebAR Demo</p>
        </footer>
      </div>
    </Router>
  )
}

export default App
