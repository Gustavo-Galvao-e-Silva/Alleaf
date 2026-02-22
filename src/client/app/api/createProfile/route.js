import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthday =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthday) age -= 1;
  return age;
}

export async function POST(req) {
  try {
    const {
      userId,
      name,
      dateOfBirth,
      sex,
      height,
      weight,
      smoker,
      activityLevel,
      sleepDuration,
    } = await req.json();

    const age = calculateAge(dateOfBirth);

    await setDoc(doc(db, "users", userId), {
      name,
      dateOfBirth,
      age,
      sex,
      height: Number(height),
      weight: Number(weight),
      smoker: smoker === "yes" ? "Y" : "N",
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
