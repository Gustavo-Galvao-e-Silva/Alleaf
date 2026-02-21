from langgraph.graph import StateGraph, END
from state import TherapySessionState
from agents import research_node, therapist_node, wrap_up_node

workflow = StateGraph(TherapySessionState)

workflow.add_node("research", research_node)
workflow.add_node("therapist", therapist_node)
workflow.add_node("wrap_up", wrap_up_node)

workflow.set_entry_point("research")
workflow.add_edge("research", "therapist")
# In a real session, you would pause here for user input
workflow.add_edge("therapist", "wrap_up") 
workflow.add_edge("wrap_up", END)

app_agent = workflow.compile()
