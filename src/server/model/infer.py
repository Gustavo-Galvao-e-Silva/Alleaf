import numpy as np
import pandas as pd
import pickle


def clean_rr_array(rr_array):
    """
    Mirror the frontend's two-pass quality filter:

    Pass 1 — physiological bounds (same as the 400–2000 ms gate in handleData):
        discard any interval outside 400–2000 ms (30–150 bpm).

    Pass 2 — artifact rejection (same 30 % running-average rule):
        walk the array and drop any beat whose IBI deviates more than 30 %
        from the exponentially-weighted running average, exactly as the
        frontend does with state.avgIBI = avgIBI * 0.8 + timeSinceLastBeat * 0.2.
    """
    rr = np.array(rr_array, dtype=float)

    # Pass 1: physiological bounds
    rr = rr[(rr >= 400) & (rr <= 2000)]
    if len(rr) < 2:
        return rr

    # Pass 2: artifact rejection with EMA (α = 0.2, same as frontend)
    clean = []
    avg_ibi = 0.0
    for interval in rr:
        if avg_ibi == 0 or abs(interval - avg_ibi) <= avg_ibi * 0.3:
            clean.append(interval)
            avg_ibi = interval if avg_ibi == 0 else avg_ibi * 0.8 + interval * 0.2

    return np.array(clean, dtype=float)


def calculate_metrics_from_rr(rr_array):
    if rr_array is None or len(rr_array) < 2:
        return None

    rr = clean_rr_array(rr_array)
    if len(rr) < 2:
        return None

    hr_array = 60000 / rr
    rr_diff = np.diff(rr)
    print("avg heart rate for 45 seconds:", np.mean(hr_array))

    return {
        "mean_hr": np.mean(hr_array),
        "hr_std": np.std(hr_array, ddof=1),          # sample std, more accurate for short windows
        "hr_min": np.min(hr_array),
        "hr_max": np.max(hr_array),
        "rmssd": np.sqrt(np.mean(rr_diff ** 2)),
        "sdnn": np.std(rr, ddof=1),                   # sample std
        "pnn50": np.sum(np.abs(rr_diff) > 50) / len(rr_diff),  # denominator = number of differences
    }


def predict_stress(
    current_rr_array, baseline_rr_array, user_info, model_path="model/model.pkl"
):
    print("current_rr_array:", current_rr_array)
    print("baseline_rr_array:", baseline_rr_array)
    print("user_info:", user_info)
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
