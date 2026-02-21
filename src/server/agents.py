import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from state import TherapySessionState
from db import client, COLLECTION # Import from our new db.py
from cortex import Filter, Field

# Initialize Gemini
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.7
)

def research_node(state: TherapySessionState):
    user_id = state.get('user_id')
    query_topics = [
        "recent panic attacks or physical anxiety symptoms",
        "social anxiety and workplace stress",
        "sleep quality and nighttime anxiety"
    ]

    all_evidence = []

    # 1. Search Actian Directly (No requests.post!)
    from embedder import get_embedding
    for topic in query_topics:
        try:
            vector = get_embedding(topic)
            user_filter = Filter().must(Field("user_id").eq(user_id))
            results = client.search(COLLECTION, query=vector, filter=user_filter, top_k=3, with_payload=True)
            all_evidence.extend([r.payload['text'] for r in results])
        except Exception as e:
            print(f"DB Search Error: {e}")

    unique_evidence = list(set(all_evidence))
    evidence_context = "\n".join([f"- {text}" for text in unique_evidence]) if unique_evidence else "No logs found."

    # 2. Prompt Gemini for the opening hook
    prompt = f"PATIENT LOGS:\n{evidence_context}\n\nTask: Write a 1-2 sentence empathetic opening based on these logs."
    response = llm.invoke([SystemMessage(content=prompt)])

    return {
        "evidence": unique_evidence,
        "food_for_thought": response.content,
        "transcript": [AIMessage(content=response.content)]
    }

def therapist_node(state: TherapySessionState):
    """Steps 5-7: Active Conversation."""
    evidence_str = "\n".join(state.get('evidence', []))
    
    system_prompt = f"""
    You are a professional AI therapist specialized in anxiety support.
    
    PATIENT HISTORY (Source Truth):
    {evidence_str if evidence_str else "No historical logs available."}
    
    INSTRUCTIONS:
    - Reference their history naturally (e.g., 'Earlier you mentioned...' or 'I recall your log about...').
    - If you need more detail to help, ask clarifying questions (Step 7).
    - Stay empathetic, grounded, and focused on anxiety management.
    """
    
    # Maintain the transcript history for the LLM
    messages = [SystemMessage(content=system_prompt)] + state['transcript']
    
    try:
        response = llm.invoke(messages)
        return {"transcript": state['transcript'] + [response]}
    except Exception as e:
        print(f"Therapist Node Error: {e}")
        return {"transcript": state['transcript'] + [AIMessage(content="I'm sorry, I'm having a little trouble processing that. Could you say it another way?")]}

def wrap_up_node(state: TherapySessionState):
    """Steps 8-9: Closing and Exercise Generation."""
    # Step 9: Generate 3 Exercises
    exercise_prompt = """
    Based on the therapy session transcript provided, generate exactly 3 interactive exercises for the user.
    1. A breathing exercise.
    2. A simple TODO or action item.
    3. A short mindfulness or grounding script.

    Respond ONLY with a valid JSON list of objects:
    [
      {"title": "...", "type": "breathing", "content": "..."},
      {"title": "...", "type": "todo", "content": "..."},
      {"title": "...", "type": "script", "content": "..."}
    ]
    """
    
    history = "\n".join([f"{'User' if isinstance(m, HumanMessage) else 'Therapist'}: {m.content}" for m in state['transcript']])
    
    try:
        response = llm.invoke([SystemMessage(content=exercise_prompt), HumanMessage(content=history)])
        
        # Clean the string for JSON parsing (Gemini sometimes adds markdown blocks)
        clean_json = response.content.replace('```json', '').replace('```', '').strip()
        exercises = json.loads(clean_json)
    except Exception as e:
        print(f"Wrap Up Error: {e}")
        exercises = [] # Fallback to empty list

    return {"exercises": exercises}
