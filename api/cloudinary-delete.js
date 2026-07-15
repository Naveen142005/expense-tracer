import { getAdminAuth } from "./_expenseAi/firebaseAdmin.js";
import {
  getBearerToken,
  getCloudinaryConfig,
  getProfilePhotoPublicId,
  sendApiCorsHeaders,
  signCloudinaryParameters,
} from "./_cloudinary/cloudinary.js";

export default async function handler(req, res) {
  sendApiCorsHeaders(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Login token is missing." });

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const parameters = {
      invalidate: "true",
      public_id: getProfilePhotoPublicId(decodedToken.uid),
      timestamp: Math.floor(Date.now() / 1000),
    };
    const body = new URLSearchParams({
      ...parameters,
      api_key: apiKey,
      signature: signCloudinaryParameters(parameters, apiSecret),
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok || (result.result !== "ok" && result.result !== "not found")) {
      throw new Error(result.error?.message || "Cloudinary could not delete the photo.");
    }

    return res.status(200).json({ removed: result.result === "ok" });
  } catch (error) {
    console.error("Unable to delete Cloudinary profile photo:", error);
    return res.status(500).json({ error: "Unable to remove the profile photo." });
  }
}
