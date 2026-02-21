import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from state import TherapySessionState
from embedder import get_embedding
import db 
from cortex import Filter, Field

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.7
)

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

    prompt = f"PATIENT LOGS:\n{evidence_context}\n\nTask: Write a brief, empathetic therapist opening message."
    
    try:
        response = llm.invoke([SystemMessage(content=prompt)])
        fft = response.content
    except:
        fft = "I'm glad you're here today. How are things feeling?"

    return {
        "evidence": unique_evidence,
        "food_for_thought": fft,
        "transcript": [AIMessage(content=fft)]
    }

def therapist_node(state: TherapySessionState):
    evidence_str = "\n".join(state.get('evidence', []))
    system_prompt = f"You are an AI therapist. Context: {evidence_str}"
    messages = [SystemMessage(content=system_prompt)] + state['transcript']
    response = llm.invoke(messages)
    return {"transcript": state['transcript'] + [response]}

def wrap_up_node(state: TherapySessionState):
    exercise_prompt = "Generate 3 exercises (breathing, todo, script) in a JSON list."
    history = "\n".join([m.content for m in state['transcript']])
    try:
        response = llm.invoke([SystemMessage(content=exercise_prompt), HumanMessage(content=history)])
        clean_json = response.content.replace('```json', '').replace('```', '').strip()
        exercises = json.loads(clean_json)
    except:
        exercises = []
    return {"exercises": exercises}
