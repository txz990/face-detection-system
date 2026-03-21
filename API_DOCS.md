# 人脸五官检测 API 文档

## 概述
本项目是一个纯前端人脸检测系统，基于 **Google MediaPipe Face Landmarker** 在浏览器端进行实时检测。

## API 函数

### 1. `initializeFaceDetector()`
初始化人脸检测模型

**签名：**
```javascript
export async function initializeFaceDetector(): Promise<boolean>
```

**返回值：**
- `true` - 初始化成功
- 抛出 Error - 初始化失败

**使用示例：**
```javascript
try {
  await initializeFaceDetector()
  console.log('✅ 模型初始化成功')
} catch (error) {
  console.error('❌ 模型初始化失败:', error)
}
```

---

### 2. `detectFaceInImage(imageUrl)`
在图片上检测人脸并返回详细数据

**签名：**
```javascript
export async function detectFaceInImage(imageUrl: string): Promise<{
  canvas: string,
  landmarks: Object
}>
```

**参数：**
- `imageUrl` (string) - 图片的 Data URL 或网络 URL

**返回值：**
```javascript
{
  canvas: string,        // 标注后的图片 (PNG, Base64 格式)
  landmarks: {
    // 脸部基本尺寸 (单位: px)
    faceHeight: number,   // 脸部高度
    faceWidth: number,    // 脸部宽度

    // 三庭比例 (单位: px) - 美学黄金比例标准
    thirdUpper: number,   // 上庭（额头到眉毛）
    thirdMiddle: number,  // 中庭（眉毛到鼻尖）
    thirdLower: number,   // 下庭（鼻尖到下巴）

    // 眼睛数据 (单位: px)
    leftEyeWidth: number,   // 左眼宽度
    rightEyeWidth: number,  // 右眼宽度
    eyeDistance: number,    // 两眼距离（五眼比例）
    leftEyeHeight: number,  // 左眼高度
    rightEyeHeight: number, // 右眼高度

    // 鼻子数据 (单位: px)
    noseWidth: number,      // 鼻宽
    noseHeight: number,     // 鼻高

    // 嘴巴数据 (单位: px)
    mouthWidth: number,     // 嘴宽
    mouthHeight: number,    // 嘴高

    // 关键点坐标 (单位: px)
    leftEyeCoord: {x: number, y: number},    // 左眼坐标
    rightEyeCoord: {x: number, y: number},   // 右眼坐标
    noseCoord: {x: number, y: number},       // 鼻尖坐标
    mouthCoord: {x: number, y: number}       // 嘴巴坐标
  }
}
```

**使用示例：**
```javascript
try {
  const result = await detectFaceInImage('data:image/png;base64,...')

  // 显示标注图片
  document.getElementById('result').src = result.canvas

  // 使用数据
  console.log('脸部高度:', result.landmarks.faceHeight, 'px')
  console.log('三庭比例:', {
    upper: result.landmarks.thirdUpper,
    middle: result.landmarks.thirdMiddle,
    lower: result.landmarks.thirdLower
  })
} catch (error) {
  console.error('检测失败:', error.message)
}
```

---

## 数据说明

### 单位
所有测量数据单位都是 **像素（px）**，基于输入图片的分辨率。

### 美学标准解释

**三庭比例（美学黄金比例）**
- 标准：上庭 : 中庭 : 下庭 = 1 : 1 : 1
- 用途：评估面部纵向比例是否均衡

**五眼比例**
- 标准：眼距 = 一眼宽度
- 用途：评估面部横向比例是否协调

### 关键点索引对照表
| 名称 | 索引 | 含义 |
|------|------|------|
| 额头中心 | 10 | 脸部最高点 |
| 下巴尖 | 152 | 脸部最低点 |
| 眉毛外角 | 105 | 眼眉线参考 |
| 左眼外角 | 33 | 左眼位置 |
| 右眼外角 | 362 | 右眼位置 |
| 鼻尖 | 1 | 鼻部最低点 |
| 嘴巴左侧 | 61 | 嘴角参考 |

---

## 错误处理

**常见错误：**

1. **未检测到人脸**
   ```
   错误信息: "未检测到人脸，请确保图片中有清晰的人脸"
   原因: 图片中没有清晰的人脸或人脸太小
   ```

2. **图片加载失败**
   ```
   错误信息: "图片加载失败"
   原因: 图片 URL 无效或跨域问题
   ```

3. **模型未初始化**
   ```
   错误信息: "检测器未初始化，请先调用 initializeFaceDetector"
   原因: 需要先初始化模型
   ```

---

## 技术栈

- **检测库**: Google MediaPipe Face Landmarker
- **运行环境**: 浏览器（JavaScript）
- **模型**: float16 精度 (约 50MB)
- **支持格式**: JPG, PNG, WebP

---

## 返回数据验证示例

```javascript
const result = await detectFaceInImage(imageUrl)

// 验证数据完整性
console.log('返回字段数:', Object.keys(result.landmarks).length) // 应该是 18

// 验证数据范围
console.assert(result.landmarks.faceHeight > 0, '脸部高度应大于0')
console.assert(result.landmarks.faceWidth > 0, '脸部宽度应大于0')
console.assert(result.canvas.startsWith('data:image'), '图片应是 Data URL 格式')
```

---

**最后更新**: 2026-03-21
