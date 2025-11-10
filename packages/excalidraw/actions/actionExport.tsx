import {
  KEYS,
  DEFAULT_EXPORT_PADDING,
  EXPORT_SCALES,
  THEME,
} from "@excalidraw/common";

import {
  getDefaultFrameName,
  getFrameChildren,
  getNonDeletedElements,
  isFrameLikeElement,
} from "@excalidraw/element";

import { getElementsOverlappingFrame } from "@excalidraw/element/frame";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { Theme } from "@excalidraw/element/types";

import { useDevice } from "../components/App";
import { CheckboxItem } from "../components/CheckboxItem";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { ProjectName } from "../components/ProjectName";
import { ToolButton } from "../components/ToolButton";
import { Tooltip } from "../components/Tooltip";
import { ExportIcon, questionCircle, saveAs } from "../components/icons";
import { loadFromJSON, saveAsJSON } from "../data";
// import { isImageFileHandle } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
// import { resaveAsImageWithScene } from "../data/resave";

import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { getExportSize } from "../scene/export";

import "../components/ToolIcon.scss";

import { serializeAsJSON } from "../data/json";

import { register } from "./register";

export const actionChangeProjectName = register({
  name: "changeProjectName",
  label: "labels.fileTitle",
  trackEvent: false,
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, name: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData, appProps, data, app }) => (
    <ProjectName
      label={t("labels.fileTitle")}
      value={app.getName()}
      onChange={(name: string) => updateData(name)}
      ignoreFocus={data?.ignoreFocus ?? false}
    />
  ),
});

export const actionChangeExportScale = register({
  name: "changeExportScale",
  label: "imageExportDialog.scale",
  trackEvent: { category: "export", action: "scale" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportScale: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ elements: allElements, appState, updateData }) => {
    const elements = getNonDeletedElements(allElements);
    const exportSelected = isSomeElementSelected(elements, appState);
    const exportedElements = exportSelected
      ? getSelectedElements(elements, appState)
      : elements;

    return (
      <>
        {EXPORT_SCALES.map((s) => {
          const [width, height] = getExportSize(
            exportedElements,
            DEFAULT_EXPORT_PADDING,
            s,
          );

          const scaleButtonTitle = `${t(
            "imageExportDialog.label.scale",
          )} ${s}x (${width}x${height})`;

          return (
            <ToolButton
              key={s}
              size="small"
              type="radio"
              icon={`${s}x`}
              name="export-canvas-scale"
              title={scaleButtonTitle}
              aria-label={scaleButtonTitle}
              id="export-canvas-scale"
              checked={s === appState.exportScale}
              onChange={() => updateData(s)}
            />
          );
        })}
      </>
    );
  },
});

export const actionChangeExportBackground = register({
  name: "changeExportBackground",
  label: "imageExportDialog.label.withBackground",
  trackEvent: { category: "export", action: "toggleBackground" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportBackground: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportBackground}
      onChange={(checked) => updateData(checked)}
    >
      {t("imageExportDialog.label.withBackground")}
    </CheckboxItem>
  ),
});

export const actionChangeExportEmbedScene = register({
  name: "changeExportEmbedScene",
  label: "imageExportDialog.tooltip.embedScene",
  trackEvent: { category: "export", action: "embedScene" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportEmbedScene: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportEmbedScene}
      onChange={(checked) => updateData(checked)}
    >
      {t("imageExportDialog.label.embedScene")}
      <Tooltip label={t("imageExportDialog.tooltip.embedScene")} long={true}>
        <div className="excalidraw-tooltip-icon">{questionCircle}</div>
      </Tooltip>
    </CheckboxItem>
  ),
});

