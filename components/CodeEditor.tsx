import React from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  onUpdate: () => void;
  error: string | null;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, onUpdate, error }) => {
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="relative flex-grow w-full h-full overflow-hidden">
        <textarea
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              onUpdate();
            }
          }}
          spellCheck={false}
          className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-relaxed text-slate-200 bg-[#1e1e1e] border-none outline-none resize-none custom-scrollbar focus:ring-0"
          placeholder="Enter DOT code here..."
        />
      </div>

      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-900/20 border-t border-red-900/50">
          <div className="font-semibold mb-1 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Syntax Error
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs opacity-90">{error}</pre>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
