import db

def inspect_collection():
    print(f"--- Inspecting Collection: {db.COLLECTION} ---")
    try:
        # STEP 1: Establish the connection
        # Standalone scripts don't trigger the Flask startup logic,
        # so we must connect manually.
        db.client.connect()
        
        # STEP 2: Check if collection exists before searching
        if not db.client.has_collection(db.COLLECTION):
            print(f"Error: Collection '{db.COLLECTION}' does not exist in the database.")
            return

        # STEP 3: Perform broad search
        # We use a zero-vector to pull the most recent entries regardless of semantic similarity
        results = db.client.search(
            db.COLLECTION,
            query=[0.0] * 384, 
            top_k=50,
            with_payload=True
        )

        if not results:
            print("The database is currently empty.")
            return

        print(f"Found {len(results)} entries:\n")
        for i, r in enumerate(results):
            p = r.payload
            p_type = p.get('type', 'unknown')
            text = p.get('text', 'No text found')
            user = p.get('user_id', 'unknown')

            print(f"[{i+1}] TYPE: {p_type} | USER: {user}")
            # Clean up newlines for a prettier terminal output
            clean_text = text.replace('\n', ' ')
            print(f"    TEXT: {clean_text[:150]}...") 
            print("-" * 40)

    except Exception as e:
        print(f"Error inspecting DB: {e}")

if __name__ == "__main__":
    inspect_collection()
