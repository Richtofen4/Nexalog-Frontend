import { useEffect, useRef } from "react";

const JITSI_DOMAIN = "meet.jit.si";

export default function JitsiMeeting({ roomName, displayName, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!window.JitsiMeetExternalAPI) {
      console.error("JitsiMeetExternalAPI nie jest dostępne");
      return;
    }

    const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
      roomName,
      parentNode: containerRef.current,
      width: "100%",
      height: "100%",
      userInfo: displayName ? { displayName } : undefined,
    });

    api.addEventListener("readyToClose", () => {
      onClose?.();
    });

    return () => {
      try {
        api.dispose();
      } catch (e) {
        console.warn("Problem przy dispose Jitsi API", e);
      }
    };
  }, [roomName, displayName, onClose]);

  return (
    <div className="jitsi-overlay">
      <div className="jitsi-window">
        <button className="jitsi-close" onClick={onClose}>
          ×
        </button>
        <div ref={containerRef} className="jitsi-container" />
      </div>
    </div>
  );
}
