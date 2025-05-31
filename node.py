import comfy
import comfy.samplers
import random
import math
from nodes import MAX_RESOLUTION

class AnyType(str):
    """一个特殊类型，可以连接到任何其他类型。来源于 pythongosssss"""

    def __ne__(self, __value: object) -> bool:
        # 重写不等于方法，始终返回 False，使其可以与任何类型兼容
        return False


any_type = AnyType("*")


class ConvertAny:
    # 定义一个可以接收任意类型输入并原样返回的节点
    # 作用：在不同类型节点间建立连接，绕过类型限制
    
    @classmethod
    def INPUT_TYPES(s):
        # 定义节点输入，使用 any_type 类型，强制要求输入
        return {
            "required": {},
            "optional": {
                "Any_input": (
                    any_type,
                    {"forceInput": True},
                ),
            },
        }

    RETURN_TYPES = (any_type,)
    RETURN_NAMES = ("Any_Output",)
    FUNCTION = "convert_any"
    CATEGORY = "Easysittingpipes"  
    
    def convert_any(self, Any_input: str = ""):
        # 直接返回输入参数，不做任何修改
        return (Any_input,)


class SamplerSetup:
    # 创建采样器设置节点，将各种参数打包成一个数据包
    
    @classmethod
    def INPUT_TYPES(cls):
        # 定义所有采样相关参数，包括：
        # - 步数、CFG值、CLIP层跳过数 steps、cfg、clip_skip
        # - 采样器和调度器名称 sampler_name、scheduler
        # - 图像宽度和高度 width、height
        # - 宽高交换选项 swap_wh
        # - 批次大小 batch_size
        return {
            "required": {
                "steps": ("INT", {"default": 20, "min": -1000, "max": 1000, "step": 1}),
                "cfg": ("FLOAT", {"default": 7.0, "min": -100.0, "max": 100.0, "step": 0.1}),
                "clip_skip": ("INT", {"default": -1, "min": -100, "max": 100, "step": 1}),
                "sampler_name": (comfy.samplers.KSampler.SAMPLERS,),
                "scheduler": (comfy.samplers.KSampler.SCHEDULERS,),
                "width": ("INT", {"default": 1024, "min": 32, "max": 8192, "step": 16}),
                "height": ("INT", {"default": 1024, "min": 32, "max": 8192, "step": 16}),
                "swap_wh": ("BOOLEAN", {"default": False, "label_on": "Swap", "label_off": "Keep"}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 128}), 
            },
        }

    RETURN_TYPES = ("SETUPPIPE",)
    RETURN_NAMES = ("setup_pipe",)
    FUNCTION = "build_pipe"
    CATEGORY = "Easysittingpipes"  

    def build_pipe(self, steps, cfg, clip_skip, sampler_name, scheduler, 
                   width, height, swap_wh, batch_size):
        # 处理宽高交换
        if swap_wh:
            width, height = height, width

        # 确保 sampler_name 和 scheduler 是有效值
        if sampler_name not in comfy.samplers.KSampler.SAMPLERS:
            sampler_name = comfy.samplers.KSampler.SAMPLERS[0]
        if scheduler not in comfy.samplers.KSampler.SCHEDULERS:
            scheduler = comfy.samplers.KSampler.SCHEDULERS[0]

        return ({
            "steps": steps,
            "cfg": cfg,
            "clip_skip": clip_skip,
            "sampler": sampler_name,
            "scheduler": scheduler,
            "width": width,
            "height": height,
            "batch_size": batch_size,
        },)


class SamplerSetupUnpack:
    # 解包采样器设置，将打包的参数拆分为单独的输出
    
    @classmethod
    def INPUT_TYPES(cls):
        # SETUPPIPE 类型输入
        return {
            "required": {
                "setup_pipe": ("SETUPPIPE",),
            },
        }

    RETURN_TYPES = (
        "INT", "FLOAT", "INT",
        comfy.samplers.KSampler.SAMPLERS,  
        comfy.samplers.KSampler.SCHEDULERS,  
        "INT", "INT", "INT"
    )
    RETURN_NAMES = (
        "steps", "cfg", "clip_skip",
        "sampler", "scheduler",
        "width", "height", "batch_size", 
    )
    FUNCTION = "unpack_pipe"
    CATEGORY = "Easysittingpipes"  

    def unpack_pipe(self, setup_pipe):
        # 安全地获取采样器和调度器值
        sampler = setup_pipe.get("sampler")
        scheduler = setup_pipe.get("scheduler")
        
        if not sampler or sampler not in comfy.samplers.KSampler.SAMPLERS:
            sampler = comfy.samplers.KSampler.SAMPLERS[0]  
        
        if not scheduler or scheduler not in comfy.samplers.KSampler.SCHEDULERS:
            scheduler = comfy.samplers.KSampler.SCHEDULERS[0]  

        # 返回所有拆分后的参数，转换为适当的类型
        # 确保参数缺失时提供默认值
        return (
            int(setup_pipe.get("steps", 0)),
            float(setup_pipe.get("cfg", 0.0)),
            int(setup_pipe.get("clip_skip", 0)),
            sampler,
            scheduler,
            int(setup_pipe.get("width", 0)),
            int(setup_pipe.get("height", 0)),
            int(setup_pipe.get("batch_size", 1)),
        )


# 注册节点
NODE_CLASS_MAPPINGS = {
    "SamplerSetup": SamplerSetup,
    "SamplerSetupUnpack": SamplerSetupUnpack,
    "ConvertAny": ConvertAny,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SamplerSetup": "SamplerSetup",
    "SamplerSetupUnpack": "Sampler Setup Unpack",
    "ConvertAny": "Convert Any",
}