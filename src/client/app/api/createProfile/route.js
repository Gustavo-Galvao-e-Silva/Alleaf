import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

export async function POST(req) {
  try {
    const {
      userId,
      name,
      age,
      sex,
      height,
      weight,
      smoker,
      activityLevel,
      sleepDuration,
    } = await req.json();

    await setDoc(doc(db, "users", userId), {
      name,
      age: Number(age),
      sex,
      height: Number(height),
      weight: Number(weight),
      smoker: smoker === "yes" ? "y" : "n",
      activityLevel,
      sleepDuration: Number(sleepDuration),
      baselineRR: null,
      createdAt: new Date().toISOString(),
    });

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
