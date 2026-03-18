"""
Transformer 情感分析模型
支持多语言和代码混合场景
"""

import torch
import torch.nn as nn
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    pipeline,
    BatchEncoding,
)
from typing import List, Dict, Union, Optional
import numpy as np
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PredictionResult:
    """预测结果"""
    label: str
    confidence: float
    scores: Dict[str, float]
    model_name: str
    latency_ms: float


class MultilingualSentimentModel:
    """
    多语言情感分析模型
    支持模型:
    - xlm-roberta-base (推荐平衡方案)
    - bert-base-chinese (中文专用)
    - distilbert-base-uncased-finetuned-sst-2-english (英文快速)
    """

    # 模型配置
    MODEL_CONFIGS = {
        "xlm-roberta-base": {
            "model_name": "cardiffnlp/twitter-xlm-roberta-base-sentiment",
            "labels": ["negative", "neutral", "positive"],
            "max_length": 512,
        },
        "bert-chinese": {
            "model_name": "uer/roberta-base-finetuned-jd-binary-chinese",
            "labels": ["negative", "positive"],
            "max_length": 512,
        },
        "distilbert-en": {
            "model_name": "distilbert-base-uncased-finetuned-sst-2-english",
            "labels": ["negative", "positive"],
            "max_length": 512,
        },
        "irony-detection": {
            "model_name": "cardiffnlp/twitter-roberta-base-irony",
            "labels": ["non_irony", "irony"],
            "max_length": 512,
        },
    }

    def __init__(self, model_key: str = "xlm-roberta-base", device: Optional[str] = None):
        """
        初始化模型

        Args:
            model_key: 模型配置键
            device: 运行设备 ('cuda', 'cpu', 或 None 自动检测)
        """
        self.model_key = model_key
        self.config = self.MODEL_CONFIGS[model_key]
        
        # 设备设置
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        logger.info(f"Loading model: {self.config['model_name']}")
        logger.info(f"Using device: {self.device}")

        # 加载模型和分词器
        self.tokenizer = AutoTokenizer.from_pretrained(self.config["model_name"])
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.config["model_name"]
        ).to(self.device)
        
        self.model.eval()
        self.labels = self.config["labels"]

        logger.info(f"Model loaded successfully. Labels: {self.labels}")

    def predict(self, text: str) -> PredictionResult:
        """
        单条文本预测

        Args:
            text: 输入文本

        Returns:
            PredictionResult 包含预测标签和置信度
        """
        import time
        start_time = time.time()

        # 编码输入
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=self.config["max_length"],
            padding=True,
        ).to(self.device)

        # 推理
        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=1)
            probs = probabilities.cpu().numpy()[0]

        # 确定标签
        pred_idx = np.argmax(probs)
        label = self.labels[pred_idx]
        confidence = float(probs[pred_idx])

        # 构建分数字典
        scores = {label: float(prob) for label, prob in zip(self.labels, probs)}

        # 标准化标签
        normalized_label = self._normalize_label(label, scores)

        latency = (time.time() - start_time) * 1000

        return PredictionResult(
            label=normalized_label,
            confidence=confidence,
            scores=scores,
            model_name=self.model_key,
            latency_ms=latency,
        )

    def predict_batch(self, texts: List[str], batch_size: int = 32) -> List[PredictionResult]:
        """
        批量预测

        Args:
            texts: 文本列表
            batch_size: 批处理大小

        Returns:
            预测结果列表
        """
        import time
        start_time = time.time()

        results = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_results = self._predict_batch_internal(batch)
            results.extend(batch_results)

        total_latency = (time.time() - start_time) * 1000
        avg_latency = total_latency / len(texts) if texts else 0

        # 更新延迟
        for r in results:
            r.latency_ms = avg_latency

        return results

    def _predict_batch_internal(self, texts: List[str]) -> List[PredictionResult]:
        """内部批处理预测"""
        inputs = self.tokenizer(
            texts,
            return_tensors="pt",
            truncation=True,
            max_length=self.config["max_length"],
            padding=True,
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=1)
            probs = probabilities.cpu().numpy()

        results = []
        for prob in probs:
            pred_idx = np.argmax(prob)
            label = self.labels[pred_idx]
            confidence = float(prob[pred_idx])
            scores = {l: float(p) for l, p in zip(self.labels, prob)}
            normalized_label = self._normalize_label(label, scores)

            results.append(PredictionResult(
                label=normalized_label,
                confidence=confidence,
                scores=scores,
                model_name=self.model_key,
                latency_ms=0,  # 将在上层统一计算
            ))

        return results

    def _normalize_label(self, raw_label: str, scores: Dict[str, float]) -> str:
        """
        标准化标签为三分类
        """
        # XLM-RoBERTa 输出: negative, neutral, positive
        if raw_label in ["negative", "positive", "neutral"]:
            return raw_label

        # 二分类模型映射
        if raw_label == "LABEL_0":
            return "negative"
        if raw_label == "LABEL_1":
            return "positive"

        return "neutral"

    def get_model_info(self) -> Dict:
        """获取模型信息"""
        return {
            "model_key": self.model_key,
            "model_name": self.config["model_name"],
            "labels": self.labels,
            "device": self.device,
            "max_length": self.config["max_length"],
        }


