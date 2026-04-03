import React, { useEffect, useCallback, useState } from "react";
import peer from "../service/Peer";
import { useSocket } from "../context/SocketProvider";
import { useNavigate } from "react-router-dom";

const RoomPage = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [isStreamSent, setIsStreamSent] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (!myStream) return;

    const senders = peer.peer.getSenders();
    for (const track of myStream.getTracks()) {
      const alreadyAdded = senders.some((sender) => sender.track?.id === track.id);
      if (!alreadyAdded) {
        peer.peer.addTrack(track, myStream);
      }
    }
    setIsStreamSent(true);
  }, [myStream]);

  const handleCallAccepted = useCallback(
    async ({ ans }) => {
      await peer.setRemoteDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const toggleVideo = useCallback(() => {
    if (myStream) {
      const videoTrack = myStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoPaused(!videoTrack.enabled);
      }
    }
  }, [myStream]);

  const handleEndCall = useCallback(() => {
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop());
    }
    window.location.href = "/";
  }, [myStream]);

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback( async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setRemoteDescription(ans);
  }, []);

  useEffect(() => {
    const handleTrack = async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    };

    peer.peer.addEventListener("track", handleTrack);

    return () => {
      peer.peer.removeEventListener("track", handleTrack);
    };
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div className="room-layout">
      {/* Header with Connection Status */}
      <div className="room-header">
        <div className="status-badge">
          <div className={`status-dot ${remoteSocketId ? "connected" : "disconnected"}`}></div>
          <span>{remoteSocketId ? "Peer Connected" : "Waiting for Peer..."}</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="video-grid">
        {!myStream && !remoteStream && (
           <div className="empty-state">
              <div className="glass-panel" style={{padding: '3rem', textAlign: 'center'}}>
                 <h2 style={{color: 'white', marginBottom: '1rem'}}>Ready to join?</h2>
                 <p style={{marginBottom: '2rem'}}>The room is active. Start your camera to begin the call.</p>
                 {remoteSocketId && <button className="btn btn-primary" onClick={handleCallUser}>Start Call</button>}
                 {!remoteSocketId && <button className="btn btn-primary" style={{opacity: 0.5, cursor: 'not-allowed'}}>Wait for someone to join</button>}
              </div>
           </div>
        )}

        {remoteStream && (
          <div className="video-container">
            <video
              className="video-element"
              autoPlay
              playsInline
              ref={(video) => {
                if (video) video.srcObject = remoteStream;
              }}
            />
            <div className="video-label">Remote Stream</div>
          </div>
        )}

        {myStream && (
          <div className={`video-container ${remoteStream ? "is-pip" : ""}`}>
            <video
              className="video-element"
              autoPlay
              playsInline
              muted
              ref={(video) => {
                if (video) video.srcObject = myStream;
              }}
            />
            <div className="video-label">My Stream</div>
          </div>
        )}
      </div>

      {/* Floating Controls Bar */}
      <div className="controls-bar glass-panel">
        {myStream && !isStreamSent && (
          <button className="btn btn-success" onClick={sendStreams}>
            Send Stream
          </button>
        )}
        {myStream && (
           <>
             <button 
               className="btn btn-primary" 
               onClick={toggleVideo} 
               style={{ backgroundColor: isVideoPaused ? '#f59e0b' : '', boxShadow: isVideoPaused ? 'none' : ''}}>
               {isVideoPaused ? "Play Video" : "Pause Video"}
             </button>
             <button className="btn btn-danger" onClick={handleEndCall}>
               End Call
             </button>
           </>
        )}
        {remoteSocketId && !myStream && (
           <button className="btn btn-primary" onClick={handleCallUser}>
             CALL
           </button>
        )}
      </div>
    </div>
  );
};

export default RoomPage;
