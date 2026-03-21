<template>
  <div class="app-wrapper">
    <!-- Header -->
    <header class="header">
      <h1>🧬 人脸五官检测系统</h1>
      <p class="header-subtitle">上传照片，自动检测并标注五官数据</p>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <!-- 左侧栏：上传和检测 -->
      <div class="left-panel">
        <div class="panel-card">
          <!-- 文件上传 -->
          <div class="upload-section">
            <label for="imageInput" class="upload-btn">
              📸 选择照片
            </label>
            <input
              id="imageInput"
              type="file"
              accept="image/*"
              @change="handleImageUpload"
              style="display: none"
            />
            <p class="file-hint">或拖拽图片到此处</p>
          </div>

          <!-- 上传图片预览 -->
          <div v-if="imageUrl" class="preview-section">
            <h3>📷 上传的照片</h3>
            <img :src="imageUrl" alt="上传的照片" class="preview-img" />
          </div>

          <!-- 检测按钮 -->
          <button
            v-if="imageFile"
            @click="detectFace"
            :disabled="isLoading"
            class="detect-btn"
          >
            {{ isLoading ? '检测中...' : '🔍 开始检测' }}
          </button>

          <!-- 加载提示 -->
          <div v-if="modelLoading" class="loading-hint">
            ⏳ 正在加载人脸识别模型，首次使用需要几秒...
          </div>

          <!-- 错误提示 -->
          <div v-if="modelError" class="error-hint">
            ❌ {{ modelError }}
          </div>
        </div>
      </div>

      <!-- 右侧栏：结果和数据 -->
      <div class="right-panel">
        <!-- 检测结果 -->
        <div v-if="resultImage" class="panel-card">
          <h3>🔍 检测结果</h3>
          <img :src="resultImage" alt="检测结果" class="result-img" />
        </div>

        <!-- 数据显示 -->
        <div v-if="faceData" class="panel-card">
          <h3>📊 五官数据分析</h3>
          <div class="data-grid">
            <div v-for="(value, key) in faceData" :key="key" class="data-item">
              <span class="label">{{ formatLabel(key) }}</span>
              <span class="value">{{ formatValue(value) }}</span>
            </div>
          </div>
        </div>

        <!-- 空状态提示 -->
        <div v-if="!resultImage && !modelError && !modelLoading" class="empty-state">
          <div class="empty-icon">→</div>
          <p>请在左侧上传照片并点击检测</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { initializeFaceDetector, detectFaceInImage } from './utils/faceDetector'

const imageFile = ref(null)
const imageUrl = ref(null)
const resultImage = ref(null)
const faceData = ref(null)
const isLoading = ref(false)
const modelLoading = ref(true)
const modelError = ref(null)

