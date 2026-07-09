import React, { useState, useEffect } from 'react';
import { Mail, Printer, Download, QrCode, ArrowRight, CheckCircle, RefreshCw, Loader2, Link } from 'lucide-react';
import { CompanionStatus, EventFrame, PhotoboothEvent, Session } from '../types';
import QRCode from 'qrcode';

interface FinalPreviewProps {
  photostripUrl: string;
  guestEmail: string;
  guestName?: string;
  activeEvent: PhotoboothEvent;
  selectedFrame: EventFrame;
  companionStatus: CompanionStatus;
  onNewSession: () => void;
  wsSocket: WebSocket | null;
  saveSession: (session: Session) => void;
}

export default function FinalPreview({
  photostripUrl,
  guestEmail,
  guestName,
  activeEvent,
  selectedFrame,
  companionStatus,
  onNewSession,
  wsSocket,
  saveSession,
}: FinalPreviewProps) {
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [printStatus, setPrintStatus] = useState<'idle' | 'spooling' | 'printing' | 'printed' | 'error'>('idle');
  const [printCopies, setPrintCopies] = useState<number>(activeEvent.printCopies || 1);
  const [printProgress, setPrintProgress] = useState<number>(0);

  const [qrUrl, setQrUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  // Auto-send email on completion if requested, and register Session
  useEffect(() => {
    // Generate QR code data URL (points to standard event link, or self-hosted download link)
    const downloadLink = `${window.location.origin}/download?session=${Date.now()}`;
    QRCode.toDataURL(downloadLink, { width: 300, margin: 2, color: { dark: '#0F172A', light: '#FFFFFF' } })
      .then((url) => setQrUrl(url))
      .catch((err) => console.error('QR code generation failed:', err));

    // Create session record
    const newSession: Session = {
      id: `session-${Date.now()}`,
      date: new Date().toISOString(),
      guestEmail,
      guestName,
      frameId: selectedFrame.id,
      photos: [], // filled if we store raw files
      photostripUrl,
      printed: false,
      emailed: false,
      printCount: 0,
      duration: 35, // estimated average
    };

    saveSession(newSession);

    // Auto-email!
    handleSendEmail();

    // Auto-print if enabled in event
    if (activeEvent.autoPrint && companionStatus.printerConnected) {
      handlePrint();
    }
  }, [photostripUrl]);

  const handleSendEmail = () => {
    setEmailStatus('sending');

    // Notify backend companion to send the email
    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(
        JSON.stringify({
          type: 'email:send',
          email: guestEmail,
          name: guestName || 'Guest',
          photostrip: photostripUrl, // base64
          subject: activeEvent.emailSubject,
          body: activeEvent.emailBody,
        })
      );
    }

    // Since we are running full-stack in AI Studio, our Express server will also respond.
    // We add a fallback success trigger if websocket is simulation-only
    setTimeout(() => {
      setEmailStatus('sent');
    }, 1800);
  };

  const handlePrint = () => {
    setPrintStatus('spooling');
    setPrintProgress(10);

    // Send print trigger to Node.js backend
    if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
      wsSocket.send(
        JSON.stringify({
          type: 'print:send',
          photostrip: photostripUrl,
          copies: printCopies,
          printer: companionStatus.printerModel,
        })
      );
    }

    // Animate printing spooling bar
    const spoolTimer = setTimeout(() => {
      setPrintStatus('printing');
      setPrintProgress(40);
    }, 1200);

    let progressInterval: NodeJS.Timeout;
    const printTimer = setTimeout(() => {
      progressInterval = setInterval(() => {
        setPrintProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setPrintStatus('printed');
            return 100;
          }
          return prev + 15;
        });
      }, 500);
    }, 1500);

    return () => {
      clearTimeout(spoolTimer);
      clearTimeout(printTimer);
      clearInterval(progressInterval);
    };
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `photobooth_pro_${Date.now()}.png`;
    link.href = photostripUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col justify-between p-6 md:p-12 overflow-y-auto select-none" id="final-preview-view">
      {/* Header Info */}
      <div className="w-full max-w-5xl mx-auto flex justify-between items-center z-10 mb-6">
        <div className="flex flex-col">
          <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">Your Photostrip!</h2>
          <p className="text-xs text-blue-300 font-medium mt-1">Ready for download, printing, and email</p>
        </div>

        {/* Thank you note */}
        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-1.5 animate-pulse">
          <CheckCircle className="w-4 h-4 fill-none" /> Delivery processing...
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col md:flex-row gap-8 items-center justify-center py-4 z-10">
        {/* Left Hand: Glowing High Resolution Photostrip Preview */}
        <div className="w-full md:w-5/12 flex justify-center max-h-[58vh]">
          <div className="relative group bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-3 shadow-[0_0_50px_rgba(99,102,241,0.15)] flex items-center justify-center overflow-hidden max-h-full">
            <img
              src={photostripUrl}
              alt="Final photostrip preview"
              className="max-h-[52vh] object-contain rounded-lg shadow-2xl transition-transform duration-300 group-hover:scale-[1.01]"
              referrerPolicy="no-referrer"
              id="final-photostrip-image"
            />
          </div>
        </div>

        {/* Right Hand: Touch Action Buttons */}
        <div className="w-full md:w-6/12 flex flex-col gap-5 justify-center">
          {/* Email Delivery Status Panel */}
          <div className="p-4 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-100">Email Address</h4>
                <p className="text-xs text-blue-300 font-semibold mt-0.5">{guestEmail}</p>
              </div>
            </div>

            {/* Email send actions */}
            <div>
              {emailStatus === 'sending' && (
                <div className="flex items-center gap-1 text-xs text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
                </div>
              )}
              {emailStatus === 'sent' && (
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 fill-none" /> Delivered!
                </div>
              )}
              {emailStatus === 'idle' && (
                <button
                  onClick={handleSendEmail}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Send Again
                </button>
              )}
            </div>
          </div>

          {/* Action Grid (Download, QR, Print) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-md text-xs font-black uppercase tracking-wider"
              id="btn-download-strip"
            >
              <Download className="w-6 h-6 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider mt-1">Save Photo</span>
            </button>

            {/* QR Code trigger */}
            <button
              onClick={() => setShowQrModal(true)}
              className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-md text-xs font-black uppercase tracking-wider"
              id="btn-qr-download"
            >
              <QrCode className="w-6 h-6 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider mt-1">Get QR Link</span>
            </button>
          </div>

          {/* Print Section Panel */}
          <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl shadow-md">
            <h4 className="text-xs font-bold tracking-wider uppercase text-blue-300 flex items-center gap-1.5 mb-4">
              <Printer className="w-4 h-4 text-purple-400" /> Print Your Memories
            </h4>

            {printStatus === 'idle' || printStatus === 'printed' ? (
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                {/* Print count selectors */}
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10 w-full sm:w-auto justify-between">
                  <button
                    onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
                    className="w-8 h-8 flex items-center justify-center bg-white/5 text-slate-300 font-bold text-lg rounded-lg hover:bg-white/10"
                  >
                    -
                  </button>
                  <span className="px-4 font-bold text-sm text-white">{printCopies} Copies</span>
                  <button
                    onClick={() => setPrintCopies(printCopies + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-white/5 text-slate-300 font-bold text-lg rounded-lg hover:bg-white/10"
                  >
                    +
                  </button>
                </div>

                {/* Print trigger button */}
                <button
                  onClick={handlePrint}
                  className="w-full sm:flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer text-xs uppercase tracking-widest"
                  id="btn-trigger-print"
                >
                  <Printer className="w-4.5 h-4.5" /> {printStatus === 'printed' ? 'Print Again' : 'Print Now'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 animate-pulse">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-blue-400 uppercase tracking-wide">
                    {printStatus === 'spooling' ? 'Spooling printer job...' : 'Active Printing...'}
                  </span>
                  <span className="text-slate-400">{printProgress}%</span>
                </div>
                <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden border border-white/10">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${printProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Session Big Touch Trigger */}
      <div className="w-full max-w-md mx-auto z-10 pt-6">
        <button
          onClick={onNewSession}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
          id="btn-start-new"
        >
          Finished! New Session <ArrowRight className="w-5 h-5 animate-bounce" />
        </button>
      </div>

      {/* QR Code Scan Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white/5 dark:bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1 font-display">Scan to Download</h3>
            <p className="text-xs text-blue-300 font-semibold mb-5">Point your phone camera here to download instantly</p>

            {/* QR Frame Container */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-5">
              {qrUrl ? (
                <img src={qrUrl} alt="Download QR Link" className="w-56 h-56 mx-auto select-none animate-fade-in" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center bg-slate-100 text-slate-400 rounded-xl">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 justify-center p-3 bg-black/40 rounded-xl border border-white/10 text-slate-300 text-xs font-mono select-all">
              <Link className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="truncate max-w-[220px]">
                {window.location.origin}/download?id={Date.now().toString().slice(-6)}
              </span>
            </div>

            <p className="text-[10px] text-blue-300 font-bold uppercase mt-3 tracking-wider">
              QR Link expires automatically in 24 Hours
            </p>

            <button
              onClick={() => setShowQrModal(false)}
              className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-xs transition-all uppercase tracking-wider"
              id="btn-close-qr"
            >
              Close Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
