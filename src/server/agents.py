import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from state import TherapySessionState

# Initialize Gemini 1.5 Pro
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro", 
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.7
)

# --- NODES ---

def research_node(state: TherapySessionState):
    """Steps 2-4: Pre-session research & Food for thought"""
    user_id = state['user_id']
    
    # Step 3: Queries to build 'Source Truth'
    queries = ["current anxiety triggers", "recent sleep patterns", "mood trends"]
    all_logs = []
    
    # Simulated search logic (connects to your Bridge)
    for q in queries:
        # Replace with your actual bridge call logic
        # logs = requests.post("http://localhost:5001/agent/search", json={"query": q, "user_id": user_id})
        all_logs.append(f"Mock log for {q}: User mentioned feeling tension.")

    # Step 4: Formulate 'Food for Thought'
    prompt = f"Based on these logs: {all_logs}, provide a gentle, one-sentence 'food for thought' to start a session."
    response = llm.invoke([SystemMessage(content=prompt)])
    
    return {
        "evidence": all_logs,
        "food_for_thought": response.content,
        "transcript": [AIMessage(content=response.content)]
    }

def therapist_node(state: TherapySessionState):
    """Step 5-7: The main therapy loop"""
    system_prompt = f"""
    You are an AI Therapist for an anxiety support app. 
    SOURCE TRUTH (User's History): {state['evidence']}
    
    Guidelines:
    1. Be empathetic but professional.
    2. Reference the 'Source Truth' if relevant (e.g. 'I noticed you logged about...').
    3. If you need more info to help, ask the user or state you're looking into it.
    """
    
    messages = [SystemMessage(content=system_prompt)] + state['transcript']
    response = llm.invoke(messages)
    
    return {"transcript": state['transcript'] + [response]}

def wrap_up_node(state: TherapySessionState):
    """Step 8-9: Conversation embedding and Exercise generation"""
    # Step 9: Structured JSON exercises
    exercise_prompt = """
    Based on the session transcript, generate exactly 3 exercises.
    Format MUST be a valid JSON list of objects:
    [
      {"title": "...", "type": "breathing", "content": "..."},
      {"title": "...", "type": "todo", "content": "..."},
      {"title": "...", "type": "script", "content": "..."}
    ]
    """
    
    # We combine the transcript into a string for the exercise generator
    history = "\n".join([m.content for m in state['transcript']])
    response = llm.invoke([SystemMessage(content=exercise_prompt), HumanMessage(content=history)])
    
    # In Step 8, you'd trigger the bridge to save 'history' to Actian
    return {"exercises": response.content} # Add JSON parsing here
