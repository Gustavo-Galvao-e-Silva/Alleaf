import pickle
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

INPUT_FILE = "../data/output/data.csv"
MODEL_FILE = "model.pkl"
TEST_IDS = ["S15", "S16", "S17"]


def train():
    df = pd.read_csv(INPUT_FILE).dropna()

    train_df = df[~df["subject_id"].isin(TEST_IDS)]
    test_df = df[df["subject_id"].isin(TEST_IDS)]

    X_train = train_df.drop(columns=["subject_id", "stress"])
    y_train = train_df["stress"]
    X_test = test_df.drop(columns=["subject_id", "stress"])
    y_test = test_df["stress"]

    pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "model",
                LogisticRegression(
                    class_weight="balanced", random_state=42, max_iter=1000
                ),
            ),
        ]
    )

    pipeline.fit(X_train, y_train)

    print(classification_report(y_test, pipeline.predict(X_test)))

    with open(MODEL_FILE, "wb") as f:
        pickle.dump({"model": pipeline, "features": X_train.columns.tolist()}, f)


if __name__ == "__main__":
    train()
