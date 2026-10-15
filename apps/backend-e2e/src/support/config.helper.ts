import { urlBuilder } from 'nestjs-backend-common';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { Logger } from './logger';

/**
 * @description Zitadel's issuer URL (for JWT audience) must match `ZITADEL_EXTERNALDOMAIN:TRAEFIK_EXPOSED_PORT`
 * FIXME: If we containerize our integration tests, then there is a chance that I have to override or modify the URL in the backend.
 */
const zitadelIssuer =
  process.env.ZITADEL_ISSUER_URL ?? 'http://localhost:8080';
const workspaceRoot = resolve(__dirname, '../../../../');
const zitadelEnvDir = resolve(
  workspaceRoot,
  'infra/terraform/envs/local-zitadel',
);
const apiUrl = urlBuilder(zitadelIssuer, 'api');
/**
 * @description URLs for making actual HTTP requests to ZITADEL through the ingress
 */
const tokenEndpoint = urlBuilder(
  zitadelIssuer,
  'oauth',
  'v2',
  'token',
);

interface ZitadelOutputs {
  project_id: { value: string };
  user_ids: {
    value: Record<'admin' | 'user' | 'writer' | 'writer2', string>;
  };
  integration_test: {
    value: {
      client_id: string;
      client_secret: string;
      /** The bot's JSON key file. */
      bot_key: string;
    };
  };
}

Logger.section('Read Values From Terraform Outputs');
const outputs: ZitadelOutputs = JSON.parse(
  execSync(`terraform -chdir=${zitadelEnvDir} output -json`, {
    encoding: 'utf-8',
  }),
);
const projectId = outputs.project_id.value;
const userIds = outputs.user_ids.value;
const integrationTest = outputs.integration_test.value;
// TODO: 👇 Should I use VITE_OIDC_SCOPE?
const scopes = `openid profile email urn:zitadel:iam:org:project:id:${projectId}:aud urn:zitadel:iam:org:project:id:${projectId}:roles urn:zitadel:iam:user:metadata`;

const enrichedIntegrationTestBotKey: IntegrationTestBotKey = {
  keyContent: Buffer.from(integrationTest.bot_key).toString('base64'),
  decodedKeyContent: JSON.parse(integrationTest.bot_key),
};

export const config = {
  apiUrl,
  userIds: {
    user: userIds.user,
    admin: userIds.admin,
    writer: userIds.writer,
    writer2: userIds.writer2,
  },
  integrationTest: {
    scopes,
    clientId: integrationTest.client_id,
    userBotKey: enrichedIntegrationTestBotKey,
    clientSecret: integrationTest.client_secret,
  },
  tokenEndpoint,
  zitadelIssuer,
};

