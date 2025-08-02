import "./BusinessServiceProtoNav.scss";

import { exportToCanvas } from "@excalidraw/utils/export";

import { useState, useRef } from "react";

import { getNonDeletedElements, isFrameLikeElement } from "@excalidraw/element";

import {
  getDefaultFrameName,
  // getElementsOverlappingFrame,
  getFrameChildren,
} from "@excalidraw/element/frame";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import { frameToolIcon, moreIcon, ExportIcon } from "../icons";

import { useApp } from "../App";

export const BusinessServiceProtoNav = () => {
  const app = useApp();
  const elements = app.scene.getNonDeletedElements();
  //   console.log("elements:", elements);

  const frames = elements.filter((el) =>
    isFrameLikeElement(el),
  ) as ExcalidrawFrameLikeElement[];
  frames.sort((a, b) => a.y - b.y);
  //   console.log("frames:", frames);

  const [selectedFrame, setSelectedFrame] =
    useState<ExcalidrawFrameLikeElement | null>(null);

  const [activeMenuFrameId, setActiveMenuFrameId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const frameClick = (frame: ExcalidrawFrameLikeElement) => {
    // console.log("frame:", frame);
    setSelectedFrame(frame);
    setActiveMenuFrameId(null);
    app.scrollToContent(frame, { animate: true });
  };

  const frameExportPng = async (exportingFrame: ExcalidrawFrameLikeElement) => {
    const elementsInFrame = getFrameChildren(
      getNonDeletedElements(elements),
      exportingFrame.id,
    ).filter((element) => !(element.type === "text" && element.containerId));

    // const exportedElements = getElementsOverlappingFrame(
    //   elements,
    //   exportingFrame,
    // );
    const canvas = exportToCanvas({
      elements: elementsInFrame,
      appState: app.state,
      files: app.files,
      // exportingFrame, // 关键参数
      // exportPadding: 0,
    });
    // 转换为 PNG blob
    const blob = await new Promise<Blob>(async (resolve) => {
      (await canvas).toBlob((blob) => resolve(blob!), "image/png");
    });
    // 创建一个临时的 URL 对象
    const url = URL.createObjectURL(blob);

    // 创建一个隐藏的 <a> 标签
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = exportingFrame.name || "";

    // 将 <a> 标签添加到文档中
    document.body.appendChild(a);
    a.click();

    // 清理
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const deleteFrame = (frame: ExcalidrawFrameLikeElement) => {
    app.scene.replaceAllElements(
      app.scene.getElementsIncludingDeleted().map((el) => {
        if (el.id === frame.id) {
          return {
            ...el,
            isDeleted: true,
          };
        }
        // Also delete all elements in the frame
        if (el.frameId === frame.id) {
          return {
            ...el,
            isDeleted: true,
          };
        }
        return el;
      }),
    );
    setActiveMenuFrameId(null);
  };

  return (
    <>
      <div className="business-service-proto-nav">
        <div className="business-service-proto-nav-header">
          <h4 className="business-service-proto-design">业务服务原型设计</h4>
          <h2 className="business-service-proto-name">业务服务名称</h2>
        </div>
        <div className="business-service-proto-nav-body">
          <div className="business-service-proto-nav-body-frames">
            {(frames || []).map((frame) => (
              <div
                key={frame.id}
                className={`business-service-proto-nav-body-frames-item ${
                  selectedFrame?.id === frame.id ? "active" : ""
                }`}
                onClick={() => {
                  frameClick(frame);
                }}
              >
                <div className="frames-item-left">
                  <div className="title-icon">{frameToolIcon}</div>
                  <div className="title-text">
                    {frame.name ?? getDefaultFrameName(frame)}
                  </div>
                </div>
                <div className="frames-item-right">
                  <div
                    className="more-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFrame(frame);
                      setActiveMenuFrameId(
                        activeMenuFrameId === frame.id ? null : frame.id,
                      );
                    }}
                  >
                    {moreIcon}
                  </div>
                  {activeMenuFrameId === frame.id && (
                    <div className="frame-more-menu" ref={menuRef}>
                      <div
                        className="frame-more-menu-item"
                        onClick={() => frameExportPng(frame)}
                      >
                        导出页面PNG
                      </div>
                      <div 
                        className="frame-more-menu-item delete"
                        onClick={() => deleteFrame(frame)}
                      >
                        删除页面
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
