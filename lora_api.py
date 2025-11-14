"""
Lora 信息 API - 为前端提供 Lora 详细信息接口
基于rgthree-comfy的核心算法实现，解决训练词汇中JSON片段的问题
"""

import os
import json
import hashlib
import re
from typing import Optional, Dict, Any, List
from aiohttp import web
from server import PromptServer
import requests

import folder_paths
from .easy_sitting_utils import get_dict_value

# 获取 PromptServer 实例并注册路由
routes = PromptServer.instance.routes

# Civitai API 配置
CIVITAI_API_URL = "https://civitai.com/api/v1/model-versions/by-hash"
CIVITAI_TIMEOUT = 10  # 秒


def file_exists(path):
    """检查文件是否存在，支持 None 类型
    
    Args:
        path: 文件路径，可以是 None
        
    Returns:
        文件存在返回 True，否则返回 False
    """
    if path is not None:
        return os.path.isfile(path)
    return False


def get_file_hash(file_path: str, algorithm: str = 'sha256') -> str:
    """计算文件的哈希值
    
    用于生成文件的唯一标识符，主要用于：
    - 文件完整性验证
    - Civitai API 查询（通过文件哈希查找模型信息）
    - 缓存管理
    
    Args:
        file_path: 文件路径
        algorithm: 哈希算法，默认为 'sha256'
        
    Returns:
        文件的哈希字符串，出错时返回空字符串
    """
    try:
        hash_obj = hashlib.new(algorithm)
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                hash_obj.update(chunk)
        return hash_obj.hexdigest()
    except Exception as e:
        return ""


def get_lora_metadata(file_path: str) -> Dict[str, Any]:
    """
    从 Lora 文件中提取元数据
    基于rgthree的 _read_file_metadata_from_header 实现
    """
    data = None
    try:
        if file_path.endswith('.safetensors'):
            with open(file_path, "rb") as file:
                # https://github.com/huggingface/safetensors#format
                # 8 bytes: N, an unsigned little-endian 64-bit integer, containing the size of the header
                header_size = int.from_bytes(file.read(8), "little", signed=False)

                if header_size <= 0:
                    return {}

                header = file.read(header_size)
                if header is None:
                    return {}

                header_json = json.loads(header)
                data = header_json.get("__metadata__", {})

                if data is not None:
                    # 更保守的JSON解析策略，避免过度解析
                    for key, value in data.items():
                        if isinstance(value, str) and value.startswith('{') and value.endswith('}'):
                            try:
                                value_as_json = json.loads(value)
                                data[key] = value_as_json
                            except Exception:
                                # 如果解析失败，保持原样
                                pass
    except Exception as e:
        data = None

    return data if data else {}


