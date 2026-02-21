import pickle
from typing import Any
from pandas import DataFrame

MODEL_FILE_PATH = f"./model.pkl"


def infer_stress_confidence(data: dict[str, Any]) -> float:
    with open(MODEL_FILE_PATH, "rb") as f:
        payload = pickle.load(f)
        model = payload["model"]
        features = payload["features"]
        df = DataFrame([data])[features]
        return model.predict_proba(df)[0][1]
