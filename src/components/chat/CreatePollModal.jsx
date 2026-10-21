import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from '../../utils/poll';

const emptyOptions = () => ['', ''];

export function CreatePollModal({ isOpen, onClose, onCreate }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(emptyOptions);
  const [multi, setMulti] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQuestion('');
    setOptions(emptyOptions());
    setMulti(false);
    setSending(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filled = options.map(o => o.trim()).filter(Boolean);
  const hasDuplicates = new Set(filled.map(o => o.toLowerCase())).size !== filled.length;
  const canSend = question.trim().length > 0 && filled.length >= POLL_MIN_OPTIONS && !hasDuplicates && !sending;

  const setOption = (idx, value) => setOptions(prev => prev.map((o, i) => (i === idx ? value : o)));

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onCreate({ question, options: filled, multi });
      onClose();
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[420px] max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-slate-800">Create poll</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-slate-600">Question</span>
            <input
              autoFocus
              value={question}
              maxLength={200}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask something..."
              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5]"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold text-slate-600">Options</span>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={opt}
                  maxLength={80}
                  onChange={(e) => setOption(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 min-w-0 border border-[#e2e8f0] rounded-lg px-3 py-2 text-[14px] outline-none focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5]"
                />
                {options.length > POLL_MIN_OPTIONS && (
                  <button
                    onClick={() => setOptions(prev => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove option"
                    className="w-8 h-8 shrink-0 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {options.length < POLL_MAX_OPTIONS && (
              <button
                onClick={() => setOptions(prev => [...prev, ''])}
                className="self-start flex items-center gap-1.5 text-[12px] font-semibold text-[#4f46e5] hover:text-[#4338ca] mt-0.5"
              >
                <Plus size={13} strokeWidth={2.5} /> Add option
              </button>
            )}
            {hasDuplicates && <span className="text-[11px] text-red-500">Options must be different.</span>}
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="w-4 h-4 accent-[#4f46e5]" />
            <span className="text-[13px] text-slate-700 font-medium">Allow multiple answers</span>
          </label>
        </div>

        <div className="flex bg-slate-100/50">
          <button onClick={onClose} className="flex-1 py-3 text-[14px] font-semibold text-slate-500 hover:bg-slate-200/50 transition-colors bg-slate-200/40">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSend}
            className={clsx(
              'flex-1 py-3 text-[14px] font-bold text-white transition-colors',
              canSend ? 'bg-[#4f46e5] hover:bg-[#4338ca]' : 'bg-[#a5b4fc] cursor-not-allowed'
            )}
          >
            Send poll
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
