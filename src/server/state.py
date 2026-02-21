from typing import TypedDict, List, Annotated
from operator import add

class TherapySessionState(TypedDict):
    user_id: str
    session_id: str
    transcript: List[dict] # The back-and-forth chat
    evidence: List[str]    # Raw journal logs found by the agent
    patient_file: str      # The "Case File" synthesized from logs
    food_for_thought: str  # The opening prompt
    exercises: List[dict]  # Step 9: The 3 final activities
