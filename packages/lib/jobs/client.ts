import { JobClient } from './client/client';
import { SEND_CONFIRMATION_EMAIL_JOB_DEFINITION } from './definitions/emails/send-confirmation-email';
import { SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-recipient-signed-email';
import { SEND_SIGNING_REJECTION_EMAILS_JOB_DEFINITION } from './definitions/emails/send-rejection-emails';
import { SEND_SIGNING_EMAIL_JOB_DEFINITION } from './definitions/emails/send-signing-email';
import { SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-team-deleted-email';
import { SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION } from './definitions/emails/send-team-member-joined-email';
import { SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION } from './definitions/emails/send-team-member-left-email';
import { BULK_SEND_TEMPLATE_JOB_DEFINITION } from './definitions/internal/bulk-send-template';
import { DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION } from './definitions/internal/document-complete-processing';
import { SEAL_DOCUMENT_JOB_DEFINITION } from './definitions/internal/seal-document';

/**
 * The `as const` assertion is load bearing as it provides the correct level of type inference for
 * triggering jobs.
 */
export const jobsClient = new JobClient([
  SEND_SIGNING_EMAIL_JOB_DEFINITION,
  SEND_CONFIRMATION_EMAIL_JOB_DEFINITION,
  SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION,
  SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION,
  SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION,
  SEAL_DOCUMENT_JOB_DEFINITION,
  SEND_SIGNING_REJECTION_EMAILS_JOB_DEFINITION,
  SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION,
  BULK_SEND_TEMPLATE_JOB_DEFINITION,
  DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION,
] as const);

export const jobs = jobsClient;
