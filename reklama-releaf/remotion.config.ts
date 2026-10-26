/**
 * Ustawienia renderu (CLI). Przy renderze przez Node API trzeba je podać osobno.
 * https://remotion.dev/docs/config
 */
import fs from "fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(96); // napisy i ekran aplikacji muszą zostać ostre
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Gdy Remotion nie może pobrać własnej przeglądarki (np. sieć w chmurze), użyj zainstalowanej
// (REMOTION_CHROME albo Chromium Headless Shell od Playwrighta).
const chrome = [
  process.env.REMOTION_CHROME,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].find((p) => p && fs.existsSync(p));
if (chrome) Config.setBrowserExecutable(chrome);
