import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const transitionSchema = z.object({
  expectedVersion: z.number().int().positive(),

  targetState: z.enum([
    "TRIAGE_PENDING",
    "CLINICIAN_REVIEW",
    "APPOINTMENT_SCHEDULED",
    "FOLLOW_UP_REQUIRED",
    "COMPLETED",
    "CANCELLED",
  ]),

  idempotencyKey: z.string().trim().min(8).max(200),

  reason: z.string().trim().min(3).max(500),
});




type RouteContext = {
  params: Promise<{
    journeyId: string;
  }>;
};

const eventTypes: Record<
  z.infer<typeof transitionSchema>["targetState"],
  string
> = {
  TRIAGE_PENDING: "TRIAGE_STARTED",
  CLINICIAN_REVIEW: "CLINICIAN_REVIEW_REQUESTED",
  APPOINTMENT_SCHEDULED: "APPOINTMENT_SCHEDULED",
  FOLLOW_UP_REQUIRED: "FOLLOW_UP_REQUIRED",
  COMPLETED: "JOURNEY_COMPLETED",
  CANCELLED: "JOURNEY_CANCELLED",
};

const postgresUuidSchema = z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "A valid PostgreSQL UUID is required."
  );
export async function POST(
    request: NextRequest,
    context: RouteContext
  ) {
    try {


        const authSupabase = await createServerSupabaseClient();

        const {
          data: { user },
          error: authError,
        } = await authSupabase.auth.getUser();
        
        if (authError || !user) {
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
  
      const validJourneyId =
        postgresUuidSchema.safeParse(journeyId);
  
      if (!validJourneyId.success) {
        return NextResponse.json(
          {
            error: "A valid journey ID is required.",
          },
          {
            status: 400,
          }
        );
      }
  
      const requestBody: unknown = await request.json();
      const validation = transitionSchema.safeParse(requestBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid transition request.",
          details: validation.error.flatten(),
        },
        {
          status: 400,
        }
      );
    }

    const {
      expectedVersion,
      targetState,
      idempotencyKey,
      reason,
    } = validation.data;

    const supabase = createAdminSupabaseClient();


    

    const { data, error } = await supabase.rpc(
      "transition_care_journey",
      {
        p_journey_id: journeyId,
        p_expected_version: expectedVersion,
        p_target_state: targetState,
        p_event_type: eventTypes[targetState],
        p_actor_type: "CLINICIAN",
        p_actor_id: user.id,
        p_idempotency_key: idempotencyKey,
        p_event_data: {
          reason,
          source: "careflow-api",
        },
      }
    );

    if (error) {
      const isConflict =
        error.message.includes("version conflict") ||
        error.message.includes("Invalid transition");

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: isConflict ? 409 : 500,
        }
      );
    }

    return NextResponse.json(
      {
        message: "Journey transitioned successfully.",
        result: data,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Journey transition failed:", error);

    return NextResponse.json(
      {
        error: "An unexpected server error occurred.",
      },
      {
        status: 500,
      }
    );
  }
}