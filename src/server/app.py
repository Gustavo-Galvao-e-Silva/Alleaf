from flask import Flask, request, jsonify
from model.infer import predict_stress, calculate_metrics_from_rr

app = Flask(__name__)

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        print("Received data for prediction:", data)
        if not data:
            return jsonify({"error": "Invalid input"}), 400

        rr_array = data.get("currentRR")
        user_id = data.get("userId")
        if not (rr_array or user_id):
            return jsonify({"error": "Missing current heart rate array"}), 400

        user_data = data.get("userData")
        user_baseline = (user_data or {}).get("baselineRR")

        # Get stress prediction
        stress_result = predict_stress(rr_array, user_baseline, user_data)
        # Get average heart rate
        metrics = calculate_metrics_from_rr(rr_array)
        mean_hr = metrics["mean_hr"] if metrics else None

        # Combine into one JSON response
        response = {
            "is_stressed": stress_result["is_stressed"] if stress_result else None,
            "stress_probability": stress_result["stress_probability"] if stress_result else None,
            "mean_hr": mean_hr
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
