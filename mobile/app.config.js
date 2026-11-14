const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

module.exports = ({ config }) => {
  const projectId = process.env.EXPO_PUBLIC_TUTA_PUSH_PROJECT_ID?.trim();
  const ios = Boolean(projectId && process.env.TUTA_PUSH_IOS === "1");
  const googleServicesFile = process.env.TUTA_PUSH_GOOGLE_SERVICES_FILE;
  const android = Boolean(projectId && googleServicesFile);
  if (!ios && !android) return config;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId))
    throw new Error("Tuta push requires a valid Expo project ID.");
  if (android && !existsSync(resolve(__dirname, googleServicesFile)))
    throw new Error("Tuta push requires an existing Firebase google-services.json file.");
  return {
    ...config,
    ...(android ? { android: { ...config.android, googleServicesFile } } : {}),
    extra: { ...config.extra, tutaPush: { projectId, ios, android } },
    plugins: [...(config.plugins || []), ["expo-notifications", { defaultChannel: "tuta-activity" }]],
  };
};
