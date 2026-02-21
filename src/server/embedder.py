from sentence_transformers import SentenceTransformer

# This loads the model locally on your CPU/GPU
model = SentenceTransformer('all-MiniLM-L6-v2')

def get_embedding(text):
    return model.encode(text).tolist()
