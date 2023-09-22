import React, { useEffect, useRef, useState } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import './style.css'; // Ensure you move your styles to the styles folder and import them as modules for Next.js

if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: 'AIzaSyAcZDb7c5wN_2whrG6UeGguLqESFJos8ZQ',
    authDomain: 'wertc-sih.firebaseapp.com',
    projectId: 'wertc-sih',
    storageBucket: 'wertc-sih.appspot.com',
    messagingSenderId: '951901947321',
    appId: '1:951901947321:web:c82dff4a0c12a58058a268',
  });
}
const firestore = firebase.firestore();

export default function Home() {
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [callCreated, setCallCreated] = useState(false);

  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  const pc = new RTCPeerConnection(servers);

  const webcamVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callInputRef = useRef(null);

  useEffect(() => {
    const webcamButtonHandler = async () => {
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const remoteStream = new MediaStream();

      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      };

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = localStream;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }

      setWebcamStarted(true);
    };

    const callButtonHandler = async () => {
      const callDoc = firestore.collection('calls').doc();
      const offerCandidates = callDoc.collection('offerCandidates');
      const answerCandidates = callDoc.collection('answerCandidates');

      if (callInputRef.current) {
        callInputRef.current.value = callDoc.id;
      }

      pc.onicecandidate = event => {
        event.candidate && offerCandidates.add(event.candidate.toJSON());
      };

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await callDoc.set({ offer });

      callDoc.onSnapshot(snapshot => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answerDescription);
        }
      });

      answerCandidates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      });

      setCallCreated(true);
    };

    const answerButtonHandler = async () => {
      const callId = callInputRef.current.value;
      const callDoc = firestore.collection('calls').doc(callId);
      const answerCandidates = callDoc.collection('answerCandidates');
      const offerCandidates = callDoc.collection('offerCandidates');

      pc.onicecandidate = event => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
      };

      const callData = (await callDoc.get()).data();

      const offerDescription = callData.offer;
      await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      await callDoc.update({ answer });

      offerCandidates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            let data = change.doc.data();
            pc.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
    };

    return () => {
      // Any cleanup can be done here
    };
  }, []);

  return (
    <div>
      <h2>1. Start your Webcam</h2>
      <div className="videos">
        <span>
          <h3>Local Stream</h3>
          <video id="webcamVideo" ref={webcamVideoRef} autoPlay playsInline></video>
        </span>
        <span>
          <h3>Remote Stream</h3>
          <video id="remoteVideo" ref={remoteVideoRef} autoPlay playsInline></video>
        </span>
      </div>

      <button onClick={webcamStarted ? null : webcamButtonHandler} disabled={webcamStarted}>Start webcam</button>

      <h2>2. Create a new Call</h2>
      <button onClick={callCreated ? null : callButtonHandler} disabled={!webcamStarted || callCreated}>Create Call (offer)</button>

      <h2>3. Join a Call</h2>
      <p>Answer the call from a different browser window or device</p>
      <input id="callInput" ref={callInputRef} />
      <button onClick={answerButtonHandler} disabled={!webcamStarted}>Answer</button>

      <h2>4. Hangup</h2>
      <button disabled={!callCreated}>Hangup</button>
    </div>
  );
}
