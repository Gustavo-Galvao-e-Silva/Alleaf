import db

def inspect_collection():
    print(f"--- Inspecting Collection: {db.COLLECTION} ---")
    try:
        # We perform a 'dummy' search with a very broad filter to get results
        # Actian doesn't have a 'get_all', so we search for 'anxiety' or similar
        # and set top_k high to see the recent entries.
        
        # Alternatively, we can just fetch everything if the SDK allows, 
        # but a top_k search on an empty string usually works for inspection.
        results = db.client.search(
            db.COLLECTION, 
            query=[0.0] * 384, # Dummy vector
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
            print(f"    TEXT: {text[:150]}...") # Print first 150 chars
            print("-" * 30)

    except Exception as e:
        print(f"Error inspecting DB: {e}")

if __name__ == "__main__":
    inspect_collection()
