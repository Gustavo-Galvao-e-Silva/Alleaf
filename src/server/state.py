from typing import TypedDict, List, Annotated
from operator import add

class PatientFile(TypedDict):
    # This represents the "State" of the therapy session
    user_id: str
    current_input: str
    clinical_file: str # The "Source Truth" file we build from journals
    therapy_response: str
    logs_retrieved: List[str]
    iteration_count: int
