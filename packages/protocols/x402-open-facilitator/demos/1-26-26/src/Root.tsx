import { Composition } from "remotion";
import { OpenFacilitatorHypeV2 } from "./OpenFacilitatorHypeV2";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="OpenFacilitatorHypeV2"
        component={OpenFacilitatorHypeV2}
        durationInFrames={30 * 65}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="OpenFacilitatorHypeV2-Vertical"
        component={OpenFacilitatorHypeV2}
        durationInFrames={30 * 65}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};
