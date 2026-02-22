import time
from flask import Flask, request, jsonify
from flask_cors import CORS

# 1. Critical Imports
from cortex import Filter, Field
from embedder import get_embedding
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
import db # Shared source of truth

app = Flask(__name__)
CORS(app)

# 2. Helper to prevent circular import crashes
def get_agent_nodes():
    from agents import research_node, therapist_node, wrap_up_node
    return research_node, therapist_node, wrap_up_node

# --- JOURNAL ROUTES ---

@app.route('/upsert', methods=['POST'])
def upsert():
    try:
        data = request.json
        vector = get_embedding(data['text'])
        entry_id = int(data.get('id', time.time()))
        db.client.upsert(
            db.COLLECTION,
            id=entry_id,
            vector=vector,
            payload={
                "text": data['text'],
                "user_id": data['user_id'],
                "type": "journal_entry"
            }
        )
        db.client.flush(db.COLLECTION)
        return jsonify({"success": True, "id": entry_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/search', methods=['POST'])
def search():
    try:
        data = request.json
        vector = get_embedding(data['query'])
        # Correctly using imported Filter and Field
        user_filter = Filter().must(Field("user_id").eq(data['user_id']))
        results = db.client.search(db.COLLECTION, query=vector, filter=user_filter, top_k=5, with_payload=True)
        return jsonify([{"text": r.payload['text']} for r in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/journal/save_chat', methods=['POST'])
def save_chat():
    try:
        data = request.json
        db.client.upsert(
            db.COLLECTION,
            id=int(time.time()),
            vector=data['vector'],
            payload={
                "text": data['full_transcript'],
                "user_id": data['user_id'],
                "type": "session_summary"
            }
        )
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- AGENT ROUTES ---

@app.route('/agent/start', methods=['POST'])
def start_agent():
    research_node, _, _ = get_agent_nodes()
    data = request.json
    # Inject user_notes into the initial state
    state = {
        "user_id": data.get('user_id'), 
        "session_id": str(int(time.time())), # Add a timestamp-based ID
        "user_notes": data.get('user_notes', ""), 
        "transcript": [], 
        "evidence": []
    }
    result = research_node(state)
    return jsonify({
        "food_for_thought": result['food_for_thought'], 
        "evidence": result['evidence'],
        "agenda": result['agenda'] # Send the generated agenda back to Next.js
    })

@app.route('/agent/run_session', methods=['POST'])
def run_session():
    _, therapist_node, _ = get_agent_nodes()
    data = request.json
    raw_transcript = data.get('transcript', [])

    history = [HumanMessage(content=m['content']) if m['role'] == 'user' else AIMessage(content=m['content']) for m in raw_transcript]
    history.append(HumanMessage(content=data.get('message')))

    state = {"user_id": data.get('user_id'), "transcript": history, "evidence": data.get('evidence', []), "agenda": data.get('agenda'),
        "session_id": data.get('session_id', 'active_session') }
    result = therapist_node(state)

    # Cleanest possible response - agents.py did the hard work
    return jsonify({
        "therapy_response": result['transcript'][-1].content,
        "full_transcript": [
            {"role": "user" if isinstance(m, HumanMessage) else "assistant", "content": m.content}
            for m in result['transcript']
        ]
    })

@app.route('/agent/end_session', methods=['POST'])
def end_session():
    _, _, wrap_up_node = get_agent_nodes()
    data = request.json
    raw_transcript = data.get('transcript', [])
    history = [HumanMessage(content=m['content']) if m['role'] == 'user' else AIMessage(content=m['content']) for m in raw_transcript]

    state = {"user_id": data.get('user_id'), "transcript": history, "evidence": data.get('evidence', []), "agenda": data.get('agenda')}
    result = wrap_up_node(state)

    # --- THE FIX: Actually save to Actian ---
    summary_text = result.get('summary', "Session ended.")
    vector = get_embedding(summary_text)

    # --- THE FIX: Wrap the upsert in a retry/reconnect block ---
    try:
        db.ensure_connected() # Make sure we weren't kicked out during the stream
        db.client.upsert(
            db.COLLECTION,
            id=int(time.time()),
            vector=vector,
            payload={
                "text": summary_text,
                "user_id": data.get('user_id'),
                "type": "session_summary"
            }
        )
        db.client.flush(db.COLLECTION)
    except Exception as e:
        print(f"Upsert failed after stream: {e}. Retrying once...")
        db.client.connect() # Force a hard reconnect
        db.client.upsert(db.COLLECTION, id=int(time.time()), vector=vector, payload={"text": summary_text, "user_id": data.get('user_id'), "type": "session_summary"})

    return jsonify({"exercises": result['exercises']})

@app.route('/init', methods=['GET'])
def init():
    should_reset = request.args.get('reset', 'false').lower() == 'true'

    if should_reset:
        db.reset_db()
        return jsonify({"status": "database_wiped_and_restarted"})

    db.init_db()
    return jsonify({"status": "ready"})

from flask import Response
# At the top of bridge.py, update this line:

# ... (keep existing routes) ...

@app.route('/agent/chat_stream', methods=['POST'])
def chat_stream():
    # Critical: Import these inside the function to avoid circular imports
    from agents import llm, ensure_text
    
    try:
        data = request.json
        raw_transcript = data.get('transcript', [])
        history = [
            HumanMessage(content=m['content']) if m['role'] == 'user' 
            else AIMessage(content=m['content']) 
            for m in raw_transcript
        ]
        history.append(HumanMessage(content=data.get('message')))

        # Get evidence context from the frontend session
        evidence_list = data.get('evidence', [])
        evidence_str = "\n".join(evidence_list) if evidence_list else "No previous context."
        user_id = data.get('user_id', 'unknown')
        agenda = data.get('agenda', "Provide general emotional support.") #

        def generate():
            system_prompt = f"""
            You are a professional AI therapist.
            User ID: {user_id}

            SESSION AGENDA:
            {agenda}

            CONTEXT: {evidence_str}
            """
            messages = [SystemMessage(content=system_prompt)] + history
            
            # Use the .stream method for real-time tokens
            for chunk in llm.stream(messages):
                content = ensure_text(chunk.content)
                if content:
                    yield content

        return Response(generate(), mimetype='text/event-stream')
    except Exception as e:
        print(f"Streaming Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    db.init_db() # Ensure collection is created on startup
    app.run(port=5001, debug=True)
