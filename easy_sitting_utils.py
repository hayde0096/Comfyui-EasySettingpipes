"""
ComfyUI 自定义节点工具库
提供 rgthree 风格的灵活输入类型和其他实用工具
"""

from typing import Any, Dict, Optional


class AnyType(str):
    """
    特殊类型：在比较时总是返回相等
    
    用于创建可以接受任何类型输入的节点，与 FlexibleOptionalInputType 配合使用。
    重写 __ne__ 方法总是返回 False，使任何类型与它比较都会认为相等。
    
    Credit: pythongosssss, rgthree
    """
    def __ne__(self, __value: object) -> bool:
        """
        重写不等于运算符，总是返回 False
        
        这是实现"万能类型"的关键技巧：
        - 任何类型与 AnyType 比较都会返回相等
        - 使得 ComfyUI 的类型检查系统认为任何输入都匹配
        - 配合 FlexibleOptionalInputType 实现动态输入
        
        Args:
            __value: 要比较的值
            
        Returns:
            总是返回 False，表示"相等"
        """
        return False


class FlexibleOptionalInputType(dict):
    """
    灵活的可选输入类型 - rgthree 的核心技巧
    
    功能：
    - 允许节点接收任意数量/类型的参数
    - 不在 ComfyUI UI 上创建输入槽（没有连接点）
    - 适用于动态输入节点（如 Power Lora Loader、Any Switch 等）
    
    工作原理：
    1. 继承自 dict，可以像普通字典一样使用
    2. __contains__ 总是返回 True - 告诉 ComfyUI"我支持任何输入"
    3. __getitem__ 为未知 key 返回灵活类型
       - 已知 key（如 model、clip）返回真实类型
       - 未知 key（如 widget 序列化的数据）返回 any_type
    
    使用场景：
    - 动态数量的输入（如 8 个 LoRA 槽位）
    - 通过 widget 序列化传递数据，而非 INPUT_TYPES
    - 避免在 UI 上显示不必要的连接点
    
    示例：
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
            }
        
        def my_function(self, model=None, clip=None, **kwargs):
            # model 和 clip 可以通过连接传入
            # **kwargs 接收 widget 序列化的数据（如 lora_1, lora_2...）
            pass
    
    参数：
        type: 灵活类型，通常使用 any_type = AnyType("*")
        data: 初始数据字典，定义节点的"正常"输入，这些会在 UI 上显示为可连接的输入槽
    
    Credit: rgthree-comfy
    """
    
    def __init__(self, type: AnyType, data: Optional[Dict[str, Any]] = None) -> None:
        """初始化灵活输入类型
        
        Args:
            type: 灵活类型（通常是 AnyType 实例）
            data: 可选的初始数据字典，定义节点的"正式"输入
        """
        super().__init__()
        self.type = type
        self.data = data or {}
        
        # 将初始数据添加到字典中
        for k, v in self.data.items():
            self[k] = v
    
    def __getitem__(self, key: str) -> tuple:
        """获取类型信息
        
        - 如果 key 在初始 data 中，返回真实类型（如 ("MODEL",)）
        - 否则返回灵活类型（如 (any_type,)）
        """
        if key in self.data:
            return self.data[key]
        return (self.type,)
    
    def __contains__(self, key: object) -> bool:
        """⭐ 核心魔法：总是返回 True
        
        告诉 ComfyUI"我可以接收任何 key 的输入"，但因为是特殊的 dict 子类，
        ComfyUI 不会为这些未知 key 创建 UI 输入槽。
        """
        return True


# 创建全局 any_type 实例
any_type = AnyType("*")

# ===== 工具函数 =====

def get_dict_value(data: Dict[str, Any], dict_key: str, default: Any = None) -> Any:
    """获取嵌套字典中的值（支持点分隔的 key）
    
    Args:
        data: 字典数据
        dict_key: 点分隔的 key 路径（如 "a.b.c"）
        default: 找不到时的默认值
    
    Returns:
        找到的值或默认值
    
    Example:
        data = {"user": {"profile": {"name": "Alice"}}}
        get_dict_value(data, "user.profile.name")  # "Alice"
    """
    keys = dict_key.split('.')
    key = keys.pop(0) if len(keys) > 0 else None
    found = data.get(key) if key in data else None
    
    if found is not None and len(keys) > 0:
        return get_dict_value(found, '.'.join(keys), default)
    
    return found if found is not None else default


def set_dict_value(
    data: Dict[str, Any],
    dict_key: str,
    value: Any,
    create_missing_objects: bool = True
) -> Dict[str, Any]:
    """设置嵌套字典中的值（支持点分隔的 key）
    
    Args:
        data: 字典数据
        dict_key: 点分隔的 key 路径
        value: 要设置的值
        create_missing_objects: 是否创建缺失的中间对象
    
    Returns:
        修改后的字典
    
    Example:
        data = {}
        set_dict_value(data, "user.profile.name", "Alice")
        # data = {"user": {"profile": {"name": "Alice"}}}
    """
    keys = dict_key.split('.')
    key = keys.pop(0) if len(keys) > 0 else None
    
    if key not in data:
        if not create_missing_objects:
            return data
        data[key] = {}
    
    if len(keys) == 0:
        data[key] = value
    else:
        set_dict_value(data[key], '.'.join(keys), value, create_missing_objects)
    
    return data


def dict_has_key(data: Dict[str, Any], dict_key: str) -> bool:
    """检查嵌套字典中是否存在某个 key
    
    Args:
        data: 字典数据
        dict_key: 点分隔的 key 路径
    
    Returns:
        是否存在该 key
    
    Example:
        data = {"user": {"profile": {"name": "Alice"}}}
        dict_has_key(data, "user.profile.name")  # True
    """
    keys = dict_key.split('.')
    key = keys.pop(0) if len(keys) > 0 else None
    
    if key is None or key not in data:
        return False
    
    if len(keys) == 0:
        return True
    
    return dict_has_key(data[key], '.'.join(keys))


def is_dict_value_falsy(data: Dict[str, Any], dict_key: str) -> bool:
    """检查嵌套字典中的值是否为 falsy
    
    Args:
        data: 字典数据
        dict_key: 点分隔的 key 路径
    
    Returns:
        值是否为 falsy（None、False、0、""、[] 等）
    
    Example:
        data = {"user": {"active": False}}
        is_dict_value_falsy(data, "user.active")  # True
    """
    val = get_dict_value(data, dict_key)
    return not val


def is_valid_lora_config(key: str, value: Any) -> bool:
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
