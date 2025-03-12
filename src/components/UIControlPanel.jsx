import { useState, useEffect } from 'react';
import '../styles/UIControlPanel.css';

const UIControlPanel = ({ 
  fps, 
  modelOptions = [],
  currentModelIndex,
  handleModelChange,
  animationOptions = [],
  animationIndex,
  handleAnimationChange,
  showEffects,
  toggleEffects,
  interactionEnabled,
  toggleInteraction,
  resetModelTransform
}) => {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('models');

  // 获取模型类型列表（去重）
  const getModelTypes = () => {
    const types = {};
    if (!modelOptions || modelOptions.length === 0) return [];
    
    modelOptions.forEach(model => {
      // 获取名称中的模型类型（如"狐狸"或"小鸟"）
      const typeName = model.name.split('(')[0].trim();
      if (!types[typeName]) {
        types[typeName] = true;
      }
    });
    
    return Object.keys(types);
  };
  
  // 按模型类型筛选模型选项
  const getModelsByType = (type) => {
    if (!modelOptions || modelOptions.length === 0) return [];
    return modelOptions.filter(model => model.name.startsWith(type));
  };
  
  // 获取当前选中模型的类型
  const getCurrentModelType = () => {
    if (!modelOptions || currentModelIndex >= modelOptions.length || !modelOptions[currentModelIndex]) return "";
    const currentModel = modelOptions[currentModelIndex];
    return currentModel.name.split('(')[0].trim();
  };
  
  // 切换模型类型
  const handleModelTypeChange = (type) => {
    // 获取该类型的第一个模型的索引
    const modelsOfType = getModelsByType(type);
    if (modelsOfType.length > 0) {
      const index = modelOptions.findIndex(model => model.name === modelsOfType[0].name);
      if (index !== -1) {
        handleModelChange(index);
      }
    }
  };

  // 安全地获取模型动作名称
  const getModelActionName = (model) => {
    if (!model || !model.name) return "默认";
    
    const parts = model.name.split('(');
    if (parts.length < 2) return "默认";
    
    const actionPart = parts[1];
    return actionPart.endsWith(')') ? actionPart.slice(0, -1) : actionPart;
  };

  // 性能数据
  const [performanceData, setPerformanceData] = useState({
    avgFps: 0,
    minFps: 999,
    maxFps: 0,
    fpsHistory: []
  });

  // 更新性能数据
  useEffect(() => {
    if (fps > 0) {
      setPerformanceData(prev => {
        const newHistory = [...prev.fpsHistory, fps].slice(-30); // 保留最近30帧
        const avgFps = Math.round(newHistory.reduce((a, b) => a + b, 0) / newHistory.length);
        const minFps = Math.min(...newHistory);
        const maxFps = Math.max(...newHistory);
        
        return {
          avgFps,
          minFps,
          maxFps,
          fpsHistory: newHistory
        };
      });
    }
  }, [fps]);

  // 切换面板显示
  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  return (
    <div className={`ui-control-panel ${isPanelOpen ? 'open' : 'closed'}`}>
      <div className="panel-toggle" onClick={togglePanel}>
        {isPanelOpen ? '收起' : '展开'} 控制面板
      </div>
      
      {isPanelOpen && (
        <div className="panel-content">
          <div className="panel-tabs">
            <button 
              className={`tab-button ${activeTab === 'models' ? 'active' : ''}`}
              onClick={() => setActiveTab('models')}
            >
              模型选择
            </button>
            <button 
              className={`tab-button ${activeTab === 'animations' ? 'active' : ''}`}
              onClick={() => setActiveTab('animations')}
            >
              动画控制
            </button>
            <button 
              className={`tab-button ${activeTab === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveTab('controls')}
            >
              交互控制
            </button>
            <button 
              className={`tab-button ${activeTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              性能监控
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'models' && (
              <div className="models-tab">
                <h3>选择模型类型</h3>
                <div className="model-type-list">
                  {getModelTypes().map((type, index) => (
                    <button
                      key={index}
                      className={`model-type-item ${getCurrentModelType() === type ? 'active' : ''}`}
                      onClick={() => handleModelTypeChange(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                
                {getCurrentModelType() && (
                  <>
                    <h3>选择模型动作</h3>
                    <div className="model-list">
                      {getModelsByType(getCurrentModelType()).map((model, idx) => (
                        <div 
                          key={idx}
                          className={`model-item ${modelOptions.indexOf(model) === currentModelIndex ? 'active' : ''}`}
                          onClick={() => handleModelChange(modelOptions.indexOf(model))}
                        >
                          <div className="model-name">{getModelActionName(model)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                
                <div className="effects-control">
                  <h3>特效控制</h3>
                  <button 
                    className={`effect-toggle ${showEffects ? 'active' : ''}`}
                    onClick={toggleEffects}
                  >
                    {showEffects ? '关闭特效' : '开启特效'}
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'animations' && (
              <div className="animations-tab">
                <h3>动画控制</h3>
                {animationOptions.length > 0 ? (
                  <div className="animation-list">
                    {animationOptions.map((anim, idx) => (
                      <div 
                        key={idx}
                        className={`animation-item ${idx === animationIndex ? 'active' : ''}`}
                        onClick={() => handleAnimationChange(idx)}
                      >
                        <div className="animation-name">{anim.name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-animations">当前模型没有可用动画</p>
                )}
              </div>
            )}
            
            {activeTab === 'controls' && (
              <div className="controls-tab">
                <h3>交互控制</h3>
                <div className="control-buttons">
                  <button 
                    className={`control-button ${interactionEnabled ? 'active' : ''}`}
                    onClick={toggleInteraction}
                  >
                    {interactionEnabled ? '禁用交互' : '启用交互'}
                  </button>
                  
                  {interactionEnabled && (
                    <button 
                      className="control-button"
                      onClick={resetModelTransform}
                    >
                      重置模型位置
                    </button>
                  )}
                </div>
                
                {interactionEnabled && (
                  <div className="interaction-tips">
                    <h4>操作提示：</h4>
                    <ul>
                      <li>单指滑动：旋转模型</li>
                      <li>双指捏合：缩放模型</li>
                      <li>鼠标拖动：旋转模型</li>
                      <li>鼠标滚轮：缩放模型</li>
                      <li>可选择不同动作和特效效果</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'performance' && (
              <div className="performance-tab">
                <h3>性能监控</h3>
                <div className="performance-stats">
                  <div className="stat-item">
                    <div className="stat-label">当前 FPS</div>
                    <div className="stat-value">{fps}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">平均 FPS</div>
                    <div className="stat-value">{performanceData.avgFps}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">最低 FPS</div>
                    <div className="stat-value">{performanceData.minFps}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">最高 FPS</div>
                    <div className="stat-value">{performanceData.maxFps}</div>
                  </div>
                </div>
                <div className="fps-chart">
                  <div className="fps-bars">
                    {performanceData.fpsHistory.map((fpsValue, index) => (
                      <div 
                        key={index} 
                        className="fps-bar" 
                        style={{ 
                          height: `${Math.min(100, fpsValue * 2)}%`,
                          backgroundColor: fpsValue < 15 ? '#ff4d4d' : fpsValue < 30 ? '#ffcc00' : '#4caf50'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UIControlPanel; 