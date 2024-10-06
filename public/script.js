const socket = io();  // Connect to the signaling server
let localStream;
let remoteStream;
let peerConnection;

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }  // Google's public STUN server
  ]
};

// Get video elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Get the local video stream
async function getLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error('Error accessing media devices.', err);
  }
}

// Initialize the peer connection and set up event listeners
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);

  // Add the local stream to the peer connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // When remote stream is received, set it to the remote video element
  peerConnection.ontrack = (event) => {
    [remoteStream] = event.streams;
    remoteVideo.srcObject = remoteStream;
  };

  // Send any ICE candidates to the other peer
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('candidate', event.candidate);
    }
  };
}

// Start the call (this will create the offer)
async function startCall() {
  await getLocalStream();
  createPeerConnection();

  // Create an offer and send it via the signaling server
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
}

// Handle incoming offers from other peers
socket.on('offer', async (offer) => {
  await getLocalStream();
  createPeerConnection();

  // Set the remote description and create an answer
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

// Handle incoming answers from other peers
socket.on('answer', async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// Handle incoming ICE candidates
socket.on('candidate', async (candidate) => {
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
