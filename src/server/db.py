import os
import time
from cortex import CortexClient

client = CortexClient("localhost:50051")
COLLECTION = "user_journals"

def ensure_connected():
    """Checks if the client is connected, and if not, reconnects."""
    try:
        # Try a lightweight call to see if the connection is alive
        client.has_collection(COLLECTION)
    except Exception:
        print("--- DB Connection lost. Reconnecting... ---")
        try:
            client.connect()
        except:
            pass # Already connected or handled by SDK internal logic

def init_db():
    ensure_connected() # Use our new helper
    if not client.has_collection(COLLECTION):
        client.create_collection(name=COLLECTION, dimension=384)
    return True

def reset_db():
    """Wipes the collection and recreates it from scratch."""
    try:
        if client.has_collection(COLLECTION):
            # FIX: Changed 'drop_collection' to 'delete_collection'
            client.delete_collection(name=COLLECTION)
            print(f"--- Collection {COLLECTION} deleted! ---")

        # Recreate the collection
        client.create_collection(name=COLLECTION, dimension=384)
        print(f"--- Collection {COLLECTION} recreated! ---")
        return True
    except Exception as e:
        print(f"Error resetting DB: {e}")
        return False
