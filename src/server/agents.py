import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from state import TherapySessionState
import requests
from embedder import get_embedding  # Our new backend embedder

# Initialize Gemini 1.5 Pro
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro", 
    google_api_key=os.getenv("GEMINI_API_KEY")
)

def research_node(state: TherapySessionState):
    """
    Step 2: Start session.
    Step 3: Query Actian for 'Source Truth' based on clinical themes.
    Step 4: Generate the 'Food for Thought' opening message.
    """
    user_id = state['user_id']

    # 1. Step 3: Define clinical query topics (These are your 'source truth' seeds)
    # The agent uses these to search the database for relevant user history
    query_topics = [
        "recent panic attacks or physical anxiety symptoms",
        "social anxiety and workplace stress",
        "sleep quality and nighttime anxiety"
    ]

    all_evidence = []

    # 2. Iterate through topics to gather evidence
    for topic in query_topics:
        # Convert topic to vector locally on the backend
        vector = get_embedding(topic)

        # Call your existing Bridge search logic (or call Actian client directly)
        # We assume your bridge.py is running on 5001
        try:
            res = requests.post("http://localhost:5001/search", json={
                "query": topic,  # Bridge now handles vectorization via get_embedding
                "user_id": user_id
            })

            if res.status_code == 200:
                logs = res.json() # List of {"text": "..."}
                all_evidence.extend([log['text'] for log in logs])
        except Exception as e:
            print(f"Research Node Error: Could not reach Actian bridge: {e}")

    # 3. Deduplicate and clean evidence
    unique_evidence = list(set(all_evidence))

    # 4. Step 4: Reason with the Evidence to create 'Food for Thought'
    # We use Gemini to synthesize the raw logs into a gentle opening
    from langchain_google_genai import ChatGoogleGenerativeAI
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro")

    research_summary_prompt = f"""
    You are preparing for a therapy session.
    Based on these recent journal logs from the patient:
    {unique_evidence if unique_evidence else "No recent logs found."}

    Your task:
    1. Identify one recurring theme or a significant recent event.
    2. Write a gentle, reflective 'Food for Thought' sentence to start the session.
    3. Keep it brief and empathetic. Do not diagnose; just reflect.

    Example: 'I noticed you've been feeling some tension in social settings lately; perhaps we could explore what that feels like for you today?'
    """

    response = llm.invoke([SystemMessage(content=research_summary_prompt)])
    food_for_thought = response.content

    # 5. Return the updated state
    return {
        "evidence": unique_evidence,
        "food_for_thought": food_for_thought,
        # We initialize the transcript with the AI's opening thought
        "transcript": [AIMessage(content=food_for_thought)]
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
