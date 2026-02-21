from langgraph.graph import StateGraph, END
from state import TherapySessionState
from agents import research_node, therapist_node, wrap_up_node

workflow = StateGraph(TherapySessionState)

# Add our 3 main stages
workflow.add_node("research", research_node)
workflow.add_node("therapist", therapist_node)
workflow.add_node("wrap_up", wrap_up_node)

# Step 1-4
workflow.set_entry_point("research")
workflow.add_edge("research", "therapist")

# Steps 5-7 (This is where the user interacts)
# In production, you'd use an 'interrupt' here to wait for user input
workflow.add_edge("therapist", "wrap_up") 

# Step 8-9
workflow.add_edge("wrap_up", END)

app_agent = workflow.compile()
