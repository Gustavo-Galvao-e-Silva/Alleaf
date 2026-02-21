from typing import TypedDict, List, Union
from langchain_core.messages import BaseMessage

class TherapySessionState(TypedDict):
    user_id: str
    session_id: str
    # Step 5: The living conversation
    transcript: List[BaseMessage]
    # Step 3: Raw evidence retrieved from Actian
    evidence: List[str]
    # Step 4: The opening reflection
    food_for_thought: str
    # Step 9: The final 3 activities
    exercises: List[dict]
    # Internal counter for reasoning loops
    iteration_count: int
