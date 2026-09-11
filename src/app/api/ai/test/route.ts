import { NextResponse } from "next/server";

import { analyzePatientIntake } from "@/lib/ai/triage";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not found." },
      { status: 404 }
    );
  }

  try {
    const result = await analyzePatientIntake({
      reasonForCare:
        "I have been feeling stressed and having difficulty sleeping.",

      symptoms: [
        "Stress",
        "Sleep difficulty",
        "Trouble concentrating",
      ],

      symptomDuration: "Two weeks",
      urgencySelfRating: 6,

      additionalNotes:
        "The symptoms are affecting my work.",
    });

    return NextResponse.json({
      message: "Gemini triage completed.",
      result,
    });
  } catch (error) {
    console.error("Gemini triage test failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gemini triage failed.",
      },
      { status: 500 }
    );
  }
}