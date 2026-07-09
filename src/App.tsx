import React, { useState, useEffect } from 'react';
import {
  EventFrame, PhotoboothEvent, CompanionStatus, EmailConfig, PrinterConfig, AppSettings, Session, AppView
} from './types';
import {
  DEFAULT_FRAMES, DEFAULT_EVENTS, DEFAULT_EMAIL_CONFIG, DEFAULT_PRINTER_CONFIG, DEFAULT_SETTINGS, generateMockFrameOverlay
} from './utils/assets';

// Subcomponents imports
import WelcomeScreen from './components/WelcomeScreen';
import FrameSelection from './components/FrameSelection';
import EmailCapture from './components/EmailCapture';
import CaptureWorkflow from './components/CaptureWorkflow';
import PhotostripCanvas from './components/PhotostripCanvas';
import FinalPreview from './components/FinalPreview';
import AdminDashboard from './components/AdminDashboard';
import { Sparkles, Heart } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<AppView>('welcome');
  const [frames, setFrames] = useState<EventFrame[]>([]);
  const [events, setEvents] = useState<PhotoboothEvent[]>(DEFAULT_EVENTS);
  const [activeEventId, setActiveEventId] = useState<string>(DEFAULT_EVENTS[0].id);

  // Guest details state
  const [selectedFrameId, setSelectedFrameId] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [photostripUrl, setPhotostripUrl] = useState<string>('');

  // Config parameters
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(DEFAULT_EMAIL_CONFIG);
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Session records database
  const [sessions, setSessions] = useState<Session[]>([]);

  // WebSocket Server Connection states
  const [wsSocket, setWsSocket] = useState<WebSocket | null>(null);
  const [reconnectCounter, setReconnectCounter] = useState(0);

  // Companion status state (defaults to dev fallback simulation)
  const [companionStatus, setCompanionStatus] = useState<CompanionStatus>({
    cameraConnected: false,
    cameraModel: 'Webcam Lens Fallback',
    cameraBattery: 92,
    printerConnected: false,
    printerModel: 'DNP DS620',
    printerStatus: 'Idle Ready',
    storageUsage: '1.4 GB',
    totalPrints: 15,
    totalEmails: 12,
    devMode: true,
  });

  // 1. Hydrate frames with dynamic styled transparency overlays on load
  useEffect(() => {
    const hydrated = DEFAULT_FRAMES.map((frame) => {
      let style: 'wedding' | 'birthday' | 'graduation' | 'corporate' | 'neon' = 'wedding';
      let orientation: 'portrait' | 'landscape' | 'square' = 'portrait';

      if (frame.id.includes('wedding')) style = 'wedding';
      else if (frame.id.includes('birthday')) style = 'birthday';
      else if (frame.id.includes('graduation')) style = 'graduation';
      else if (frame.id.includes('corporate')) style = 'corporate';
      else if (frame.id.includes('neon')) style = 'neon';

      if (frame.id.includes('portrait')) orientation = 'portrait';
      else if (frame.id.includes('landscape')) orientation = 'landscape';
      else if (frame.id.includes('square')) orientation = 'square';

      const overlay = generateMockFrameOverlay(style, orientation);
      return {
        ...frame,
        imageUrl: overlay,
      };
    });

    setFrames(hydrated);
  }, []);

  // 2. Align default selected frame with active event's frameId
  const activeEvent = events.find((e) => e.id === activeEventId) || events[0];
  useEffect(() => {
    if (activeEvent) {
      setSelectedFrameId(activeEvent.frameId);
    }
  }, [activeEventId]);

  // 3. Connect to full-stack Express WebSocket companion server
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    console.log(`Establishing WS link with Companion Server: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WS Connection succeeded: Companion online!');
      setCompanionStatus((prev) => ({
        ...prev,
        cameraConnected: true,
        cameraModel: 'EOS R5 (USB)',
        printerConnected: true,
        devMode: false,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status:sync') {
          setCompanionStatus(data.status);
        } else if (data.type === 'email:sent') {
          console.log('Companion reports email dispatched successfully!');
        }
      } catch (err) {
        console.error('WS incoming message parse failed:', err);
      }
    };

    ws.onclose = () => {
      console.warn('WS link closed. Utilizing browser simulation mode.');
    };

    setWsSocket(ws);

    return () => {
      ws.close();
    };
  }, [reconnectCounter]);

  const triggerReconnection = () => {
    setReconnectCounter((prev) => prev + 1);
  };

  // State handlers
  const handleStartSession = () => {
    setView('frame-select');
  };

  const handleFrameSelected = (frame: EventFrame) => {
    setSelectedFrameId(frame.id);
    setView('email-capture');
  };

  const handleEmailConfirmed = (email: string, name?: string) => {
    setGuestEmail(email);
    setGuestName(name || '');
    setView('capture');
  };

  const handlePhotosCompleted = (photos: string[]) => {
    setCapturedPhotos(photos);
    setPhotostripUrl(''); // Reset previous strip url to trigger dynamic canvas composition screen
    setView('preview');
  };

  const handleNewSession = () => {
    // Navigate through quick, friendly thank you View before resetting
    setView('thank-you');
  };

  // Reset core states back to Welcome screen
  useEffect(() => {
    if (view === 'thank-you') {
      const timer = setTimeout(() => {
        setGuestEmail('');
        setGuestName('');
        setCapturedPhotos([]);
        setPhotostripUrl('');
        setSelectedFrameId(activeEvent.frameId);
        setView('welcome');
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [view]);

  const handleSaveSessionRecord = (session: Session) => {
    setSessions((prev) => [session, ...prev]);

    // Update companion totals dynamically
    setCompanionStatus((prev) => ({
      ...prev,
      totalPrints: prev.totalPrints + (session.printed ? session.printCount : 0),
      totalEmails: prev.totalEmails + 1,
    }));
  };

  const handleDeleteSessionRecord = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const currentSelectedFrame = frames.find((f) => f.id === selectedFrameId) || frames[0];

  return (
    <div className={`min-h-screen ${settings.darkMode ? 'dark bg-slate-950 text-white' : 'bg-white text-slate-900'} transition-colors duration-300 font-sans`}>
      {/* View router switcher */}
      {view === 'welcome' && (
        <WelcomeScreen
          activeEvent={activeEvent}
          companionStatus={companionStatus}
          settings={settings}
          setSettings={setSettings}
          onStart={handleStartSession}
          onOpenAdmin={() => setView('admin')}
        />
      )}

      {view === 'frame-select' && (
        <FrameSelection
          frames={frames}
          selectedFrameId={selectedFrameId}
          onSelect={handleFrameSelected}
          onBack={() => setView('welcome')}
          themeColor={activeEvent.themeColor}
        />
      )}

      {view === 'email-capture' && (
        <EmailCapture
          onConfirm={handleEmailConfirmed}
          onBack={() => setView('frame-select')}
          privacyPolicy={settings.privacyPolicy}
        />
      )}

      {view === 'capture' && currentSelectedFrame && (
        <CaptureWorkflow
          activeEvent={activeEvent}
          selectedFrame={currentSelectedFrame}
          companionStatus={companionStatus}
          onPhotosComplete={handlePhotosCompleted}
          onBack={() => setView('welcome')}
          wsSocket={wsSocket}
        />
      )}

      {view === 'preview' && currentSelectedFrame && (
        <>
          {photostripUrl ? (
            <FinalPreview
              photostripUrl={photostripUrl}
              guestEmail={guestEmail}
              guestName={guestName}
              activeEvent={activeEvent}
              selectedFrame={currentSelectedFrame}
              companionStatus={companionStatus}
              onNewSession={handleNewSession}
              wsSocket={wsSocket}
              saveSession={handleSaveSessionRecord}
            />
          ) : (
            <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 select-none">
              <PhotostripCanvas
                photos={capturedPhotos}
                frame={currentSelectedFrame}
                onGenerated={(url) => setPhotostripUrl(url)}
              />
            </div>
          )}
        </>
      )}

      {view === 'thank-you' && (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 select-none animate-fade-in" id="thank-you-view">
          <div className="relative flex items-center justify-center mb-6">
            <Heart className="w-20 h-20 text-rose-500 fill-rose-500/10 animate-beat" />
            <Sparkles className="w-8 h-8 text-indigo-400 absolute animate-pulse" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
            Thank You!
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-sm mx-auto leading-relaxed mb-8">
            Your high-resolution memories are being dispatched. Have an amazing time at the event!
          </p>

          <div className="px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-full text-slate-500 text-xs font-bold tracking-widest uppercase animate-pulse">
            Resetting photobooth kiosk in a moment...
          </div>
        </div>
      )}

      {view === 'admin' && (
        <AdminDashboard
          frames={frames}
          onSaveFrames={setFrames}
          events={events}
          onSaveEvents={setEvents}
          activeEventId={activeEventId}
          onSetActiveEventId={setActiveEventId}
          companionStatus={companionStatus}
          emailConfig={emailConfig}
          onSaveEmailConfig={setEmailConfig}
          printerConfig={printerConfig}
          onSavePrinterConfig={setPrinterConfig}
          settings={settings}
          onSaveSettings={setSettings}
          sessions={sessions}
          onDeleteSession={handleDeleteSessionRecord}
          onClose={() => setView('welcome')}
          wsSocket={wsSocket}
          triggerReconnection={triggerReconnection}
        />
      )}
    </div>
  );
}
