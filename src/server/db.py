import os
from cortex import CortexClient

# Initialize Actian Cortex Client
client = CortexClient("localhost:50051")
client.connect()
COLLECTION = "user_journals"
