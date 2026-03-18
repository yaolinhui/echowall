"""
领域适配训练脚本
针对技术产品评论进行模型微调
"""

import os
import json
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
    DataCollatorWithPadding,
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
import numpy as np
from typing import List, Dict, Tuple, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TechReviewDataset(Dataset):
    """技术产品评论数据集"""

    LABEL_MAP = {
        "negative": 0,
        "neutral": 1,
        "positive": 2,
    }

    def __init__(
        self,
        texts: List[str],
        labels: List[str],
        tokenizer,
        max_length: int = 512,
    ):
        self.texts = texts
        self.labels = [self.LABEL_MAP.get(l, 1) for l in labels]
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = self.labels[idx]

        encoding = self.tokenizer(
            text,
            max_length=self.max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

        return {
            "input_ids": encoding["input_ids"].flatten(),
            "attention_mask": encoding["attention_mask"].flatten(),
            "labels": torch.tensor(label, dtype=torch.long),
        }


class DomainAdaptationTrainer:
    """
    领域适配训练器
    支持增量学习和全量微调
    """

    def __init__(
        self,
        base_model_name: str = "xlm-roberta-base",
        num_labels: int = 3,
        device: Optional[str] = None,
    ):
        self.base_model_name = base_model_name
        self.num_labels = num_labels
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        logger.info(f"Initializing trainer with model: {base_model_name}")
        logger.info(f"Using device: {self.device}")

        self.tokenizer = AutoTokenizer.from_pretrained(base_model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            base_model_name,
            num_labels=num_labels,
            ignore_mismatched_sizes=True,
        ).to(self.device)

    def prepare_data(
        self,
        data_path: str,
        test_size: float = 0.2,
        val_size: float = 0.1,
    ) -> Tuple[TechReviewDataset, TechReviewDataset, TechReviewDataset]:
        """
        准备数据集

        Args:
            data_path: JSONL 文件路径，每行包含 {"text": "...", "label": "positive/neutral/negative"}
            test_size: 测试集比例
            val_size: 验证集比例
        """
        # 加载数据
        texts = []
        labels = []

        with open(data_path, "r", encoding="utf-8") as f:
            for line in f:
                item = json.loads(line.strip())
                texts.append(item["text"])
                labels.append(item["label"])

        logger.info(f"Loaded {len(texts)} samples")

        # 划分数据集
        train_texts, temp_texts, train_labels, temp_labels = train_test_split(
            texts, labels, test_size=test_size + val_size, random_state=42, stratify=labels
        )

        val_ratio = val_size / (test_size + val_size)
        val_texts, test_texts, val_labels, test_labels = train_test_split(
            temp_texts, temp_labels, test_size=1 - val_ratio, random_state=42, stratify=temp_labels
        )

        # 创建数据集
        train_dataset = TechReviewDataset(train_texts, train_labels, self.tokenizer)
        val_dataset = TechReviewDataset(val_texts, val_labels, self.tokenizer)
        test_dataset = TechReviewDataset(test_texts, test_labels, self.tokenizer)

        logger.info(
            f"Data split: train={len(train_dataset)}, "
            f"val={len(val_dataset)}, test={len(test_dataset)}"
        )

        return train_dataset, val_dataset, test_dataset

    def compute_metrics(self, eval_pred) -> Dict:
        """计算评估指标"""
        predictions, labels = eval_pred
        predictions = np.argmax(predictions, axis=1)

        accuracy = accuracy_score(labels, predictions)
        precision, recall, f1, _ = precision_recall_fscore_support(
            labels, predictions, average="weighted", zero_division=0
        )

        return {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1": f1,
        }

    def train(
        self,
        train_dataset: TechReviewDataset,
        val_dataset: TechReviewDataset,
        output_dir: str = "./results",
        num_epochs: int = 3,
        batch_size: int = 16,
        learning_rate: float = 2e-5,
        warmup_ratio: float = 0.1,
        weight_decay: float = 0.01,
        early_stopping_patience: int = 3,
        use_focal_loss: bool = False,
    ):
        """
        训练模型

        Args:
            train_dataset: 训练数据集
            val_dataset: 验证数据集
            output_dir: 输出目录
            num_epochs: 训练轮数
            batch_size: 批次大小
            learning_rate: 学习率
            warmup_ratio: 预热比例
            weight_decay: 权重衰减
            early_stopping_patience: 早停耐心值
            use_focal_loss: 是否使用 Focal Loss（处理类别不平衡）
        """
        # 训练参数
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=batch_size * 2,
            learning_rate=learning_rate,
            weight_decay=weight_decay,
            warmup_ratio=warmup_ratio,
            logging_dir=f"{output_dir}/logs",
            logging_steps=10,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="f1",
            greater_is_better=True,
            report_to=["tensorboard"],
            fp16=torch.cuda.is_available(),
            dataloader_num_workers=4,
        )

        # 数据整理器
        data_collator = DataCollatorWithPadding(tokenizer=self.tokenizer)

        # 训练器
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            tokenizer=self.tokenizer,
            data_collator=data_collator,
            compute_metrics=self.compute_metrics,
            callbacks=[EarlyStoppingCallback(early_stopping_patience=early_stopping_patience)],
        )

        # 训练
        logger.info("Starting training...")
        trainer.train()

        # 保存模型
        trainer.save_model(f"{output_dir}/best_model")
        self.tokenizer.save_pretrained(f"{output_dir}/best_model")

        logger.info(f"Model saved to {output_dir}/best_model")

        return trainer

    def evaluate(self, test_dataset: TechReviewDataset) -> Dict:
        """评估模型"""
        from torch.utils.data import DataLoader

        self.model.eval()
        dataloader = DataLoader(test_dataset, batch_size=32, shuffle=False)

        all_preds = []
        all_labels = []

        with torch.no_grad():
            for batch in dataloader:
                input_ids = batch["input_ids"].to(self.device)
                attention_mask = batch["attention_mask"].to(self.device)
                labels = batch["labels"].to(self.device)

                outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
                predictions = torch.argmax(outputs.logits, dim=-1)

                all_preds.extend(predictions.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())

        accuracy = accuracy_score(all_labels, all_preds)
        precision, recall, f1, _ = precision_recall_fscore_support(
            all_labels, all_preds, average="weighted"
        )

        # 每类指标
        class_precision, class_recall, class_f1, _ = precision_recall_fscore_support(
            all_labels, all_preds, average=None
        )

        results = {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "per_class": {
                "negative": {
                    "precision": class_precision[0],
                    "recall": class_recall[0],
                    "f1": class_f1[0],
                },
                "neutral": {
                    "precision": class_precision[1],
                    "recall": class_recall[1],
                    "f1": class_f1[1],
                },
                "positive": {
                    "precision": class_precision[2],
                    "recall": class_recall[2],
                    "f1": class_f2[2],
                },
            },
        }

        logger.info(f"Evaluation results: {results}")
        return results


