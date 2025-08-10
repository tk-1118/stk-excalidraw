# BusinessServiceProtoNav Frame 监听和数据导出

这个组件现在支持监听 frame 的变化，并自动生成 Excalidraw 文件对象导出给外部项目使用。

## 功能特性

1. **自动监听 Frame 变化**: 当 frame 被添加、删除或内容修改时，组件会自动检测并导出数据
2. **生成 Excalidraw 文件对象**: 每个 frame 及其子元素都会被序列化为标准的 Excalidraw JSON 格式
3. **通过 onHemaButtonClick 导出**: 使用现有的 `onHemaButtonClick` 机制将数据传递给外部项目
4. **手动导出功能**: 提供手动导出按钮和单个 frame 导出功能

## 数据结构

### FrameData 接口
```typescript
interface FrameData {
  frameId: string;              // Frame的唯一ID
  frameName: string;            // Frame的名称
  frameElement: ExcalidrawFrameLikeElement;  // Frame元素本身
  childrenElements: ExcalidrawElement[];     // Frame内的所有子元素
  excalidrawData: string;       // 序列化的Excalidraw JSON数据
}
```

### FramesExportData 接口
```typescript
interface FramesExportData {
  frames: FrameData[];          // 所有Frame的数据数组
  timestamp: number;            // 导出时间戳
  totalFrames: number;          // Frame总数
}
```

## 在外部项目中使用

### 1. 监听所有 Frame 变化
```typescript
// 在你的 React 组件中
const handleHemaButtonClick = (type: string, data: any) => {
  if (type === "framesDataExport") {
    const framesData: FramesExportData = data.data;
    console.log("Frames changed:", framesData);
    
    // 处理每个 frame 的数据
    framesData.frames.forEach((frameData) => {
      console.log(`Frame ${frameData.frameName}:`, frameData.excalidrawData);
      
      // 你可以将 excalidrawData 保存到数据库或文件
      saveFrameToDatabase(frameData);
    });
  }
};

// 传递给 Excalidraw 组件
<Excalidraw onHemaButtonClick={handleHemaButtonClick} />
```

### 2. 监听单个 Frame 导出
```typescript
const handleHemaButtonClick = (type: string, data: any) => {
  if (type === "singleFrameExport") {
    const frameData: FrameData = data.frameData;
    console.log("Single frame exported:", frameData);
    
    // 处理单个 frame
    downloadFrameAsFile(frameData);
  }
};
```

### 3. 实用函数示例

```typescript
// 保存 frame 数据到本地文件
function downloadFrameAsFile(frameData: FrameData) {
  const blob = new Blob([frameData.excalidrawData], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${frameData.frameName}.excalidraw`;
  a.click();
  URL.revokeObjectURL(url);
}

// 将所有 frames 保存为单个文件
function downloadAllFrames(framesData: FramesExportData) {
  const blob = new Blob([JSON.stringify(framesData, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `all-frames-${framesData.timestamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 恢复 frame 到 Excalidraw
function loadFrameToExcalidraw(excalidrawData: string, excalidrawApi: ExcalidrawImperativeAPI) {
  const data = JSON.parse(excalidrawData);
  excalidrawApi.updateScene({
    elements: data.elements,
    appState: data.appState
  });
}
```

## 触发条件

数据导出会在以下情况下自动触发：

1. **添加新 Frame**: 创建新 frame 时
2. **删除 Frame**: 删除 frame 时  
3. **Frame 内容变化**: Frame 内的元素发生变化时
4. **Frame 重命名**: Frame 名称改变时
5. **手动触发**: 点击"导出所有页面数据"按钮时

## 性能优化

组件已经进行了多层次的性能优化：

### 1. 快速变化检测
- 使用轻量级的"快照"机制进行初步变化检测
- 快照包含 frame 的关键信息：ID、名称、位置、尺寸、子元素数量、版本号
- 只有快照发生变化时才进行昂贵的完整数据生成

### 2. 防抖机制
- 自动变化检测使用 300ms 防抖延迟，避免频繁触发
- 用户操作（添加/删除 frame）使用 150ms 较短延迟，提供更好的响应性
- 手动导出立即执行，不使用防抖

### 3. 内存优化
- 使用 `useMemo` 缓存快照生成
- 使用 `useCallback` 优化函数引用
- 自动清理定时器避免内存泄漏

### 4. 智能更新策略
```typescript
// 优化前：每次都生成完整数据
useEffect(() => {
  const data = generateFramesExportData(); // 昂贵操作
  if (hasChanged(data)) {
    export(data);
  }
});

// 优化后：分层检测
useEffect(() => {
  if (!hasFramesChangedQuick(snapshot)) return; // 快速检测
  const data = generateFramesExportData(); // 只在必要时执行
  debouncedExport(data); // 防抖导出
});
```

## 注意事项

1. **性能优化**: 组件已经过优化，但对于包含大量复杂元素的 frame，JSON 序列化仍可能有性能影响
2. **回调处理**: 外部项目需要正确处理 `onHemaButtonClick` 回调
3. **Frame 子元素**: Frame 的子元素包括所有 `frameId` 匹配的元素
4. **导出模式**: 导出的数据使用 "local" 模式，包含完整的文件信息
5. **防抖延迟**: 可以根据实际需求调整防抖延迟时间（当前为 300ms）
6. **内存管理**: 组件会自动清理定时器，但大量数据可能需要外部项目主动管理内存
