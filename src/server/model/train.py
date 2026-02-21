import pickle
from typing import Any
import pandas as pd
from xgboost import XGBClassifier, plot_importance
from sklearn.metrics import accuracy_score, classification_report

INPUT_FILE_PATH = f"../data/output/data.csv"
OUTPUT_FILE_NAME = "model.pkl"
TEST_IDS = ["S15", "S16", "S17"]
TARGET_COLUMN = "stress"
ID_COLUMN = "subject_id"


def build_clean_df(file_path: str) -> pd.DataFrame:
    df = pd.read_csv(file_path, index_col=0)
    df["smoker"] = (df["smoker"] == "Y").astype(int)
    df["male"] = (df["gender"] == "M").astype(int)
    return df.drop(columns="gender")


def build_test_train_dfs(
    df: pd.DataFrame, subject_ids: list[str], id_col: str, target_col: str
) -> tuple[Any, ...]:
    train_df = df[~df["subject_id"].isin(subject_ids)]
    test_df = df[df["subject_id"].isin(subject_ids)]
    X_train = train_df.drop(columns=[id_col, target_col])
    y_train = train_df[target_col]
    X_test = test_df.drop(columns=[id_col, target_col])
    y_test = test_df[target_col]
    return X_train, X_test, y_train, y_test


def train_model(
    X_train: pd.DataFrame, y_train: pd.Series, hyper_params: dict[str, Any]
) -> XGBClassifier:
    model = XGBClassifier(**hyper_params)
    model.fit(X_train, y_train)
    return model


if __name__ == "__main__":
    df = build_clean_df(INPUT_FILE_PATH)
    X_train, X_test, y_train, y_test = build_test_train_dfs(
        df, TEST_IDS, ID_COLUMN, TARGET_COLUMN
    )
    hyper_params = {
        "n_estimators": 100,
        "max_depth": 6,
        "learning_rate": 0.1,
        "random_state": 42,
    }
    model = train_model(X_train, y_train, hyper_params)
    y_pred = model.predict(X_test)
    print(accuracy_score(y_test, y_pred))
    print(classification_report(y_test, y_pred))
    for feature, importance in zip(X_train.columns, model.feature_importances_):
        print(f"{feature}: {importance:.4f}")
    with open(OUTPUT_FILE_NAME, "wb") as f:
        feature_cols = X_train.columns.to_list()
        payload = {"model": model, "features": feature_cols}
        pickle.dump(payload, f)
