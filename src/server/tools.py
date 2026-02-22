from langchain_core.tools import tool
from db import client, COLLECTION
from embedder import get_embedding
from cortex import Filter, Field

@tool
def search_user_history(query: str, user_id: str):
    """
    Searches the user's past journal entries and session summaries for specific information.
    Use this when the user mentions a specific event, person, or date (like a birthday) 
    that isn't in the current context.
    NOTE: The user_id is automatically provided by the system.
    DO NOT ask the user for their ID.
    """
    try:
        vector = get_embedding(query)
        user_filter = Filter().must(Field("user_id").eq(user_id))
        results = client.search(COLLECTION, query=vector, filter=user_filter, top_k=5, with_payload=True)
        
        if not results:
            return "No relevant history found for this query."
            
        return "\n".join([f"- {r.payload['text']}" for r in results if 'text' in r.payload])
    except Exception as e:
        return f"Error searching history: {str(e)}"