export const actionSaveToActiveFile = register({
  name: "saveToActiveFile",
  label: "buttons.save",
  icon: ExportIcon,
  trackEvent: { category: "export" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.saveToActiveFile &&
      !!appState.fileHandle &&
      !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, value, app) => {
    // 🚀 同步BusinessServiceProtoNav的优化逻辑
    const frames = elements
      .filter((el) => isFrameLikeElement(el) && !el.isDeleted) // 确保不包含已删除的frame
      .reduce((unique, frame) => {
        // 去重：防止重复的frame
        if (!unique.find((f) => f.id === frame.id)) {
          unique.push(frame);
        }
        return unique;
      }, [] as any[]);

    if (process.env.NODE_ENV === "development") {
      console.log(
        "🔍 SaveToActiveFile - Processing frames:",
        frames.length,
        "frames",
      );
    }

    const framesData: any[] = frames.map((frame: any) => {
      // 🚀 智能的子元素收集策略（同步BusinessServiceProtoNav逻辑）
      let childrenElements: any[] = [];

      // 检查是否需要几何检测（简化版，因为actionExport通常在静态状态下调用）
      const isDragging = appState.selectedElementsAreBeingDragged || false;
      const needsGeometricCheck = isDragging || frame.versionNonce; // 总是进行完整检测以确保数据完整性

      if (!needsGeometricCheck) {
        // 🚀 快速路径：只使用frameId关联（适用于静态状态）
        childrenElements = getFrameChildren(elements, frame.id);
      } else {
        // 🚀 完整路径：同时使用frameId关联和几何重叠（适用于动态状态）
        const associatedChildren = getFrameChildren(elements, frame.id);
        const overlappingElements = getElementsOverlappingFrame(
          elements,
          frame,
        );

        // 合并两个集合，去重
        const allChildrenMap = new Map<string, any>();

        // 先添加frameId关联的元素
        associatedChildren.forEach((element) => {
          allChildrenMap.set(element.id, element);
        });

        // 再添加几何重叠的元素
        overlappingElements.forEach((element) => {
          if (element.id !== frame.id && !isFrameLikeElement(element)) {
            if (!allChildrenMap.has(element.id)) {
              allChildrenMap.set(element.id, element);
            }
          }
        });

        childrenElements = Array.from(allChildrenMap.values());
      }

      // 构建包含frame和其子元素的完整元素列表
      const frameElements = [frame, ...childrenElements];

      // 生成Excalidraw格式的JSON数据
      const excalidrawData = serializeAsJSON(
        frameElements,
        app.state,
        app.files,
        "local",
      );

      const frameData = {
        frameId: frame.id,
        frameName: frame.name || getDefaultFrameName(frame),
        frameElement: frame,
        childrenElements,
        excalidrawData,
      };

      if (process.env.NODE_ENV === "development") {
        console.log(
          "🔍 Generated frame data:",
          frame.name || frame.id,
          "children:",
          frameData.childrenElements.length,
        );
      }

      return frameData;
    });

    // 🚀 性能监控和数据验证
    const exportData = {
      frames: framesData,
      timestamp: Date.now(),
      totalFrames: frames.length,
    };

    if (process.env.NODE_ENV === "development") {
      console.log(
        "🔍 SaveToActiveFile - Final export data:",
        exportData.totalFrames,
        "frames",
      );
    }

    // 保留原有的console.log用于兼容性
    // eslint-disable-next-line no-console
    console.log("framesData", framesData);

    // 🚀 触发优化后的数据导出事件
    app.onHemaButtonClick("framesDataExport", {
      type: "FRAMES_DATA_CHANGED",
      data: exportData,
      timestamp: exportData.timestamp,
    });
    // const fileHandleExists = !!appState.fileHandle;

    // try {
    //   const { fileHandle } = isImageFileHandle(appState.fileHandle)
    //     ? await resaveAsImageWithScene(
    //         elements,
    //         appState,
    //         app.files,
    //         app.getName(),
    //       )
    //     : await saveAsJSON(elements, appState, app.files, app.getName());

    //   return {
    //     captureUpdate: CaptureUpdateAction.EVENTUALLY,
    //     appState: {
    //       ...appState,
    //       fileHandle,
    //       toast: fileHandleExists
    //         ? {
    //             message: fileHandle?.name
    //               ? t("toast.fileSavedToFilename").replace(
    //                   "{filename}",
    //                   `"${fileHandle.name}"`,
    //                 )
    //               : t("toast.fileSaved"),
    //           }
    //         : null,
    //     },
    //   };
    // } catch (error: any) {
    //   if (error?.name !== "AbortError") {
    //     console.error(error);
    //   } else {
    //     console.warn(error);
    //   }
    return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
    // }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
});

export const actionSaveFileToDisk = register({
  name: "saveFileToDisk",
  label: "exportDialog.disk_title",
  icon: ExportIcon,
  viewMode: true,
  trackEvent: { category: "export" },
  perform: async (elements, appState, value, app) => {
    try {
      const { fileHandle } = await saveAsJSON(
        elements,
        {
          ...appState,
          fileHandle: null,
        },
        app.files,
        app.getName(),
      );
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: {
          ...appState,
          openDialog: null,
          fileHandle,
          toast: { message: t("toast.fileSaved") },
        },
      };
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event.shiftKey && event[KEYS.CTRL_OR_CMD],
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={saveAs}
      title={t("buttons.saveAs")}
      aria-label={t("buttons.saveAs")}
      showAriaLabel={useDevice().editor.isMobile}
      hidden={!nativeFileSystemSupported}
      onClick={() => updateData(null)}
      data-testid="save-as-button"
    />
  ),
});

export const actionLoadScene = register({
  name: "loadScene",
  label: "buttons.load",
  trackEvent: { category: "export" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.loadScene && !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, _, app) => {
    try {
      const {
        elements: loadedElements,
        appState: loadedAppState,
        files,
      } = await loadFromJSON(appState, elements);
      return {
        elements: loadedElements,
        appState: loadedAppState,
        files,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.warn(error);
        return false;
      }
      return {
        elements,
        appState: { ...appState, errorMessage: error.message },
        files: app.files,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.O,
});

export const actionExportWithDarkMode = register({
  name: "exportWithDarkMode",
  label: "imageExportDialog.label.darkMode",
  trackEvent: { category: "export", action: "toggleTheme" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportWithDarkMode: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: "-45px",
        marginBottom: "10px",
      }}
    >
      <DarkModeToggle
        value={appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT}
        onChange={(theme: Theme) => {
          updateData(theme === THEME.DARK);
        }}
        title={t("imageExportDialog.label.darkMode")}
      />
    </div>
  ),
});
