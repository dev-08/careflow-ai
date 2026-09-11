import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date of birth must use YYYY-MM-DD.",
  })
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value <= new Date().toISOString().slice(0, 10)
    );
  }, {
    message: "A valid date of birth is required.",
  });

const intakeSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(250),
  dateOfBirth: dateOfBirthSchema,

  reasonForCare: z.string().trim().min(5).max(2000),

  symptoms: z
    .array(z.string().trim().min(1).max(100))
    .max(20)
    .default([]),

  symptomDuration: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default(""),

  urgencySelfRating: z.number().int().min(1).max(10),

  additionalNotes: z
    .string()
    .trim()
    .max(3000)
    .optional()
    .default(""),

  consentToContact: z.literal(true, {
    message: "Consent to contact is required.",
  }),

  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const requestBody: unknown = await request.json();
    const validation = intakeSchema.safeParse(requestBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid intake submission.",
          details: validation.error.flatten(),
        },
        {
          status: 400,
        }
      );
    }

    const intake = validation.data;
    const adminSupabase = createAdminSupabaseClient();

    const { data, error } = await adminSupabase.rpc(
      "submit_patient_intake",
      {
        p_first_name: intake.firstName,
        p_last_name: intake.lastName,
        p_email: intake.email,
        p_date_of_birth: intake.dateOfBirth,
        p_reason_for_care: intake.reasonForCare,
        p_symptoms: intake.symptoms,
        p_symptom_duration:
          intake.symptomDuration || null,
        p_urgency_self_rating:
          intake.urgencySelfRating,
        p_additional_notes:
          intake.additionalNotes || null,
        p_consent_to_contact:
          intake.consentToContact,
        p_idempotency_key:
          intake.idempotencyKey,
      }
    );

    if (error) {
      console.error("Intake database operation failed:", error);

      const isValidationError =
        error.code === "P0001";

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: isValidationError ? 400 : 500,
        }
      );
    }

    const result = data as {
      duplicate?: boolean;
    };

    return NextResponse.json(
      {
        message: result.duplicate
          ? "This intake was already submitted."
          : "Intake submitted successfully.",
        result,
      },
      {
        status: result.duplicate ? 200 : 201,
      }
    );
  } catch (error) {
    console.error("Intake submission failed:", error);

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