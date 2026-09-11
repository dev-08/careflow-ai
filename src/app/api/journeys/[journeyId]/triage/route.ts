import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { analyzePatientIntake } from "@/lib/ai/triage";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  expectedVersion: z.number().int().positive(),

  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(200),
});

type RouteContext = {
  params: Promise<{
    journeyId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Confirm that the caller is authenticated.
    const serverSupabase =
      await createServerSupabaseClient();

    const {
      data: { user },
      error: authenticationError,
    } = await serverSupabase.auth.getUser();

    if (authenticationError || !user) {
      return NextResponse.json(
        {
          error: "Authentication is required.",
        },
        {
          status: 401,
        }
      );
    }

    const { journeyId } = await context.params;

    const journeyIdValidation = z
      .string()
      .uuid()
      .safeParse(journeyId);

    if (!journeyIdValidation.success) {
      return NextResponse.json(
        {
          error: "Invalid journey ID.",
        },
        {
          status: 400,
        }
      );
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Request body must contain valid JSON.",
        },
        {
          status: 400,
        }
      );
    }

    const validation = requestSchema.safeParse(requestBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid triage request.",
          details: validation.error.flatten(),
        },
        {
          status: 400,
        }
      );
    }

    const {
      expectedVersion,
      idempotencyKey,
    } = validation.data;

    const adminSupabase = createAdminSupabaseClient();

    // Avoid making another Gemini request when this operation
    // was already completed.
    const {
      data: existingResult,
      error: existingResultError,
    } = await adminSupabase
      .from("ai_triage_results")
      .select("id, journey_id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
      if (existingResultError) {
        console.error(
          "Existing triage lookup failed:",
          existingResultError
        );
      
        return NextResponse.json(
          {
            error: "Unable to check the triage request.",
            databaseError: {
              code: existingResultError.code,
              message: existingResultError.message,
              details: existingResultError.details,
              hint: existingResultError.hint,
            },
          },
          {
            status: 500,
          }
        );
      }

    if (existingResult) {
      if (existingResult.journey_id !== journeyId) {
        return NextResponse.json(
          {
            error:
              "This idempotency key belongs to another journey.",
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json({
        message: "This intake was already triaged.",
        result: {
          triageResultId: existingResult.id,
          journeyId,
          duplicate: true,
        },
      });
    }

    const {
      data: journey,
      error: journeyError,
    } = await adminSupabase
      .from("care_journeys")
      .select("id, current_state, version")
      .eq("id", journeyId)
      .maybeSingle();

    if (journeyError) {
      console.error(
        "Journey lookup failed:",
        journeyError
      );

      return NextResponse.json(
        {
          error: "Unable to load the care journey.",
        },
        {
          status: 500,
        }
      );
    }

    if (!journey) {
      return NextResponse.json(
        {
          error: "Care journey not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (journey.version !== expectedVersion) {
      return NextResponse.json(
        {
          error: "Journey version conflict.",
          expectedVersion,
          currentVersion: journey.version,
        },
        {
          status: 409,
        }
      );
    }

    if (
      journey.current_state !== "INTAKE_PENDING" &&
      journey.current_state !== "TRIAGE_PENDING"
    ) {
      return NextResponse.json(
        {
          error:
            `Journey cannot be triaged from state ` +
            `${journey.current_state}.`,
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: intake,
      error: intakeError,
    } = await adminSupabase
      .from("patient_intakes")
      .select(`
        id,
        reason_for_care,
        symptoms,
        symptom_duration,
        urgency_self_rating,
        additional_notes
      `)
      .eq("journey_id", journeyId)
      .maybeSingle();

    if (intakeError) {
      console.error(
        "Patient intake lookup failed:",
        intakeError
      );

      return NextResponse.json(
        {
          error: "Unable to load the patient intake.",
        },
        {
          status: 500,
        }
      );
    }

    if (!intake) {
      return NextResponse.json(
        {
          error: "Patient intake not found.",
        },
        {
          status: 404,
        }
      );
    }

    const triageResult = await analyzePatientIntake({
      reasonForCare: intake.reason_for_care,
      symptoms: intake.symptoms ?? [],
      symptomDuration: intake.symptom_duration,
      urgencySelfRating: intake.urgency_self_rating,
      additionalNotes: intake.additional_notes,
    });

    const modelName = process.env.GEMINI_MODEL;

    if (!modelName) {
      throw new Error(
        "GEMINI_MODEL is missing from .env.local"
      );
    }

    const {
      data: databaseResult,
      error: databaseError,
    } = await adminSupabase.rpc(
      "record_ai_triage_result",
      {
        p_journey_id: journeyId,
        p_expected_version: expectedVersion,
        p_model_name: modelName,
        p_prompt_version: "triage-v1",
        p_urgency_level:
          triageResult.urgencyLevel,
        p_confidence: triageResult.confidence,
        p_recommended_state:
          triageResult.recommendedState,
        p_requires_human_review:
          triageResult.requiresHumanReview,
        p_summary: triageResult.summary,
        p_rationale: triageResult.rationale,
        p_risk_indicators:
          triageResult.riskIndicators,
        p_raw_response: triageResult,
        p_idempotency_key: idempotencyKey,
      }
    );

    if (databaseError) {
      console.error(
        "Recording AI triage failed:",
        databaseError
      );

      const isConflict =
        databaseError.message
          .toLowerCase()
          .includes("version conflict") ||
        databaseError.message
          .toLowerCase()
          .includes("cannot be triaged");

      return NextResponse.json(
        {
          error: databaseError.message,
        },
        {
          status: isConflict ? 409 : 400,
        }
      );
    }

    return NextResponse.json(
      {
        message: "AI triage completed successfully.",
        triage: triageResult,
        result: databaseResult,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("AI triage request failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected server error occurred.",
      },
      {
        status: 500,
      }
    );
  }
}