import { Config } from '@remotion/cli/config';

// Kontener bez GPU: WebGL przez ANGLE + SwiftShader
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('png');
Config.setConcurrency(4);
// Przeglądarka zainstalowana w kontenerze (Remotion nie może tu pobrać własnej)
Config.setBrowserExecutable(process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell');
