import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from cortex import CortexClient, DistanceMetric, Filter, Field
from embedder import get_embedding # Make sure embedder.py exists in the same folder
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

app = Flask(__name__)
CORS(app)

client = CortexClient("localhost:50051")
client.connect()
COLLECTION = "user_journals"

@app.route('/upsert', methods=['POST'])
def upsert():
    try:
        data = request.json
        # 1. Always generate the vector on the backend
        vector = get_embedding(data['text'])

        # 2. Force ID to integer (critical for Actian)
        entry_id = int(data.get('id', time.time()))

        client.upsert(
            COLLECTION,
            id=entry_id,
            vector=vector,
            payload={
                "text": data['text'],
                "user_id": data['user_id'],
                "type": "journal_entry"
            }
        )
        client.flush(COLLECTION)
        return jsonify({"success": True, "id": entry_id})
    except Exception as e:
        print(f"UPSERT ERROR: {e}") # This will show up in your bridge terminal
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/search', methods=['POST'])
def search():
    try:
        data = request.json
        # Generate vector for the query string
        vector = get_embedding(data['query'])
        
        user_filter = Filter().must(Field("user_id").eq(data['user_id']))
        results = client.search(COLLECTION, query=vector, filter=user_filter, top_k=5, with_payload=True)
        
        return jsonify([{"text": r.payload['text']} for r in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    vector = get_embedding(query_text) #

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

from graph import app_agent # Import the compiled LangGraph

@app.route('/journal/save_session', methods=['POST'])
def save_session():
    """Step 8: Embed the final conversation and save to Actian."""
    data = request.json
    # Here you would use sentence-transformers to embed data['text']
    # Then client.upsert(...)
    return jsonify({"status": "saved"})

@app.route('/agent/start', methods=['POST'])
def start_agent():
    try:
        data = request.json
        user_id = data.get('userId') # Next.js sends 'userId'

        # Initialize fresh state for Steps 2-4
        state = {
            "user_id": user_id,
            "session_id": str(int(time.time())),
            "transcript": [],
            "evidence": [],
            "food_for_thought": "",
            "exercises": []
        }

        # This triggers the research_node in your graph
        from agents import research_node
        result = research_node(state)

        return jsonify({
            "food_for_thought": result['food_for_thought'],
            "evidence": result['evidence'] # Step 3 evidence
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/agent/run_session', methods=['POST'])
def run_session():
    try:
        data = request.json
        # The frontend needs to send the full transcript and evidence back
        state = {
            "user_id": data.get('user_id'),
            "transcript": [HumanMessage(content=m['content']) if m['role'] == 'user' else AIMessage(content=m['content']) for m in data.get('transcript', [])],
            "evidence": data.get('evidence', []),
            "exercises": []
        }

        # Add the newest message
        state['transcript'].append(HumanMessage(content=data.get('message')))

        from agents import therapist_node
        result = therapist_node(state)

        return jsonify({
            "therapy_response": result['transcript'][-1].content,
            "full_transcript": [{"role": "user" if isinstance(m, HumanMessage) else "assistant", "content": m.content} for m in result['transcript']]
        })

@app.route('/journal/save_session', methods=['POST'])
def save_session():
    try:
        data = request.json
        full_text = data.get('text')
        user_id = data.get('user_id')

        vector = get_embedding(full_text)

        client.upsert(
            COLLECTION,
            id=int(time.time()),
            vector=vector,
            payload={
                "text": f"Session Summary: {full_text}",
                "user_id": user_id,
                "type": "session_memory"
            }
        )
        client.flush(COLLECTION)
        return jsonify({"status": "saved"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/agent/end_session', methods=['POST'])
def end_session():
    try:
        data = request.json
        state = {
            "user_id": data.get('user_id'),
            "transcript": [HumanMessage(content=m['content']) if m['role'] == 'user' else AIMessage(content=m['content']) for m in data.get('transcript', [])],
            "evidence": data.get('evidence', []),
            "exercises": []
        }

        # We manually trigger the wrap_up_node logic
        from agents import wrap_up_node
        result = wrap_up_node(state)

        return jsonify({
            "exercises": result['exercises'],
            "status": "completed"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001)
