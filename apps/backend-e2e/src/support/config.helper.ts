import { isEmpty } from 'class-validator';
import { urlBuilder } from 'nestjs-backend-common';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { DockerFixture } from './docker.fixture';
import { Logger } from './logger';

/**
 * @description Zitadel's issuer URL (for JWT audience) must match `ZITADEL_EXTERNALDOMAIN:TRAEFIK_EXPOSED_PORT`
 * FIXME: If we dockerize our integration tests, then there is a chance that I have to override or modify the URL in the backend.
 */
const zitadelIssuer =
  process.env.ZITADEL_ISSUER_URL ?? 'http://localhost:8080';
const appName = process.env.SERVICE_NAME; // It should have been set to ZITADEL_APP_NAME

if (isEmpty(appName)) {
  throw new Error('SERVICE_NAME environment variable is required');
}

const zitadelDir = '/zitadel-pat';
const userIdsDir = join(zitadelDir, 'user-ids');
const integrationTestDir = join(zitadelDir, 'integration-test');
const workspaceRoot = resolve(__dirname, '../../../../');
const localSetupDir = resolve(workspaceRoot, 'local-setup');
const apiUrl = urlBuilder(zitadelIssuer, 'api');
/**
 * @description Internal URLs for making actual HTTP requests from within Docker network
 */
const tokenEndpoint = urlBuilder(
  zitadelIssuer,
  'oauth',
  'v2',
  'token',
);

Logger.section('Read Values From Files');
Logger.log('Reading integration test client ID from config file...');
const integrationTestClientId = readFileSync(
  join(localSetupDir, 'client', `${appName}-client-id`),
  'utf-8',
);
Logger.log(
  'Reading integration test client secret from config file...',
);
const integrationTestClientSecret = readFileSync(
  join(localSetupDir, 'client', `${appName}-secret`),
  'utf-8',
);
Logger.log('Reading project ID from config file...');
const projectId = readFileSync(
  join(localSetupDir, 'pats', 'project-id'),
  'utf-8',
);
// TODO: 👇 Should I use VITE_OIDC_SCOPE?
const scopes = `openid profile email urn:zitadel:iam:org:project:id:${projectId}:aud urn:zitadel:iam:org:project:id:${projectId}:roles urn:zitadel:iam:user:metadata`;
Logger.log('Reading user ID from config file...');
const userUserId = readFileSync(
  join(localSetupDir, 'user-ids', 'user'),
  'utf-8',
);
Logger.log('Reading admin user ID from config file...');
const adminUserId = readFileSync(
  join(localSetupDir, 'user-ids', 'admin'),
  'utf-8',
);
Logger.log('Reading writer user ID from config file...');
const writerUserId = readFileSync(
  join(localSetupDir, 'user-ids', 'writer'),
  'utf-8',
);
Logger.log('Reading second writer user ID from config file...');
const writer2UserId = readFileSync(
  join(localSetupDir, 'user-ids', 'writer2'),
  'utf-8',
);
Logger.log('Reading integration test bot key from config file...');
const integrationTestBotKeyRaw = readFileSync(
  join(localSetupDir, 'pats', 'bot-key.json'),
  'utf-8',
);

Logger.section('Enrich bot key with decoded content');
const integrationTestBotKey: Omit<
  IntegrationTestBotKey,
  'decodedKeyContent'
> = JSON.parse(integrationTestBotKeyRaw);
const enrichedIntegrationTestBotKey: IntegrationTestBotKey = {
  ...integrationTestBotKey,
  decodedKeyContent: JSON.parse(
    Buffer.from(integrationTestBotKey.keyContent, 'base64').toString(
      'utf-8',
    ),
  ),
};

export const config = {
  apiUrl,
  userIds: {
    user: userUserId,
    admin: adminUserId,
    writer: writerUserId,
    writer2: writer2UserId,
  },
  integrationTest: {
    scopes,
    clientId: integrationTestClientId,
    userBotKey: enrichedIntegrationTestBotKey,
    clientSecret: integrationTestClientSecret,
  },
  tokenEndpoint,
  zitadelIssuer,
};

interface IntegrationTestBotKey {
  /** @example "2026-03-25T13:07:58.286916Z" */
  creationDate: string;
  /** @example "365656198390743043" */
  keyId: string;
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

/**
 * @description Extract credentials produced by `setup-zitadel` from the shared Docker volume onto the host.
 */
export function extractZitadelConfigFromDocker() {
  Logger.section('Extracting Config Files From Docker Volume');

  const hostDirectories = ['pats', 'client', 'user-ids'];

  for (const dir of hostDirectories) {
    mkdirSync(resolve(workspaceRoot, `local-setup/${dir}`), {
      recursive: true,
    });
  }

  const files = [
    {
      containerPath: join(integrationTestDir, 'bot-token'),
      hostFilePath: 'local-setup/pats/bot-token',
    },
    {
      containerPath: join(integrationTestDir, `${appName}-client-id`),
      hostFilePath: `local-setup/client/${appName}-client-id`,
    },
    {
      containerPath: join(integrationTestDir, `${appName}-secret`),
      hostFilePath: `local-setup/client/${appName}-secret`,
    },
    {
      containerPath: join(userIdsDir, 'admin'),
      hostFilePath: 'local-setup/user-ids/admin',
    },
    {
      containerPath: join(userIdsDir, 'user'),
      hostFilePath: 'local-setup/user-ids/user',
    },
    {
      containerPath: join(userIdsDir, 'writer'),
      hostFilePath: 'local-setup/user-ids/writer',
    },
    {
      containerPath: join(userIdsDir, 'writer2'),
      hostFilePath: 'local-setup/user-ids/writer2',
    },
    {
      containerPath: join(zitadelDir, 'project-id'),
      hostFilePath: 'local-setup/pats/project-id',
    },
    {
      containerPath: join(integrationTestDir, 'bot-key.json'),
      hostFilePath: 'local-setup/pats/bot-key.json',
    },
  ];

  for (const { containerPath, hostFilePath } of files) {
    DockerFixture.extractFile(
      workspaceRoot,
      containerPath,
      hostFilePath,
    );
  }
}
