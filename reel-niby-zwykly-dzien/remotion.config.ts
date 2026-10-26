/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// W środowisku bez dostępu do remotion.media: użyj zainstalowanego Chrome Headless Shell,
// jeśli istnieje (ścieżkę można też podać przez REMOTION_BROWSER).
import fs from 'node:fs';
const localShell = process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
if (fs.existsSync(localShell)) {
  Config.setBrowserExecutable(localShell);
}
