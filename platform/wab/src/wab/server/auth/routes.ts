import {
  customTeamApiAuth,
  customTeamApiUserAuth,
} from "@/wab/server/auth/custom-api-auth";
import { DbMgr } from "@/wab/server/db/DbMgr";
import { UserPreferences } from "@/wab/server/entities/Entities";
import "@/wab/server/extensions";
import { logger } from "@/wab/server/observability";
import { isCustomPublicApiRequest } from "@/wab/server/routes/custom-routes";
import { getUser, superDbMgr, userDbMgr } from "@/wab/server/routes/util";
import {
  BadRequestError,
  UnauthorizedError,
} from "@/wab/shared/ApiErrors/errors";
import {
  ListAuthIntegrationsResponse,
  SelfResponse,
} from "@/wab/shared/ApiSchema";
import { ensureType } from "@/wab/shared/common";
import { getPublicUrl } from "@/wab/shared/urls";
import * as Sentry from "@sentry/node";
import { NextFunction, Request, Response } from "express";
import fs from "fs";
import passport from "passport";
import { AuthenticateOptionsGoogle } from "passport-google-oauth20";

export async function self(req: Request, res: Response) {
  const user = getUser(req);
  await superDbMgr(req).ensurePersonalWorkspace(user);
  const preferences = await req.noTxMgr.findOne(UserPreferences, {
    userId: user.id,
  });
  user.extraData = preferences?.extraData ?? null;
  res.json(
    ensureType<SelfResponse>({
      user,
      isAdmin: req.shiguangIdentity?.roles.includes("system-admin") ?? false,
      observer: req.cookies?.["plasmic-observer"] === "true",
    }),
  );
}

async function extractApiTeam(req: Request) {
  const teamToken = req.headers["x-plasmic-team-token"];
  if (teamToken && typeof teamToken === "string") {
    const mgr = superDbMgr(req);
    const token = await mgr.getTeamApiToken(teamToken);
    if (token) {
      const team = await mgr.getTeamById(token.teamId);
      req.apiTeam = team;
      return team;
    }
  }
  return undefined;
}

/**
 * Checks if request is using a Team API token. Populates
 * req.apiTeam if so.
 */
export async function teamApiAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await extractApiTeam(req);
  await customTeamApiAuth(req, res, next);
}

/**
 * Checks if request is using a Team API token, acting on behalf of
 * a specific user.  Populates req.apiTeam and req.user if so.
 */
export async function teamApiUserAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await extractApiTeam(req);
  if (req.headers["x-plasmic-external-user"]) {
    throw new UnauthorizedError("User impersonation is not supported");
  }
  await customTeamApiUserAuth(req, res, next);
}

/**
 * Returns true if request is not coming from our Studio app, but from
 * users explicitly using the REST API with credentials. These requests
 * should be exempt from csrf checks.
 */
export function isPublicApiRequest(req: Request) {
  return (
    // project ID and project tokens; mainly used from CLI
    req.body?.projectIdsAndTokens ||
    req.headers?.["x-plasmic-api-project-tokens"] ||
    // CMS
    req.headers?.["x-plasmic-api-cms-tokens"] ||
    // Team API token
    req.headers?.["x-plasmic-team-token"] ||
    isCustomPublicApiRequest(req)
  );
}

function callbackHtml(_authStatus: string) {
  const _publicUrl = getPublicUrl();

  // TODO Ideally we have something a bit safer.
  // Call eval() on callback.html, which isn't actually HTML.
  // callback.html is actually a template string, so it can access variables
  // in the current scope. See the "${JSON.stringify(var)}" in the "HTML".
  return eval(
    "`" +
      fs.readFileSync(__dirname + "/callback.html", { encoding: "utf8" }) +
      "`",
  );
}

export async function authApiTokenMiddleware(
  req: Request,
  res: Response | null,
  next: NextFunction,
) {
  const email = req.headers["x-plasmic-api-user"];
  const token = req.headers["x-plasmic-api-token"];

  if (!email || !token) {
    return next();
  }

  const mgr = superDbMgr(req);
  const { apiToken, user } = await getApiTokenUser(
    mgr,
    email as string,
    token as string,
  );
  if (!apiToken) {
    throw new UnauthorizedError("Invalid API token");
  }

  if (!user) {
    throw new UnauthorizedError(
      `Error - the email in plasmic.json (${email}) must match the email of the API token (${
        apiToken.user?.email || "<unknown>"
      }), which is the email you use to sign into Plasmic.`,
    );
  }
  if (req.shiguangIdentity && req.shiguangIdentity.sub !== user.id) {
    throw new UnauthorizedError("Conflicting identity credentials");
  }
  req.user = user;
  next();
}

