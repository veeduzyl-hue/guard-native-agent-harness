import { readFile } from "node:fs/promises";

export const reviewProfileIds = ["local-dev", "ci-pr", "release-prep", "audit-review"] as const;

export type ReviewProfileId = (typeof reviewProfileIds)[number];

export interface ReviewProfileEvidenceFile {
  path: string;
  role: string;
  required: boolean;
}

export interface ReviewProfileInspectionOutput {
  path: string;
  format: "json" | "markdown";
  description: string;
}

export interface ReviewProfileSection {
  section_id: string;
  display_name: string;
  focus: string;
}

export interface ReviewProfileMetadata {
  schema_version: "guard-native-evidence-review-profile.v0.5";
  profile_id: ReviewProfileId;
  display_name: string;
  description: string;
  intended_context: string;
  required_evidence_files: ReviewProfileEvidenceFile[];
  expected_verifiers: string[];
  inspection_outputs: ReviewProfileInspectionOutput[];
  review_sections: ReviewProfileSection[];
  boundary: {
    approval: false;
    enforcement: false;
    autonomous_execution: false;
    runtime_control_plane: false;
    authority_grant: false;
    provider_output_authorizes_execution: false;
  };
  non_goals: string[];
}

export class ReviewProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewProfileError";
  }
}

export function isReviewProfileId(value: string): value is ReviewProfileId {
  return reviewProfileIds.includes(value as ReviewProfileId);
}

export function formatReviewProfileIds(): string {
  return reviewProfileIds.join(", ");
}

export async function loadReviewProfile(profileId: string): Promise<ReviewProfileMetadata> {
  if (!isReviewProfileId(profileId)) {
    throw new ReviewProfileError(
      `Unknown review profile: ${profileId}. Expected one of: ${formatReviewProfileIds()}.`
    );
  }

  const profilePath = new URL(`../../fixtures/v0.5/review-profiles/${profileId}.profile.json`, import.meta.url);
  const profile = JSON.parse(await readFile(profilePath, "utf8")) as ReviewProfileMetadata;

  if (profile.profile_id !== profileId) {
    throw new ReviewProfileError(`Review profile fixture mismatch for: ${profileId}.`);
  }

  return profile;
}
