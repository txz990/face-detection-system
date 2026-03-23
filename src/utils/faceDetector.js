import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let faceLandmarker = null

/**
 * 自动检测和修正关键点索引
 */
function autoDetectKeypoints(landmarks, imgWidth, imgHeight) {
  const getDistance = (idx1, idx2) => {
    const p1 = landmarks[idx1]
    const p2 = landmarks[idx2]
    if (!p1 || !p2) return 0
    const dx = (p2.x - p1.x) * imgWidth
    const dy = (p2.y - p1.y) * imgHeight
    return Math.sqrt(dx * dx + dy * dy)
  }

  // 可能的眼睛宽度索引组合
  const eyeCombinations = [
    { left: [33, 133], right: [362, 263], name: '修正版' },
    { left: [33, 130], right: [263, 362], name: '旧版' },
  ]

  console.log('🔧 自动检测关键点索引:')
  console.log('---')

  eyeCombinations.forEach(combo => {
    const leftWidth = getDistance(combo.left[0], combo.left[1])
    const rightWidth = getDistance(combo.right[0], combo.right[1])
    const ratio = (leftWidth / rightWidth).toFixed(2)
    const isValid = leftWidth > 20 && leftWidth < 200 && rightWidth > 20 && rightWidth < 200

    console.log(`${combo.name}: 左眼=${leftWidth.toFixed(2)}px, 右眼=${rightWidth.toFixed(2)}px, 比例=${ratio}`, isValid ? '✅' : '❌')
  })

  console.log('---')

  // 调试：输出下颌相关关键点
  console.log('📍 下颌区域关键点坐标（X, Y）:')
  const jawCandidates = [148, 149, 150, 176, 177, 178, 397, 398, 399]
  jawCandidates.forEach(idx => {
    const point = landmarks[idx]
    if (point) {
      console.log(`  landmarks[${idx}]: (${(point.x * imgWidth).toFixed(0)}, ${(point.y * imgHeight).toFixed(0)})`)
    }
  })
}


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
export async function detectFaceInImage(imageUrl, measurementMode = 'all') {
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
        const data = drawLandmarks(ctx, landmarks, img.width, img.height, measurementMode)

        // 打印所有原始 API 数据到控制台
        console.log('====== 原始 API 返回数据 ======')
        console.log('📌 总共检测到', landmarks.length, '个关键点')

        // 自动检测正确的关键点索引
        autoDetectKeypoints(landmarks, img.width, img.height)
        console.log('')
        resolve({
          canvas: canvas.toDataURL('image/png'),
          landmarks: data,
          rawLandmarks: landmarks  // 返回原始数据
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
function drawLandmarks(ctx, landmarks, width, height, measurementMode = 'all') {
  // 缩放因子（MediaPipe 返回的是 0-1 之间的相对坐标）
  const scale = {
    x: width,
    y: height
  }

  // 计算人脸尺度因子（用于动态调整线条、字体、标签大小）
  const foreheadCenter = landmarks[10]
  const chinTip = landmarks[152]
  const faceHeight = Math.abs((chinTip.y - foreheadCenter.y) * height)

  // 基准人脸高度为 300px，计算缩放因子
  const baseHeight = 300
  const faceScale = Math.max(0.5, Math.min(2, faceHeight / baseHeight))

  // 关键点索引定义（根据 MediaPipe 官方 468 个关键点定义）
  const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375]
  const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
  const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
  const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

  // 只在"全部"和"关键点"模式下绘制面部轮廓和眼睛轮廓
  if (measurementMode === 'all' || measurementMode === 'keypoints') {
    // 绘制面部轮廓
    ctx.strokeStyle = '#00CED1'
    ctx.lineWidth = 2.5 * faceScale
    ctx.setLineDash([5, 5])
    ctx.globalAlpha = 0.8
    drawConnectedPoints(ctx, landmarks, FACE_OVAL, scale)

    // 绘制左眼
    ctx.strokeStyle = '#FF69B4'
    ctx.globalAlpha = 0.8
    drawConnectedPoints(ctx, landmarks, LEFT_EYE, scale)

    // 绘制右眼
    ctx.strokeStyle = '#FF1493'
    ctx.globalAlpha = 0.8
    drawConnectedPoints(ctx, landmarks, RIGHT_EYE, scale)

    // 绘制嘴巴
    ctx.strokeStyle = '#FFD700'
    ctx.globalAlpha = 0.8
    drawConnectedPoints(ctx, landmarks, LIPS, scale)

    ctx.setLineDash([]) // 恢复实线
    ctx.globalAlpha = 1.0
  }

  // 计算详细的面部测量数据（需要先计算，然后才能显示）
  const measurements = calculateFaceMeasurements(landmarks, scale)

  // 根据模式绘制不同的测量线
  if (measurementMode === 'all' || measurementMode === 'third') {
    // 绘制三庭区域框
    drawThirdRegions(ctx, landmarks, scale, measurements, faceScale)
  }

  if (measurementMode === 'all' || measurementMode === 'five-eyes') {
    // 绘制五眼比例区域
    drawFiveEyesRegions(ctx, landmarks, scale, measurements, faceScale)
  }

  // 在"全部"模式下显示脸高和脸宽
  if (measurementMode === 'all') {
    drawFaceDimensions(ctx, landmarks, scale, measurements, faceScale)
  }

  // 只在"全部"和"关键点"模式下显示关键点标注
  if (measurementMode === 'all' || measurementMode === 'keypoints') {
    // 标记关键点并添加数据标签
    const keyPoints = {
      noseTip: { index: 1, label: '鼻宽', value: `${measurements.noseWidth.toFixed(1)} px` },
      mouth: { index: 13, label: '嘴宽', value: `${measurements.mouthWidth.toFixed(1)} px` }
    }

    // 绘制关键点圆点和标签
    Object.entries(keyPoints).forEach(([key, pointData]) => {
      const point = landmarks[pointData.index]
      const x = point.x * scale.x
      const y = point.y * scale.y

      // 根据人脸比例调整圆点大小（参考 MediaPipe DrawingSpec）
      const mainRadius = 5 * faceScale
      const borderRadius = Math.max(mainRadius + 1.5, mainRadius * 1.3)

      // 绘制圆点外圈边框（灰色半透明背景）
      ctx.fillStyle = 'rgba(255, 99, 71, 0.15)'
      ctx.beginPath()
      ctx.arc(x, y, borderRadius + 2, 0, 2 * Math.PI)
      ctx.fill()

      // 绘制主圆点（实心）
      ctx.fillStyle = '#FF6347'
      ctx.beginPath()
      ctx.arc(x, y, mainRadius, 0, 2 * Math.PI)
      ctx.fill()

      // 绘制圆点边框
      ctx.strokeStyle = '#FF4500'
      ctx.lineWidth = 1 * faceScale
      ctx.beginPath()
      ctx.arc(x, y, mainRadius, 0, 2 * Math.PI)
      ctx.stroke()

      // 白色内点（高亮）
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(x, y, mainRadius * 0.4, 0, 2 * Math.PI)
      ctx.fill()

      // 绘制标签
      const label = `${pointData.label}`
      const value = pointData.value

      // 根据人脸比例调整字体和框大小
      const fontSize = Math.round(13 * faceScale)
      const valueSize = Math.round(11 * faceScale)
      const boxPadding = 8 * faceScale
      const labelOffset = 18 * faceScale

      // 计算文字宽度和位置
      ctx.font = `bold ${fontSize}px Arial`
      const labelMetrics = ctx.measureText(label)
      const valueMetrics = ctx.measureText(value)
      const maxWidth = Math.max(labelMetrics.width, valueMetrics.width) + 2 * boxPadding
      const boxHeight = 42 * faceScale

      // 智能标签位置算法：尝试 12 个位置找最佳点（类似 face-api.js）
      const positions = [
        { dx: labelOffset, dy: -labelOffset },      // 右上
        { dx: labelOffset, dy: 0 },                  // 右
        { dx: labelOffset, dy: labelOffset },        // 右下
        { dx: 0, dy: -labelOffset },                 // 上
        { dx: 0, dy: labelOffset },                  // 下
        { dx: -labelOffset, dy: -labelOffset },      // 左上
        { dx: -labelOffset, dy: 0 },                 // 左
        { dx: -labelOffset, dy: labelOffset },       // 左下
      ]

      let bestPosition = positions[0]
      let minBoundaryViolations = Infinity

      positions.forEach(pos => {
        const testX = x + pos.dx
        const testY = y + pos.dy
        let violations = 0

        // 检查边界
        if (testX - maxWidth / 2 < 0) violations += 10
        if (testX + maxWidth / 2 > width) violations += 10
        if (testY - boxHeight / 2 < 0) violations += 10
        if (testY + boxHeight / 2 > height) violations += 5

        if (violations < minBoundaryViolations) {
          minBoundaryViolations = violations
          bestPosition = pos
        }
      })

      let labelX = x + bestPosition.dx
      let labelY = y + bestPosition.dy

      // 边界夹紧（确保完全可见）
      labelX = Math.max(maxWidth / 2, Math.min(labelX, width - maxWidth / 2))
      labelY = Math.max(boxHeight / 2, Math.min(labelY, height - boxHeight / 2))

      // 绘制标签背景（圆角矩形）
      ctx.fillStyle = 'rgba(255, 255, 255, 0.97)'
      ctx.strokeStyle = '#FF6347'
      ctx.lineWidth = 1.5 * faceScale

      const boxX = labelX - maxWidth / 2
      const boxY = labelY - boxHeight / 2
      drawRoundRect(ctx, boxX, boxY, maxWidth, boxHeight, 5 * faceScale)
      ctx.fill()
      ctx.stroke()

      // 绘制连接线（从圆点到标签框边缘）
      ctx.strokeStyle = '#FF6347'
      ctx.lineWidth = 1.2 * faceScale
      ctx.globalAlpha = 0.5
      ctx.setLineDash([3, 2])
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(labelX, labelY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1.0

      // 绘制文字（使用 textBaseline 改进对齐）
      ctx.fillStyle = '#FF6347'
      ctx.font = `bold ${fontSize}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, labelX, labelY - 8 * faceScale)

      ctx.font = `${valueSize}px Arial`
      ctx.fillStyle = '#555'
      ctx.textBaseline = 'middle'
      ctx.fillText(value, labelX, labelY + 10 * faceScale)
    })
  }

  return measurements
}

/**
 * 绘制脸部尺寸（脸高、中庭、脸宽及其他宽度参数）
 */
function drawFaceDimensions(ctx, landmarks, scale, measurements, faceScale) {
  const forehead = landmarks[10]      // 额头中心
  const chin = landmarks[152]         // 下巴
  const faceLeft = landmarks[162]     // 脸左侧
  const faceRight = landmarks[389]    // 脸右侧
  const eyeTop = landmarks[159]       // 左眼上方（眉线参考）
  const noseTip = landmarks[1]        // 鼻尖
  const leftTemple = landmarks[21]    // 左太阳穴
  const rightTemple = landmarks[251]  // 右太阳穴
  const mouthBottom = landmarks[14]   // 嘴巴下方中心

  if (!forehead || !chin || !faceLeft || !faceRight || !eyeTop || !noseTip ||
      !leftTemple || !rightTemple || !mouthBottom) return

  // 找下颌最外侧的点（通过遍历脸部轮廓，找在下颌高度最左和最右的点）
  const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
  const chinY = chin.y * scale.y
  const mouthBottomY = mouthBottom.y * scale.y

  // 在下颌区域（下巴附近的纵向范围内）找最左和最右的点
  let jawLeftPoint = null
  let jawRightPoint = null
  let minX = Infinity
  let maxX = -Infinity

  // 只看 Y 坐标在下颌附近的点（下巴之下，嘴巴附近）
  const jawYRange = { min: mouthBottomY, max: chin.y * scale.y + 50 * faceScale }

  FACE_OVAL.forEach(idx => {
    const point = landmarks[idx]
    if (!point) return
    const x = point.x * scale.x
    const y = point.y * scale.y

    // 在下颌Y坐标范围内，找最左和最右的点
    if (y >= jawYRange.min - 30 * faceScale && y <= jawYRange.max) {
      if (x < minX) {
        minX = x
        jawLeftPoint = point
      }
      if (x > maxX) {
        maxX = x
        jawRightPoint = point
      }
    }
  })

  const leftJawX = jawLeftPoint ? jawLeftPoint.x * scale.x : faceLeft.x * scale.x
  const rightJawX = jawRightPoint ? jawRightPoint.x * scale.x : faceRight.x * scale.x

  const foreheadY = forehead.y * scale.y
  const chinX = chin.x * scale.x
  const chinY_val = chin.y * scale.y
  const leftX = faceLeft.x * scale.x
  const rightX = faceRight.x * scale.x
  const eyeTopY = eyeTop.y * scale.y
  const noseTipY = noseTip.y * scale.y
  const leftTempleX = leftTemple.x * scale.x
  const rightTempleX = rightTemple.x * scale.x
  const templeY = leftTemple.y * scale.y
  const jawY = jawLeftPoint ? jawLeftPoint.y * scale.y : mouthBottomY
  const rightJawY = jawRightPoint ? jawRightPoint.y * scale.y : mouthBottomY

  // 线条样式
  const lineWidth = 2 * faceScale
  const arrowSize = 15 * faceScale
  const fontSize = Math.round(12 * faceScale)
  const valueFontSize = Math.round(11 * faceScale)

  // ===== 脸高标注（左侧竖线） =====
  ctx.strokeStyle = '#8B5CF6'
  ctx.lineWidth = lineWidth
  ctx.globalAlpha = 0.7
  ctx.setLineDash([5, 5])
  const heightX = leftX - 30 * faceScale
  ctx.beginPath()
  ctx.moveTo(heightX, foreheadY)
  ctx.lineTo(heightX, chinY_val)
  ctx.stroke()

  // 脸高箭头标记
  ctx.setLineDash([])
  ctx.globalAlpha = 1.0
  drawArrow(ctx, heightX, foreheadY - arrowSize/2, heightX, foreheadY + arrowSize/2, '#8B5CF6', arrowSize)
  drawArrow(ctx, heightX, chinY_val + arrowSize/2, heightX, chinY_val - arrowSize/2, '#8B5CF6', arrowSize)

  // 脸高标签（与脸宽标签对齐）
  const heightLabelX = heightX - 25 * faceScale
  const heightLabelY = foreheadY - 75 * faceScale  // 与脸宽标签Y位置对齐
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeStyle = '#8B5CF6'
  ctx.lineWidth = 1.5 * faceScale
  drawRoundRect(ctx, heightLabelX - 35 * faceScale, heightLabelY - 20 * faceScale, 70 * faceScale, 40 * faceScale, 4 * faceScale)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#8B5CF6'
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('脸高', heightLabelX, heightLabelY - 8 * faceScale)

  ctx.font = `${valueFontSize}px Arial`
  ctx.fillStyle = '#666'
  ctx.fillText(`${measurements.faceHeight.toFixed(1)} px`, heightLabelX, heightLabelY + 10 * faceScale)

  // ===== 脸宽标注（上方，在五眼标签上方） =====
  ctx.strokeStyle = '#EC4899'
  ctx.lineWidth = lineWidth
  ctx.globalAlpha = 0.7
  ctx.setLineDash([5, 5])
  const widthY = foreheadY - 50 * faceScale  // 上移：在五眼标签上方
  ctx.beginPath()
  ctx.moveTo(leftX, widthY)
  ctx.lineTo(rightX, widthY)
  ctx.stroke()

  // 脸宽箭头标记
  ctx.setLineDash([])
  ctx.globalAlpha = 1.0
  drawArrow(ctx, leftX - arrowSize/2, widthY, leftX + arrowSize/2, widthY, '#EC4899', arrowSize)
  drawArrow(ctx, rightX + arrowSize/2, widthY, rightX - arrowSize/2, widthY, '#EC4899', arrowSize)

  // 脸宽标签
  const widthLabelX = (leftX + rightX) / 2
  const widthLabelY = widthY - 25 * faceScale
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeStyle = '#EC4899'
  ctx.lineWidth = 1.5 * faceScale
  drawRoundRect(ctx, widthLabelX - 35 * faceScale, widthLabelY - 20 * faceScale, 70 * faceScale, 40 * faceScale, 4 * faceScale)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#EC4899'
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('脸宽', widthLabelX, widthLabelY - 8 * faceScale)

  ctx.font = `${valueFontSize}px Arial`
  ctx.fillStyle = '#666'
  ctx.fillText(`${measurements.faceWidth.toFixed(1)} px`, widthLabelX, widthLabelY + 10 * faceScale)

  // ===== 颞部宽度标注 =====
  ctx.strokeStyle = '#F97316'
  ctx.lineWidth = lineWidth
  ctx.globalAlpha = 0.7
  ctx.setLineDash([5, 5])
  const templeLineY = templeY
  ctx.beginPath()
  ctx.moveTo(leftTempleX, templeLineY)
  ctx.lineTo(rightTempleX, templeLineY)
  ctx.stroke()

  // 颞部宽度箭头标记
  ctx.setLineDash([])
  ctx.globalAlpha = 1.0
  drawArrow(ctx, leftTempleX - arrowSize/2, templeLineY, leftTempleX + arrowSize/2, templeLineY, '#F97316', arrowSize)
  drawArrow(ctx, rightTempleX + arrowSize/2, templeLineY, rightTempleX - arrowSize/2, templeLineY, '#F97316', arrowSize)

  // 颞部宽度标签
  const templeLabelX = (leftTempleX + rightTempleX) / 2
  const templeLabelY = templeLineY - 25 * faceScale
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeStyle = '#F97316'
  ctx.lineWidth = 1.5 * faceScale
  drawRoundRect(ctx, templeLabelX - 40 * faceScale, templeLabelY - 20 * faceScale, 80 * faceScale, 40 * faceScale, 4 * faceScale)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#F97316'
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('颞部宽', templeLabelX, templeLabelY - 8 * faceScale)

  ctx.font = `${valueFontSize}px Arial`
  ctx.fillStyle = '#666'
  ctx.fillText(`${measurements.templeWidth.toFixed(1)} px`, templeLabelX, templeLabelY + 10 * faceScale)

  // ===== 颧骨宽度标注 =====
  // 注：颧骨宽度与脸宽相同，共享脸宽的线条，这里只标注
  // 颧骨最宽处在眼睛下方和鼻子之间，取眼睛下方点的Y坐标
  const eyeBottom = landmarks[145]  // 左眼下方
  const eyeBottomY = eyeBottom ? eyeBottom.y * scale.y : (eyeTopY + noseTipY) / 2
  const cheekboneLineY = eyeBottomY

  // 颧骨宽度标签（无需绘制线条，共享脸宽线条）
  const cheekboneLabelX = (leftX + rightX) / 2
  const cheekboneLabelY = cheekboneLineY - 40 * faceScale  // 标签在颧骨线上方
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeStyle = '#06B6D4'
  ctx.lineWidth = 1.5 * faceScale
  drawRoundRect(ctx, cheekboneLabelX - 40 * faceScale, cheekboneLabelY - 20 * faceScale, 80 * faceScale, 40 * faceScale, 4 * faceScale)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#06B6D4'
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('颧骨宽', cheekboneLabelX, cheekboneLabelY - 8 * faceScale)

  ctx.font = `${valueFontSize}px Arial`
  ctx.fillStyle = '#666'
  ctx.fillText(`${measurements.cheekboneWidth.toFixed(1)} px`, cheekboneLabelX, cheekboneLabelY + 10 * faceScale)

  // ===== 下颌宽度标注（在下嘴唇附近） =====
  ctx.strokeStyle = '#FF6347'
  ctx.lineWidth = lineWidth
  ctx.globalAlpha = 0.7
  ctx.setLineDash([5, 5])

  // 在下嘴唇高度绘制横线（从左下颌到右下颌，自动匹配脸型大小）
  ctx.beginPath()
  ctx.moveTo(leftJawX, jawY)
  ctx.lineTo(rightJawX, jawY)
  ctx.stroke()
  ctx.setLineDash([])

  // 下颌宽度箭头标记
  ctx.globalAlpha = 1.0
  drawArrow(ctx, leftJawX - arrowSize/2, jawY, leftJawX + arrowSize/2, jawY, '#FF6347', arrowSize)
  drawArrow(ctx, rightJawX + arrowSize/2, jawY, rightJawX - arrowSize/2, jawY, '#FF6347', arrowSize)

  // 下颌宽度标签
  const jawLabelX = (leftJawX + rightJawX) / 2
  const jawLabelY = jawY + 30 * faceScale
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeStyle = '#FF6347'
  ctx.lineWidth = 1.5 * faceScale
  drawRoundRect(ctx, jawLabelX - 40 * faceScale, jawLabelY - 20 * faceScale, 80 * faceScale, 40 * faceScale, 4 * faceScale)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#FF6347'
  ctx.font = `bold ${fontSize}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('下颌宽', jawLabelX, jawLabelY - 8 * faceScale)

  ctx.font = `${valueFontSize}px Arial`
  ctx.fillStyle = '#666'
  ctx.fillText(`${measurements.jawWidth.toFixed(1)} px`, jawLabelX, jawLabelY + 10 * faceScale)
}

/**
 * 绘制箭头
 */
function drawArrow(ctx, fromX, fromY, toX, toY, color, size) {
  const headlen = 8
  const angle = Math.atan2(toY - fromY, toX - fromX)

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.5

  // 箭头顶点
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()
}

/**
 * 绘制三庭比例区域
 */
function drawThirdRegions(ctx, landmarks, scale, measurements, faceScale) {
  const forehead = landmarks[10]      // 额头中心
  const eyeTop = landmarks[159]       // 左眼上方（准确的眼睛上边界）
  const noseTip = landmarks[1]        // 鼻尖
  const chin = landmarks[152]         // 下巴

  const leftFace = landmarks[162]     // 脸左侧
  const rightFace = landmarks[389]    // 脸右侧

  if (!forehead || !eyeTop || !noseTip || !chin || !leftFace || !rightFace) return

  const foreheadY = forehead.y * scale.y
  const hairlineY = foreheadY - 60 * faceScale  // 发际线：额头上方60px（动态缩放）
  const y1 = hairlineY                // 发际线（上庭上界）
  const y2 = eyeTop.y * scale.y       // 眼睛上边界（更准确的眉毛线）
  const y3 = noseTip.y * scale.y      // 鼻尖高度
  const y4 = chin.y * scale.y         // 下巴高度

  const x1 = leftFace.x * scale.x     // 左边界
  const x2 = rightFace.x * scale.x    // 右边界

  // 根据人脸比例调整线条宽度
  const lineWidth = 2.5 * faceScale
  const dashSize = Math.max(6, 6 * faceScale)
  const fontSize = Math.round(14 * faceScale)
  const valueFontSize = Math.round(12 * faceScale)
  const labelBoxWidth = 90 * faceScale
  const labelBoxHeight = 44 * faceScale
  const boxRadius = 6 * faceScale

  // 绘制三条水平线（更清晰的样式）
  ctx.lineWidth = lineWidth
  ctx.setLineDash([dashSize, 5])

  // 眉毛线（上庭下界 = 中庭上界）
  ctx.strokeStyle = '#FF6B6B'
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.moveTo(x1, y2)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  // 鼻尖线（中庭下界 = 下庭上界）
  ctx.strokeStyle = '#4ECDC4'
  ctx.beginPath()
  ctx.moveTo(x1, y3)
  ctx.lineTo(x2, y3)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.globalAlpha = 1.0

  // 绘制三个区域的标签和数值
  const regions = [
    {
      name: '上庭',
      value: measurements.thirdUpper,
      color: '#FF6B6B',
      y: (y1 + y2) / 2
    },
    {
      name: '中庭',
      value: measurements.thirdMiddle,
      color: '#4ECDC4',
      y: (y2 + y3) / 2
    },
    {
      name: '下庭',
      value: measurements.thirdLower,
      color: '#95E1D3',
      y: (y3 + y4) / 2
    }
  ]

  regions.forEach((region, index) => {
    // 所有标签都在左侧对齐，固定X位置，Y根据区域调整
    const labelX = x1 - 85 * faceScale
    const labelY = region.y

    // 绘制带圆角的标签背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)'
    ctx.strokeStyle = region.color
    ctx.lineWidth = lineWidth

    const boxX = labelX - labelBoxWidth / 2
    const boxY = labelY - labelBoxHeight / 2

    drawRoundRect(ctx, boxX, boxY, labelBoxWidth, labelBoxHeight, boxRadius)
    ctx.fill()
    ctx.stroke()

    // 绘制指向线（连接标签和测量线）
    ctx.strokeStyle = region.color
    ctx.lineWidth = 1.5 * faceScale
    ctx.globalAlpha = 0.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(labelX + labelBoxWidth / 2, labelY)
    ctx.lineTo(x1 - 10, labelY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1.0

    // 绘制标签文字
    ctx.fillStyle = region.color
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(region.name, labelX, labelY - 4 * faceScale)

    // 绘制数值
    ctx.font = `${valueFontSize}px Arial`
    ctx.fillStyle = '#666'
    ctx.fillText(`${region.value.toFixed(1)} px`, labelX, labelY + 12 * faceScale)
  })
}


/**
 * 绘制五眼比例区域
 */
function drawFiveEyesRegions(ctx, landmarks, scale, measurements, faceScale) {
  const faceLeft = landmarks[162]
  const leftEyeLeft = landmarks[33]
  const leftEyeRight = landmarks[133]
  const rightEyeLeft = landmarks[362]
  const rightEyeRight = landmarks[263]
  const faceRight = landmarks[389]
  const foreheadY = landmarks[10].y * scale.y
  const chinY = landmarks[152].y * scale.y

  if (!faceLeft || !leftEyeLeft || !leftEyeRight || !rightEyeLeft || !rightEyeRight || !faceRight) return

  const x0 = faceLeft.x * scale.x
  const x1 = leftEyeLeft.x * scale.x
  const x2 = leftEyeRight.x * scale.x
  const x3 = rightEyeLeft.x * scale.x
  const x4 = rightEyeRight.x * scale.x
  const x5 = faceRight.x * scale.x
  const eyeY = leftEyeLeft.y * scale.y

  // 根据人脸比例调整线条
  const lineWidth = 2.5 * faceScale
  const dashSize = Math.max(6, 6 * faceScale)

  // 绘制竖线（分割五个眼睛宽度区域）
  ctx.lineWidth = lineWidth
  ctx.setLineDash([dashSize, 5])
  ctx.globalAlpha = 0.6

  const lines = [
    { x: x1, color: '#FF69B4' },  // 左眼外侧
    { x: x2, color: '#8E7DBE' },  // 左眼内侧
    { x: x3, color: '#8E7DBE' },  // 右眼内侧
    { x: x4, color: '#FF1493' }   // 右眼外侧
  ]

  lines.forEach(line => {
    ctx.strokeStyle = line.color
    ctx.beginPath()
    ctx.moveTo(line.x, foreheadY)
    ctx.lineTo(line.x, chinY)
    ctx.stroke()
  })

  ctx.setLineDash([])
  ctx.globalAlpha = 1.0

  // 绘制五个眼睛宽度区域的标签
  const regions = [
    {
      name: '左空白',
      value: measurements.leftBlank,
      color: '#9CA3AF',
      x: (x0 + x1) / 2
    },
    {
      name: '左眼',
      value: measurements.leftEyeWidth,
      color: '#FF69B4',
      x: (x1 + x2) / 2
    },
    {
      name: '眼距',
      value: measurements.eyeDistance,
      color: '#8E7DBE',
      x: (x2 + x3) / 2
    },
    {
      name: '右眼',
      value: measurements.rightEyeWidth,
      color: '#FF1493',
      x: (x3 + x4) / 2
    },
    {
      name: '右空白',
      value: measurements.rightBlank,
      color: '#9CA3AF',
      x: (x4 + x5) / 2
    }
  ]

  const fontSize = Math.round(14 * faceScale)
  const valueFontSize = Math.round(12 * faceScale)
  const labelBoxWidth = 110 * faceScale
  const labelBoxHeight = 44 * faceScale
  const boxRadius = 6 * faceScale

  regions.forEach(region => {
    const labelX = region.x
    const labelY = foreheadY - 15 * faceScale  // 下移：从 -35 改成 -15

    // 防止超出边界
    const canvasWidth = ctx.canvas.width
    let finalX = Math.max(60 * faceScale, Math.min(labelX, canvasWidth - 60 * faceScale))

    // 绘制带圆角的标签背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)'
    ctx.strokeStyle = region.color
    ctx.lineWidth = lineWidth

    const boxX = finalX - labelBoxWidth / 2
    const boxY = labelY - labelBoxHeight / 2

    drawRoundRect(ctx, boxX, boxY, labelBoxWidth, labelBoxHeight, boxRadius)
    ctx.fill()
    ctx.stroke()

    // 绘制指向线（连接标签和竖线）
    ctx.strokeStyle = region.color
    ctx.lineWidth = 1.5 * faceScale
    ctx.globalAlpha = 0.4
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(finalX, labelY + labelBoxHeight / 2)
    ctx.lineTo(finalX, foreheadY + 30 * faceScale)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1.0

    // 绘制标签文字
    ctx.fillStyle = region.color
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(region.name, finalX, labelY - 4 * faceScale)

    // 绘制数值
    ctx.font = `${valueFontSize}px Arial`
    ctx.fillStyle = '#666'
    ctx.fillText(`${region.value.toFixed(1)} px`, finalX, labelY + 12 * faceScale)
  })
}

/**
 * 绘制测量线
 */
function drawMeasurementLine(ctx, landmarks, scale, config) {
  const p1 = landmarks[config.p1Index]
  const p2 = landmarks[config.p2Index]

  if (!p1 || !p2) return

  const x1 = p1.x * scale.x
  const y1 = p1.y * scale.y
  const x2 = p2.x * scale.x
  const y2 = p2.y * scale.y

  // 绘制测量线
  ctx.strokeStyle = config.color
  ctx.lineWidth = 2
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.setLineDash([])

  // 绘制端点圆
  ctx.fillStyle = config.color
  ctx.beginPath()
  ctx.arc(x1, y1, 3, 0, 2 * Math.PI)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x2, y2, 3, 0, 2 * Math.PI)
  ctx.fill()

  // 绘制标注文字
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const label = `${config.name}: ${config.value.toFixed(2)} px`

  // 计算文字宽度
  ctx.font = 'bold 12px Arial'
  const textMetrics = ctx.measureText(label)
  const textWidth = textMetrics.width + 8

  // 根据方向放置标签
  let labelX, labelY
  if (config.side === 'left') {
    labelX = x1 - textWidth - 10
    labelY = (y1 + y2) / 2
  } else {
    labelX = midX - textWidth / 2
    labelY = Math.min(y1, y2) - 15
  }

  // 绘制背景框
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeStyle = config.color
  ctx.lineWidth = 1
  ctx.fillRect(labelX - 2, labelY - 14, textWidth, 18)
  ctx.strokeRect(labelX - 2, labelY - 14, textWidth, 18)

  // 绘制文字
  ctx.fillStyle = config.color
  ctx.font = 'bold 11px Arial'
  ctx.fillText(label, labelX + 2, labelY - 2)
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

    // 眼睛关键点（根据 MediaPipe 官方定义修正）
    leftEyeLeft: 33,         // 左眼外侧（离鼻子远）
    leftEyeRight: 133,       // 左眼内侧（靠近鼻子）- 修正：133 不是 130
    leftEyeTop: 159,         // 左眼上方
    leftEyeBottom: 145,      // 左眼下方
    rightEyeLeft: 362,       // 右眼外侧（离鼻子远）
    rightEyeRight: 263,      // 右眼内侧（靠近鼻子）
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
  data.faceHeight = faceHeight
  data.faceWidth = faceWidth

  // 1.5. 脸部宽度变化（颞部、颧骨、下颌角）
  const templeWidth = getDistance(points.leftTemple, points.rightTemple)  // 颞部宽度
  const cheekboneWidth = faceWidth  // 颧骨宽度（与脸宽相同）

  // 下颌宽度：在脸部轮廓中找下颌区域最左和最右的点
  const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
  const chinPoint = landmarks[points.chinTip]
  const mouthBottomPoint = landmarks[14]
  let jawMinX = Infinity
  let jawMaxX = -Infinity

  if (chinPoint && mouthBottomPoint) {
    const chinY = chinPoint.y
    const mouthBottomY = mouthBottomPoint.y
    const jawYRange = { min: mouthBottomY, max: chinY + 0.05 }

    FACE_OVAL.forEach(idx => {
      const point = landmarks[idx]
      if (!point) return
      if (point.y >= jawYRange.min - 0.02 && point.y <= jawYRange.max) {
        if (point.x < jawMinX) jawMinX = point.x
        if (point.x > jawMaxX) jawMaxX = point.x
      }
    })
  }

  const jawWidth = (jawMaxX - jawMinX) > 0 ? (jawMaxX - jawMinX) * scale.x : Math.abs((landmarks[397].x - landmarks[148].x) * scale.x)
  data.templeWidth = templeWidth
  data.cheekboneWidth = cheekboneWidth
  data.jawWidth = jawWidth

  // 2. 三庭比例（美学标准）
  // 上庭：从发际线到眉毛
  // 中庭：从眉毛到鼻尖
  // 下庭：从鼻尖到下巴
  const foreheadL = landmarks[10]
  const eyeTopL = landmarks[159]  // 眼睛上方作为眉毛线参考
  const foreheadY = foreheadL.y * scale.y
  const eyeTopY = eyeTopL.y * scale.y
  const hairlineY = foreheadY - 60  // 发际线：额头上方60px
  const thirdUpper = Math.abs(eyeTopY - hairlineY)  // 从发际线到眉毛的距离
  const thirdMiddle = getDistance(159, 1)  // 眼睛上方到鼻尖
  const thirdLower = getDistance(points.noseTip, points.chinTip)  // 鼻尖到下巴
  data.thirdUpper = thirdUpper
  data.thirdMiddle = thirdMiddle
  data.thirdLower = thirdLower

  // 3. 五眼比例 (两眼距离 = 一眼宽度)
  const leftEyeWidth = getDistance(points.leftEyeLeft, points.leftEyeRight)
  const rightEyeWidth = getDistance(points.rightEyeLeft, points.rightEyeRight)
  const eyeDistance = getDistance(points.leftEyeRight, points.rightEyeLeft)

  // 补充：五眼的两侧空白宽度
  const leftBlank = getDistance(points.faceLeft, points.leftEyeLeft)
  const rightBlank = getDistance(points.rightEyeRight, points.faceRight)

  data.leftEyeWidth = leftEyeWidth
  data.rightEyeWidth = rightEyeWidth
  data.eyeDistance = eyeDistance
  data.leftBlank = leftBlank
  data.rightBlank = rightBlank

  // 4. 眼睛高度
  const leftEyeHeight = getDistance(points.leftEyeTop, points.leftEyeBottom)
  const rightEyeHeight = getDistance(points.rightEyeTop, points.rightEyeBottom)
  data.leftEyeHeight = leftEyeHeight
  data.rightEyeHeight = rightEyeHeight

  // 5. 鼻子尺寸
  const noseWidth = getDistance(points.noseLeft, points.noseRight)
  const noseHeight = getDistance(points.noseTop, points.noseTip)
  data.noseWidth = noseWidth
  data.noseHeight = noseHeight

  // 6. 嘴巴尺寸
  const mouthWidth = getDistance(points.mouthLeft, points.mouthRight)
  const mouthHeight = getDistance(points.mouthTop, points.mouthBottom)
  data.mouthWidth = mouthWidth
  data.mouthHeight = mouthHeight

  // 7. 关键点坐标
  data.leftEyeCoord = {
    x: landmarks[points.leftEyeLeft]?.x * scale.x || 0,
    y: landmarks[points.leftEyeLeft]?.y * scale.y || 0
  }
  data.rightEyeCoord = {
    x: landmarks[points.rightEyeLeft]?.x * scale.x || 0,
    y: landmarks[points.rightEyeLeft]?.y * scale.y || 0
  }
  data.noseCoord = {
    x: landmarks[points.noseTip]?.x * scale.x || 0,
    y: landmarks[points.noseTip]?.y * scale.y || 0
  }
  data.mouthCoord = {
    x: landmarks[points.mouthLeft]?.x * scale.x || 0,
    y: landmarks[points.mouthLeft]?.y * scale.y || 0
  }

  return data
}

/**
 * 打印所有测量数据（调试用）
 */
export function printAllMeasurements(data) {
  console.log('====== 完整的人脸测量数据 ======')
  console.log('📊 总共返回数据项:', Object.keys(data).length, '条')
  console.log('')

  console.log('🔴 脸部基本尺寸:')
  console.log('  - faceHeight (脸部高度):', data.faceHeight?.toFixed(2), 'px')
  console.log('  - faceWidth (脸部宽度):', data.faceWidth?.toFixed(2), 'px')
  console.log('')

  console.log('🟡 三庭比例:')
  console.log('  - thirdUpper (上庭):', data.thirdUpper?.toFixed(2), 'px')
  console.log('  - thirdMiddle (中庭):', data.thirdMiddle?.toFixed(2), 'px')
  console.log('  - thirdLower (下庭):', data.thirdLower?.toFixed(2), 'px')
  console.log('')

  console.log('🟢 五眼比例:')
  console.log('  - leftBlank (左侧空白):', data.leftBlank?.toFixed(2), 'px')
  console.log('  - leftEyeWidth (左眼宽):', data.leftEyeWidth?.toFixed(2), 'px')
  console.log('  - eyeDistance (两眼距):', data.eyeDistance?.toFixed(2), 'px')
  console.log('  - rightEyeWidth (右眼宽):', data.rightEyeWidth?.toFixed(2), 'px')
  console.log('  - rightBlank (右侧空白):', data.rightBlank?.toFixed(2), 'px')
  console.log('  - 左眼/右眼比例:', (data.leftEyeWidth / data.rightEyeWidth)?.toFixed(2))
  console.log('  - 五眼总宽:', (data.leftBlank + data.leftEyeWidth + data.eyeDistance + data.rightEyeWidth + data.rightBlank)?.toFixed(2), 'px')
  console.log('')

  console.log('👁️ 眼睛数据:')
  console.log('  - leftEyeHeight (左眼高):', data.leftEyeHeight?.toFixed(2), 'px')
  console.log('  - rightEyeHeight (右眼高):', data.rightEyeHeight?.toFixed(2), 'px')
  console.log('')

  console.log('👃 鼻子数据:')
  console.log('  - noseWidth (鼻宽):', data.noseWidth?.toFixed(2), 'px')
  console.log('  - noseHeight (鼻高):', data.noseHeight?.toFixed(2), 'px')
  console.log('')

  console.log('👄 嘴巴数据:')
  console.log('  - mouthWidth (嘴宽):', data.mouthWidth?.toFixed(2), 'px')
  console.log('  - mouthHeight (嘴高):', data.mouthHeight?.toFixed(2), 'px')
  console.log('')

  console.log('📍 关键点坐标:')
  console.log('  - leftEyeCoord (左眼):', data.leftEyeCoord)
  console.log('  - rightEyeCoord (右眼):', data.rightEyeCoord)
  console.log('  - noseCoord (鼻尖):', data.noseCoord)
  console.log('  - mouthCoord (嘴巴):', data.mouthCoord)
  console.log('')

  console.log('📋 完整数据对象:', data)
  console.log('=============================')
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
 * 绘制圆角矩形
 */
function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
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
