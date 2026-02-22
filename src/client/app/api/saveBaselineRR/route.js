import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";

export async function POST(req) {
  try {
    const { userId, baselineRR } = await req.json();

    if (!userId || !Array.isArray(baselineRR)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid payload" }),
        { status: 400 },
      );
    }

    await updateDoc(doc(db, "users", userId), {
      baselineRR,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 },
    );
  }
}
