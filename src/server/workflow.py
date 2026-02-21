from langgraph.graph import StateGraph, END

workflow = StateGraph(PatientFile)

# Add Nodes
workflow.add_node("archivist", archivist_node)
workflow.add_node("reasoning", reasoning_node)
workflow.add_node("therapist", therapist_node)

# Define the Path
workflow.set_entry_point("archivist")
workflow.add_edge("archivist", "reasoning")
workflow.add_edge("reasoning", "therapist")
workflow.add_edge("therapist", END)

# Compile the Graph
app_agent = workflow.compile()
