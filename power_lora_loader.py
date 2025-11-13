"""
Power LoRA Loader - ComfyUI Custom Node
支持加载多个 LoRA 模型并分别调节强度
"""

from typing import Optional, Dict, Any, Tuple
import logging

import folder_paths
import comfy.utils
import comfy.sd

from .easy_sitting_utils import FlexibleOptionalInputType, any_type

# 配置日志
logger = logging.getLogger(__name__)


class PowerLoraLoader:
    """强大的 LoRA 加载器节点
    
    功能：支持动态加载多个 LoRA 模型，每个模型可独立控制强度
    """
    
    def __init__(self) -> None:
        """初始化 LoRA 加载器，缓存已加载的 LoRA"""
        self.loaded_lora: Optional[Tuple[str, Any]] = None
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": FlexibleOptionalInputType(
                type=any_type,
                data={
                    "model": ("MODEL",),
                    "clip": ("CLIP",),
                }
            ),
            "hidden": {},
        }
    
    RETURN_TYPES = ("MODEL", "CLIP")
    FUNCTION = "load_loras"
    CATEGORY = "easy sitting"
    INPUT_IS_LIST = False
    OUTPUT_NODE = False

    def load_lora(
        self,
        model: Any,
        clip: Optional[Any],
        lora_name: str,
        strength_model: float,
        strength_clip: float
    ) -> Tuple[Any, Optional[Any]]:
        """加载单个 LoRA 模型
        
        Args:
            model: 基础模型
            clip: CLIP 模型（可选）
            lora_name: LoRA 文件名
            strength_model: 模型强度系数
            strength_clip: CLIP 强度系数
            
        Returns:
            (处理后的模型, 处理后的 CLIP)
        """
        # 如果强度都为 0，直接返回原模型
        if strength_model == 0 and strength_clip == 0:
            return model, clip
        
        # 如果 LoRA 名称无效，直接返回原模型
        if not lora_name or lora_name == "None":
            return model, clip
        
        try:
            # 获取 LoRA 完整路径
            lora_path = folder_paths.get_full_path_or_raise("loras", lora_name)
            
            # 检查缓存，避免重复加载同一个 LoRA
            lora = None
            if self.loaded_lora is not None:
                cached_path, cached_lora = self.loaded_lora
                if cached_path == lora_path:
                    lora = cached_lora
                else:
                    self.loaded_lora = None
            
            # 如果缓存中没有，则加载 LoRA 文件
            if lora is None:
                lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
                self.loaded_lora = (lora_path, lora)
            
            # 应用 LoRA 到模型和 CLIP
            model_lora, clip_lora = comfy.sd.load_lora_for_models(
                model, clip, lora, strength_model, strength_clip
            )
            
            return model_lora, clip_lora
            
        except FileNotFoundError:
            logger.error(f"LoRA 文件未找到: {lora_name}")
            return model, clip
        except Exception as e:
            logger.error(f"加载 LoRA 时发生错误 ({lora_name}): {e}", exc_info=True)
            return model, clip

    def load_loras(
        self,
        model: Optional[Any] = None,
        clip: Optional[Any] = None,
        **kwargs: Dict[str, Any]
    ) -> Tuple[Optional[Any], Optional[Any]]:
        """加载所有启用的 LoRA 模型
        
        Args:
            model: 基础模型（可选）
            clip: CLIP 模型（可选）
            **kwargs: 包含 LoRA 配置的动态参数
            
        Returns:
            (处理后的模型, 处理后的 CLIP)
        """
        # 如果没有提供模型，直接返回
        if model is None:
            return (None, clip)
        
        current_model = model
        current_clip = clip
        
        # 遍历所有传入的参数，查找 LoRA 配置
        for key, value in kwargs.items():
            # 检查是否是有效的 LoRA 配置
            if not self._is_valid_lora_config(key, value):
                continue
            
            # 如果 LoRA 未启用，跳过
            if not value.get('on', False):
                continue
            
            # 获取强度参数
            strength_model = value.get('strength', 1.0)
            strength_clip = value.get('strengthTwo', strength_model)
            
            # 如果没有 CLIP 但设置了 CLIP 强度，发出警告
            if clip is None and strength_clip != 0:
                logger.warning("收到 CLIP 强度参数但未提供 CLIP 模型")
                strength_clip = 0
            
            # 如果强度都为 0，跳过
            if strength_model == 0 and strength_clip == 0:
                continue
            
            # 获取 LoRA 名称并加载
            lora_name = value.get('lora')
            if lora_name and lora_name != "None":
                current_model, current_clip = self.load_lora(
                    current_model, current_clip, lora_name,
                    strength_model, strength_clip
                )
        
        return (current_model, current_clip)
    
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
    "PowerLoraLoader": PowerLoraLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PowerLoraLoader": "Power Lora Loader 🔥",
}
