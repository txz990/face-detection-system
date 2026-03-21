<template>
  <div class="app-wrapper">
    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <div class="logo-area">
          <div class="logo-icon">🧬</div>
          <div class="logo-text">
            <h1>人脸五官检测系统</h1>
          </div>
        </div>
        <div class="header-actions">
          <button v-if="imageUrl" @click="clearAll" class="clear-btn">
            🧹 清除所有
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Left Panel: Upload and Preview -->
      <div class="left-panel">
        <div class="panel-card upload-card">
          <div class="card-header">
            <h3>📸 上传照片</h3>
            <p>支持 JPG, PNG 格式</p>
          </div>
          
          <!-- File Upload Area -->
          <div 
            class="upload-section" 
            :class="{ 'has-image': imageUrl }"
            @dragover.prevent
            @drop.prevent="handleDrop"
          >
            <label for="imageInput" class="upload-label">
              <div v-if="!imageUrl" class="upload-placeholder">
                <svg class="upload-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <rect x="15" y="30" width="70" height="50" rx="5" fill="none" stroke="#6366f1" stroke-width="2"/>
                  <circle cx="70" cy="45" r="8" fill="none" stroke="#6366f1" stroke-width="2"/>
                  <polyline points="15,70 35,55 65,80 85,60" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="45,25 45,50 35,40" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="55,25 55,50 65,40" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="upload-text">点击或拖拽图片到此处</span>
                <span class="upload-hint">建议使用正面清晰人像照片</span>
              </div>
              <div v-else class="preview-container">
                <img :src="imageUrl" alt="上传的照片" class="preview-img" />
                <div class="change-overlay">更换图片</div>
              </div>
            </label>
            <input
              id="imageInput"
              type="file"
              accept="image/*"
              @change="handleImageUpload"
              style="display: none"
            />
          </div>

          <!-- Detection Button -->
          <div class="action-area">
            <button
              v-if="imageFile"
              @click="detectFace"
              :disabled="isLoading || modelLoading"
              class="detect-btn"
              :class="{ 'loading': isLoading }"
            >
              <span v-if="!isLoading">🔍 开始检测</span>
              <span v-else class="loader-text">
                <span class="spinner"></span> 检测中...
              </span>
            </button>

            <!-- Model Loading Hint -->
            <div v-if="modelLoading" class="status-hint loading">
              <span class="pulse"></span> 正在加载 AI 模型...
            </div>

            <!-- Error Hint -->
            <div v-if="modelError" class="status-hint error">
              ❌ {{ modelError }}
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Results and Data -->
      <div class="right-panel">
        <!-- Detection Result Image -->
        <div v-if="resultImage" class="panel-card result-card">
          <div class="card-header">
            <h3>检测结果</h3>
            <p>标注测量数据</p>
          </div>

          <!-- Measurement Mode Selector -->
          <div class="mode-selector">
            <button
              v-for="mode in measurementModes"
              :key="mode.value"
              @click="selectMeasurementMode(mode.value)"
              :class="['mode-btn', { active: currentMeasurementMode === mode.value }]"
            >
              {{ mode.label }}
            </button>
          </div>

          <div class="result-container">
            <img :src="resultImage" alt="检测结果" class="result-img" />
          </div>
        </div>

        <!-- Data Analysis -->
        <div v-if="faceData" class="panel-card data-card">
          <div class="card-header">
            <h3>数据分析</h3>
            <p>详细的面部特征测量数据</p>
          </div>

          <!-- Section 1: 脸部基本尺寸 -->
          <div class="data-section">
            <div class="section-title">脸部基本尺寸</div>
            <div class="data-grid">
              <div v-for="key in ['faceHeight', 'faceWidth']" :key="key" class="data-item">
                <div class="data-info">
                  <span class="label">{{ formatLabel(key) }}</span>
                  <span class="value">{{ formatValue(faceData[key]) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 2: 三庭比例 -->
          <div class="data-section">
            <div class="section-title">三庭比例（美学黄金比例）</div>
            <div class="data-grid">
              <div v-for="key in ['thirdUpper', 'thirdMiddle', 'thirdLower']" :key="key" class="data-item">
                <div class="data-info">
                  <span class="label">{{ formatLabel(key) }}</span>
                  <span class="value">{{ formatValue(faceData[key]) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: 眼睛数据 -->
          <div class="data-section">
            <div class="section-title">眼睛数据</div>
            <div class="data-grid">
              <div v-for="key in ['leftEyeWidth', 'rightEyeWidth', 'eyeDistance', 'leftEyeHeight', 'rightEyeHeight']" :key="key" class="data-item">
                <div class="data-info">
                  <span class="label">{{ formatLabel(key) }}</span>
                  <span class="value">{{ formatValue(faceData[key]) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3.5: 五眼比例两侧空白 -->
          <div class="data-section">
            <div class="section-title">五眼比例（完整）</div>
            <div class="data-grid">
              <div v-for="key in ['leftBlank', 'leftEyeWidth', 'eyeDistance', 'rightEyeWidth', 'rightBlank']" :key="key" class="data-item">
                <div class="data-info">
                  <span class="label">{{ formatLabel(key) }}</span>
                  <span class="value">{{ formatValue(faceData[key]) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 4: 鼻子数据 -->
          <div class="data-section">
            <div class="section-title">鼻子数据</div>
            <div class="data-grid">
              <div v-for="key in ['noseWidth', 'noseHeight']" :key="key" class="data-item">
                <div class="data-info">
                  <span class="label">{{ formatLabel(key) }}</span>
                  <span class="value">{{ formatValue(faceData[key]) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 5: 嘴巴数据 -->
          <div class="data-section">
            <div class="section-title">嘴巴数据</div>
            <div class="data-grid">
              <div v-for="key in ['mouthWidth', 'mouthHeight']" :key="key" class="data-item">
                <div class="data-info">
                  <span class="label">{{ formatLabel(key) }}</span>
                  <span class="value">{{ formatValue(faceData[key]) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 6: 关键点坐标 -->
          <div class="data-section">
            <div class="section-title">关键点坐标</div>
            <div class="data-grid">
              <div v-for="key in ['leftEyeCoord', 'rightEyeCoord', 'noseCoord', 'mouthCoord']" :key="key" class="data-item">
                <div class="data-info">
                  <span class="label">{{ formatLabel(key) }}</span>
                  <span class="value">{{ formatValue(faceData[key]) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="!resultImage && !modelError && !modelLoading" class="empty-state">
          <div class="empty-illustration">
            <div class="face-outline">
              <div class="eye left"></div>
              <div class="eye right"></div>
              <div class="nose"></div>
              <div class="mouth"></div>
            </div>
          </div>
          <h3>准备就绪</h3>
          <p>请在左侧上传照片并点击“开始检测”按钮，系统将自动分析您的面部特征。</p>
        </div>
      </div>
    </main>
    
    <footer class="app-footer">
      <p>&copy; 2026 人脸五官检测系统</p>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { initializeFaceDetector, detectFaceInImage, printAllMeasurements } from './utils/faceDetector'

const imageFile = ref(null)
const imageUrl = ref(null)
const resultImage = ref(null)
const resultImageData = ref(null)  // 存储原始检测结果
const faceData = ref(null)
const isLoading = ref(false)
const modelLoading = ref(true)
const modelError = ref(null)

// 测量模式相关
const measurementModes = [
  { value: 'all', label: '全部' },
  { value: 'third', label: '三庭比例' },
  { value: 'five-eyes', label: '五眼比例' },
  { value: 'keypoints', label: '关键点' }
]
const currentMeasurementMode = ref('all')

// Initialize model
initializeFaceDetector()
  .then(() => {
    modelLoading.value = false
    modelError.value = null
  })
  .catch((error) => {
    modelLoading.value = false
    modelError.value = error.message || '模型加载失败'
    console.error('模型初始化错误:', error)
  })

const handleImageUpload = (event) => {
  const file = event.target.files[0]
  processFile(file)
}

const handleDrop = (event) => {
  const file = event.dataTransfer.files[0]
  processFile(file)
}

const processFile = (file) => {
  if (file && file.type.startsWith('image/')) {
    imageFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      imageUrl.value = e.target.result
      // Reset results when new image is uploaded
      resultImage.value = null
      faceData.value = null
    }
    reader.readAsDataURL(file)
  }
}

const clearAll = () => {
  imageFile.value = null
  imageUrl.value = null
  resultImage.value = null
  faceData.value = null
}

const detectFace = async () => {
  if (!imageFile.value) return

  if (modelError.value) {
    alert('❌ 人脸识别模型加载失败，请刷新页面重试')
    return
  }

  isLoading.value = true
  try {
    const result = await detectFaceInImage(imageUrl.value, currentMeasurementMode.value)

    // 打印所有数据到控制台
    console.log('===== 完整检测结果 =====')
    console.log('检测结果对象:', result)
    console.log('')
    console.log('📊 计算后的测量数据:', result.landmarks)
    console.log('')
    printAllMeasurements(result.landmarks)
    console.log('')
    console.log('📌 原始 API 返回的 468 个关键点:', result.rawLandmarks)
    console.log('========================')

    resultImageData.value = result  // 保存原始结果
    resultImage.value = result.canvas
    faceData.value = result.landmarks
    currentMeasurementMode.value = 'all'  // 重置为全部模式
  } catch (error) {
    alert('检测失败: ' + error.message)
    console.error('检测错误:', error)
  } finally {
    isLoading.value = false
  }
}

const selectMeasurementMode = async (mode) => {
  if (!resultImageData.value) return

  currentMeasurementMode.value = mode
  isLoading.value = true
  try {
    const result = await detectFaceInImage(imageUrl.value, mode)
    resultImage.value = result.canvas
  } catch (error) {
    console.error('模式切换失败:', error)
  } finally {
    isLoading.value = false
  }
}

const getIcon = (key) => {
  const icons = {
    faceHeight: '📏',
    faceWidth: '↔️',
    thirdUpper: '💆',
    thirdMiddle: '👁️',
    thirdLower: '👄',
    leftEyeWidth: '👁️',
    rightEyeWidth: '👁️',
    eyeDistance: '📏',
    leftBlank: '⬜',
    rightBlank: '⬜',
    leftEyeHeight: '↕️',
    rightEyeHeight: '↕️',
    noseWidth: '👃',
    noseHeight: '👃',
    mouthWidth: '👄',
    mouthHeight: '👄',
    leftEyeCoord: '📍',
    rightEyeCoord: '📍',
    noseCoord: '📍',
    mouthCoord: '📍'
  }
  return icons[key] || '📊'
}

const formatLabel = (key) => {
  const labels = {
    faceHeight: '脸部高度',
    faceWidth: '脸部宽度',
    thirdUpper: '上庭（额头）',
    thirdMiddle: '中庭（眼到鼻）',
    thirdLower: '下庭（鼻到下巴）',
    leftEyeWidth: '左眼宽度',
    rightEyeWidth: '右眼宽度',
    eyeDistance: '两眼距离',
    leftBlank: '左侧空白',
    rightBlank: '右侧空白',
    leftEyeHeight: '左眼高度',
    rightEyeHeight: '右眼高度',
    noseWidth: '鼻宽',
    noseHeight: '鼻高',
    mouthWidth: '嘴宽',
    mouthHeight: '嘴高',
    leftEyeCoord: '左眼坐标',
    rightEyeCoord: '右眼坐标',
    noseCoord: '鼻尖坐标',
    mouthCoord: '嘴巴坐标'
  }
  return labels[key] || key
}

const formatValue = (value) => {
  if (typeof value === 'number') {
    return value.toFixed(2) + ' px'
  }
  if (typeof value === 'object' && value !== null) {
    return `(${Math.round(value.x)}, ${Math.round(value.y)}) px`
  }
  return value
}
</script>

<style scoped>
/* Modern Color Palette */
:root {
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --secondary: #f8fafc;
  --accent: #10b981;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --bg-app: #f1f5f9;
  --white: #ffffff;
  --border: #e2e8f0;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.app-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f8fafc;
  color: #1e293b;
}

/* Header Styles */
.header {
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 1.25rem 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-icon {
  font-size: 2rem;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.logo-text h1 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.025em;
}

.logo-text p {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.clear-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

/* Main Content Layout */
.main-content {
  flex: 1;
  display: flex;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  width: 100%;
}

.left-panel {
  flex: 0 0 380px;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Card Styles */
.panel-card {
  background: #ffffff;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid #f1f5f9;
}

.card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.card-header p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0.25rem 0 0 0;
}

/* Upload Section */
.upload-section {
  padding: 1.5rem;
}

.upload-label {
  display: block;
  border: 2px dashed #cbd5e1;
  border-radius: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8fafc;
}

.upload-label:hover {
  border-color: #6366f1;
  background: #f5f3ff;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.upload-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto;
}

.upload-text {
  font-weight: 600;
  color: #1e293b;
}

.upload-hint {
  font-size: 0.75rem;
  color: #64748b;
}

.preview-container {
  position: relative;
  border-radius: 0.5rem;
  overflow: hidden;
}

.preview-img {
  width: 100%;
  height: auto;
  display: block;
}

.change-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  font-weight: 600;
}

.preview-container:hover .change-overlay {
  opacity: 1;
}

/* Action Area */
.action-area {
  padding: 0 1.5rem 1.5rem 1.5rem;
}

.detect-btn {
  width: 100%;
  padding: 0.875rem;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  border-radius: 0.75rem;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);
}

.detect-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.4);
}

.detect-btn:active:not(:disabled) {
  transform: translateY(0);
}

.detect-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background: #94a3b8;
  box-shadow: none;
}

/* Status Hints */
.status-hint {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-hint.loading {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fef3c7;
}

.status-hint.error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fee2e2;
}

/* Result Card */
/* Mode Selector */
.mode-selector {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.5rem 0 1.5rem;
  flex-wrap: wrap;
  border-bottom: 1px solid #e2e8f0;
}

.mode-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: #f5f3ff;
}

.mode-btn.active {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border-color: #6366f1;
}

.result-container {
  padding: 1.5rem;
  background: #f8fafc;
  display: flex;
  justify-content: center;
}

.result-img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

/* Data Sections */
.data-section {
  padding: 1.5rem;
  border-bottom: 1px solid #f1f5f9;
}

.data-section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e2e8f0;
}

/* Data Grid */
.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.data-item {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: all 0.2s;
}

.data-item:hover {
  background: #ffffff;
  border-color: #6366f1;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
  transform: translateY(-2px);
}

.data-icon {
  display: none;
}

.data-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.data-info .label {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
}

.data-info .value {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  background: #ffffff;
  border-radius: 1rem;
  border: 2px dashed #e2e8f0;
}

.empty-illustration {
  margin-bottom: 2rem;
}

.face-outline {
  width: 120px;
  height: 140px;
  border: 4px solid #e2e8f0;
  border-radius: 60px 60px 50px 50px;
  position: relative;
  animation: float 3s ease-in-out infinite;
}

.eye {
  width: 12px;
  height: 12px;
  background: #e2e8f0;
  border-radius: 50%;
  position: absolute;
  top: 45px;
}

.eye.left { left: 30px; }
.eye.right { right: 30px; }

.nose {
  width: 8px;
  height: 20px;
  background: #e2e8f0;
  border-radius: 4px;
  position: absolute;
  top: 65px;
  left: 50%;
  transform: translateX(-50%);
}

.mouth {
  width: 40px;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  color: #64748b;
  max-width: 400px;
  margin: 0;
  line-height: 1.6;
}

/* Footer */
.app-footer {
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
}

/* Animations */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.pulse {
  width: 8px;
  height: 8px;
  background: #f59e0b;
  border-radius: 50%;
  display: inline-block;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
  }
  
  .left-panel {
    flex: 1;
  }
}

@media (max-width: 640px) {
  .header {
    padding: 1rem;
  }
  
  .main-content {
    padding: 1rem;
  }
  
  .data-grid {
    grid-template-columns: 1fr;
  }
}
</style>
