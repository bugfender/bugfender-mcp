export function sdkSnippet(platform: string, appKey: string): string {
  switch (platform) {
    case "ios":
      return `Bugfender.activateLogger("${appKey}")`;
    case "android":
      return `Bugfender.init(this, "${appKey}", BuildConfig.DEBUG);`;
    case "web":
      return `Bugfender.init({ appKey: "${appKey}" });`;
    case "flutter":
      return `await Bugfender.activateLogger("${appKey}");`;
    default:
      throw new Error("platform must be one of ios, android, web, flutter");
  }
}
