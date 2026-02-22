import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from state import TherapySessionState
from embedder import get_embedding
import db 
from cortex import Filter, Field
from tools import search_user_history

def ensure_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in content])
    return str(content)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.4
)
tools = [search_user_history]
llm_with_tools = llm.bind_tools(tools)

def research_node(state: TherapySessionState):
    user_id = state.get('user_id')
    user_notes = state.get('user_notes', "")
    query_topics = ["panic attacks and physical anxiety", "work stress and social anxiety", "sleep quality"]
    all_evidence = []
    
    for topic in query_topics:
        try:
            vector = get_embedding(topic)
            user_filter = Filter().must(Field("user_id").eq(user_id))
            results = db.client.search(db.COLLECTION, query=vector, filter=user_filter, top_k=3, with_payload=True)
            for r in results:
                # Ensure the key exists in payload
                if 'text' in r.payload:
                    all_evidence.append(r.payload['text'])
        except Exception as e:
            print(f"Research Node Error: {e}")

    unique_evidence = list(set(all_evidence))
    evidence_context = "\n".join([f"- {text}" for text in unique_evidence]) if unique_evidence else "No recent logs."

    # 2. NEW: Generate the Agenda
    agenda_prompt = f"""
    You are a clinical supervisor. Based on the User's Pre-session Notes and Past History,
    create a 3-point "Session Agenda" for the AI Therapist.

    USER NOTES: {user_notes}
    PAST HISTORY: {evidence_context}

    Format the agenda as a weighted list of objectives.
    """

    agenda_response = llm.invoke([SystemMessage(content=agenda_prompt)])
    agenda = ensure_text(agenda_response.content)

    # 3. Generate the empathetic opening using the agenda
    opening_res = llm.invoke([
        SystemMessage(content="You are a compassionate therapist."),
        HumanMessage(content=f"Based on this agenda, give a warm 1-sentence opening: {agenda}")
    ])
    fft = ensure_text(opening_res.content)

    return {
        "evidence": unique_evidence,
        "agenda": agenda, # Save this to state!
        "food_for_thought": fft,
        "transcript": [AIMessage(content=fft)]
    }


def therapist_node(state: TherapySessionState):
    user_id = state.get('user_id')
    evidence_str = "\n".join(state.get('evidence', []))


    system_prompt = f"""
    You are a professional AI therapist. 
    User ID: {user_id}
    CURRENT CONTEXT: {evidence_str}
    
    If you need to search past entries, use 'search_user_history'. 
    The user_id is already provided in the system context; do not ask the user for it.
    """


    messages = [SystemMessage(content=system_prompt)] + state['transcript']

    response = llm_with_tools.invoke(messages)

    if response.tool_calls:
        for tool_call in response.tool_calls:

            query = tool_call['args'].get('query', '')
            print(f"--- AGENT TOOL CALL: Searching for '{query}' for user '{user_id}' ---")

            search_result = search_user_history.invoke({"query": query, "user_id": user_id})
            messages.append(response)
            messages.append(ToolMessage(content=search_result, tool_call_id=tool_call['id']))

        # Get final response after tool call
        response = llm_with_tools.invoke(messages)

    # FIX: Always clean content regardless of which branch was taken
    response.content = ensure_text(response.content)
    return {"transcript": state['transcript'] + [response]}

def wrap_up_node(state: TherapySessionState):
    exercise_prompt = """
    Generate exactly 3 tailored mental health exercises.
    Each exercise must be one of two types: "asynchronous" or "interactive".

    1. Asynchronous: Static instructions for the user to read.
    2. Interactive: A script for a guided session.
       - Use the [BREAK] token between sentences where the AI should stop reading and wait for the user.
       - Example: "Close your eyes. [BREAK] Now, take a deep breath. [BREAK] Hold it for 4 seconds."

    Return ONLY a JSON list of objects:
    {"type": "interactive"|"asynchronous", "title": "...", "content": "..."}
    """
    # NEW: We also need a prompt for the summary
    summary_prompt = "Summarize the key personal details and emotional state from this chat in 2 concise sentences for long-term memory."
    
    history = "\n".join([f"{'User' if isinstance(m, HumanMessage) else 'Therapist'}: {m.content}" for m in state['transcript']])

    # --- PART 1: Generate the Summary (The "Memory" part) ---
    try:
        summary_res = llm.invoke([
            SystemMessage(content=summary_prompt), 
            HumanMessage(content=history)
        ])
        summary_text = ensure_text(summary_res.content)
    except Exception as e:
        print(f"Summary Error: {e}")
        summary_text = "Session summary unavailable."

    # --- PART 2: Generate the Exercises (The "UI" part) ---
    try:
        response = llm.invoke([
            SystemMessage(content=exercise_prompt),
            HumanMessage(content=f"Session history:\n{history}")
        ])
        content = ensure_text(response.content)

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        exercises = json.loads(content)
        if isinstance(exercises, dict):
            exercises = [exercises]
    except Exception as e:
        print(f"Wrap Up Error: {e}")
        exercises = []

    # --- PART 3: Return BOTH ---
    # We return the summary so bridge.py can catch it and save it to Actian
    return {"exercises": exercises, "summary": summary_text}

def therapist_stream_node(state: TherapySessionState):
    user_id = state.get('user_id')
    evidence_str = "\n".join(state.get('evidence', []))
    system_prompt = f"You are a professional AI therapist. User ID: {user_id}. Context: {evidence_str}"
    messages = [SystemMessage(content=system_prompt)] + state['transcript']

    # We use .stream instead of .invoke
    # Note: Tool calling with streaming is complex,
    # so we will stream the FINAL response.
    for chunk in llm.stream(messages):
        yield ensure_text(chunk.content)
