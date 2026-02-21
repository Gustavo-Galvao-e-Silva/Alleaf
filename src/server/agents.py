import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from state import TherapySessionState

# Initialize Gemini 1.5 Pro
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro", 
    google_api_key=os.getenv("GEMINI_API_KEY")
)

def research_node(state: TherapySessionState):
    """Steps 2-4: Pre-session retrieval and Opening Message."""
    # Step 3: Gather evidence (Connecting to your existing search logic)
    import requests
    search_query = "anxiety triggers and recent mood"
    # We call our own bridge to get the logs
    res = requests.post("http://localhost:5001/search", json={
        "vector": [0.1] * 384, # Replace with actual embedding of search_query
        "user_id": state['user_id']
    })
    logs = [item['text'] for item in res.json()]
    
    # Step 4: Create Food for Thought
    prompt = f"Based on these patient logs: {logs}, write a short, empathetic 'food for thought' to start our therapy session."
    response = llm.invoke([SystemMessage(content=prompt)])
    
    return {
        "evidence": logs,
        "food_for_thought": response.content,
        "transcript": [AIMessage(content=response.content)]
    }

def therapist_node(state: TherapySessionState):
    """Steps 5-7: Active Conversation."""
    system_prompt = f"""
    You are a professional therapist. 
    PATIENT HISTORY: {state['evidence']}
    Use this history to personalize your advice. If the user mentions something related to their logs, acknowledge it.
    """
    messages = [SystemMessage(content=system_prompt)] + state['transcript']
    response = llm.invoke(messages)
    return {"transcript": state['transcript'] + [response]}

def wrap_up_node(state: TherapySessionState):
    """Steps 8-9: Closing and Exercise Generation."""
    # Step 9: Generate 3 Exercises
    exercise_prompt = """
    Based on today's chat, generate 3 anxiety exercises (1 Breathing, 1 Todo, 1 Audio Script).
    Respond ONLY with a JSON list: [{"title": "...", "type": "...", "content": "..."}]
    """
    history = "\n".join([m.content for m in state['transcript']])
    response = llm.invoke([SystemMessage(content=exercise_prompt), HumanMessage(content=history)])
    
    # Clean the string for JSON parsing
    clean_json = response.content.replace('```json', '').replace('```', '').strip()
    return {"exercises": json.loads(clean_json)}
