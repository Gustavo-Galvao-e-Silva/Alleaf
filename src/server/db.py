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