def extract_trained_words(metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    从元数据中提取训练词汇
    基于rgthree的 _merge_metadata 实现，避免JSON片段混入
    """
    trained_words = {}
    
    if not isinstance(metadata, dict):
        return []
    
    # 使用rgthree的严格类型检查逻辑
    if 'ss_tag_frequency' in metadata and isinstance(metadata['ss_tag_frequency'], dict):
        for bucket_value in metadata['ss_tag_frequency'].values():
            if isinstance(bucket_value, dict):
                for tag, count in bucket_value.items():
                    # 确保tag是字符串，避免JSON对象混入
                    if isinstance(tag, str) and not tag.startswith('{') and not tag.startswith('['):
                        if tag not in trained_words:
                            trained_words[tag] = {'word': tag, 'count': 0, 'metadata': True}
                        # 累加计数
                        if isinstance(count, (int, float)):
                            trained_words[tag]['count'] = trained_words[tag]['count'] + count
    
    result = list(trained_words.values())
    return result


def get_civitai_info_sync(file_hash: str) -> Optional[Dict[str, Any]]:
    """
    同步方式从 Civitai API 获取模型信息
    """
    if not file_hash:
        return None
    
    try:
        url = f"{CIVITAI_API_URL}/{file_hash}"
        response = requests.get(url, timeout=CIVITAI_TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            return data
        elif response.status_code == 404:
            return {"error": "Model not found"}
        else:
            return None
    except requests.exceptions.Timeout:
        return None
    except requests.exceptions.RequestException as e:
        return None


def merge_civitai_data(info: Dict[str, Any], civitai_data: Dict[str, Any]) -> None:
    """
    将 Civitai 数据合并到 Lora 信息中
    基于rgthree的 _merge_civitai_data 实现，包含更好的词汇清理
    """
    if not civitai_data or 'error' in civitai_data:
        return
    
    # 提取基础信息
    if 'name' not in info:
        info['name'] = get_dict_value(civitai_data, 'model.name', '')
        version_name = get_dict_value(civitai_data, 'name')
        if version_name is not None:
            info['name'] += f' - {version_name}'
    
    if 'type' not in info:
        info['type'] = get_dict_value(civitai_data, 'model.type')
    
    if 'baseModel' not in info:
        info['baseModel'] = get_dict_value(civitai_data, 'baseModel')
    
    # 使用rgthree的词汇清理逻辑
    civitai_trigger = get_dict_value(civitai_data, 'triggerWords', default=[])
    civitai_trained = get_dict_value(civitai_data, 'trainedWords', default=[])
    
    # 清理和规范化词汇
    civitai_words = ','.join(civitai_trigger + civitai_trained)
    if civitai_words:
        civitai_words = re.sub(r"\s*,\s*", ",", civitai_words)
        civitai_words = re.sub(r",+", ",", civitai_words)
        civitai_words = re.sub(r"^,", "", civitai_words)
        civitai_words = re.sub(r",$", "", civitai_words)
        
        if civitai_words:
            civitai_words = civitai_words.split(',')
            if 'trainedWords' not in info:
                info['trainedWords'] = []
            
            for trigger_word in civitai_words:
                # 过滤掉JSON对象和空字符串
                if not trigger_word or trigger_word.startswith('{') or trigger_word.startswith('['):
                    continue
                
                word_data = next(
                    (data for data in info['trainedWords'] if data.get('word') == trigger_word), None
                )
                if word_data is None:
                    word_data = {'word': trigger_word}
                    info['trainedWords'].append(word_data)
                word_data['civitai'] = True
    
    # 提取 Civitai 链接
    if 'modelId' in civitai_data:
        if 'links' not in info:
            info['links'] = []
        
        model_id = civitai_data['modelId']
        civitai_link = f'https://civitai.com/models/{model_id}'
        
        if 'id' in civitai_data:
            civitai_link += f'?modelVersionId={civitai_data["id"]}'
        
        if civitai_link not in info['links']:
            info['links'].append(civitai_link)
    
    # 提取图片
    if 'images' in civitai_data:
        if 'images' not in info:
            info['images'] = []
        
        existing_urls = {img.get('url') for img in info['images']}
        
        for img in civitai_data['images']:
            img_url = img.get('url')
            if img_url and img_url not in existing_urls:
                img_data = {
                    'url': img_url,
                    'type': img.get('type'),
                    'width': img.get('width'),
                    'height': img.get('height'),
                }
                
                # 提取元数据
                meta = img.get('meta', {})
                if meta.get('seed'):
                    img_data['seed'] = meta['seed']
                if meta.get('prompt'):
                    img_data['positive'] = meta['prompt']
                if meta.get('negativePrompt'):
                    img_data['negative'] = meta['negativePrompt']
                if meta.get('steps'):
                    img_data['steps'] = meta['steps']
                if meta.get('sampler'):
                    img_data['sampler'] = meta['sampler']
                if meta.get('cfgScale'):
                    img_data['cfg'] = meta['cfgScale']
                if meta.get('Model'):
                    img_data['model'] = meta['Model']
                
                info['images'].append(img_data)
    
    # 保存原始 Civitai 数据
    if 'raw' not in info:
        info['raw'] = {}
    info['raw']['civitai'] = civitai_data


def get_lora_info(lora_name: str, fetch_civitai: bool = False) -> Optional[Dict[str, Any]]:
    """
    获取指定 Lora 的详细信息
    使用rgthree的核心算法实现
    """
    try:
        # 获取 Lora 文件的完整路径
        lora_path = folder_paths.get_full_path("loras", lora_name)
        
        if not os.path.exists(lora_path):
            return None
        
        # 构建基础信息
        info = {
            "file": lora_name,
            "path": lora_path,
            "size": os.path.getsize(lora_path),
            "name": os.path.splitext(lora_name)[0],  # 不带扩展名的名称
        }
        
        # 计算文件哈希
        file_hash = get_file_hash(lora_path)
        if file_hash:
            info["sha256"] = file_hash
        
        # 尝试提取元数据
        metadata = get_lora_metadata(lora_path)
        if metadata:
            if "raw" not in info:
                info["raw"] = {}
            info["raw"]["metadata"] = metadata
            
            # 提取训练词汇（使用rgthree的严格逻辑）
            trained_words = extract_trained_words(metadata)
            if trained_words:
                info["trainedWords"] = trained_words
            
            # 提取其他有用的字段
            if 'ss_clip_skip' in metadata:
                try:
                    info["clipSkip"] = int(metadata['ss_clip_skip'])
                except (ValueError, TypeError):
                    info["clipSkip"] = metadata['ss_clip_skip']
            
            if 'ss_output_name' in metadata:
                info["name"] = metadata['ss_output_name']
        
        # 如果需要，从 Civitai 获取信息
        if fetch_civitai and file_hash:
            civitai_data = get_civitai_info_sync(file_hash)
            if civitai_data:
                merge_civitai_data(info, civitai_data)
        
        return info
    
    except Exception as e:
        return None


@routes.get('/api/easy_sitting/loras/info')
async def api_get_lora_info(request: web.Request) -> web.Response:
    """
    获取指定 Lora 的详细信息
    
    查询参数:
        file: Lora 文件名（必需）
        civitai: 是否从 Civitai 获取信息（可选，默认为 false）
        
    返回:
        {
            "file": "lora_name.safetensors",
            "path": "/path/to/lora.safetensors",
            "sha256": "hash...",
            "size": 12345,
            "name": "lora_name",
            "trainedWords": [
                {"word": "keyword1"},
                {"word": "keyword2", "civitai": true}
            ],
            "links": ["https://civitai.com/models/..."],
            "images": [
                {
                    "url": "...",
                    "seed": "...",
                    "positive": "...",
                    "negative": "..."
                }
            ],
            "raw": {
                "metadata": {...},
                "civitai": {...}
            }
        }
    """
    try:
        file_param = request.rel_url.query.get('file')
        civitai_param = request.rel_url.query.get('civitai', 'false').lower() == 'true'
        
        if not file_param:
            return web.json_response(
                {"error": "Missing 'file' parameter"},
                status=400
            )
        
        info = get_lora_info(file_param, fetch_civitai=civitai_param)
        
        if info is None:
            return web.json_response(
                {"error": f"Lora file not found: {file_param}"},
                status=404
            )
        
        return web.json_response(info)
    
    except Exception as e:
        return web.json_response(
            {"error": str(e)},
            status=500
        )


@routes.get('/api/easy_sitting/loras/list')
async def api_list_loras(request: web.Request) -> web.Response:
    """
    获取所有可用的 Lora 列表
    """
    try:
        loras = folder_paths.get_filename_list("loras")
        return web.json_response(loras)
    except Exception as e:
        return web.json_response(
            {"error": str(e)},
            status=500
        )


def register_lora_api():
    """
    注册 Lora API
    这个函数在模块加载时会被调用
    """
    pass


# 模块加载时自动注册
register_lora_api()
