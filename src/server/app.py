from flask import Flask, request, jsonify
from model.infer import predict_stress

app = Flask(__name__)


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid input"}), 400

        rr_array = data.get("rr_array")
        user_id = data.get("user_id")
        if not (rr_array or user_id):
            return jsonify({"error": "Missing current heart rate array"}), 400

        user_data = data.get("user_data")  # TODO: add proper data getting from user db
        user_baseline = data.get("user_baseline_rr")  # TODO: same as above
        confidence = predict_stress(rr_array, user_baseline, user_data)
        return jsonify({"stress_probability": confidence})
    except Exception:
        return jsonify({"error": "Prediction failed"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
