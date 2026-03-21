import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let faceLandmarker = null

/**
 * 初始化人脸识别模型
 */
export async function initializeFaceDetector() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    )

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
      },
      runningMode: 'IMAGE',
      numFaces: 1
    })

    console.log('✅ 人脸识别模型初始化成功')
    return true
  } catch (error) {
    console.error('❌ 模型初始化失败:', error)
    throw error
  }
}

/**
 * 在图片上检测人脸并绘制标注
 */
export async function detectFaceInImage(imageUrl) {
  if (!faceLandmarker) {
    throw new Error('检测器未初始化，请先调用 initializeFaceDetector')
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        // 检测人脸（使用 detect 而不是 detectForVideo）
        const results = faceLandmarker.detect(img)

        if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
          reject(new Error('未检测到人脸，请确保图片中有清晰的人脸'))
          return
        }

        // 创建 canvas 并绘制
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')

        // 绘制原图
        ctx.drawImage(img, 0, 0)

        // 绘制标注
        const landmarks = results.faceLandmarks[0]
        const data = drawLandmarks(ctx, landmarks, img.width, img.height)

        resolve({
          canvas: canvas.toDataURL('image/png'),
          landmarks: data
        })
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = imageUrl
  })
}

/**
 * 绘制面部特征点和线条
 */
function drawLandmarks(ctx, landmarks, width, height) {
  const data = {}

  // 缩放因子（MediaPipe 返回的是 0-1 之间的相对坐标）
  const scale = {
    x: width,
    y: height
  }

  // 关键点索引定义
  const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375]
  const LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
  const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
  const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

  // 绘制面部轮廓
  ctx.strokeStyle = '#00CED1'
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5]) // 虚线
  drawConnectedPoints(ctx, landmarks, FACE_OVAL, scale)

  // 绘制左眼
  ctx.strokeStyle = '#FF69B4'
  drawConnectedPoints(ctx, landmarks, LEFT_EYE, scale)

  // 绘制右眼
  ctx.strokeStyle = '#FF1493'
  drawConnectedPoints(ctx, landmarks, RIGHT_EYE, scale)

  // 绘制嘴巴
  ctx.strokeStyle = '#FFD700'
  drawConnectedPoints(ctx, landmarks, LIPS, scale)

  ctx.setLineDash([]) // 恢复实线

  // 标记关键点
  const keyPoints = {
    leftEye: 33,     // 左眼外角
    rightEye: 362,   // 右眼外角
    noseTip: 1,      // 鼻尖
    mouth: 13,       // 嘴巴中心
  }

  ctx.fillStyle = '#FF6347'
  ctx.strokeStyle = '#FF6347'
  ctx.lineWidth = 2

  Object.entries(keyPoints).forEach(([key, index]) => {
    const point = landmarks[index]
    const x = point.x * scale.x
    const y = point.y * scale.y

    // 画圆点
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, 2 * Math.PI)
    ctx.fill()

    // 标记名字
    ctx.fillStyle = '#333'
    ctx.font = 'bold 12px Arial'
    ctx.fillText(formatPointName(key), x + 10, y - 10)
    ctx.fillStyle = '#FF6347'
  })

  // 计算详细的面部测量数据
  const measurements = calculateFaceMeasurements(landmarks, scale)

  return measurements
}

/**
 * 计算详细的面部测量数据
 */
