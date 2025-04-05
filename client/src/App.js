import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Peer from 'peerjs';
import './App.css';

function App() {
  const [roomId, setRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [myPeerId, setMyPeerId] = useState('');
  const [videoStream, setVideoStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [participants, setParticipants] = useState([]);

  const videoGridRef = useRef(null);
  const myVideoRef = useRef(null);
  const socketRef = useRef();
  const peerRef = useRef();
  const peersRef = useRef({});

  useEffect(() => {
    // Get room ID from URL
    const path = window.location.pathname.split('/');
    const id = path[path.length - 1];
    if (id && id !== '') {
      setRoomId(id);
    } else {
      // Generate new room ID if none exists
      window.location.href = `/${uuidv4()}`;
    }

    // Initialize socket connection
    socketRef.current = io("http://localhost:5000", {
      withCredentials: true
    });

    // Initialize PeerJS
    peerRef.current = new Peer({
      host: process.env.REACT_APP_PEER_HOST || 'localhost',
      port: process.env.REACT_APP_PEER_PORT || 3001,
      path: '/peerjs',
      secure: false,
      debug: 3,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    // PeerJS error handling
    peerRef.current.on('error', (err) => {
      console.error('PeerJS error:', err);
    });

    peerRef.current.on('open', (id) => {
      setMyPeerId(id);
      if (roomId) {
        socketRef.current.emit('join-room', roomId, id);
      }
    });

    // Get user media
    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    }).then(stream => {
      setVideoStream(stream);
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        myVideoRef.current.muted = true;
      }

      // Handle incoming calls
      peerRef.current.on('call', (call) => {
        call.answer(stream);
        const video = document.createElement('video');
        call.on('stream', (userVideoStream) => {
          addVideoStream(video, userVideoStream);
        });
        call.on('close', () => {
          video.remove();
          adjustVideoGrid();
        });
      });

      // Handle existing users
      socketRef.current.on('existing-users', (users) => {
        users.forEach(userId => {
          connectToNewUser(userId, stream);
        });
      });

      // Handle new user connections
      socketRef.current.on('user-connected', (userId) => {
        connectToNewUser(userId, stream);
        setParticipants(prev => [...prev, userId]);
      });

      // Handle user disconnections
      socketRef.current.on('user-disconnected', (userId) => {
        if (peersRef.current[userId]) {
          peersRef.current[userId].close();
          delete peersRef.current[userId];
        }
        setParticipants(prev => prev.filter(id => id !== userId));
        adjustVideoGrid();
      });
    }).catch(err => {
      console.error('Failed to get user media:', err);
    });

    // Handle messages
    socketRef.current.on('createMessage', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      // Cleanup
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      Object.values(peersRef.current).forEach(peer => peer.close());
    };
  }, [roomId]);

  const connectToNewUser = (userId, stream) => {
    const call = peerRef.current.call(userId, stream);
    const video = document.createElement('video');
    
    call.on('stream', (userVideoStream) => {
      addVideoStream(video, userVideoStream);
    });
    
    call.on('close', () => {
      video.remove();
      adjustVideoGrid();
    });
    
    peersRef.current[userId] = call;
  };

  const addVideoStream = (video, stream) => {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
      video.play();
    });
    if (videoGridRef.current) {
      videoGridRef.current.append(video);
      adjustVideoGrid();
    }
  };

  const adjustVideoGrid = () => {
    const videos = videoGridRef.current?.getElementsByTagName('video');
    if (videos && videos.length > 0) {
      const columns = Math.ceil(Math.sqrt(videos.length));
      videoGridRef.current.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && roomId) {
      socketRef.current.emit('message', messageInput);
      setMessageInput('');
    }
  };

  const toggleMute = () => {
    if (videoStream) {
      const audioTrack = videoStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (videoStream) {
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(!videoTrack.enabled);
      }
    }
  };

  const leaveRoom = () => {
    window.location.href = '/';
  };

  const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  return (
    <div className="app">
      <div className="main">
        <div className="main__left">
          <div className="main__videos">
            <div ref={videoGridRef} id="video-grid">
              <video ref={myVideoRef} muted autoPlay playsInline />
            </div>
          </div>
          <div className="main__controls">
            <div className="main__controls_block">
              <button
                className={`main__controls_button ${isMuted ? 'unmute' : ''}`}
                onClick={toggleMute}
              >
                <i className={`fa fa-microphone${isMuted ? '-slash' : ''}`}></i>
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              <button
                className={`main__controls_button ${!isVideoOn ? 'unmute' : ''}`}
                onClick={toggleVideo}
              >
                <i className={`fa fa-video${!isVideoOn ? '-slash' : '-camera'}`}></i>
                <span>{!isVideoOn ? 'Start Video' : 'Stop Video'}</span>
              </button>
            </div>
            <div className="main__controls_block">
              <div className="main__controls_button">
                <i className="fa fa-users"></i>
                <span>{participants.length + 1} Participants</span>
              </div>
              <button className="main__controls_button">
                <i className="fa fa-comment"></i>
                <span>Chat</span>
              </button>
            </div>
            <div className="main__controls_block">
              <button
                className="main__controls_button leaveMeeting"
                onClick={leaveRoom}
              >
                <i className="fa fa-times"></i>
                <span>Leave Meeting</span>
              </button>
            </div>
          </div>
        </div>
        <div className="main__right">
          <div className="main__header">
            <h6>Chat ({participants.length + 1} participants)</h6>
          </div>
          <div className="main__chat__window">
            <ul className="messages">
              {messages.map((msg, index) => (
                <li key={index}>
                  <strong>{msg.sender}: </strong>{msg.text}
                </li>
              ))}
            </ul>
          </div>
          <form className="main__message_container" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type message here.."
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;