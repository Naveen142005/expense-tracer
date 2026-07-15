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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Login token is missing." });

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const parameters = {
      format: "webp",
      invalidate: "true",
      overwrite: "true",
      public_id: getProfilePhotoPublicId(decodedToken.uid),
      timestamp: Math.floor(Date.now() / 1000),
    };

    return res.status(200).json({
      cloudName,
      apiKey,
      parameters,
      signature: signCloudinaryParameters(parameters, apiSecret),
    });
  } catch (error) {
    console.error("Unable to create Cloudinary upload signature:", error);
    return res.status(500).json({ error: "Unable to prepare the photo upload." });
  }
}
