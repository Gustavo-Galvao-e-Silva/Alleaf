from typing import TypedDict, List, Union
from langchain_core.messages import BaseMessage

class TherapySessionState(TypedDict):
    user_id: str
    session_id: str
    transcript: List[BaseMessage] 
    evidence: List[str]    
    food_for_thought: str  
    exercises: List[dict]
