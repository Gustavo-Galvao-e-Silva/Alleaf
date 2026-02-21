import os
import json
import requests
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from state import TherapySessionState
from embedder import get_embedding  # Our backend embedder utility

# Initialize Gemini 1.5 Pro
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.7 # Slight randomness for better therapist tone
)

def research_node(state: TherapySessionState):
    """
    Step 2: Start session.
    Step 3: Query Actian for 'Source Truth' based on clinical themes.
    Step 4: Generate the 'Food for Thought' opening message.
    """
    user_id = state.get('user_id')
    if not user_id:
        return {"transcript": [AIMessage(content="Hello! I'm here to help, but I couldn't find your user profile. How are you feeling today?")]}

    # 1. Step 3: Define clinical query topics
    query_topics = [
        "recent panic attacks or physical anxiety symptoms",
        "social anxiety and workplace stress",
        "sleep quality and nighttime anxiety"
    ]

    all_evidence = []

    # 2. Iterate through topics to gather evidence from Actian
    for topic in query_topics:
        try:
            # We call the local bridge search endpoint
            res = requests.post("http://localhost:5001/search", json={
                "query": topic,
                "user_id": user_id
            }, timeout=5)

            if res.status_code == 200:
                logs = res.json()  # Expected format: [{"text": "..."}]
                all_evidence.extend([log['text'] for log in logs])
        except Exception as e:
            print(f"Research Node Error (Search): {e}")

    # 3. Deduplicate and clean evidence
    unique_evidence = list(set(all_evidence))
    
    # Format evidence for the prompt; provide a fallback if empty
    evidence_context = "\n".join([f"- {text}" for text in unique_evidence]) if unique_evidence else "The user has no recent journal logs."

    # 4. Step 4: Craft the opening message
    research_summary_prompt = f"""
    You are a compassionate AI therapist preparing for a session.
    
    PATIENT RECENT LOGS:
    {evidence_context}

    YOUR TASK:
    1. If there are logs: Identify a recurring theme and write a gentle, reflective 'Food for Thought' sentence to start the session.
    2. If there are NO logs: Write a warm, open-ended invitation for the user to share what's on their mind today.
    3. Keep it brief (max 2 sentences) and empathetic.
    """

    try:
        # We ensure the message list is never empty to avoid 'contents are required'
        response = llm.invoke([SystemMessage(content=research_summary_prompt)])
        food_for_thought = response.content if response.content.strip() else "I'm glad you're here today. How have things been feeling for you lately?"
    except Exception as e:
        print(f"Research Node Error (LLM): {e}")
        food_for_thought = "I'm glad we can connect today. What's been on your mind?"

    # 5. Return the updated state
    return {
        "evidence": unique_evidence,
        "food_for_thought": food_for_thought,
        "transcript": [AIMessage(content=food_for_thought)]
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
