import { ApiUser, UserId } from "@/wab/shared/ApiSchema";
import {
  fullName,
  fullNameAndEmail,
  fullNameLastAbbreviated,
} from "@/wab/shared/ApiSchemaUtil";

const profile: ApiUser = {
  id: "iam-sub" as UserId,
  email: "email@domain.com",
  displayName: "拾光用户",
  loginName: "user",
  state: "STATE_ACTIVE",
  emailVerified: true,
};
it("uses the IAM display name without splitting names or inventing account data", () => {
  expect(fullName(profile)).toBe("拾光用户");
  expect(fullNameAndEmail(profile)).toBe("拾光用户 (email@domain.com)");
  expect(fullNameLastAbbreviated(profile)).toBe("拾光用户");
});
it("falls back to directory email for an empty display name", () => {
  expect(fullName({ ...profile, displayName: "" })).toBe("email@domain.com");
});
