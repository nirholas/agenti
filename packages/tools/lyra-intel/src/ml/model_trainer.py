"""
Model training for code analysis ML models.
"""

import json
import pickle
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4


class ModelType(Enum):
    CLASSIFIER = "classifier"
    REGRESSOR = "regressor"
    CLUSTERING = "clustering"
    EMBEDDING = "embedding"


@dataclass
class TrainingConfig:
    model_type: ModelType = ModelType.CLASSIFIER
    epochs: int = 100
    batch_size: int = 32
    learning_rate: float = 0.001
    validation_split: float = 0.2
    early_stopping: bool = True
    patience: int = 10
    model_path: str = "./models"


@dataclass
class TrainingMetrics:
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    loss: float = 0.0
    val_accuracy: float = 0.0
    val_loss: float = 0.0


@dataclass
class TrainedModel:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    model_type: ModelType = ModelType.CLASSIFIER
    version: str = "1.0.0"
    metrics: TrainingMetrics = field(default_factory=TrainingMetrics)
    created_at: datetime = field(default_factory=datetime.utcnow)
    config: dict = field(default_factory=dict)
    weights: Optional[Any] = None


class ModelTrainer:
    def __init__(self, config: Optional[TrainingConfig] = None):
        self.config = config or TrainingConfig()
        self.models: dict[str, TrainedModel] = {}
        self.training_history: list[dict] = []

    def train(
        self,
        name: str,
        X: list[list[float]],
        y: list[Any],
        model_type: Optional[ModelType] = None,
    ) -> TrainedModel:
        model_type = model_type or self.config.model_type

        # Split data
        split_idx = int(len(X) * (1 - self.config.validation_split))
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]

        # Simulate training (in production, use sklearn/pytorch/tensorflow)
        metrics = self._simulate_training(X_train, y_train, X_val, y_val, model_type)

        model = TrainedModel(
            name=name,
            model_type=model_type,
            metrics=metrics,
            config={
                "epochs": self.config.epochs,
                "batch_size": self.config.batch_size,
                "learning_rate": self.config.learning_rate,
            },
            weights={"trained": True, "samples": len(X_train)},
        )

        self.models[model.id] = model
        self.training_history.append({
            "model_id": model.id,
            "name": name,
            "metrics": metrics.__dict__,
            "timestamp": datetime.utcnow().isoformat(),
        })

        return model

    def _simulate_training(
        self,
        X_train: list,
        y_train: list,
        X_val: list,
        y_val: list,
        model_type: ModelType,
    ) -> TrainingMetrics:
        # Simulated training metrics
        import random
        base_acc = 0.7 + random.random() * 0.25
        return TrainingMetrics(
            accuracy=base_acc,
            precision=base_acc - random.random() * 0.05,
            recall=base_acc - random.random() * 0.05,
            f1_score=base_acc - random.random() * 0.03,
            loss=1.0 - base_acc + random.random() * 0.1,
            val_accuracy=base_acc - random.random() * 0.05,
            val_loss=1.0 - base_acc + random.random() * 0.15,
        )

    def predict(self, model_id: str, X: list[list[float]]) -> list[Any]:
        model = self.models.get(model_id)
        if not model:
            raise ValueError(f"Model not found: {model_id}")

        # Simulated prediction
        if model.model_type == ModelType.CLASSIFIER:
            return [1 if sum(x) > len(x) * 5 else 0 for x in X]
        elif model.model_type == ModelType.REGRESSOR:
            return [sum(x) / len(x) for x in X]
        else:
            return [0] * len(X)

    def save_model(self, model_id: str, path: Optional[str] = None) -> str:
        model = self.models.get(model_id)
        if not model:
            raise ValueError(f"Model not found: {model_id}")

        save_path = Path(path or self.config.model_path)
        save_path.mkdir(parents=True, exist_ok=True)

        model_file = save_path / f"{model.name}_{model.id}.pkl"
        with open(model_file, "wb") as f:
            pickle.dump(model, f)

        meta_file = save_path / f"{model.name}_{model.id}.json"
        with open(meta_file, "w") as f:
            json.dump({
                "id": model.id,
                "name": model.name,
                "type": model.model_type.value,
                "version": model.version,
                "metrics": model.metrics.__dict__,
                "config": model.config,
                "created_at": model.created_at.isoformat(),
            }, f, indent=2)

        return str(model_file)

    def load_model(self, path: str) -> TrainedModel:
        with open(path, "rb") as f:
            model = pickle.load(f)
        self.models[model.id] = model
        return model

    def get_model(self, model_id: str) -> Optional[TrainedModel]:
        return self.models.get(model_id)

    def list_models(self) -> list[TrainedModel]:
        return list(self.models.values())

    def delete_model(self, model_id: str) -> bool:
        if model_id in self.models:
            del self.models[model_id]
            return True
        return False

    def get_training_history(self) -> list[dict]:
        return self.training_history

    def compare_models(self, model_ids: list[str]) -> dict:
        comparison = {}
        for mid in model_ids:
            model = self.models.get(mid)
            if model:
                comparison[mid] = {
                    "name": model.name,
                    "accuracy": model.metrics.accuracy,
                    "f1_score": model.metrics.f1_score,
                    "val_accuracy": model.metrics.val_accuracy,
                }
        return comparison
