import pickle
import numpy as np
import pandas as pd
import neurokit2 as nk

# -----------------------------
# Configuration
# -----------------------------
FS = 700
WINDOW_SECONDS = 60
WINDOW_SIZE = FS * WINDOW_SECONDS
INPUT_PATH = f"../data/input"
OUTPUT_PATH = f"../data/output"
DEMOGRAPHICS = {
    "S2": {"age": 27, "height": 175, "weight": 80, "gender": "M", "smoker": "N"},
    "S3": {"age": 27, "height": 173, "weight": 69, "gender": "M", "smoker": "N"},
    "S4": {"age": 25, "height": 175, "weight": 90, "gender": "M", "smoker": "N"},
    "S5": {"age": 35, "height": 189, "weight": 80, "gender": "M", "smoker": "N"},
    "S6": {"age": 27, "height": 170, "weight": 66, "gender": "M", "smoker": "Y"},
    "S7": {"age": 28, "height": 184, "weight": 74, "gender": "M", "smoker": "N"},
    "S8": {"age": 27, "height": 172, "weight": 64, "gender": "F", "smoker": "N"},
    "S9": {"age": 26, "height": 181, "weight": 75, "gender": "M", "smoker": "N"},
    "S10": {"age": 28, "height": 178, "weight": 76, "gender": "M", "smoker": "N"},
    "S11": {"age": 26, "height": 171, "weight": 54, "gender": "F", "smoker": "N"},
    "S13": {"age": 28, "height": 181, "weight": 82, "gender": "M", "smoker": "N"},
    "S14": {"age": 27, "height": 180, "weight": 80, "gender": "M", "smoker": "N"},
    "S15": {"age": 28, "height": 186, "weight": 83, "gender": "M", "smoker": "N"},
    "S16": {"age": 24, "height": 184, "weight": 69, "gender": "M", "smoker": "N"},
    "S17": {"age": 29, "height": 165, "weight": 55, "gender": "F", "smoker": "N"},
}


# -----------------------------
# I/O
# -----------------------------
def load_participant(path_to_pkl):
    with open(path_to_pkl, "rb") as f:
        return pickle.load(f, encoding="latin1")


def extract_signals(data):
    ecg = data["signal"]["chest"]["ECG"].flatten()
    labels = data["label"]
    return ecg, labels


def extract_demographics(data):
    height_m = data["height"] / 100
    bmi = data["weight"] / (height_m**2)
    return {
        "age": data["age"],
        "gender": data["gender"],
        "bmi": bmi,
        "smoker": data["smoker"],
    }


# -----------------------------
# Labelling
# -----------------------------
def get_majority_label(label_window):
    unique, counts = np.unique(label_window, return_counts=True)
    return unique[np.argmax(counts)]


def to_binary_label(majority_label, keep=(1, 2)):
    if majority_label not in keep:
        return None
    return 1 if majority_label == 2 else 0


# -----------------------------
# HRV Feature Extraction
# -----------------------------
def extract_hrv_features(ecg_window, fs=FS):
    signals, info = nk.ecg_process(ecg_window, sampling_rate=fs)
    mean_hr = signals["ECG_Rate"].mean()

    rpeaks = info["ECG_R_Peaks"]
    rr_intervals = np.diff(rpeaks) / fs * 1000  # ms

    if len(rr_intervals) < 2:
        return None

    rmssd = np.sqrt(np.mean(np.diff(rr_intervals) ** 2))
    sdnn = np.std(rr_intervals)

    return {
        "mean_hr": mean_hr,
        "rmssd_60s": rmssd,
        "sdnn_60s": sdnn,
    }


# -----------------------------
# Windowing
# -----------------------------
def generate_windows(ecg, labels, window_size=WINDOW_SIZE):
    n_samples = len(ecg)
    for start in range(0, n_samples - window_size, window_size):
        end = start + window_size
        yield ecg[start:end], labels[start:end]


def process_window(ecg_window, label_window):
    majority_label = get_majority_label(label_window)
    binary_label = to_binary_label(majority_label)
    if binary_label is None:
        return None

    try:
        features = extract_hrv_features(ecg_window)
    except Exception:
        return None

    if features is None:
        return None

    return {**features, "stress": binary_label}


# -----------------------------
# Main pipeline
# -----------------------------
def create_windows_df(path_to_pkl, subject_id):
    data = load_participant(f"{path_to_pkl}/{subject_id}/{subject_id}.pkl")
    ecg, labels = extract_signals(data)
    demographics = extract_demographics(DEMOGRAPHICS[subject_id])

    rows = []
    for ecg_window, label_window in generate_windows(ecg, labels):
        row = process_window(ecg_window, label_window)
        if row is not None:
            rows.append({**row, **demographics})

    return pd.DataFrame(rows)


# -----------------------------
# Example usage
# -----------------------------
if __name__ == "__main__":
    df_list = [
        create_windows_df(INPUT_PATH, subject_id) for subject_id in DEMOGRAPHICS.keys()
    ]
    df = pd.concat(df_list)
    df.to_csv(f"{OUTPUT_PATH}/data.csv")
