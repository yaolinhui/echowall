"""
FastAPI 模型服务
提供 RESTful API 供 TypeScript 层调用
"""

import os
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import logging

from models.transformer_model import (
    MultilingualSentimentModel,
    SarcasmDetectionModel,
    get_model,
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建 FastAPI 应用
app = FastAPI(
    title="Multilingual Sentiment Analysis API",
    description="多语言情感分析模型服务",
    version="1.0.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 数据模型
class PredictRequest(BaseModel):
    text: str
    language: Optional[str] = "auto"
    model: Optional[str] = "xlm-roberta-base"


class BatchPredictRequest(BaseModel):
    texts: List[str]
    language: Optional[str] = "auto"
    model: Optional[str] = "xlm-roberta-base"


class FastPredictRequest(BaseModel):
    text: str
    language: Optional[str] = "auto"


class SarcasmDetectRequest(BaseModel):
    text: str
    language: Optional[str] = "zh"
    context: Optional[List[str]] = None


class PredictResponse(BaseModel):
    label: str
    confidence: float
    scores: Dict[str, float]
    model_name: str
    latency_ms: float


class HealthResponse(BaseModel):
    status: str
    models: Dict[str, Any]


# 全局模型实例
sentiment_model: Optional[MultilingualSentimentModel] = None
sarcasm_model: Optional[SarcasmDetectionModel] = None


@app.on_event("startup")
async def startup_event():
    """服务启动时加载模型"""
    global sentiment_model, sarcasm_model
    
    logger.info("Loading models...")
    
    # 加载主情感分析模型
    model_key = os.getenv("MODEL_KEY", "xlm-roberta-base")
    device = os.getenv("DEVICE", None)
    
    try:
        sentiment_model = get_model(model_key, device)
        logger.info(f"Sentiment model loaded: {model_key}")
    except Exception as e:
        logger.error(f"Failed to load sentiment model: {e}")
        raise

    # 加载讽刺检测模型
    try:
        sarcasm_model = SarcasmDetectionModel(device=device)
        logger.info("Sarcasm detection model loaded")
    except Exception as e:
        logger.error(f"Failed to load sarcasm model: {e}")
        # 讽刺检测模型失败不影响主服务
        sarcasm_model = None


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """健康检查端点"""
    return HealthResponse(
        status="healthy" if sentiment_model else "unhealthy",
        models={
            "sentiment": sentiment_model.get_model_info() if sentiment_model else None,
            "sarcasm": sarcasm_model is not None,
        }
    )


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    单条文本情感分析
    
    - **text**: 待分析的文本
    - **language**: 语言代码 (zh/en/auto)
    - **model**: 模型名称
    """
    if not sentiment_model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    
    try:
        result = sentiment_model.predict(request.text)
        return PredictResponse(
            label=result.label,
            confidence=result.confidence,
            scores=result.scores,
            model_name=result.model_name,
            latency_ms=result.latency_ms,
        )
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/fast", response_model=PredictResponse)
async def predict_fast(request: FastPredictRequest):
    """
    快速预测（使用轻量级模型或缓存）
    """
    if not sentiment_model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        result = sentiment_model.predict(request.text)
        # 快速模式稍微降低置信度
        result.confidence *= 0.95
        return PredictResponse(
            label=result.label,
            confidence=result.confidence,
            scores=result.scores,
            model_name=f"{result.model_name}_fast",
            latency_ms=result.latency_ms,
        )
    except Exception as e:
        logger.error(f"Fast prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch", response_model=List[PredictResponse])
async def predict_batch(request: BatchPredictRequest):
    """
    批量文本情感分析
    
    - **texts**: 待分析的文本列表
    - **language**: 语言代码
    - **model**: 模型名称
    """
    if not sentiment_model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if not request.texts:
        raise HTTPException(status_code=400, detail="Empty texts list")
    
    if len(request.texts) > 1000:
        raise HTTPException(status_code=400, detail="Batch size too large (max 1000)")
    
    try:
        results = sentiment_model.predict_batch(request.texts)
        return [
            PredictResponse(
                label=r.label,
                confidence=r.confidence,
                scores=r.scores,
                model_name=r.model_name,
                latency_ms=r.latency_ms,
            )
            for r in results
        ]
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect/sarcasm")
async def detect_sarcasm(request: SarcasmDetectRequest):
    """
    讽刺检测
    
    - **text**: 待分析的文本
    - **language**: 语言代码
    - **context**: 上下文对话历史
    """
    if not sarcasm_model:
        raise HTTPException(status_code=503, detail="Sarcasm model not loaded")
    
    try:
        result = sarcasm_model.predict(request.text, request.language)
        return result
    except Exception as e:
        logger.error(f"Sarcasm detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/models")
async def list_models():
    """列出可用模型"""
    return {
        "available_models": list(MultilingualSentimentModel.MODEL_CONFIGS.keys()),
        "loaded_model": sentiment_model.get_model_info() if sentiment_model else None,
    }


@app.post("/reload")
async def reload_model(model_key: str):
    """
    重新加载模型
    
    - **model_key**: 模型配置键
    """
    global sentiment_model
    
    try:
        from models.transformer_model import clear_models
        clear_models()
        
        sentiment_model = get_model(model_key)
        return {"status": "success", "model": sentiment_model.get_model_info()}
    except Exception as e:
        logger.error(f"Model reload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def main():
    """启动服务"""
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "api_server:app",
        host=host,
        port=port,
        reload=False,
        workers=1,
    )


if __name__ == "__main__":
    main()