interface IntegrationTestBotKey {
  /**
   * @example "eyJ0eXBlIjoic2VydmljZWFjY291bnQiLCJrZXlJZCI6IjM2NTY1NjE5ODM5MDc0MzA0MyIsImtleSI6Ii0tLS0tQkVHSU4gUlNBIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUVwQUlCQUFLQ0FRRUE1Z2lrdjdHOTlMellBZ001aCtkeUFNQ3ZMVzVkOTRnRmlVMEs4VlFVelF1K3dUUXJcbmN6YTVQUHBMVGtZRWU1Mm9FeUZ5N2RqS2VrOE1xbEp5c2pzQ214ZGNhT2xOYWx3UENBSk5WZWUxcmd3aFRlVHZcbjRCT0NhQjFEZGlMbWthdTJXNU80dlU2Y0VabUR4ZG84R09wbmhaWnBWMitsMnJVbnVacjV1cTFUTEtHRjJqYklcbmV5WTJYT1F1K3JBK1Y1eko4NFRMU1BzNmxnYTFURHJzVjVhVmlkVmVMQWxTUXJTOVdQUThZaURIdVlSM3J3dDRcbnFLaEVSVkRFUDlEZllGb1NYNm9Ka3pKRGVkb1ZEUGdYZXYvWDh3QmFJN1JhTzFIN294am4zUEd6VnBRYWRZQmpcbnpjM0tLd1l6SXM4eHVzbWMxazhGaDQrVnBNSy9RaHJnMUJqRFBRSURBUUFCQW9JQkFEVTNBSzNiOTM2N2hSa0tcbkYvQUpxY1Rrem1Hcks0L001c0w1a0xOOWFRWjZWaG1wOFBkSlRKYi9yQllpZW4wQ1h0UjJJM2xFY3FyU3lMSktcbk9vQml5RnFLai9VeEs1aVVUV0hqN25JV0ZXQjdLK1V5TmcvWFU0NjBYbHZnL1FmcitsYTdHTHlxaDg1R2ZrWnlcbkV2OE1rd0JEYUlFeXNlS2pqOW9QTVFCdmdsTkxaalFYNVJXM0lqdSszaEpuOEt5bWtERUluSWZwN3ZqM0g5a2Rcbit1cEZJdC9IamFsNVNUeFNsRk8yNHpKZ3Y3eHVZRjNhdXoxVTFRaXhGTTJ1SWp0S2pLZWk2UlVIeEZIU0dyeVlcbjVCakxKSExzODlBVThwNUkxRVkzUHd4aTRjNG8zY0Y0cUVrRTg4U04rcDFGVjRXTjdGbHZubHJoQVFaOVBOdTFcbkVZeGdJWUVDZ1lFQStQMURxc1U0TExaKzZWZTdiL21MU2ZXbG0wNCtsS1draFZuMW9DdUNuN3h4NG1TVW5IcW5cbjUyblAzM1pCL2VDZDhWYURTVVk4YUNwOEF6NTJJUVZ3M2FEY2lRVnZrdjQvM1NDazBHdkpsam52RnUzalV5b2FcbmxYSWV5cklqZ2RQYmR4UWZlQVlUeTQ5ODVzVkZ1MFlTeGphM1F1Qlc5aGlPdkQ0OGpaYnRsQjBDZ1lFQTdJSytcbi9OdXk1K0dUeTJHa3FxQytza3paS3FzbDVhSHVwTGpQL25HL0V4M29jdVdkT1I5NEdReDhQSHJmdHhuMVNUdktcbms3ZDBoQTRxUU4ya2tYTVlOMHE1Qmw4dEdHKzkzdjRjcUl0WmZoWlJvbHZxQVplcTR0YTdnK015RFBQMTRoSCtcblEzaS8xeXZwT0xreEd0SUlUK3daNnJKeHBaNDdmSFMvc005OGdhRUNnWUVBa2FhTnE5cmNob05tOEJjTEpYQ0Rcbnc0cjRDa2FXSXh4V2hrOWVlUWlheTloUGdsQzJBbWRaeXV4QjFvVjJDdzRYTm5NV0w0bnZranV2K2JIVEpuUHBcblZ5eGZkYVFCWmFwbkwzS0dGd25HamFOc01peU1lenk0K2swY3FCUFc0MzVMOW5lR0JROEJDMlh2ZVl0U3hEODBcbmdsREZtVkJrYm1kbEw4YjBZeHN6OVIwQ2dZRUF1bjB0MDN2NHlkYVpEeGxqR2hlOXhpSEthMWFnZnp6OFMyNWVcbnN5ZEZudkZLUks3QkZqVzJJU296SEExWE1hMktOOENwcjJoTXU0UGYxVjN2VWJFTE95MzBUdzNsSlF1WEQ2b1hcbk50OEtKZDI3YU9aSTBoQ2hjbFFYYjV0SjcrUzkwUkNYQ09UQmdBemp6Ukpab2VoVEhaSHhyWm9lK3BTV0cwQ0RcbmxndEZCWUVDZ1lBdFd1bEVJK3FFcEF2WktLZ1N6NWtpQldQUE1CWm9tM3VWaXJzTWdsRXVQTVZTNlBrcVlPczBcbkV3MUtxNWt5anFkbytPSWkvRG40SGNWcU9ja1VTYjIrekJnY1h4MzQ4MnRzV1RoNzVzZm0zbVduZGpzZGY5YTFcbkNpS3R0bDMxN0NQbmp5Z1dDb3hvRHVrKzdmdlczR2xpTXVXaWVwWmlOem5RaEdnallOQ3Erdz09XG4tLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLVxuIiwiZXhwaXJhdGlvbkRhdGUiOiI5OTk5LTEyLTMxVDIzOjU5OjU5WiIsInVzZXJJZCI6IjM2NTY1NjE5ODM1NzE4ODYxMSJ9"
   */
  keyContent: string;
  decodedKeyContent: DecodedKeyContent;
}
interface DecodedKeyContent {
  /**
   * @description Key type
   * @example "serviceaccount"
   */
  type: string;
  /** @example "365656198390743043" */
  keyId: string;
  /** @example "365656198357188611" */
  userId: string;
  /**
   * @description A PEM-encoded private key.
   * @example "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----"
   * */
  key: string;
  /** @example "9999-12-31T23:59:59Z" */
  expirationDate: string;
}
