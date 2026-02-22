import numpy as np
import pandas as pd
import pickle


def calculate_metrics_from_rr(rr_array):
    rr_array = np.array(rr_array)
    if len(rr_array) < 2:
        return None

    hr_array = 60000 / rr_array
    rr_diff = np.diff(rr_array)

    return {
        "mean_hr": np.mean(hr_array),
        "hr_std": np.std(hr_array),
        "hr_min": np.min(hr_array),
        "hr_max": np.max(hr_array),
        "rmssd": np.sqrt(np.mean(rr_diff**2)),
        "sdnn": np.std(rr_array),
        "pnn50": np.sum(np.abs(rr_diff) > 50) / len(rr_array),
    }


def predict_stress(
    current_rr_array, baseline_rr_array, user_info, model_path="model/model.pkl"
):
    current_metrics = calculate_metrics_from_rr(current_rr_array)
    baseline_metrics = calculate_metrics_from_rr(baseline_rr_array)

    if current_metrics is None or baseline_metrics is None:
        return None

    with open(model_path, "rb") as f:
        payload = pickle.load(f)
        model = payload["model"]
        feature_order = payload["features"]

    bmi = user_info["weight"] / ((user_info["height"] / 100) ** 2)
    male_val = 1 if user_info["sex"] == "M" else 0
    smoker_val = 1 if user_info["smoker"] == "Y" else 0

    hr_delta = current_metrics["mean_hr"] - baseline_metrics["mean_hr"]
    rmssd_delta = current_metrics["rmssd"] - baseline_metrics["rmssd"]

    input_data = {
        **current_metrics,
        "hr_delta": hr_delta,
        "rmssd_delta": rmssd_delta,
        "age": user_info["age"],
        "male": male_val,
        "bmi": bmi,
        "smoker": smoker_val,
        "hr_delta_x_age": hr_delta * user_info["age"],
        "rmssd_delta_x_gender": rmssd_delta * male_val,
    }

    df = pd.DataFrame([input_data])[feature_order]

    prob = model.predict_proba(df)[0][1]
    prediction = model.predict(df)[0]

    return {"stress_probability": float(prob), "is_stressed": int(prediction)}
