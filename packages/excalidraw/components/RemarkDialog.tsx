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
            <label>作用对象</label>
            <textarea
              ref={firstFieldRef}
              value={componentPurpose}
              onChange={(e) => setComponentPurpose(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`示例：
              展示商品信息
              让用户搜索订单说明该提示对应的页面元素或功能点，方便后续整理与实现。
建议写法：位置 + 元素类型 + 元素名称（可选其二）
示例：
	•	页面顶部的搜索条件标题
	•	“客户列表”中的“状态”字段
	•	“订单详情”信息展示表单
	•	表单中的“联系人电话”输入框`}
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
            <label>需求说明</label>
            <textarea
              value={componentUserOperation}
              onChange={(e) => setComponentUserOperation(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`描述该组件的业务意义和目标。
示例：
	•	在客户列表中提供状态筛选，方便业务人员快速定位目标客户。
	•	在订单详情页展示快递单号，方便客户跟踪物流。`}
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
            <label>用户操作与交互</label>
            <textarea
              value={componentOperationResult}
              onChange={(e) => setComponentOperationResult(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`说明用户如何使用该组件，交互流程是什么。
示例：
	•	用户选择状态下拉框中的“已签约” → 列表刷新显示匹配数据
	•	用户输入关键字 → 点击“搜索” → 展示结果列表`}
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
            <label>服务端接口交互</label>
            <textarea
              value={componentServerInteraction}
              onChange={(e) => setComponentServerInteraction(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`引用已配置的服务端应用服务，并说明调用目的、输入输出要点。
格式：
	•	应用服务：@服务端/应用服务名称
	•	调用目的：简要说明为何调用
	•	关键输入：说明哪些字段会传入（字段名可与应用服务定义一致）
	•	关键输出：说明需要用到的返回字段`}
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
          {/* <div
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
          </div> */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label>映射组件库</label>
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
