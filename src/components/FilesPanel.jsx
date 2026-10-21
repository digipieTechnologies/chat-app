import { FileText, Download, Eye } from 'lucide-react';
import { useChat } from '../context/ChatContext';

const EXT_STYLE = {
  doc:  { bg: '#eff6ff', icon: '#3b82f6', border: '#bfdbfe', chipBg: '#dbeafe', chipText: '#1d4ed8' },
  docx: { bg: '#eff6ff', icon: '#3b82f6', border: '#bfdbfe', chipBg: '#dbeafe', chipText: '#1d4ed8' },
  pdf:  { bg: '#fef2f2', icon: '#ef4444', border: '#fecaca', chipBg: '#fee2e2', chipText: '#b91c1c' },
  fig:  { bg: '#faf5ff', icon: '#a855f7', border: '#e9d5ff', chipBg: '#f3e8ff', chipText: '#7e22ce' },
  zip:  { bg: '#fffbeb', icon: '#f59e0b', border: '#fde68a', chipBg: '#fef3c7', chipText: '#b45309' },
};

const formatFileDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  
  if (date.toDateString() === now.toDateString()) {
    return `Today, ${timeStr}`;
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yest, ${timeStr}`;
  }
  
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
};

export function FilesPanel() {
  const { allMessages, setViewingFile } = useChat();

  const fileMessages = (allMessages || []).filter(m => m.type === 'file' && m.file && !m.isDeleted);
  
  // Sort files by newest first
  const sortedFiles = [...fileMessages].reverse();

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] px-3 sm:px-6 py-4 sm:py-6">

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-[#0f172a]">Shared Files</h3>
          <span className="text-[11px] font-semibold text-[#64748b] bg-white border border-[#e2e8f0] px-2.5 py-1 rounded-full shadow-sm">
            {sortedFiles.length} files
          </span>
        </div>

        <div className="grid gap-3">
          {sortedFiles.map(msg => {
            const file = msg.file;
            const ext   = file.name.split('.').pop()?.toLowerCase() ?? 'doc';
            const style = EXT_STYLE[ext] ?? EXT_STYLE.doc;

            return (
              <div
                key={msg.id}
                onClick={() => setViewingFile(file)}
                className="flex items-center gap-2 sm:gap-4 p-2 sm:p-4 bg-white border border-[#e2e8f0]
                           rounded-xl hover:border-[#cbd5e1] hover:shadow-sm transition-all duration-150
                           cursor-pointer group min-w-0"
              >
                {/* Icon */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 border"
                     style={{ backgroundColor: style.bg, borderColor: style.border }}>
                  <FileText className="w-5 h-5 sm:w-5.5 sm:h-5.5" strokeWidth={1.8} style={{ color: style.icon }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#0f172a] truncate group-hover:text-[#4f46e5] transition-colors">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1 sm:gap-2 mt-1 sm:mt-1.5 overflow-hidden">
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[8.5px] sm:text-[10px] font-bold uppercase shrink-0 whitespace-nowrap"
                          style={{ backgroundColor: style.chipBg, color: style.chipText }}>
                      {ext.length > 4 ? ext.slice(0, 3) + '..' : ext}
                    </span>
                    <span className="text-[9.5px] sm:text-[11px] font-medium text-[#64748b] whitespace-nowrap">{file.size}</span>
                    <span className="text-[#cbd5e1] text-[8px] sm:text-[10px] shrink-0">·</span>
                    <span className="text-[9.5px] sm:text-[11px] font-medium text-[#64748b] whitespace-nowrap">
                      {formatFileDate(msg.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="hidden sm:flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingFile(file);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-lg
                               text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]
                               transition-all duration-100 border border-transparent hover:border-[#e2e8f0]"
                  >
                    <Eye size={16} strokeWidth={2} />
                  </button>
                  <a 
                    href={file.url} 
                    download={file.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-9 h-9 flex items-center justify-center rounded-lg
                               text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]
                               transition-all duration-100 border border-transparent hover:border-[#e2e8f0]"
                  >
                    <Download size={16} strokeWidth={2} />
                  </a>
                </div>
              </div>
            );
          })}
          
          {sortedFiles.length === 0 && (
            <div className="text-center py-10 bg-white border border-[#e2e8f0] border-dashed rounded-xl">
              <FileText size={32} className="mx-auto text-[#cbd5e1] mb-3" />
              <p className="text-[14px] font-semibold text-[#475569]">No shared files</p>
              <p className="text-[12px] text-[#94a3b8] mt-1">Files you share in this conversation will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
