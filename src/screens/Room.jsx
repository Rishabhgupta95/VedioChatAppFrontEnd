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
  const [isAudioMuted, setIsAudioMuted] = useState(false);

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

  const toggleAudio = useCallback(() => {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  }, [myStream]);

  const handleEndCall = useCallback(() => {
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop());
    }
    if (remoteSocketId) {
      socket.emit("call:end", { to: remoteSocketId });
    }
    peer.close();
    window.location.href = "/";
  }, [myStream, remoteSocketId, socket]);

  const handleRemoteCallEnded = useCallback(() => {
    console.log("Remote peer ended the call");
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }
    setRemoteSocketId(null);
    setRemoteStream(null);
    peer.close();
  }, [remoteStream]);

  const handleUserLeft = useCallback(({ id }) => {
    console.log(`User with ID ${id} left the room`);
    if (remoteSocketId === id) {
      setRemoteSocketId(null);
      setRemoteStream(null);
      peer.close();
    }
  }, [remoteSocketId]);

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

  const handleNegoNeedIncomming = useCallback(async ({ from, offer }) => {
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
    socket.on("call:ended", handleRemoteCallEnded);
    socket.on("user:left", handleUserLeft);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("call:ended", handleRemoteCallEnded);
      socket.off("user:left", handleUserLeft);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    handleRemoteCallEnded,
    handleUserLeft,
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
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
              <h2 style={{ color: 'white', marginBottom: '1rem' }}>Ready to join?</h2>
              <p style={{ marginBottom: '2rem' }}>The room is active. Start your camera to begin the call.</p>
              {remoteSocketId && <button className="btn btn-primary" onClick={handleCallUser}>Start Call</button>}
              {!remoteSocketId && <button className="btn btn-primary" style={{ opacity: 0.5, cursor: 'not-allowed' }}>Wait for someone to join</button>}
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
          <button
            className="btn btn-success icon-btn"
            onClick={sendStreams}
            title="Share your screen">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
          </button>
        )}
        {myStream && (
          <>
            <button
              className={`btn icon-btn ${isAudioMuted ? 'btn-warning' : 'btn-primary'}`}
              onClick={toggleAudio}
              title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}>
              {isAudioMuted ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
              )}
            </button>
            <button
              className={`btn icon-btn ${isVideoPaused ? 'btn-warning' : 'btn-primary'}`}
              onClick={toggleVideo}
              title={isVideoPaused ? "Play Video" : "Pause Video"}>
              {isVideoPaused ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L22 7v10" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
              )}
            </button>
            <button
              className="btn btn-danger icon-btn"
              onClick={handleEndCall}
              title="Leave Call">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" fill="#fff" stroke="none" /><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /></svg>
            </button>
          </>
        )}
        {/* {remoteSocketId && !myStream && (
          <button className="btn btn-primary" onClick={handleCallUser}>
            CALL
          </button>
        )} */}
      </div>
    </div>
  );
};

export default RoomPage;
