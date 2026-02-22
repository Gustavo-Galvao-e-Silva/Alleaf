import numpy as np
from flask import Flask, request, jsonify
from model.infer import predict_stress

app = Flask(__name__)


def validate_input(data):
    if not data:
        return None, "Invalid request body"

    rr_array = data.get("currentRR")
    user_data = data.get("userData")

    if rr_array is None or user_data is None:
        return None, "Missing currentRR or userData"

    if not isinstance(rr_array, list) or len(rr_array) < 2:
        return None, "currentRR must be a list of at least 2 values"

    required_fields = ["age", "sex", "height", "weight", "smoker", "baselineRR"]
    for field in required_fields:
        if field not in user_data:
            return None, f"userData missing field: {field}"

    if (
        not isinstance(user_data["baselineRR"], list)
        or len(user_data["baselineRR"]) < 2
    ):
        return None, "baselineRR inside userData must be a list of at least 2 values"

    return data, None


@app.route("/heart-data", methods=["POST"])
def predict():
    try:
        data, error_message = validate_input(request.get_json())
        if error_message:
            return jsonify({"error": error_message}), 400

        rr_array = data["currentRR"]
        user_data = data["userData"]
        user_baseline = user_data["baselineRR"]
        user_data["sex"] = "M" if user_data["sex"] == "male" else "F"

        result = predict_stress(rr_array, user_baseline, user_data)

        if result is None:
            return jsonify({"error": "Could not calculate metrics from RR data"}), 400

        return jsonify(
            {
                "status": "success",
                "stress_probability": result["stress_probability"],
                "is_stressed": result["is_stressed"],
            }
        )

    except Exception as e:
        print(e)
        return jsonify({"error": "Prediction processing failed"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
