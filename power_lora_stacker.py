"""
Power LoRA Stacker - ComfyUI Custom Node
支持创建和管理多个 LoRA 的堆栈，最多100个
"""

from typing import Optional, List, Tuple, Dict, Any

import folder_paths
from .easy_sitting_utils import FlexibleOptionalInputType, any_type


class PowerLoraStacker:
    """强大的 LoRA 堆栈器节点
    
    功能：将多个 LoRA 配置组合成堆栈，便于批量管理和传递
    """
    
    def __init__(self) -> None:
        """初始化 LoRA 堆栈器"""
        pass
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": FlexibleOptionalInputType(
                type=any_type,
                data={
                    "lora_stack": ("LORA_STACK",),
                }
            ),
            "hidden": {},
        }
    
    RETURN_TYPES = ("LORA_STACK",)
    RETURN_NAMES = ("lora_stack",)
    FUNCTION = "create_stack"
    CATEGORY = "easy sitting"
    INPUT_IS_LIST = False
    OUTPUT_NODE = False

    def create_stack(
        self,
        lora_stack: Optional[List[Tuple[str, float, float]]] = None,
        **kwargs: Dict[str, Any]
    ) -> Tuple[Optional[List[Tuple[str, float, float]]]]:
        """创建 LoRA 堆栈
        
        Args:
            lora_stack: 输入的 LoRA 堆栈（可选，用于堆栈链接）
            **kwargs: 包含 LoRA 配置的动态参数
            
        Returns:
            包含 LoRA 配置的堆栈列表，格式为 [(lora_name, model_strength, clip_strength), ...]
        """
        # 初始化结果堆栈
        result_stack: List[Tuple[str, float, float]] = []
        
        # 如果有输入的 lora_stack，先添加进来
        if lora_stack is not None and isinstance(lora_stack, list):
            result_stack.extend(lora_stack)
        
        # 收集所有启用的 LoRA 配置
        lora_items = self._collect_lora_items(kwargs)
        
        # 添加到结果栈
        result_stack.extend(lora_items)
        
        # 如果栈为空，返回 None
        if len(result_stack) == 0:
            return (None,)
        
        return (result_stack,)
    
    @staticmethod
    def _collect_lora_items(kwargs: Dict[str, Any]) -> List[Tuple[str, float, float]]:
        """从参数中收集所有启用的 LoRA 配置
        
        Args:
            kwargs: 包含 LoRA 配置的参数字典
            
        Returns:
            LoRA 配置列表，格式为 [(lora_name, model_strength, clip_strength), ...]
        """
        lora_items: List[Tuple[str, float, float]] = []
        
        for key, value in kwargs.items():
            # 检查是否是有效的 LoRA widget 数据
            if not PowerLoraStacker._is_valid_lora_config(key, value):
                continue
            
            # 只添加开启的 lora
            if not value.get('on', False):
                continue
            
            lora_name = value.get('lora')
            if not lora_name or lora_name == "None":
                continue
            
            # 获取强度参数，确保转换为浮点数
            strength_model = float(value.get('strength', 1.0))
            strength_clip = float(value.get('strengthTwo', strength_model))
            
            # 添加到结果列表
            lora_items.append((lora_name, strength_model, strength_clip))
        
        return lora_items
    
    @staticmethod
    def _is_valid_lora_config(key: str, value: Any) -> bool:
        """检查参数是否是有效的 LoRA 配置
        
        Args:
            key: 参数键名
            value: 参数值
            
        Returns:
            是否是有效的 LoRA 配置
        """
        return (
            key.upper().startswith('LORA_') and
            isinstance(value, dict) and
            'on' in value and
            'lora' in value and
            'strength' in value
        )


NODE_CLASS_MAPPINGS = {
    "PowerLoraStacker": PowerLoraStacker,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PowerLoraStacker": "Power Lora Stacker 📚",
}
