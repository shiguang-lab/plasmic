import { Config } from "@/wab/server/config";
import { User } from "@/wab/server/entities/Entities";
import { superDbMgr } from "@/wab/server/routes/util";
import {
  getAirtableSsoSecrets,
  getGoogleSheetsClientId,
  getGoogleSheetsClientSecret,
} from "@/wab/server/secrets";
import { assert, asyncToCallback, ensure } from "@/wab/shared/common";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import OAuth2Strategy from "passport-oauth2";
import refresh from "passport-oauth2-refresh";

/** Passport is used only for connecting external data sources, never for signing in. */
export async function setupDataSourceOAuth(config: Config) {
  const airtableSsoSecrets = getAirtableSsoSecrets();
  if (airtableSsoSecrets) {
    const airtableStrategy = new OAuth2Strategy(
      {
        authorizationURL: "https://airtable.com/oauth2/v1/authorize",
        tokenURL: "https://airtable.com/oauth2/v1/token",
        clientID: airtableSsoSecrets.clientId,
        clientSecret: airtableSsoSecrets.clientSecret,
        callbackURL: `${config.host}/api/v1/oauth2/airtable/callback`,
        customHeaders: {
          Authorization: `Basic ${Buffer.from(
            `${airtableSsoSecrets.clientId}:${airtableSsoSecrets.clientSecret}`,
          ).toString("base64")}`,
        },
        state: true,
        pkce: true,
        passReqToCallback: true,
        scope: ["data.records:read", "data.records:write", "schema.bases:read"],
      },
      (req, accessToken, refreshToken, profile, done) =>
        asyncToCallback(done, async () => {
          const mgr = superDbMgr(req);
          const user = await mgr.tryGetUserById(req.user.id);
          assert(user, "Oauth2Error: unable to get user");
          const row = await mgr.upsertOauthToken(
            user.id,
            "airtable",
            { accessToken, refreshToken },
            {},
          );
          return row;
        }),
    );
    passport.use("airtable", airtableStrategy);
    refresh.use("airtable", airtableStrategy);
  }

  // Google Sheets
  const googleSheetsClientId = getGoogleSheetsClientId();
  const googleSheetsClientSecret = getGoogleSheetsClientSecret();
  if (googleSheetsClientId && googleSheetsClientSecret) {
    const googleStrategy = new GoogleStrategy(
      {
        clientID: googleSheetsClientId,
        clientSecret: googleSheetsClientSecret,
        callbackURL: `${config.host}/api/v1/oauth2/google-sheets/callback`,
        passReqToCallback: true,
        state: true,
      },
      (req, accessToken, refreshToken, profile, done) =>
        asyncToCallback<User | undefined>(done, async () => {
          const mgr = superDbMgr(req);
          const user = await mgr.tryGetUserById(
            ensure(req.user, "Should have a user").id,
          );
          assert(user, "Oauth2Error: unable to get user");
          const row = await mgr.upsertOauthToken(
            user.id,
            "google-sheets",
            { accessToken, refreshToken },
            {},
          );
          return undefined;
        }),
    );
    passport.use("google-sheets", googleStrategy);
    refresh.use("google-sheets", googleStrategy);
  }
}
