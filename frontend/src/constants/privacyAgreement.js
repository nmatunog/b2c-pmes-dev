/**
 * Single privacy / data protection notice for the whole B2C PMES app and marketing site.
 * Grounded in the Data Privacy Act of 2012 (RA 10173). Shown on the landing “Data privacy”
 * modal and on the PMES consent screen (plus an extra consent line before “I Agree”).
 */

/** Page / modal title — keep in sync wherever the notice appears. */
export const PRIVACY_NOTICE_HEADING = "Privacy & data notice";

/**
 * Shared body copy (no action-specific closing). Use everywhere we explain the policy at a glance.
 * @type {readonly string[]}
 */
export const PRIVACY_NOTICE_PARAGRAPHS = [
  'B2C Consumers Cooperative ("B2C") respects your privacy under the Data Privacy Act of 2012 (Republic Act No. 10173) and related issuances. This notice describes how we collect, use, store, and share personal information across our digital services and cooperative operations.',
  "This applies to the Pre-Membership Education Seminar (PMES) and member portal, account registration and sign-in, certificates and assessment or exam records, letters of intent, member profile updates, and other activities supported by this application—including communications about your membership and patronage where applicable.",
  "We collect only what we need to run these services responsibly—for example name, contact details, date of birth, gender where applicable, residence or address, account identifiers, and PMES or exam outcomes. We use this information for PMES administration, issuance of certificates, maintaining registry and records as required by the Cooperative Development Authority (CDA) or other law and policy, patronage refunds and dividends where the rules apply, and to support cooperative business such as online ordering and fulfillment when you use those services.",
  "We rely on industry-standard providers (including secure cloud hosting and authentication). Data may be processed on systems located outside your country of residence, subject to appropriate safeguards and applicable law.",
  "We do not sell your personal information. Access is limited to authorized B2C personnel and systems that need it to operate PMES and member services. We may disclose information to regulators such as the CDA where required, and to partners such as delivery or payment processors only to the extent needed to provide the services you request.",
  "We retain personal information only as long as necessary for these purposes or as required by law. You may request access to or correction of your personal data, or raise privacy concerns, through B2C’s official contact channels (website, office, or published notices).",
];

/**
 * PMES consent screen only: shown after {@link PRIVACY_NOTICE_PARAGRAPHS}, before the “I Agree and Continue” control.
 */
export const PRIVACY_PMES_CONSENT_CLOSING =
  'By clicking "I Agree and Continue," you confirm that you have read this notice and consent to the collection and use of your information as described above for PMES and related member services.';
