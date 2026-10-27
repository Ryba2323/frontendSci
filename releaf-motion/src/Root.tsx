import { Composition } from "remotion";
import { HiddenLogoLoop } from "./HiddenLogoLoop";
import { DURATION, FPS } from "./motion";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ReLeafHiddenLogoLoop"
      component={HiddenLogoLoop}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