export function apiAuth(
  req: Request,
  res: Response | null,
  next: NextFunction,
) {
  // Simply having a projectIdsAndTokens (even if it's empty/invalid) in the
  // body means we don't have to provide more user friendly checks. The actual
  // authorization depends on the specific projects accessed by the API method.
  if (req.body.projectIdsAndTokens) {
    return next();
  }
  if (req.headers["x-plasmic-api-project-tokens"]) {
    // same for if project tokens are specified as the headers
    return next();
  }
  if (req.headers["x-plasmic-api-cms-tokens"]) {
    // if cms tokens are specified, also allow
    return next();
  }
  if (req.user) {
    // If there's an authenticated user -- because this request was made from
    // within the Studio, or with x-plasmic-api-token/user pair -- then also allow.
    return next();
  }
  if (!req.headers["x-plasmic-api-token"]) {
    // not a API token requests
    throw new UnauthorizedError(
      "Missing API token - make sure your plasmic.auth have the 'token' field.",
    );
  }
  if (!req.headers["x-plasmic-api-user"]) {
    throw new UnauthorizedError(
      "Missing API user - make sure your plasmic.auth have the 'user' field.",
    );
  }

  throw new UnauthorizedError("Unauthenticated API request.");
}

export async function getApiTokenUser(
  mgr: DbMgr,
  email: string,
  token: string,
) {
  const apiToken = await mgr.getPersonalApiToken(token as string);
  if (!apiToken) {
    return {};
  }

  const user = await mgr.tryGetUserById(apiToken.userId);
  if (!user || !["USER_STATE_ACTIVE", "STATE_ACTIVE"].includes(user.state)) {
    return { apiToken };
  }

  if (user.email.toLowerCase() !== email.toLowerCase()) {
    return { apiToken };
  }

  return { apiToken, user };
}

export async function airtableLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await new Promise<void>((resolve) =>
    passport.authenticate("airtable", {}, () => resolve())(req, res, next),
  );
}

export async function airtableCallback(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await new Promise<void>((resolve) =>
    passport.authenticate(
      "airtable",
      async (err: Error, row: { id: string }, info: { message?: string }) =>
        (async () => {
          logger().error(`AUTH CALLBACK`, { err, row, info });
          if (err) {
            const errName = `${err}`;
            logger().error(`could not airtable auth due to error: ${errName}`);
            Sentry.captureException(err);
            res.send(callbackHtml(errName));
            return;
          }
          res.send(callbackHtml(`Success`));
        })().then(() => resolve()),
    )(req, res, next),
  );
}

export async function googleSheetsLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const prompt = req.query.force ? { prompt: "consent" } : {};
  await new Promise<void>((resolve) =>
    passport.authenticate(
      "google-sheets",
      {
        ...prompt,
        accessType: "offline",
        scope: [
          "email",
          "profile",
          "openid",
          "https://www.googleapis.com/auth/spreadsheets",
        ],
      } as AuthenticateOptionsGoogle,
      () => resolve(),
    )(req, res, next),
  );
}

export async function googleSheetsCallback(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await new Promise<void>((resolve) =>
    passport.authenticate(
      "google-sheets",
      async (err: Error, row: { id: string }, info: { message?: string }) =>
        (async () => {
          logger().error(`AUTH CALLBACK`, { err, row, info });
          if (err) {
            const errName = `${err}`;
            logger().error(`could not google-sheets due to error: ${errName}`);
            Sentry.captureException(err);
            res.send(callbackHtml(errName));
            return;
          }

          res.send(callbackHtml(`Success`));
        })().then(() => resolve()),
    )(req, res, next),
  );
}

export async function getUserAuthIntegrations(req: Request, res: Response) {
  const dbMgr = userDbMgr(req);
  const user = req.user;
  if (!user) {
    res.json({ providers: [] });
    return;
  }
  const providers = await dbMgr.getUserTokenProviders();
  res.json({
    providers: providers.map((p) => {
      return { name: p.provider, id: p.id };
    }),
  } as ListAuthIntegrationsResponse);
}

export async function updatePreferences(req: Request, res: Response) {
  const user = getUser(req);
  const { extraData } = req.body;
  if (typeof extraData !== "string" || extraData.length > 65536) {
    throw new BadRequestError("Invalid editor preferences");
  }
  let value: unknown;
  try {
    value = JSON.parse(extraData);
  } catch {
    throw new BadRequestError("Invalid editor preferences");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("Invalid editor preferences");
  }
  await req.noTxMgr.save(UserPreferences, { userId: user.id, extraData });
  res.json({});
}