class SarcasmDetectionModel:
    """
    讽刺检测专用模型
    基于 irony detection 模型 + 自定义分类头
    """

    def __init__(self, device: Optional[str] = None):
        self.irony_model = MultilingualSentimentModel(
            model_key="irony-detection",
            device=device
        )

        # 讽刺指示词
        self.sarcasm_indicators = {
            "zh": ["呵呵", "真棒", "真好", "太好了", "厉害", "佩服"],
            "en": ["yeah right", "sure", "obviously", "clearly", "brilliant", "genius"],
        }

    def predict(self, text: str, language: str = "zh") -> Dict:
        """
        预测讽刺概率
        """
        # 基础讽刺检测
        irony_result = self.irony_model.predict(text)
        irony_score = irony_result.scores.get("irony", 0)

        # 词汇线索检测
        indicator_score = self._check_indicators(text, language)

        # 综合评分
        combined_score = irony_score * 0.6 + indicator_score * 0.4

        return {
            "is_sarcastic": combined_score > 0.6,
            "confidence": float(combined_score),
            "irony_score": float(irony_score),
            "indicator_score": float(indicator_score),
            "cues": self._extract_cues(text, language),
        }

    def _check_indicators(self, text: str, language: str) -> float:
        """检查讽刺指示词"""
        text_lower = text.lower()
        indicators = self.sarcasm_indicators.get(language, [])
        
        count = sum(1 for ind in indicators if ind in text_lower)
        return min(count * 0.3, 1.0)

    def _extract_cues(self, text: str, language: str) -> List[str]:
        """提取讽刺线索"""
        cues = []
        text_lower = text.lower()
        
        indicators = self.sarcasm_indicators.get(language, [])
        for ind in indicators:
            if ind in text_lower:
                cues.append(f"indicator:{ind}")

        # 标点符号线索
        if "..." in text or "。。。" in text:
            cues.append("punctuation:ellipsis")
        if text.count("！") >= 2 or text.count("!") >= 2:
            cues.append("punctuation:exclamation")

        return cues


class EnsembleModel:
    """
    模型集成
    结合多个模型的预测结果
    """

    def __init__(self, models: List[MultilingualSentimentModel], weights: Optional[List[float]] = None):
        self.models = models
        self.weights = weights or [1.0 / len(models)] * len(models)

    def predict(self, text: str) -> PredictionResult:
        """集成预测"""
        import time
        start_time = time.time()

        results = [model.predict(text) for model in self.models]

        # 加权融合分数
        fused_scores = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
        
        for result, weight in zip(results, self.weights):
            for label, score in result.scores.items():
                normalized_label = self._normalize_label_name(label)
                if normalized_label in fused_scores:
                    fused_scores[normalized_label] += score * weight

        # 确定最终标签
        final_label = max(fused_scores, key=fused_scores.get)
        final_confidence = fused_scores[final_label]

        latency = (time.time() - start_time) * 1000

        return PredictionResult(
            label=final_label,
            confidence=final_confidence,
            scores=fused_scores,
            model_name="ensemble",
            latency_ms=latency,
        )

    def _normalize_label_name(self, label: str) -> str:
        """标准化标签名"""
        label = label.lower()
        if "positive" in label or label == "positive":
            return "positive"
        if "negative" in label or label == "negative":
            return "negative"
        return "neutral"


# 全局模型实例（懒加载）
_model_instances = {}


def get_model(model_key: str = "xlm-roberta-base", device: Optional[str] = None) -> MultilingualSentimentModel:
    """
    获取模型实例（单例模式）
    """
    cache_key = f"{model_key}_{device}"
    
    if cache_key not in _model_instances:
        _model_instances[cache_key] = MultilingualSentimentModel(
            model_key=model_key,
            device=device
        )
    
    return _model_instances[cache_key]


def clear_models():
    """清除所有缓存的模型"""
    global _model_instances
    _model_instances = {}
    torch.cuda.empty_cache()
    logger.info("All model instances cleared")