function calculateFaceMeasurements(landmarks, scale) {
  const data = {}

  // 关键点索引
  const points = {
    // 脸部关键点
    foreheadCenter: 10,      // 额头中心
    chinTip: 152,            // 下巴尖
    leftTemple: 21,          // 左太阳穴
    rightTemple: 251,        // 右太阳穴

    // 眼睛关键点
    leftEyeLeft: 33,         // 左眼左侧
    leftEyeRight: 130,       // 左眼右侧
    leftEyeTop: 159,         // 左眼上方
    leftEyeBottom: 145,      // 左眼下方
    rightEyeLeft: 362,       // 右眼左侧
    rightEyeRight: 263,      // 右眼右侧
    rightEyeTop: 386,        // 右眼上方
    rightEyeBottom: 374,     // 右眼下方

    // 鼻子关键点
    noseTip: 1,              // 鼻尖
    noseLeft: 98,            // 鼻子左侧
    noseRight: 327,          // 鼻子右侧
    noseTop: 10,             // 鼻子顶部

    // 嘴巴关键点
    mouthLeft: 61,           // 嘴巴左侧
    mouthRight: 291,         // 嘴巴右侧
    mouthTop: 13,            // 嘴巴上方
    mouthBottom: 14,         // 嘴巴下方

    // 脸部宽度
    faceLeft: 162,           // 脸左侧（颧骨）
    faceRight: 389,          // 脸右侧（颧骨）
  }

  // 计算距离函数
  const getDistance = (idx1, idx2) => {
    const p1 = landmarks[idx1]
    const p2 = landmarks[idx2]
    if (!p1 || !p2) return 0
    const dx = (p2.x - p1.x) * scale.x
    const dy = (p2.y - p1.y) * scale.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  // 1. 脸部总尺寸
  const faceHeight = getDistance(points.foreheadCenter, points.chinTip)
  const faceWidth = getDistance(points.faceLeft, points.faceRight)
  data.faceHeight = faceHeight.toFixed(2)
  data.faceWidth = faceWidth.toFixed(2)

  // 2. 三庭比例
  const thirdUpper = getDistance(points.foreheadCenter, landmarks[10])  // 眉毛到额头
  const thirdMiddle = getDistance(landmarks[10], landmarks[152])         // 眉毛到鼻子
  const thirdLower = getDistance(landmarks[152], points.chinTip)         // 鼻子到下巴
  data.thirdUpper = thirdUpper.toFixed(2)
  data.thirdMiddle = thirdMiddle.toFixed(2)
  data.thirdLower = thirdLower.toFixed(2)

  // 3. 五眼比例 (两眼距离 = 一眼宽度)
  const leftEyeWidth = getDistance(points.leftEyeLeft, points.leftEyeRight)
  const rightEyeWidth = getDistance(points.rightEyeLeft, points.rightEyeRight)
  const eyeDistance = getDistance(points.leftEyeRight, points.rightEyeLeft)
  data.leftEyeWidth = leftEyeWidth.toFixed(2)
  data.rightEyeWidth = rightEyeWidth.toFixed(2)
  data.eyeDistance = eyeDistance.toFixed(2)

  // 4. 眼睛高度
  const leftEyeHeight = getDistance(points.leftEyeTop, points.leftEyeBottom)
  const rightEyeHeight = getDistance(points.rightEyeTop, points.rightEyeBottom)
  data.leftEyeHeight = leftEyeHeight.toFixed(2)
  data.rightEyeHeight = rightEyeHeight.toFixed(2)

  // 5. 鼻子尺寸
  const noseWidth = getDistance(points.noseLeft, points.noseRight)
  const noseHeight = getDistance(points.noseTop, points.noseTip)
  data.noseWidth = noseWidth.toFixed(2)
  data.noseHeight = noseHeight.toFixed(2)

  // 6. 嘴巴尺寸
  const mouthWidth = getDistance(points.mouthLeft, points.mouthRight)
  const mouthHeight = getDistance(points.mouthTop, points.mouthBottom)
  data.mouthWidth = mouthWidth.toFixed(2)
  data.mouthHeight = mouthHeight.toFixed(2)

  // 7. 关键点坐标
  data.leftEyeCoord = {
    x: (landmarks[points.leftEyeLeft]?.x * scale.x).toFixed(2) || '0.00',
    y: (landmarks[points.leftEyeLeft]?.y * scale.y).toFixed(2) || '0.00'
  }
  data.rightEyeCoord = {
    x: (landmarks[points.rightEyeLeft]?.x * scale.x).toFixed(2) || '0.00',
    y: (landmarks[points.rightEyeLeft]?.y * scale.y).toFixed(2) || '0.00'
  }
  data.noseCoord = {
    x: (landmarks[points.noseTip]?.x * scale.x).toFixed(2) || '0.00',
    y: (landmarks[points.noseTip]?.y * scale.y).toFixed(2) || '0.00'
  }
  data.mouthCoord = {
    x: (landmarks[points.mouthLeft]?.x * scale.x).toFixed(2) || '0.00',
    y: (landmarks[points.mouthLeft]?.y * scale.y).toFixed(2) || '0.00'
  }

  return data
}

/**
 * 绘制连接的点
 */
function drawConnectedPoints(ctx, landmarks, indices, scale) {
  if (indices.length < 2) return

  ctx.beginPath()
  const firstPoint = landmarks[indices[0]]
  ctx.moveTo(firstPoint.x * scale.x, firstPoint.y * scale.y)

  for (let i = 1; i < indices.length; i++) {
    const point = landmarks[indices[i]]
    ctx.lineTo(point.x * scale.x, point.y * scale.y)
  }

  // 闭合路径
  ctx.lineTo(landmarks[indices[0]].x * scale.x, landmarks[indices[0]].y * scale.y)
  ctx.stroke()
}

/**
 * 格式化关键点名称
 */
function formatPointName(key) {
  const names = {
    leftEye: '左眼',
    rightEye: '右眼',
    noseTip: '鼻尖',
    mouth: '嘴'
  }
  return names[key] || key
}
