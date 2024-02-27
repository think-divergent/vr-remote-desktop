import logo from './logo.svg';
import * as THREE from 'three';
import {useMemo, useCallback, useState, useRef, useLayoutEffect} from 'react'
import './App.css';
import { RayGrab, stopSession, Interactive, XRButton, ARButton, XR, Controllers, Hands } from '@react-three/xr'
import { 
  Html, Circle, Box, OrbitControls, Plane, Sphere, Sky, useMatcapTexture ,
  Effects
} from '@react-three/drei'
import { useFrame, Canvas, useThree} from '@react-three/fiber'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader'
import { extend } from '@react-three/fiber'
import { EffectComposer, N8AO, Bloom} from '@react-three/postprocessing'
import { TAARenderPass } from 'three/examples/jsm/postprocessing/TAARenderPass';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import RFB from '@novnc/novnc/core/rfb';
import SignalingChannel from './SignalingChannel.js'
import RemoteDisplay from './RemoteDisplay'




extend({ TextGeometry, TAARenderPass, RenderPass, OutputPass })
const loader = new FontLoader();
const MAX_WIDTH = 7200
const MAX_HEIGHT = 3600
const DISPLAY_WIDTH = 6106
const DISPLAY_HEIGHT = 3384
const SUBDIVS= 3//32
const PPD = 20
const font = loader.load(
	// resource URL
	'fonts/Arial_Regular.json',

	// onLoad callback
	function ( font ) {
		// do something with the font
    //console.log( font );
	},

	// onProgress callback
	function ( xhr ) {
    //console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
	},

	// onError callback
	function ( err ) {
    //console.log( 'An error happened' );
	}
);

const createMeshForScreen = (video, gl) => {
  const width = video.videoWidth
  const height = video.videoHeight
  const pi = Math.PI
  const ppd = PPD
  const wRad = (width/ ppd)/ 360 * 2 * pi
  const hRad = (height/ ppd)/ 360 * 2 * pi
  const phiStart = pi -wRad / 2
  const thetaStart = (pi - hRad)/2
  const hSegs = SUBDIVS
  const wSegs = SUBDIVS
  const radius = 4
  const sHeight = height/(width/(wRad * radius)) 
  const geometry = new THREE.CylinderGeometry(
    radius, radius, sHeight, 
    wSegs, hSegs,  true,
    phiStart,
    wRad,
  );
  var uvAttr= geometry.attributes.uv;
  var posAttr = geometry.attributes.position;
  let minWidth = Math.cos(hRad/2) // this is the maximum width, at the top and bottom

  for ( var i = 0; i < uvAttr.count; i ++ ) {
    let x = posAttr.getX( i );
    let y = posAttr.getY( i );
    let z = posAttr.getZ(i);
    let u = 1-uvAttr.getX( i );
    let v = uvAttr.getY( i );
    let uRatio = (Math.sqrt(x**2 + z **2)/radius)/ minWidth
    console.log({x,y, z, u, v, uRatio})

    // do something with uv

    // write values back to attribute

    //uvAttr.setXY( i, (u-0.5)*uRatio + 0.5, v);
    uvAttr.setXY( i, u, v);

  }
  const material = new THREE.MeshBasicMaterial( { 
    transparent:true,
    //wireframe: true, 
    //color: 0xffff00 
  } );
  const texture = new THREE.VideoTexture(video) 
  texture.needsUppdate = true
  texture.colorSpace = THREE.SRGBColorSpace
  //canvasTexture.magFilter = THREE.LinearFilter
  texture.magFilter = THREE.NearestFilter
  //canvasTexture.minFilter = THREE.NearestMipmapLinearFilter
  texture.minFilter = THREE.NearestFilter
  texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  texture.generateMipmaps = false;
  material.side = THREE.BackSide
  material.map = texture
  material.flatShading = true
  material.toneMapped = false
  material.needsUppdate = true
  const mesh = new THREE.Mesh( geometry, material );
  return mesh
}
const FrameLimiter = (props) => {
  const [clock] = useState(new THREE.Clock());

  useFrame((state) => {
    state.ready = false;
    const timeUntilNextFrame = (1000 / props.fps) - clock.getDelta();

    setTimeout(() => {
      state.ready = true;
      state.invalidate();
    }, Math.max(0, timeUntilNextFrame));

  });

  return <></>;
};

