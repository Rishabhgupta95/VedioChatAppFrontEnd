import React, { useCallback, useState, useEffect } from 'react'
import { useSocket } from '../context/SocketProvider';
import { useNavigate } from 'react-router-dom'
const LobbyScreen = () => {
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");
  const socket = useSocket();
  const navigate = useNavigate();

  //submit handler
  const handleSubmitForm = useCallback((e) => {
    e.preventDefault();
    sessionStorage.setItem("userEmail", email);
    sessionStorage.setItem("roomId", room);
    socket.emit("room:join", { email, room });
  }, [email, room, socket]);

  const handleJoinRoom = useCallback((data) => {
    const { email, room } = data;
    navigate(`/room/${room}`);
  }, [navigate])

  useEffect(() => {
    socket.on("room:join", handleJoinRoom);
    return () => {
      socket.off("room:join", handleJoinRoom);
    }
  }, [socket, handleJoinRoom]);

  return (
    <div className="lobby-container glass-panel">
      <div className='lobby-header'>
        <h1>Join a Meeting</h1>
        <p>Enter your details below to connect</p>
      </div>
      <form action="" onSubmit={handleSubmitForm}>
        <div className="input-group">
          <label htmlFor="email">Email Address</label>
          <input type="email" id='email'
            className="input-field"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required />
        </div>
        <div className="input-group">
          <label htmlFor="room">Room ID</label>
          <input type="text" id='room'
            className="input-field"
            placeholder="e.g. 1234-xyz"
            value={room}
            onChange={e => setRoom(e.target.value)}
            required />
        </div>
        <button type='submit' className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
          Join Room
        </button>
      </form>
    </div>
  );
}

export default LobbyScreen
