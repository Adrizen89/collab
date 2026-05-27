import { useCallback, useEffect, useRef, useState } from 'react';
import type { SignalMessage } from '@collab/shared';
import { config } from '../../lib/config';
import { getAccessToken } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

/**
 * Appel audio WebRTC 1-à-1. Le canal de signalisation (offre/réponse/ICE) passe
 * par le serveur Realtime. Isolé : si cette brique échoue, l'édition collaborative
 * continue normalement.
 */

type Phase = 'idle' | 'calling' | 'incoming' | 'in-call';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function CallPanel({ documentId }: { documentId: string }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pendingOfferRef = useRef<string | null>(null);

  const send = useCallback((msg: SignalMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  const hangup = useCallback(
    (notify = true) => {
      if (notify) send({ type: 'call-end', documentId, from: user?.id ?? '' });
      cleanupMedia();
      pendingOfferRef.current = null;
      setPhase('idle');
    },
    [cleanupMedia, documentId, send, user?.id],
  );

  const createPeerConnection = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        send({
          type: 'ice-candidate',
          documentId,
          candidate: JSON.stringify(ev.candidate),
          from: user?.id ?? '',
        });
      }
    };
    pc.ontrack = (ev) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = ev.streams[0];
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        hangup(false);
      }
    };
    pcRef.current = pc;
    return pc;
  }, [documentId, hangup, send, user?.id]);

  const attachLocalAudio = useCallback(async (pc: RTCPeerConnection) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }, []);

  // Canal de signalisation ouvert en permanence pour détecter les appels entrants.
  useEffect(() => {
    const token = getAccessToken() ?? '';
    const ws = new WebSocket(`${config.realtimeUrl}/rtc/${documentId}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      let msg: SignalMessage;
      try {
        msg = JSON.parse(typeof event.data === 'string' ? event.data : await (event.data as Blob).text());
      } catch {
        return;
      }
      try {
        if (msg.type === 'call-offer') {
          // Offre entrante : on la garde et on propose de répondre.
          pendingOfferRef.current = msg.sdp;
          setPhase((p) => (p === 'idle' ? 'incoming' : p));
        } else if (msg.type === 'call-answer' && pcRef.current) {
          await pcRef.current.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
          setPhase('in-call');
        } else if (msg.type === 'ice-candidate' && pcRef.current) {
          await pcRef.current.addIceCandidate(JSON.parse(msg.candidate) as RTCIceCandidateInit);
        } else if (msg.type === 'call-end') {
          hangup(false);
        }
      } catch (err) {
        setError('Erreur de négociation de l’appel');
        // eslint-disable-next-line no-console
        console.error(err);
      }
    };

    ws.onerror = () => setError('Signalisation indisponible');

    return () => {
      ws.close();
      wsRef.current = null;
      cleanupMedia();
    };
  }, [documentId, cleanupMedia, hangup]);

  const startCall = async () => {
    setError(null);
    try {
      const pc = createPeerConnection();
      await attachLocalAudio(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'call-offer', documentId, sdp: offer.sdp ?? '', from: user?.id ?? '' });
      setPhase('calling');
    } catch {
      setError('Micro inaccessible ou appel impossible');
      cleanupMedia();
      setPhase('idle');
    }
  };

  const answerCall = async () => {
    setError(null);
    const offerSdp = pendingOfferRef.current;
    if (!offerSdp) return;
    try {
      const pc = createPeerConnection();
      await attachLocalAudio(pc);
      await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: 'call-answer', documentId, sdp: answer.sdp ?? '', from: user?.id ?? '' });
      setPhase('in-call');
    } catch {
      setError('Micro inaccessible ou appel impossible');
      cleanupMedia();
      setPhase('idle');
    }
  };

  return (
    <div className="card sidebar-panel">
      <h3 className="panel-title">Appel audio</h3>
      {error ? <div className="alert alert-error">{error}</div> : null}

      {phase === 'idle' ? (
        <button type="button" className="btn btn-sm" onClick={startCall}>
          🎙️ Démarrer un appel
        </button>
      ) : null}

      {phase === 'incoming' ? (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>Appel entrant…</p>
          <button type="button" className="btn btn-sm" onClick={answerCall}>
            ✅ Répondre
          </button>
        </div>
      ) : null}

      {phase === 'calling' ? (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>Appel en cours, en attente…</p>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => hangup()}>
            Annuler
          </button>
        </div>
      ) : null}

      {phase === 'in-call' ? (
        <div>
          <p style={{ marginTop: 0, color: 'var(--success)', fontWeight: 600 }}>● En communication</p>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => hangup()}>
            Raccrocher
          </button>
        </div>
      ) : null}

      {/* L'audio distant est joué ici. */}
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
}
