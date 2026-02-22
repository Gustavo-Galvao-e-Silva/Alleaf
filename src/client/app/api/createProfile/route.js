import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

export async function POST(req) {
  try {
    const data = await req.json();
    const userRef = doc(db, "users", data.userId);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        baselineRR: null,
        age: null,
        sex: "",
        height: null,
        weight: null,
        smoker: "",
        activityLevel: "",
        sleepDuration: "",
      });
    } else {
      console.log("User already exists");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Profile created successfully",
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 },
    );
  }
}
