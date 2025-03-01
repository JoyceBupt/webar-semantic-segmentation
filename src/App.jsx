import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Camera from './components/Camera'
import SemanticSegmentation from './components/SemanticSegmentation'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <h1>WebAR 演示</h1>
        <nav className="nav-menu">
          <Link to="/person" className="nav-link">人像分割</Link>
          <Link to="/semantic" className="nav-link">语义分割</Link>
        </nav>
        <Routes>
          <Route path="/person" element={<Camera />} />
          <Route path="/semantic" element={<SemanticSegmentation />} />
          <Route path="/" element={
            <div className="welcome">
              <h2>请选择演示模式</h2>
              <p>点击上方按钮选择要体验的分割模式</p>
            </div>} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
