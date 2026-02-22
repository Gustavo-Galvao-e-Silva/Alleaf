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
    user_notes = state.get('user_notes', "No specific notes provided.")
    query_topics = ["panic attacks and physical anxiety", "work stress and social anxiety", "sleep quality"]
    all_evidence = []

    # 1. Gather Historical Context
    for topic in query_topics:
        try:
            vector = get_embedding(topic)
            user_filter = Filter().must(Field("user_id").eq(user_id))
            results = db.client.search(db.COLLECTION, query=vector, filter=user_filter, top_k=3, with_payload=True)
            for r in results:
                if 'text' in r.payload:
                    all_evidence.append(r.payload['text'])
        except Exception as e:
            print(f"Research Node Error: {e}")

    unique_evidence = list(set(all_evidence))
    evidence_context = "\n".join([f"- {text}" for text in unique_evidence]) if unique_evidence else "No recent logs."

    safe_notes = user_notes if user_notes.strip() else "The user is starting a general check-in."
    safe_evidence = evidence_context if evidence_context.strip() else "No previous history available."

    agenda_prompt = f"""
    You are a clinical supervisor. Create a 3-point "Session Agenda" for the AI Therapist.

    USER'S CURRENT CONCERNS: {safe_notes}
    USER'S HISTORY: {safe_evidence}

    Format this as a clear 'Weighted List of Objectives' for the therapist to follow.
    """

    try:
        # USE A LIST OF MESSAGES explicitly
        agenda_response = llm.invoke([
            SystemMessage(content="You are a clinical strategy assistant."),
            HumanMessage(content=agenda_prompt) # Google GenAI prefers a HumanMessage following a SystemMessage
        ])
        agenda = ensure_text(agenda_response.content)
    except Exception as e:
        print(f"Agenda Generation Error: {e}")
        agenda = "1. Establish rapport. 2. Conduct a mood check. 3. Explore current stressors."

    # 3. Generate Opening
    try:
        opening_res = llm.invoke([
            SystemMessage(content="You are a compassionate therapist starting a session."),
            HumanMessage(content=f"Based on this agenda, give a warm 1-2 sentence opening that acknowledges their notes: {agenda}")
        ])
        fft = ensure_text(opening_res.content)
    except Exception as e:
        print(f"Opening Error: {e}")
        fft = "I'm here and ready to listen. How are you feeling today?"

    return {
        "evidence": unique_evidence,
        "agenda": agenda,
        "food_for_thought": fft,
        "transcript": [AIMessage(content=fft)]
    }

def therapist_node(state: TherapySessionState):
    user_id = state.get('user_id')
    evidence_str = "\n".join(state.get('evidence', []))
    agenda = state.get('agenda', "Provide general emotional support.")

    # We keep user_id and context, but ADD the agenda as the primary directive
    system_prompt = f"""
    You are a professional AI therapist.
    User ID: {user_id}
    
    HISTORICAL CONTEXT:
    {evidence_str}

    SESSION AGENDA (Your primary objectives for this session):
    {agenda}

    INSTRUCTIONS:
    1. Focus on the Agenda points, but stay flexible if the user needs to vent.
    2. Use 'search_user_history' if you need more details on a specific past event.
    3. The user_id is already provided; do not ask for it.
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
        
        response = llm_with_tools.invoke(messages)

    response.content = ensure_text(response.content)
    return {"transcript": state['transcript'] + [response]}

# wrap_up_node and therapist_stream_node remain largely the same, 
# but could optionally use state.get('agenda') for better summaries.

def wrap_up_node(state: TherapySessionState):
    agenda = state.get('agenda', "General emotional support.")

    # REFINED: Combining agenda-awareness with strict formatting
    exercise_prompt = f"""
    Generate exactly 3 tailored mental health exercises based on the session history.
    
    ORIGINAL SESSION GOALS:
    {agenda}

    Check the transcript: if a goal was missed, make an exercise for it. 
    If a goal was met, provide an advanced "next step."

    Each exercise must be one of two types: "asynchronous" (static text) or "interactive" (guided session).
    
    CRITICAL FORMATTING FOR INTERACTIVE EXERCISES:
    - Use the [BREAK] token between sentences where the AI should pause for the user.
    - Example: "Close your eyes. [BREAK] Now, take a deep breath. [BREAK]"

    Return ONLY a JSON list:
    [{{"type": "interactive"|"asynchronous", "title": "...", "content": "..."}}]
    """

    summary_prompt = f"""
    Summarize key personal details and emotional state in 2 concise sentences for long-term memory.
    Briefly acknowledge if these session goals were addressed: {agenda}
    """

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
    agenda = state.get('agenda', "Provide general emotional support.") # Add this

    # Match the prompt from therapist_node for consistency
    system_prompt = f"""
    You are a professional AI therapist. User ID: {user_id}.

    SESSION AGENDA:
    {agenda}

    CONTEXT: {evidence_str}
    """
    messages = [SystemMessage(content=system_prompt)] + state['transcript']

    for chunk in llm.stream(messages):
        yield ensure_text(chunk.content)
