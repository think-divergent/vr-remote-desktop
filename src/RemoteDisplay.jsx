import { useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import { useEffect, useMemo, useState } from "react";
import {
  BackSide,
  MirroredRepeatWrapping,
  Vector2,
  WebGLRenderer,
  sRGBEncoding,
} from "three";

export default function RemoteDisplay({
  video,
  centralAngle = Math.PI / 2.4,
  radius = 1.4,
  transform = new XRRigidTransform({ y: 1.015 }),
}) {
  const renderer = useThree((s) => s.gl);
  const isPresenting = useXR((s) => s.isPresenting);
  const layer = useMemo(
    () => (isPresenting ? createLayer(renderer, video) : null),
    [renderer, isPresenting, video]
  );

  //useRerenderOnAspectRatioChange(video);
  const aspectRatio = Number.isFinite(video.videoWidth / video.videoHeight)
    ? video.videoWidth / video.videoHeight
    : 16 / 9;

  useEffect(() => {
    if (!layer) return;
    //layer.centralHorizontalAngle = centralAngle;
    layer.centralHorizontalAngle = centralAngle;
    layer.radius = radius;
    layer.lowerVerticalAngle = -centralAngle/4
    layer.upperVerticalAngle = centralAngle/4
    //layer.transform = transform;
    //layer.aspectRatio = aspectRatio
  }, [layer, centralAngle, radius, transform, aspectRatio]);

  const material = layer ? (
    <meshBasicMaterial side={BackSide} colorWrite={false} />
  ) : (
    <meshBasicMaterial side={BackSide}>
      {video&& <videoTexture
        args={[video]}
        attach="map"
        encoding={sRGBEncoding}
      /> }
    </meshBasicMaterial>
  );

  return <></>
  return (
    <mesh position={[0, transform.position.y, 0]}>
      <cylinderGeometry
        args={[
          radius,
          radius,
          (centralAngle * radius) / aspectRatio, // height
          16, // segments
          1, // height segments
          true, // open ended
          Math.PI - centralAngle / 2, // theta start
          centralAngle, // theta length
        ]}
      />
      {material}
    </mesh>
  );
}

function createLayer(renderer,video) {
  const session = renderer.xr.getSession();
  if (!session) throw Error("no session");
  const space = renderer.xr.getReferenceSpace();
  if (!space) throw Error("no ref space");
  const xrMediaFactory = new window.XRMediaBinding(session);
  const transform = new XRRigidTransform(
    {x:0, y:0.5, z:0},
    {x:0.3, y:0, z:0}
  )
  const layer = xrMediaFactory.createEquirectLayer(video, { space, transform });
  session.updateRenderState({ layers: [layer, renderer.xr.getBaseLayer()] });
  return layer;
}

function useRerenderOnAspectRatioChange(video) {
  const [, set] = useState(0);
  useEffect(() => {
    const forceRerender = () => set((x) => x + 1);
    video.addEventListener("loadedmetadata", forceRerender);
    return () => video.removeEventListener("loadedmetadata", forceRerender);
  }, [video]);
}