function Scene({video, centralAngle}){
  return <XR>
    <RemoteDisplay video={video} centralAngle={centralAngle}/>
  </XR>
  /*
  const controlsRef = useRef(null)
  const [debugText, setDebugText] = useState("")
  const {gl, scene, camera} = useThree()
  const mesh = useMemo(() => {
    if(!video){
      return null
    }
    return createMeshForScreen(video, gl)
  }, [video])
  useLayoutEffect(() => {
    if(!controlsRef.current){
      return
    }
    let controls = controlsRef.current
    controls.object.position.set(0,0,0.00001)
    controls.target = new THREE.Vector3(0,0,0)
    controls.update()
    controls.saveState()
  },[])
  
  const onExit = useCallback(() => {
    stopSession()
  }, [])

  const onResetView = useCallback(() => {
    if(!controlsRef.current){
      return
    }
    let controls = controlsRef.current
    controls.target = new THREE.Vector3(0,0,0)
    controls.reset()
  }, [])

  useFrame(({camera}) => {
    const {position, rotation} = camera
    setDebugText(`
    Positon:
    x: ${position.x.toFixed(3)}
    y: ${position.y.toFixed(3)}
    z: ${position.z.toFixed(3)}

    Rotation:
    x: ${rotation.x.toFixed(3)}
    y: ${rotation.y.toFixed(3)}
    z: ${rotation.z.toFixed(3)}

    DevicePixelRatio: 
    ${devicePixelRatio}

    Canvas:
    w: ${video.videoWidth}
    h: ${video.videoHeight}
    `)
  })

  return <>
    <XR>
      <Controllers />
      <Hands />
      <RayGrab>
     <primitive object={mesh} position={[0, 0, 2.7]} />
   </RayGrab>
      <Html>
        <pre className="label" style={{color:"blue"}}>{debugText}</pre>
      </Html>
      <OrbitControls
        ref = {controlsRef}
      />
      <Circle 
        onClick={onExit}
        args={[2]} position={[-3,-7,-3]} rotation={[-1.5, 0, 0]} material-color="red"/> 
      <Circle 
        onClick={onResetView}
        args={[2]} position={[3,-7,-3]} rotation={[-1.5, 0, 0]} material-color="green"/> 
      <Circle 
        onClick={onExit}
        args={[2]} position={[-3,7,-3]} rotation={[1.5, 0, 0]} material-color="red"/> 
      <Circle 
        onClick={onResetView}
        args={[2]} position={[3,7,-3]} rotation={[1.5, 0, 0]} material-color="green"/> 

    </XR>
      <FrameLimiter fps={30}/>
      {<Effects disableGamma>
        <renderPass args={[scene, camera]}/>
        <tAARenderPass args={[scene, camera]}/>
        <outputPass args={[THREE.ACESFilmicToneMapping]} />
      </Effects>
      }
  </>
    */
}

const displayStream= (video2, pc2) => {
    /*
    pc1.createOffer().then(d => pc1.setLocalDescription(d))
      .then(() => {
        console.log(pc1.localDescription)
        pc2.setRemoteDescription(pc1.localDescription)
      })
      .then(() => pc2.createAnswer()).then(d => pc2.setLocalDescription(d))
      .then(() => pc1.setRemoteDescription(pc2.localDescription));
      */
}