def create_sample_data(output_path: str, num_samples: int = 1000):
    """
    创建示例训练数据
    实际项目中应从真实来源获取数据
    """
    import random

    # 技术产品评论模板
    templates = {
        "positive": [
            "这个{product}的{feature}真的很{adj}，用起来很顺畅！",
            "{product}的{feature}让我很满意，强烈推荐！",
            "用了{product}之后，工作效率提升了不少，{feature}特别实用。",
            "{product}的{feature}做得非常好，体验很棒。",
            "对{product}的{feature}非常满意，{adj}！",
        ],
        "neutral": [
            "{product}的{feature}一般般，没有什么特别的。",
            "用了{product}，{feature}还可以吧。",
            "{product}的{feature}符合预期，正常水平。",
            "对{product}的{feature}没什么感觉，就那样。",
            "{product}的{feature}中规中矩。",
        ],
        "negative": [
            "{product}的{feature}太{adj}了，用起来很不爽。",
            "对{product}的{feature}很失望，经常出现{problem}。",
            "{product}的{feature}做得不好，体验很差。",
            "{product}的{feature}让人头疼，{problem}太多了。",
            "不推荐{product}，{feature}太{adj}了。",
        ],
    }

    products = ["APP", "软件", "系统", "工具", "平台", "客户端"]
    features = ["界面", "功能", "性能", "稳定性", "响应速度", "用户体验", "API", "文档"]
    adjectives = {
        "positive": ["棒", "优秀", "出色", "流畅", "便捷"],
        "negative": ["差", "烂", "慢", "卡", "难用"],
    }
    problems = ["崩溃", "卡顿", "延迟", "bug", "兼容性问题"]

    data = []
    for _ in range(num_samples):
        label = random.choice(["positive", "neutral", "negative"])
        template = random.choice(templates[label])

        text = template.format(
            product=random.choice(products),
            feature=random.choice(features),
            adj=random.choice(adjectives.get(label, ["一般"])),
            problem=random.choice(problems) if "{problem}" in template else "",
        )

        data.append({"text": text, "label": label})

    # 保存
    with open(output_path, "w", encoding="utf-8") as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    logger.info(f"Created {num_samples} sample data at {output_path}")


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description="Domain Adaptation Training")
    parser.add_argument("--data", type=str, required=True, help="训练数据路径")
    parser.add_argument("--output", type=str, default="./output", help="输出目录")
    parser.add_argument("--model", type=str, default="xlm-roberta-base", help="基础模型")
    parser.add_argument("--epochs", type=int, default=3, help="训练轮数")
    parser.add_argument("--batch-size", type=int, default=16, help="批次大小")
    parser.add_argument("--lr", type=float, default=2e-5, help="学习率")
    parser.add_argument("--create-sample", action="store_true", help="创建示例数据")

    args = parser.parse_args()

    # 创建示例数据
    if args.create_sample:
        create_sample_data(args.data, num_samples=1000)
        return

    # 训练
    trainer = DomainAdaptationTrainer(base_model_name=args.model)
    
    train_dataset, val_dataset, test_dataset = trainer.prepare_data(args.data)
    
    trainer.train(
        train_dataset=train_dataset,
        val_dataset=val_dataset,
        output_dir=args.output,
        num_epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
    )

    # 评估
    results = trainer.evaluate(test_dataset)
    print("\nFinal Results:")
    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
