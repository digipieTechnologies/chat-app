import { FileText, Download, Eye } from 'lucide-react';
import clsx from 'clsx';

const FILE_STYLE = {
  doc:  { bg: '#eff6ff', icon: '#3b82f6', border: '#bfdbfe', ext: 'DOCX' },
  docx: { bg: '#eff6ff', icon: '#3b82f6', border: '#bfdbfe', ext: 'DOCX' },
  pdf:  { bg: '#fef2f2', icon: '#ef4444', border: '#fecaca', ext: 'PDF'  },
  fig:  { bg: '#faf5ff', icon: '#a855f7', border: '#e9d5ff', ext: 'FIG'  },
  zip:  { bg: '#fffbeb', icon: '#f59e0b', border: '#fde68a', ext: 'ZIP'  },
};

export function FileCard({ file, isMe, onViewFile }) {
  if (!file) return null;
  const ext = (file.name.split('.').pop() ?? 'doc').toLowerCase();
  const style = FILE_STYLE[ext] ?? FILE_STYLE.doc;

  return (
    <div 
      onClick={() => onViewFile && onViewFile(file)}
      className={clsx(
        'flex flex-col gap-2 p-2.5 md:p-3 mt-1 rounded-xl shadow-sm hover:shadow-md transition-shadow animate-slide-up w-[240px] sm:w-[280px] md:w-[320px] max-w-full cursor-pointer',
        isMe 
          ? 'bg-[#4f46e5] border border-[#4338ca]' 
          : 'bg-white border border-[#e2e8f0]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={clsx(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border',
          isMe ? 'bg-white/20 border-white/20' : ''
        )} style={!isMe ? { backgroundColor: style.bg, borderColor: style.border } : {}}>
          <FileText size={20} strokeWidth={2} style={!isMe ? { color: style.icon } : { color: '#ffffff' }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={clsx(
            'text-[13px] font-semibold truncate leading-tight',
            isMe ? 'text-white' : 'text-[#0f172a]'
          )}>
            {file.name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={clsx(
              'text-[10px] font-bold',
              isMe ? 'text-white/80' : 'text-[#64748b]'
            )}>{style.ext}</span>
            <span className={clsx('w-1 h-1 rounded-full', isMe ? 'bg-white/50' : 'bg-[#cbd5e1]')} />
            <span className={clsx('text-[11px]', isMe ? 'text-white/80' : 'text-[#64748b]')}>{file.size}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onViewFile) onViewFile(file);
            }}
            className={clsx(
              'w-7 h-7 flex items-center justify-center rounded-md transition-all',
              isMe ? 'text-white hover:bg-white/20' : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
            )}
          >
            <Eye size={14} strokeWidth={2} />
          </button>
          
          <a
            href={file.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            download={file.name}
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              'w-7 h-7 flex items-center justify-center rounded-md transition-all',
              isMe ? 'text-white hover:bg-white/20' : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]',
              !file.url && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Download size={14} strokeWidth={2} />
          </a>
        </div>
      </div>
    </div>
  );
}
