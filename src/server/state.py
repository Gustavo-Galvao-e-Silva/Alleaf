from typing import TypedDict, List, Optional
from langchain_core.messages import BaseMessage

class TherapySessionState(TypedDict):
    user_id: str
    session_id: str
    transcript: List[BaseMessage]
    evidence: List[str]
    food_for_thought: str
    # New fields for Collaborative Agenda Setting
    user_notes: str 
    agenda: str
    # Field for the final session summary
    summary: Optional[str]
    exercises: List[dict]
