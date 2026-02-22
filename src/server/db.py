import os
import time
from cortex import CortexClient

# Initialize Actian Cortex Client
# This is our single source of truth for the DB connection
client = CortexClient("localhost:50051")
client.connect()
COLLECTION = "user_journals"

def init_db():
    """Ensure the collection exists on startup."""
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