const CLIENT_ID =  Date.now()
const PEER_CONNECTIONS = {}
function App2 (){
  const [initialized, setInitialized] = useState(false)
  const v2Ref= useRef(null)
  useLayoutEffect(() => {
    if(v2Ref.current?.videoWidth){
      setInitialized(true)
    }
  }, [v2Ref.current])
  const onVideoResize= useCallback(() => {
    setInitialized(true)
  }, [])
  return <>
  <XRButton mode="VR" 
    sessionInit={{ optionalFeatures: ["layers"] }}
    style={{padding: 32}}/>
    {initialized&&   <Canvas camera={{fov:120}}>
    <XR>
      <Controllers />
      <Hands />
      <mesh>
        <boxGeometry />
        <meshBasicMaterial color="blue" />
      </mesh>
      <RemoteDisplay video={v2Ref.current}/>
    </XR>
  </Canvas>}
    <video 
      onResize={onVideoResize}
      style={{
      position:"fixed", bottom:0, left:0,
    }} ref={v2Ref} muted autoPlay src="https://www.w3schools.com/html/mov_bbb.mp4"/>
</>

}
function App() {
  const imgRef = useRef(null)
  const canvasRef = useRef(null)
  const v1Ref= useRef(null)
  const v2Ref= useRef(null)
  const uiRef = useRef(null)
  const selectedStreamRef = useRef(null)
  const [initialized, setInitialized] = useState(false)
  const [displayWidth, setDisplayWidth] = useState(DISPLAY_WIDTH)
  const [displayHeight, setDisplayHeight] = useState(DISPLAY_HEIGHT)
  const [isRecving, setIsRecving] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(true)
  const [logs, setLogs] = useState("these are some logs ....")
  const pc2Ref = useRef(null)
  const serverChannelRef = useRef(null)
  let tgtWidth = Math.round((displayWidth / PPD) / 360 * MAX_WIDTH)
  let tgtHeight= Math.round((displayHeight/ PPD) / 180 * MAX_HEIGHT)
  const onLog = useCallback((args) => {
   setLogs(l=>`${l}\n${JSON.stringify(args)}\n`)
  }, [])
  const onRecv = useCallback(() => {
    if(!pc2Ref.current){
      let pc2 = new RTCPeerConnection()
      const token = "SIGNALING123";
      const url = `http://${window.location.hostname}:3030`
      console.log({url})
      const channel = new SignalingChannel(CLIENT_ID, url, token);
      channel.onMessage = async ({payload, message}) => {
        if(message?.type=="candidate"){
          pc2.addIceCandidate(message.data)
          console.log("Added ice candidate", message)
        } else if (message?.type=="offer"){
          await pc2.setRemoteDescription(message.data)
          let sdp= await pc2.createAnswer()
          var arr = sdp.sdp.split('\r\n');
          arr.forEach((str, i) => {
            if (/^a=fmtp:\d*/.test(str)) {
              arr[i] = str + ';x-google-max-bitrate=1000000;x-google-min-bitrate=0;x-google-start-bitrate=1000000';
            } else if (/^a=mid:(1|video)/.test(str)) {
              arr[i] += '\r\nb=AS:1000000';
            }
          });
          sdp = new RTCSessionDescription({
            type: 'answer',
            sdp: arr.join('\r\n'),
          })
          await pc2.setLocalDescription(sdp)
          channel.sendTo(
            'server', {
              type:'answer',
              data: sdp 
            }
          )
          console.log("Added remote desc ", message.data)
        } else if(payload?.action=='open'){
          setIsRecving(true)
        } else {
          console.log({payload, message});
        }
      };
      channel.connect();
      channel.sendTo("server", { type:"newClient" });
      pc2.ontrack = e => {
        v2Ref.current.srcObject = e.streams[0];
      }
      pc2.onicecandidate = e => {
        console.log("candidate", e)
        channel.sendTo("server", {
          type:'candidate', 
          data:e.candidate
        });
        console.log("Sent ice candidate")
      }
    }
    //initWebrtc(v1Ref.current, v2Ref.current, channel)
  }, [])

  const onVideoResize= useCallback(() => {
    setInitialized(true)
    setDisplayWidth(v2Ref.current.videoWidth) 
    setDisplayHeight(v2Ref.current.videoHeight) 
    //setIsFullScreen(true)
  }, [])
  const onShare = useCallback(() => {
    if(!serverChannelRef.current){
      const token = "SIGNALING123";
      let channel = new SignalingChannel("server", "http://localhost:3030", token);
      channel.onMessage = (data) => {
        console.log(data)
        const {from:clientId, payload, message} = data
        if(message?.type=="candidate"){
          console.log("received candidate")
          PEER_CONNECTIONS[clientId].addIceCandidate(message.data)
        } else if (message?.type=="answer") {
          console.log("received answer")
          PEER_CONNECTIONS[clientId].setRemoteDescription(message.data)
        } else if(message?.type=="newClient") {
          console.log("Found new client", clientId)
          let pc = new RTCPeerConnection()
          //debugger
          pc.onicecandidate = e=>{
            channel.sendTo(clientId, {
              type:'candidate',
              data: e.candidate
            });
            console.log('Sent ice candatae to client', e.candidate)
          } 
          pc.onnegotiationneeded = async e =>{
            const sender = pc.getSenders()[0];
            const parameters = sender.getParameters();
            parameters.encodings[0].maxBitrate = 80 * 1000 * 100;
            parameters.encodings[0].minBitrate = 10 * 1000 * 100;
            parameters.encodings[0].priority="high";
            parameters.encodings[0].networkPriority="high";
            sender.setParameters(parameters);
            let offer = await pc.createOffer()
            //debugger
            pc.setLocalDescription(offer)
            channel.sendTo(clientId, {
              type:'offer',
              data: offer
            })
            console.log("sent offer to client", offer)
          }
          setTimeout(() => {
            if(selectedStreamRef.current){
              pc.addStream(selectedStreamRef.current)
            }
          }, 500)
          PEER_CONNECTIONS[clientId] = pc
        } else {
          console.log({payload, message});
        }
      };
      channel.connect();
      channel.send("Hello from the first peer");
      channel.sendTo("testPeer2", { this: "is a test" });
      serverChannelRef.current = channel
    }
    navigator.mediaDevices.getDisplayMedia({exact:{width:99999}})
      .then(stream => {
        selectedStreamRef.current = stream
        //v2Ref.current.srcObject = selectedStreamRef.current
      });
    //initWebrtc(pc1Ref.current, v2Ref.current)
  }, [])
  useLayoutEffect(() => {
    //console.log = onLog
    //console.error= onLog
    if(!canvasRef.current){
      return
    }
    setTimeout(() => {
      return 
      /*
      const host = window.location.hostname;
      let port = 6080;
      const password = "woof";
      let rfb = new RFB(
        document.getElementById('source-canvas'), `wss://${host}:6080/websockify`,
        { credentials: { password: password } });
      return
      */
      console.log(canvasRef.current)
      const ctx = canvasRef.current.getContext("2d");
      console.log(ctx.canvas.width)
      ctx.drawImage(imgRef.current, 
        0, 0, 
        tgtWidth, tgtHeight,
        /*
        (MAX_WIDTH-tgtWidth)/2, 
        (MAX_HEIGHT-tgtHeight)/2, 
        tgtWidth,tgtHeight */
        /*
        0, 0, 
        displayWidth*2, displayHeight*2,
        */
      );
    }, 300)
  }, [canvasRef.current])
  const onFullScreen = useCallback(() => {
     uiRef.current.requestFullscreen()
  }, [])
  const width = displayWidth
  const pi = Math.PI
  const ppd = PPD
  const wRad = (width/ ppd)/ 360 * 2 * pi
  return (
    <>
      {true&&<div style={{
        flex:1, 
        display:"flex", justifyContent:"center", backgroundColor:"#777"}}>
        {initialized && <Canvas>
        <Scene video={v2Ref.current} centralAngle={wRad}/> 
        </Canvas>
        }
      </div>
      }
      <div 
        ref={uiRef}
        style={{
        backgroundColor:"black",
        top:0, left:0,
        width:isFullScreen?MAX_WIDTH:"100vw", 
        height:isFullScreen?MAX_HEIGHT:"100svh",
        position:"fixed",
        zIndex:1000,
        display:"flex",
        justifyContent:"center",
        alignItems:"center",
      }}>
        <video ref={v2Ref} style={{ 
          width: isFullScreen?tgtWidth:"100%", 
          height:isFullScreen?tgtHeight:"100%" 
        }} autoPlay
          onResize={onVideoResize}
        ></video>
      </div>
      <div style={{
        zIndex:1000,
        position:"fixed", top:16, left:16,}}>
      <button onClick={onFullScreen} style={{ padding: 16, 
        backgroundColor:"transparent", 
        border:"1px solid #aaa", color:"#aaa"}}>Full screen </button>
        <br/>
        <br/>
        <div>
        <XRButton 
          mode="VR"
          sessionInit={{ optionalFeatures: ["layers"] }}
          style={{
            padding:16, 
            backgroundColor:"red"
          }}
        />
        <br/>
        <br/>
      </div>
      <div style={{position:"fixed", top: 80, left:16, zIndex:1000}}>
      </div>
      {!isRecving && 
      <>
        <button onClick={onShare} style={{padding: 16, 
          backgroundColor:"transparent", 
          border:"1px solid #aaa", color:"#aaa", zIndex:1000}}>Share</button>
        <br/>
        <br/>
        <button onClick={onRecv} style={{padding: 16, 
          backgroundColor:"transparent", 
          border:"1px solid #aaa", color:"#aaa", zIndex:1000}}>Receive</button>
      </>
      }
      {isRecving && <div style={{color:"white"}}>
        Resolution: {displayWidth} x {displayHeight}
      </div>}
      </div>
      <pre style={{
        display:"none",
        position:"fixed", top:0, 
        width:500,
        left:200,  backgroundColor:"red",height:'100vh', zIndex:1001
      }}>
        {logs}
      </pre>
    </>
  )
}

export default App;
