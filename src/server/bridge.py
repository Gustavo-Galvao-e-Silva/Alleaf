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
    try:
        data = request.json
        raw_transcript = data.get('transcript', [])
        user_id = data.get('user_id') or data.get('userId') # Handle both naming styles

        print(f"DEBUG: First message structure: {raw_transcript[0] if raw_transcript else 'EMPTY'}")

        # --- SAFE PARSING START ---
        history = []
        for m in raw_transcript:
            if isinstance(m, str): continue # Skip if it's accidentally a raw string
            
            raw_content = m.get('content', "")
            # Flatten the Assistant UI part list if necessary
            if isinstance(raw_content, list):
                text = " ".join([part.get('text', '') for part in raw_content if part.get('type') == 'text'])
            else:
                text = str(raw_content)

            if not text.strip(): continue

            if m.get('role') == 'user':
                history.append(HumanMessage(content=text))
            else:
                history.append(AIMessage(content=text))
        # --- SAFE PARSING END ---

        state = {
            "user_id": user_id, 
            "transcript": history, 
            "evidence": data.get('evidence', []), 
            "agenda": data.get('agenda')
        }
        
        # 1. Run the clinical wrap-up (LangChain)
        result = wrap_up_node(state)

        # 2. Save the session recap to Actian Vector DB
        summary_text = result.get('summary', "Session ended.")
        vector = get_embedding(summary_text)

        try:
            db.ensure_connected()
            db.client.upsert(
                db.COLLECTION,
                id=int(time.time()),
                vector=vector,
                payload={
                    "text": summary_text,
                    "user_id": user_id,
                    "type": "session_summary"
                }
            )
            db.client.flush(db.COLLECTION)
        except Exception as upsert_error:
            print(f"Vector DB sync failed: {upsert_error}")

        # 3. Send exercises back to Next.js to be saved to Firestore
        return jsonify({"exercises": result['exercises']})

    except Exception as e:
        print(f"End Session Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

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

def get_reply_from_agent(user_id, message, transcript, notes, agenda_from_front=""):
    research_node, therapist_node, _ = get_agent_nodes()
    
    # 1. ROBUST TRANSCRIPT PARSING
    history = []
    for m in transcript:
        # The Assistant UI often sends content as a list: [{"type": "text", "text": "..."}]
        raw_content = m.get('content', "")
        
        if isinstance(raw_content, list):
            # Extract and join all text parts
            text = " ".join([part.get('text', '') for part in raw_content if part.get('type') == 'text'])
        else:
            text = str(raw_content)

        # Clean up the text
        text = text.strip()

        # Skip if this is the message we are currently processing to avoid duplication
        if text == message or not text:
            continue
            
        if m.get('role') == 'user':
            history.append(HumanMessage(content=text))
        else:
            history.append(AIMessage(content=text))
    
    if agenda_from_front:
        agenda = agenda_from_front
    elif not history:
        initial_state = { "user_id": user_id, "user_notes": notes, "transcript": [], "evidence": [] }
        res = research_node(initial_state)
        agenda = res.get('agenda', "Provide empathetic support.")
        evidence = res.get('evidence', [])
    else:
        agenda = "Continue the existing therapy session."
        evidence = []

    # 3. GET RESPONSE
    state = {
        "user_id": user_id,
        "transcript": history + [HumanMessage(content=message)],
        "agenda": agenda,
        "evidence": evidence,
        "session_id": "active_session"
    }
    
    result = therapist_node(state)
    return result['transcript'][-1].content

# --- THE ROUTE ---
@app.route('/chat', methods=['POST'])
def handle_chat():
    try:
        data = request.json
        # Use our refined helper
        reply = get_reply_from_agent(
            data.get('user_id'), 
            data.get('message'), 
            data.get('transcript', []), 
            data.get('notes', ""),
            data.get('agenda', "")
        )
        return jsonify({"reply": reply})
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/therapy/end', methods=['POST'])
def handle_end():
    # Reuse your existing end_session logic but ensure the route name matches
    return end_session()



if __name__ == '__main__':
    db.init_db() # Ensure collection is created on startup
    app.run(port=5001, debug=True)
