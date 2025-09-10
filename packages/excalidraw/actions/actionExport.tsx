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
    const frames = elements.filter((el) => isFrameLikeElement(el));
    const framesData: any[] = frames.map((frame: any) => {
      // 获取frame内已正确关联的子元素（frameId匹配）
      const associatedChildren = getFrameChildren(elements, frame.id);

      // 获取所有与frame重叠/包含在frame内的元素（包括未正确关联frameId的元素）
      const overlappingElements = getElementsOverlappingFrame(elements, frame);

      // 合并两个集合，去重，确保收集到所有相关元素
      const allChildrenMap = new Map<string, any>();

      // 添加已关联的子元素
      associatedChildren.forEach((element) => {
        allChildrenMap.set(element.id, element);
      });

      // 添加重叠的元素（排除frame自身和其他frame元素）
      overlappingElements.forEach((element) => {
        if (element.id !== frame.id && !isFrameLikeElement(element)) {
          allChildrenMap.set(element.id, element);
        }
      });

      // 转换为数组
      const childrenElements = Array.from(allChildrenMap.values());

      // 构建包含frame和其子元素的完整元素列表
      const frameElements = [frame, ...childrenElements];

      // 生成Excalidraw格式的JSON数据
      const excalidrawData = serializeAsJSON(
        frameElements,
        app.state,
        app.files,
        "local",
      );

      return {
        frameId: frame.id,
        frameName: frame.name || getDefaultFrameName(frame),
        frameElement: frame,
        childrenElements,
        excalidrawData,
      };
    });
    // eslint-disable-next-line no-console
    console.log("framesData", framesData);
    app.onHemaButtonClick("framesDataExport", {
      type: "FRAMES_DATA_CHANGED",
      data: {
        frames: framesData,
        timestamp: Date.now(),
        totalFrames: frames.length,
      },
      timestamp: Date.now(),
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