// 初始化模型
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
  if (file) {
    imageFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      imageUrl.value = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const detectFace = async () => {
  if (!imageFile.value) return

  if (modelError.value) {
    alert('❌ 人脸识别模型加载失败，请刷新页面重试')
    return
  }

  isLoading.value = true
  try {
    const result = await detectFaceInImage(imageUrl.value)
    resultImage.value = result.canvas
    faceData.value = result.landmarks
  } catch (error) {
    alert('检测失败: ' + error.message)
  } finally {
    isLoading.value = false
  }
}

const formatLabel = (key) => {
  const labels = {
    // 脸部尺寸
    faceHeight: '脸部高度',
    faceWidth: '脸部宽度',

    // 三庭
    thirdUpper: '上庭（额头）',
    thirdMiddle: '中庭（眼到鼻）',
    thirdLower: '下庭（鼻到下巴）',

    // 五眼（眼睛宽度）
    leftEyeWidth: '左眼宽度',
    rightEyeWidth: '右眼宽度',
    eyeDistance: '两眼距离',

    // 眼睛高度
    leftEyeHeight: '左眼高度',
    rightEyeHeight: '右眼高度',

    // 鼻子
    noseWidth: '鼻宽',
    noseHeight: '鼻高',

    // 嘴巴
    mouthWidth: '嘴宽',
    mouthHeight: '嘴高',

    // 坐标
    leftEyeCoord: '左眼坐标',
    rightEyeCoord: '右眼坐标',
    noseCoord: '鼻尖坐标',
    mouthCoord: '嘴巴坐标'
  }
  return labels[key] || key
}

const formatValue = (value) => {
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  if (typeof value === 'object' && value !== null) {
    return `(${value.x}, ${value.y})`
  }
  return value
}
</script>

<style scoped>
/* 全局样式 */
:root {
  --primary-color: #1565c0;
  --text-primary: #212121;
  --text-secondary: #666666;
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --border-color: #e0e0e0;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.app-wrapper {
  min-height: 100vh;
  background-color: var(--bg-secondary);
}

/* Header */
.header {
  background-color: var(--bg-primary);
  padding: 40px 20px;
  text-align: center;
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.header h1 {
  color: var(--text-primary);
  font-size: 32px;
  margin: 0 0 8px 0;
  font-weight: 700;
}

.header-subtitle {
  color: var(--text-secondary);
  font-size: 15px;
  margin: 0;
  font-weight: 400;
}

/* Main Content */
.main-content {
  display: flex;
  gap: 24px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 20px;
}

.left-panel {
  flex: 0 0 40%;
  min-width: 300px;
}

.right-panel {
  flex: 1;
  min-width: 300px;
}

/* Panel Cards */
.panel-card {
  background-color: var(--bg-primary);
  border-radius: 12px;
  padding: 28px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 24px;
  border: 1px solid var(--border-color);
}

.panel-card h3 {
  color: var(--text-primary);
  font-size: 18px;
  margin: 0 0 20px 0;
  font-weight: 600;
}

/* 上传区域 */
.upload-section {
  border: 2px dashed #666666;
  border-radius: 10px;
  padding: 32px 20px;
  text-align: center;
  transition: all 0.3s ease;
  background-color: #f0f0f0;
}

.upload-section:hover {
  border-color: #333333;
  background-color: #e8e8e8;
}

.upload-btn {
  display: inline-block;
  background-color: var(--primary-color);
  color: white;
  padding: 12px 32px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
  border: none;
}

.upload-btn:hover {
  background-color: #0d47a1;
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.file-hint {
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 12px;
  margin-bottom: 0;
}

/* 预览区域 */
.preview-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.preview-section h3 {
  color: var(--text-primary);
  font-size: 16px;
  margin: 0 0 16px 0;
  font-weight: 600;
}

.preview-img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  display: block;
}

/* 检测按钮 */
.detect-btn {
  width: 100%;
  padding: 14px 20px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 24px;
}

.detect-btn:hover:not(:disabled) {
  background-color: #0d47a1;
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.detect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 检测结果 */
.result-img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  display: block;
  border: 1px solid var(--border-color);
}

/* 数据网格 */
.data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.data-item {
  background-color: var(--bg-secondary);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.data-item .label {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 13px;
}

.data-item .value {
  color: var(--primary-color);
  font-weight: 700;
  font-size: 16px;
  word-break: break-all;
}

/* 提示信息 */
.loading-hint {
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 16px;
  background-color: #fff3e0;
  border-radius: 8px;
  border-left: 4px solid #ff9800;
  margin-top: 20px;
}

.error-hint {
  text-align: center;
  color: #c62828;
  font-size: 13px;
  padding: 16px;
  background-color: #ffebee;
  border-radius: 8px;
  border-left: 4px solid #c62828;
  margin-top: 20px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary);
  text-align: center;
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  background-color: var(--bg-secondary);
}

.empty-icon {
  font-size: 36px;
  margin-bottom: 12px;
  color: #90caf9;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 900px) {
  .main-content {
    flex-direction: column;
  }

  .left-panel,
  .right-panel {
    flex: 1;
    min-width: auto;
  }
}

@media (max-width: 600px) {
  .header {
    padding: 24px 16px;
  }

  .header h1 {
    font-size: 24px;
  }

  .main-content {
    padding: 16px;
    gap: 16px;
  }

  .panel-card {
    padding: 20px;
    margin-bottom: 16px;
  }

  .upload-section {
    padding: 24px 16px;
  }

  .data-grid {
    grid-template-columns: 1fr;
  }
}
</style>
