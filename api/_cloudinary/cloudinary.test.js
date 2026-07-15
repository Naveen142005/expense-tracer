import assert from "node:assert/strict";
import test from "node:test";
import {
  getProfilePhotoPublicId,
  signCloudinaryParameters,
} from "./cloudinary.js";

test("creates a stable user-scoped profile photo public id", () => {
  assert.equal(
    getProfilePhotoPublicId("user-123"),
    "expense-tracker/profile-images/user-123/avatar"
  );
});

test("signs Cloudinary parameters in canonical key order", () => {
  const signature = signCloudinaryParameters(
    {
      timestamp: 1700000000,
      public_id: "expense-tracker/profile-images/user-123/avatar",
      overwrite: "true",
      invalidate: "true",
      format: "webp",
    },
    "test-secret"
  );

  assert.equal(signature, "26ae148dbaa24c34877c45c44d8b38ef4bd66d98");
});
