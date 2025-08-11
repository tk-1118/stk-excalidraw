import React, { useState, useEffect, useRef } from "react";

import { useI18n } from "../i18n";

import { Dialog } from "./Dialog";

import { FilledButton } from "./FilledButton";

interface RemarkDialogProps {
  customData: {
    componentPurpose: string;
    componentUserOperation: string;
    componentOperationResult: string;
    componentServerInteraction: string;
    componentSpecialRequirements: string;
    componentMapping: string;
  };
  onSubmit: (customData: ComponentDescription) => void;
  onClose: () => void;
}

interface ComponentDescription {
  componentPurpose: string;
  componentUserOperation: string;
  componentOperationResult: string;
  componentServerInteraction: string;
  componentSpecialRequirements: string;
  componentMapping: string;
}

export const RemarkDialog = ({
  customData,
  onSubmit,
  onClose,
}: RemarkDialogProps) => {
  const { t } = useI18n();

  const initialDescription = customData;

  const [componentPurpose, setComponentPurpose] = useState(
    initialDescription.componentPurpose,
  );

  const [componentUserOperation, setComponentUserOperation] = useState(
    initialDescription.componentUserOperation,
  );

  const [componentOperationResult, setComponentOperationResult] = useState(
    initialDescription.componentOperationResult,
  );

  const [componentMapping, setComponentMapping] = useState(
    initialDescription.componentMapping,
  );

  const [componentServerInteraction, setComponentServerInteraction] = useState(
    initialDescription.componentServerInteraction,
  );

  const [componentSpecialRequirements, setComponentSpecialRequirements] =
    useState(initialDescription.componentSpecialRequirements);

  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // 自动聚焦到第一个输入框
    const timer = setTimeout(() => {
      if (firstFieldRef.current) {
        firstFieldRef.current.focus();
        // 确保光标位置在内容末尾
        firstFieldRef.current.setSelectionRange(
          componentPurpose?.length || 0,
          componentPurpose?.length || 0,
        );
      }
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = () => {
    const submitData: ComponentDescription = {
      componentPurpose,
      componentUserOperation,
      componentOperationResult,
      componentServerInteraction,
      componentSpecialRequirements,
      componentMapping,
    };
    onSubmit(submitData);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    // Ctrl+Enter (Windows/Linux) 或 Cmd+Enter (Mac) 提交表单
    // event.preventDefault();
    // handleSubmit();
    // } else if (event.key === "Escape") {
    //   onClose();
    // }
    // Enter键默认换行，不做特殊处理
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("labels.addRemark")}
      className="RemarkDialog"
      size="wide"
      autofocus={false}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "0 8px 0 0",
            marginBottom: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label>1. 它在页面上是干什么的？</label>
            <textarea
              ref={firstFieldRef}
              value={componentPurpose}
              onChange={(e) => setComponentPurpose(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`示例：
              展示商品信息
              让用户搜索订单
              显示订单当前状态`}
              // disabled
              style={{
                boxSizing: "border-box",
                width: "100%",
                minHeight: "200px",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontFamily: "inherit",
                fontSize: "inherit",
                whiteSpace: "pre-wrap",
              }}
            />
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label>2. 用户会怎么操作它？</label>
            <textarea
              value={componentUserOperation}
              onChange={(e) => setComponentUserOperation(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`示例：
              点击 / 输入文字 / 选择下拉项 / 拖拽 / 悬停显示 / 无操作 / 其他…`}
              // disabled
              style={{
                boxSizing: "border-box",
                width: "100%",
                minHeight: "200px",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontFamily: "inherit",
                fontSize: "inherit",
                whiteSpace: "pre-wrap",
              }}
            />
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label>3. 用户操作后会发生什么？</label>
            <textarea
              value={componentOperationResult}
              onChange={(e) => setComponentOperationResult(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`示例：
              点击"立即购买" → 跳转到支付页
              输入搜索词 → 列表实时刷新
              选择订单状态 → 筛选订单列表
              无操作 → 仅展示信息`}
              // disabled
              style={{
                boxSizing: "border-box",
                width: "100%",
                minHeight: "200px",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontFamily: "inherit",
                fontSize: "inherit",
                whiteSpace: "pre-wrap",
              }}
            />
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label>4. 需要和服务端交互吗？</label>
            <textarea
              value={componentServerInteraction}
              onChange={(e) => setComponentServerInteraction(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`示例：
              获取商品详情
              提交订单
              搜索订单列表
              上传文件
              ）*
              "成功后告诉用户什么？"
              *（示例：
              "订单提交成功！"
              "找到3个订单"
              "文件上传完成"
              ）*
              "失败时告诉用户什么？"
              *（示例：
              "网络错误，请重试"
              "库存不足"
              "文件格式不支持"
              ）*`}
              // disabled
              style={{
                boxSizing: "border-box",
                width: "100%",
                minHeight: "200px",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontFamily: "inherit",
                fontSize: "inherit",
                whiteSpace: "pre-wrap",
              }}
            />
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label>5. 有没有什么特殊要求？</label>
            <textarea
              value={componentSpecialRequirements}
              onChange={(e) => setComponentSpecialRequirements(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`示例：
              必须显示"新品"标签
              金额显示要保留两位小数
              超过1000字要折叠
              只允许输入数字`}
              // disabled
              style={{
                boxSizing: "border-box",
                width: "100%",
                minHeight: "200px",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontFamily: "inherit",
                fontSize: "inherit",
                whiteSpace: "pre-wrap",
              }}
            />
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label>6. 有没有使用UI库？</label>
            <textarea
              value={componentMapping}
              onChange={(e) => setComponentMapping(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`示例：
              商品上架数据表格使用了element-plus的el-table组件
              `}
              style={{
                boxSizing: "border-box",
                width: "100%",
                minHeight: "200px",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontFamily: "inherit",
                fontSize: "inherit",
                whiteSpace: "pre-wrap",
              }}
            />
          </div>
        </div>
        {/* <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件名称</label>
          <input
            ref={firstFieldRef}
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件名称"
            // disabled
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              backgroundColor: "#fff",
              color: "#333",
            }}
          />
        </div> */}
        {/* <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
          <label>组件功能</label>
          <textarea
            value={componentBehavior}
            onChange={(e) => setComponentBehavior(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件功能"
            style={{
              width: "100%",
              minHeight: "200px",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
        </div> */}
        {/* <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件交互</label>
          <textarea
            value={componentInteraction}
            onChange={(e) => setComponentInteraction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件交互方式"
            style={{
              width: "100%",
              minHeight: "200px",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
        </div> */}
        {/* <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件规约</label>
          <textarea
            value={componentStatute}
            onChange={(e) => setComponentStatute(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件规约"
            style={{
              width: "100%",
              minHeight: "200px",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
        </div> */}
        {/* <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label>组件样式</label>
          <textarea
            value={componentStyle}
            onChange={(e) => setComponentStyle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入组件样式"
            style={{
              width: "100%",
              minHeight: "200px",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "inherit",
              whiteSpace: "pre-wrap",
            }}
          />
        </div> */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <FilledButton
            variant="outlined"
            color="muted"
            label={t("buttons.cancel")}
            onClick={onClose}
          >
            {t("buttons.cancel")}
          </FilledButton>
          <FilledButton
            label={t("buttons.submit")}
            onClick={handleSubmit}
            variant="filled"
          >
            {t("buttons.submit")}
          </FilledButton>
        </div>
      </div>
    </Dialog>
  );
};
