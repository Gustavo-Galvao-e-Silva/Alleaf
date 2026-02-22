"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

const createProfile = async (userId) => {
  try {
    const response = await fetch("/api/createProfile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });
    const result = await response.json();
    console.log(result);
  } catch (error) {
    console.error("Error with creating profile: ", error);
  }
};

export default function AuthClient() {
  const { isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (isSignedIn && userId) {
      createProfile(userId);
    }
  }, [isSignedIn, userId]);

  return null; // This component doesn't render anything
}
