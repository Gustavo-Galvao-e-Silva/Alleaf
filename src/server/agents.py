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

    # FIX: Explicit list structure for LangChain Google adapter
    messages = [
        SystemMessage(content="You are a compassionate AI therapist."),
        HumanMessage(content=f"Review these logs and write a 1-2 sentence empathetic opening: {evidence_context}")
    ]

    try:
        response = llm.invoke(messages)
        # FIX: Ensure result is a string
        fft = ensure_text(response.content)
    except Exception as e:
        print(f"LLM ERROR in research_node: {e}")
        fft = "I'm glad you're here today. How are things feeling?"

    return {
        "evidence": unique_evidence,
        "food_for_thought": fft,
        "transcript": [AIMessage(content=fft)]
    }

def therapist_node(state: TherapySessionState):
    user_id = state.get('user_id')
    evidence_str = "\n".join(state.get('evidence', []))
    system_prompt = f"You are a professional AI therapist. Context: {evidence_str}"
    messages = [SystemMessage(content=system_prompt)] + state['transcript']

    response = llm_with_tools.invoke(messages)

    if response.tool_calls:
        for tool_call in response.tool_calls:
            query = tool_call['args']['query']
            print(f"--- AGENT TOOL CALL: Searching for '{query}' ---")
            search_result = search_user_history.invoke({"query": query, "user_id": user_id})
            messages.append(response)
            messages.append(ToolMessage(content=search_result, tool_call_id=tool_call['id']))
        # Get final response after tool call
        response = llm_with_tools.invoke(messages)

    # FIX: Always clean content regardless of which branch was taken
    response.content = ensure_text(response.content)
    return {"transcript": state['transcript'] + [response]}

def wrap_up_node(state: TherapySessionState):
    exercise_prompt = "Generate 3 exercises (breathing, todo, script) in a JSON list format."
    history = "\n".join([f"{'User' if isinstance(m, HumanMessage) else 'Therapist'}: {m.content}" for m in state['transcript']])

    try:
        response = llm.invoke([
            SystemMessage(content=exercise_prompt),
            HumanMessage(content=f"Session history:\n{history}")
        ])
        # FIX: Clean content before JSON parsing
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
    return {"exercises": exercises}
