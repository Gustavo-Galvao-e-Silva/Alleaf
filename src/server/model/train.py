import pickle
import pandas as pd
from typing import Any

from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

INPUT_FILE_PATH = "../data/output/data.csv"
OUTPUT_FILE_NAME = "model.pkl"

TEST_IDS = ["S15", "S16", "S17"]

TARGET_COLUMN = "stress"
ID_COLUMN = "subject_id"


def build_clean_df(file_path: str) -> pd.DataFrame:
    df = pd.read_csv(file_path)
    df = df.dropna()
    return df


def build_test_train_dfs(
    df: pd.DataFrame,
    subject_ids: list[str],
    id_col: str,
    target_col: str,
):

    train_df = df[~df[id_col].isin(subject_ids)]
    test_df = df[df[id_col].isin(subject_ids)]

    X_train = train_df.drop(columns=[id_col, target_col])
    y_train = train_df[target_col]

    X_test = test_df.drop(columns=[id_col, target_col])
    y_test = test_df[target_col]

    return X_train, X_test, y_train, y_test


def train_model(X_train: pd.DataFrame, y_train: pd.Series):

    pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "model",
                LogisticRegression(
                    penalty="l2",
                    C=1.0,
                    class_weight="balanced",
                    max_iter=1000,
                    random_state=42,
                ),
            ),
        ]
    )

    pipeline.fit(X_train, y_train)

    return pipeline


if __name__ == "__main__":

    df = build_clean_df(INPUT_FILE_PATH)

    X_train, X_test, y_train, y_test = build_test_train_dfs(
        df, TEST_IDS, ID_COLUMN, TARGET_COLUMN
    )

    model = train_model(X_train, y_train)

    y_pred = model.predict(X_test)

    print("Accuracy:", accuracy_score(y_test, y_pred))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    # Print coefficients for interpretability
    logistic = model.named_steps["model"]
    feature_names = X_train.columns

    print("\nFeature Coefficients:")
    for feature, coef in zip(feature_names, logistic.coef_[0]):
        print(f"{feature}: {coef:.4f}")

    with open(OUTPUT_FILE_NAME, "wb") as f:
        payload = {
            "model": model,
            "features": feature_names.to_list(),
        }
        pickle.dump(payload, f)

    print("\nModel saved to", OUTPUT_FILE_NAME)
