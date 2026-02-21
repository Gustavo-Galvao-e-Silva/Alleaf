from flask import Flask, request, jsonify
from flask_cors import CORS
from cortex import CortexClient, DistanceMetric, Filter, Field

app = Flask(__name__)
CORS(app)

client = CortexClient("localhost:50051")
client.connect()
COLLECTION = "user_journals"

@app.route('/init', methods=['GET'])
def init():
    if not client.has_collection(COLLECTION):
        client.create_collection(name=COLLECTION, dimension=384)
    return jsonify({"status": "ready"})

@app.route('/upsert', methods=['POST'])
def upsert():
    data = request.json
    client.upsert(COLLECTION, id=data['id'], vector=data['vector'], 
                  payload={"text": data['text'], "user_id": data['user_id']})
    client.flush(COLLECTION)
    return jsonify({"success": True})

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    user_filter = Filter().must(Field("user_id").eq(data['user_id']))
    results = client.search(COLLECTION, query=data['vector'], filter=user_filter, top_k=5, with_payload=True)
    return jsonify([{"text": r.payload['text'], "score": r.score} for r in results])

# bridge.py updates
@app.route('/agent/search', methods=['POST'])
def agent_search():
    data = request.json
    # The Reasoning Agent will send a "query_string" like
    # "Find instances where the user mentions physical panic symptoms"
    query_text = data.get("query")
    user_id = data.get("user_id")

    # For the agent to work, we handle the embedding conversion here
    # Use your existing pipeline or a utility function
    vector = generate_embedding(query_text)

    results = client.search(
        COLLECTION,
        query=vector,
        filter=Filter().must(Field("user_id").eq(user_id)),
        top_k=8
    )
    return jsonify({"logs": [r.payload['text'] for r in results]})

if __name__ == '__main__':
    app.run(port=5001)
