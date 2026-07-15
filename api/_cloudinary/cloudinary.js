import { createHash } from "node:crypto";

export function getRequiredCloudinaryEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is missing.`);
  return value;
}

export function getCloudinaryConfig() {
  return {
    cloudName: getRequiredCloudinaryEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: getRequiredCloudinaryEnv("CLOUDINARY_API_KEY"),
    apiSecret: getRequiredCloudinaryEnv("CLOUDINARY_API_SECRET"),
  };
}

export function getProfilePhotoPublicId(uid) {
  return `expense-tracker/profile-images/${uid}/avatar`;
}

export function signCloudinaryParameters(parameters, apiSecret) {
  const value = Object.entries(parameters)
    .filter(([, parameterValue]) => parameterValue !== undefined && parameterValue !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, parameterValue]) => `${key}=${parameterValue}`)
    .join("&");

  return createHash("sha1").update(`${value}${apiSecret}`).digest("hex");
}

export function sendApiCorsHeaders(req, res) {
  const requestOrigin = req.headers.origin;
  const configuredOrigins = String(process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigin =
    !requestOrigin || configuredOrigins.length === 0 || configuredOrigins.includes(requestOrigin)
      ? requestOrigin || "*"
      : configuredOrigins[0];

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization || "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
}
