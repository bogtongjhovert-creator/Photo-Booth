import React, { useState, useRef, useEffect } from 'react';
import { EventFrame, PhotoSlot } from '../types';
import { Trash2, Plus, Edit, Save, Check, RefreshCw, X, Eye, HelpCircle, Layers, Move } from 'lucide-react';
import { generateMockFrameOverlay } from '../utils/assets';

interface FrameManagerProps {
  frames: EventFrame[];
  onSaveFrames: (updated: EventFrame[]) => void;
}

export default function FrameManager({ frames, onSaveFrames }: FrameManagerProps) {
  const [editingFrame, setEditingFrame] = useState<EventFrame | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(1);

  // New Frame form fields
  const [newFrameName, setNewFrameName] = useState('');
  const [newFrameCategory, setNewFrameCategory] = useState('Wedding');
  const [newFrameOrientation, setNewFrameOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait');

  // Drag state trackers
  const stageRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleEditFrame = (frame: EventFrame) => {
    setEditingFrame(JSON.parse(JSON.stringify(frame))); // deep copy
    setSelectedSlotId(frame.slots[0]?.id || 1);
    setShowEditor(true);
  };

  const handleDeleteFrame = (id: string) => {
    if (confirm('Are you sure you want to delete this frame?')) {
      const updated = frames.filter((f) => f.id !== id);
      onSaveFrames(updated);
    }
  };

  const handleToggleFrameActive = (id: string) => {
    const updated = frames.map((f) => (f.id === id ? { ...f, active: !f.active } : f));
    onSaveFrames(updated);
  };

  const handleCreateFrame = () => {
    if (!newFrameName.trim()) return;

    // Create a new frame structure with default spots
    const defaultSlots: PhotoSlot[] =
      newFrameOrientation === 'portrait'
        ? [
            { id: 1, x: 10, y: 5, width: 80, height: 18 },
            { id: 2, x: 10, y: 26, width: 80, height: 18 },
            { id: 3, x: 10, y: 47, width: 80, height: 18 },
            { id: 4, x: 10, y: 68, width: 80, height: 18 },
          ]
        : [
            { id: 1, x: 5, y: 5, width: 42, height: 40 },
            { id: 2, x: 53, y: 5, width: 42, height: 40 },
            { id: 3, x: 5, y: 50, width: 42, height: 40 },
            { id: 4, x: 53, y: 50, width: 42, height: 40 },
          ];

    const mockOverlay = generateMockFrameOverlay(
      newFrameCategory.toLowerCase() as any,
      newFrameOrientation
    );

    const newFrame: EventFrame = {
      id: `frame-${Date.now()}`,
      name: newFrameName,
      category: newFrameCategory,
      imageUrl: mockOverlay,
      slots: defaultSlots,
      active: true,
      isCustom: true,
    };

    onSaveFrames([newFrame, ...frames]);
    setNewFrameName('');
    handleEditFrame(newFrame); // Auto open in visual editor
  };

  // Drag and drop mechanics for visual slot layout
  const handleSlotMouseDown = (e: React.MouseEvent, slotId: number) => {
    e.preventDefault();
    setSelectedSlotId(slotId);
    setIsDragging(true);

    if (!stageRef.current || !editingFrame) return;
    const stageRect = stageRef.current.getBoundingClientRect();
    const slot = editingFrame.slots.find((s) => s.id === slotId);
    if (!slot) return;

    // Convert slot percentage positions back to actual pixel values
    const actualX = (slot.x / 100) * stageRect.width;
    const actualY = (slot.y / 100) * stageRect.height;

    // Position of cursor relative to slot top-left corner
    const cursorX = e.clientX - stageRect.left;
    const cursorY = e.clientY - stageRect.top;

    setDragOffset({
      x: cursorX - actualX,
      y: cursorY - actualY,
    });
  };

  const handleStageMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || selectedSlotId === null || !editingFrame || !stageRef.current) return;

    const stageRect = stageRef.current.getBoundingClientRect();
    const cursorX = e.clientX - stageRect.left;
    const cursorY = e.clientY - stageRect.top;

    // Target positions in pixels
    let targetX = cursorX - dragOffset.x;
    let targetY = cursorY - dragOffset.y;

    // Convert back to percentages (0-100)
    let percentX = (targetX / stageRect.width) * 100;
    let percentY = (targetY / stageRect.height) * 100;

    // Find the slot to update
    const updatedSlots = editingFrame.slots.map((s) => {
      if (s.id !== selectedSlotId) return s;

      // Keep inside bounds
      const boundedX = Math.max(0, Math.min(100 - s.width, percentX));
      const boundedY = Math.max(0, Math.min(100 - s.height, percentY));

      return {
        ...s,
        x: Math.round(boundedX * 10) / 10,
        y: Math.round(boundedY * 10) / 10,
      };
    });

    setEditingFrame({
      ...editingFrame,
      slots: updatedSlots,
    });
  };

  const handleStageMouseUp = () => {
    setIsDragging(false);
  };

  const updateSelectedSlotSize = (dimension: 'width' | 'height', delta: number) => {
    if (!editingFrame || selectedSlotId === null) return;

    const updatedSlots = editingFrame.slots.map((s) => {
      if (s.id !== selectedSlotId) return s;

      const size = s[dimension];
      const newSize = Math.max(5, Math.min(95, size + delta));

      return {
        ...s,
        [dimension]: newSize,
      };
    });

    setEditingFrame({
      ...editingFrame,
      slots: updatedSlots,
    });
  };

  const handleSaveEditorChanges = () => {
    if (!editingFrame) return;

    const updated = frames.map((f) => (f.id === editingFrame.id ? editingFrame : f));
    onSaveFrames(updated);
    setShowEditor(false);
    setEditingFrame(null);
  };

  // Guess layout orientation of current editing frame
  const getEditorLayoutOrientation = () => {
    if (!editingFrame) return 'portrait';
    const first = editingFrame.slots[0];
    if (first && first.width < 90 && first.height < 25) return 'portrait';
    if (first && first.width < 50 && first.height < 50) return 'landscape';
    return 'square';
  };

  const orientation = getEditorLayoutOrientation();

  return (
    <div className="flex flex-col gap-6" id="frame-manager-panel">
      {/* Visual Frame Editor Modal */}
      {showEditor && editingFrame && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-5xl flex flex-col md:flex-row gap-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Visual Editor Workspace (Left) */}
            <div className="flex-1 flex flex-col items-center">
              <div className="flex justify-between w-full items-center mb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                    <Move className="w-5 h-5 text-indigo-400" /> Visual Layout Editor
                  </h3>
                  <p className="text-xs text-slate-400">Drag to re-position. Use sliders to resize photo slots.</p>
                </div>

                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((id) => (
                    <button
                      key={id}
                      onClick={() => setSelectedSlotId(id)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        selectedSlotId === id
                          ? 'bg-indigo-600 text-white shadow-lg'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      #{id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Drag Arena stage */}
              <div
                ref={stageRef}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onMouseLeave={handleStageMouseUp}
                className={`relative bg-slate-950 border border-slate-800 rounded-2xl shadow-inner select-none ${
                  orientation === 'portrait' ? 'w-[230px] h-[520px]' : 'w-[450px] h-[300px]'
                }`}
                id="visual-editor-stage"
              >
                {/* Background overlay thumbnail image */}
                {editingFrame.imageUrl && (
                  <img
                    src={editingFrame.imageUrl}
                    alt="Frame background"
                    className="absolute inset-0 w-full h-full object-contain opacity-50 pointer-events-none rounded-2xl"
                    referrerPolicy="no-referrer"
                  />
                )}

                {/* Draggable slot outlines */}
                {editingFrame.slots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;

                  return (
                    <div
                      key={slot.id}
                      onMouseDown={(e) => handleSlotMouseDown(e, slot.id)}
                      className={`absolute rounded-lg border-2 cursor-move flex flex-col items-center justify-center p-1 transition-shadow ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-500/20 shadow-lg shadow-indigo-500/10 z-20 ring-2 ring-indigo-500/20'
                          : 'border-slate-500/60 bg-slate-900/40 hover:border-slate-300 z-10'
                      }`}
                      style={{
                        left: `${slot.x}%`,
                        top: `${slot.y}%`,
                        width: `${slot.width}%`,
                        height: `${slot.height}%`,
                      }}
                    >
                      <span className="text-xs font-black tracking-wider select-none font-sans drop-shadow-md text-white flex items-center gap-1">
                        <Move className="w-3 h-3 text-indigo-300 shrink-0" /> Photo #{slot.id}
                      </span>
                      <span className="text-[9px] text-slate-300 font-mono select-none">
                        x:{slot.x}% y:{slot.y}%
                      </span>
                      <span className="text-[9px] text-slate-300 font-mono select-none">
                        w:{slot.width}% h:{slot.height}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sliders and Controls (Right) */}
            <div className="w-full md:w-80 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-850 pt-6 md:pt-0 md:pl-8">
              <div className="flex flex-col gap-5">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400">Frame Info</h4>
                  <div className="mt-2.5 flex flex-col gap-2">
                    <label className="text-xs text-slate-500">Frame Title</label>
                    <input
                      type="text"
                      value={editingFrame.name}
                      onChange={(e) => setEditingFrame({ ...editingFrame, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                    />
                  </div>
                </div>

                {selectedSlotId !== null && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 flex flex-col gap-4">
                    <h5 className="text-xs font-black uppercase text-indigo-400 flex items-center gap-1">
                      Slot #{selectedSlotId} Fine-Tuning
                    </h5>

                    {/* Width slider */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs font-mono text-slate-400">
                        <span>Width</span>
                        <span>{editingFrame.slots.find((s) => s.id === selectedSlotId)?.width}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSelectedSlotSize('width', -2)}
                          className="px-2.5 py-1 bg-slate-800 rounded font-bold text-sm text-slate-200"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="10"
                          max="95"
                          value={editingFrame.slots.find((s) => s.id === selectedSlotId)?.width || 40}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setEditingFrame({
                              ...editingFrame,
                              slots: editingFrame.slots.map((s) => (s.id === selectedSlotId ? { ...s, width: val } : s)),
                            });
                          }}
                          className="flex-1 accent-indigo-500"
                        />
                        <button
                          onClick={() => updateSelectedSlotSize('width', 2)}
                          className="px-2.5 py-1 bg-slate-800 rounded font-bold text-sm text-slate-200"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Height slider */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs font-mono text-slate-400">
                        <span>Height</span>
                        <span>{editingFrame.slots.find((s) => s.id === selectedSlotId)?.height}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSelectedSlotSize('height', -2)}
                          className="px-2.5 py-1 bg-slate-800 rounded font-bold text-sm text-slate-200"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="5"
                          max="95"
                          value={editingFrame.slots.find((s) => s.id === selectedSlotId)?.height || 40}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setEditingFrame({
                              ...editingFrame,
                              slots: editingFrame.slots.map((s) => (s.id === selectedSlotId ? { ...s, height: val } : s)),
                            });
                          }}
                          className="flex-1 accent-indigo-500"
                        />
                        <button
                          onClick={() => updateSelectedSlotSize('height', 2)}
                          className="px-2.5 py-1 bg-slate-800 rounded font-bold text-sm text-slate-200"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditor(false);
                    setEditingFrame(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditorChanges}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs uppercase shadow-md"
                >
                  Save Frame
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Frame Creator Row */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-300 flex items-center gap-1.5 mb-4">
          <Plus className="w-4 h-4 text-indigo-400" /> Design New Frame Overlay
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-semibold">Frame Name</label>
            <input
              type="text"
              value={newFrameName}
              onChange={(e) => setNewFrameName(e.target.value)}
              placeholder="e.g. Elegant Floral Wedding"
              className="px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-semibold">Category</label>
            <select
              value={newFrameCategory}
              onChange={(e) => setNewFrameCategory(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none"
            >
              <option value="Wedding">Wedding</option>
              <option value="Birthday">Birthday</option>
              <option value="Graduation">Graduation</option>
              <option value="Corporate">Corporate</option>
              <option value="Modern">Modern</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-semibold">Strip Layout Style</label>
            <select
              value={newFrameOrientation}
              onChange={(e) => setNewFrameOrientation(e.target.value as any)}
              className="px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-sm text-slate-200 focus:outline-none"
            >
              <option value="portrait">Traditional 2x6 Strip (Portrait)</option>
              <option value="landscape">Classic 4x6 Grid (Landscape)</option>
              <option value="square">Modern 2x2 Grid (Square)</option>
            </select>
          </div>

          <button
            onClick={handleCreateFrame}
            className="py-2 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-md"
          >
            Create & Edit
          </button>
        </div>
      </div>

      {/* Interactive Frames Directory list */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold tracking-wider uppercase text-slate-300 mb-4 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-400" /> Active Frames Directory ({frames.length})
        </h3>

        <div className="flex flex-col gap-3">
          {frames.map((frame) => {
            const isStrip = frame.slots[0] && frame.slots[0].width < 90 && frame.slots[0].height < 25;
            const styleLabel = isStrip ? '2x6 Portrait Strip' : '4x6 Landscape Grid';

            return (
              <div
                key={frame.id}
                className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-850 hover:border-slate-800 transition-all gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-850 flex items-center justify-center text-xs text-indigo-400 font-bold shrink-0">
                    {frame.imageUrl ? 'PNG' : 'GRID'}
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-200 leading-tight">{frame.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {frame.category} • {styleLabel} • {frame.slots.length} photo slots
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Active/Inactive Status indicator toggle */}
                  <button
                    onClick={() => handleToggleFrameActive(frame.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      frame.active
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-slate-800 text-slate-500 hover:bg-slate-750'
                    }`}
                  >
                    {frame.active ? <Check className="w-3.5 h-3.5" /> : null}
                    {frame.active ? 'Active' : 'Disabled'}
                  </button>

                  <button
                    onClick={() => handleEditFrame(frame)}
                    className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 text-indigo-400 rounded-lg"
                    title="Edit Visual Layout"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteFrame(frame.id)}
                    className="p-2 bg-slate-900 hover:bg-rose-950 border border-slate-850 hover:border-rose-900/40 text-rose-400 rounded-lg"
                    title="Delete Frame"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
