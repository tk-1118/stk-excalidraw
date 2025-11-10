import type { ExcalidrawFrameLikeElement } from '@excalidraw/element/types';

// 状态接口定义
export interface BusinessServiceState {
  // Frame相关状态
  selectedFrame: ExcalidrawFrameLikeElement | null;
  activeMenuFrameId: string | null;

  // 模板相关状态
  showTemplateModal: boolean;
  selectedTemplateType: string;
  imagePreviewUrl: string | null;

  // 恢复功能相关状态
  showRestoreConfirm: boolean;
  titleClickCount: number;

  // UI状态
  isExporting: boolean;
}

// 动作类型定义
export type BusinessServiceAction =
  | { type: 'SET_SELECTED_FRAME'; payload: ExcalidrawFrameLikeElement | null }
  | { type: 'SET_ACTIVE_MENU_FRAME_ID'; payload: string | null }
  | { type: 'SET_SHOW_TEMPLATE_MODAL'; payload: boolean }
  | { type: 'SET_SELECTED_TEMPLATE_TYPE'; payload: string }
  | { type: 'SET_IMAGE_PREVIEW_URL'; payload: string | null }
  | { type: 'SET_SHOW_RESTORE_CONFIRM'; payload: boolean }
  | { type: 'SET_TITLE_CLICK_COUNT'; payload: number }
  | { type: 'INCREMENT_TITLE_CLICK_COUNT' }
  | { type: 'RESET_TITLE_CLICK_COUNT' }
  | { type: 'SET_IS_EXPORTING'; payload: boolean }
  | { type: 'CLOSE_ALL_MODALS' }
  | { type: 'RESET_STATE' };

// 初始状态
export const initialState: BusinessServiceState = {
  selectedFrame: null,
  activeMenuFrameId: null,
  showTemplateModal: false,
  selectedTemplateType: 'BLANK',
  imagePreviewUrl: null,
  showRestoreConfirm: false,
  titleClickCount: 0,
  isExporting: false,
};

// Reducer函数
export const businessServiceReducer = (
  state: BusinessServiceState,
  action: BusinessServiceAction
): BusinessServiceState => {
  switch (action.type) {
    case 'SET_SELECTED_FRAME':
      return {
        ...state,
        selectedFrame: action.payload,
        // 选择frame时自动关闭菜单
        activeMenuFrameId: null,
      };

    case 'SET_ACTIVE_MENU_FRAME_ID':
      return {
        ...state,
        activeMenuFrameId: action.payload,
      };

    case 'SET_SHOW_TEMPLATE_MODAL':
      return {
        ...state,
        showTemplateModal: action.payload,
        // 关闭模板模态框时重置相关状态
        ...(action.payload === false && {
          selectedTemplateType: 'BLANK',
          imagePreviewUrl: null,
        }),
      };

    case 'SET_SELECTED_TEMPLATE_TYPE':
      return {
        ...state,
        selectedTemplateType: action.payload,
        // 切换模板类型时关闭图片预览
        imagePreviewUrl: null,
      };

    case 'SET_IMAGE_PREVIEW_URL':
      return {
        ...state,
        imagePreviewUrl: action.payload,
      };

    case 'SET_SHOW_RESTORE_CONFIRM':
      return {
        ...state,
        showRestoreConfirm: action.payload,
      };

    case 'SET_TITLE_CLICK_COUNT':
      return {
        ...state,
        titleClickCount: action.payload,
      };

    case 'INCREMENT_TITLE_CLICK_COUNT':
      return {
        ...state,
        titleClickCount: state.titleClickCount + 1,
      };

    case 'RESET_TITLE_CLICK_COUNT':
      return {
        ...state,
        titleClickCount: 0,
      };

    case 'SET_IS_EXPORTING':
      return {
        ...state,
        isExporting: action.payload,
      };

    case 'CLOSE_ALL_MODALS':
      return {
        ...state,
        showTemplateModal: false,
        imagePreviewUrl: null,
        showRestoreConfirm: false,
        activeMenuFrameId: null,
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
};
