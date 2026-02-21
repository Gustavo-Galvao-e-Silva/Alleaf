from flask import Flask, request, jsonify
from flask_cors import CORS
from cortex import CortexClient, DistanceMetric, Filter, Field
from embedder import get_embedding

app = Flask(__name__)
CORS(app)

client = CortexClient("localhost:50051")
client.connect()
COLLECTION = "user_journals"

@app.route('/upsert', methods=['POST'])
def upsert():
    data = request.json
    # Logic moved here: convert text to vector
    vector = get_embedding(data['text'])
    
    client.upsert(
        COLLECTION, 
        id=int(data.get('id', time.time())), 
        vector=vector, 
        payload={"text": data['text'], "user_id": data['user_id']}
    )
    client.flush(COLLECTION)
    return jsonify({"success": True})

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    # Logic moved here: convert search query to vector
    vector = get_embedding(data['query'])
    
    user_filter = Filter().must(Field("user_id").eq(data['user_id']))
    results = client.search(COLLECTION, query=vector, filter=user_filter, top_k=5)
    return jsonify([{"text": r.payload['text']} for r in results])

@app.route('/init', methods=['GET'])
def init():
    if not client.has_collection(COLLECTION):
        client.create_collection(name=COLLECTION, dimension=384)
    return jsonify({"status": "ready"})

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

@app.route('/journal/save_chat', methods=['POST'])
def save_chat():
    data = request.json
    # We save the summary of the chat as a new "memory"
    client.upsert(
        COLLECTION,
        id=int(time.time()),
        vector=data['vector'],
        payload={
            "text": data['full_transcript'],
            "user_id": data['user_id'],
            "type": "session_summary" # Distinguished from daily logs
        }
    )
    return jsonify({"success": True})


@app.route('/agent/start', methods=['POST'])
def start_agent():
    data = request.json
    # Run the research node specifically
    initial_state = {"user_id": data['user_id'], "transcript": [], "evidence": []}
    result = app_agent.invoke(initial_state)
    return jsonify(result)

@app.route('/journal/save_session', methods=['POST'])
def save_session():
    """Step 8: Embed the final conversation and save to Actian."""
    data = request.json
    # Here you would use sentence-transformers to embed data['text']
    # Then client.upsert(...)
    return jsonify({"status": "saved"})

if __name__ == '__main__':
    app.run(port=5001)
