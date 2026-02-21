import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

# Initialize Gemini
llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", google_api_key=os.getenv("GEMINI_API_KEY"))

# 1. The Archivist (Vector Query Agent)
def archivist_node(state: PatientFile):
    # This node calls the Bridge to get raw data
    res = requests.post("http://localhost:5001/agent/search", json={
        "query": state['current_input'],
        "user_id": state['user_id']
    })
    logs = res.json().get("logs", [])
    return {"logs_retrieved": logs}

# 2. The Reasoning Agent (File Builder)
def reasoning_node(state: PatientFile):
    context = "\n".join(state['logs_retrieved'])
    prompt = f"""
    You are a Clinical Reasoning Agent. 
    Using these journal logs: {context}
    Update the 'Patient File' for this user. 
    Focus on: Triggers, Anxiety Levels, and Coping Success.
    If information is missing, note it as 'Unknown'.
    """
    response = llm.invoke([SystemMessage(content=prompt)])
    return {"clinical_file": response.content}

# 3. The Master Therapist Agent
def therapist_node(state: PatientFile):
    prompt = f"""
    You are a compassionate Therapist Agent.
    Use the following Patient File as your Source Truth: {state['clinical_file']}
    
    The user just said: {state['current_input']}
    
    Respond with empathy and use details from their 'File' to guide them.
    """
    response = llm.invoke([SystemMessage(content=prompt)])
    return {"therapy_response": response.content}
