import { useCallback, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface PDFUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  isComplete: boolean;
  error?: string;
}

const dropBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '.45rem',
  padding: '.55rem 1.1rem', borderRadius: 8,
  background: '#0f2340', color: '#fff',
  fontSize: '.76rem', fontWeight: 600,
  fontFamily: 'inherit', letterSpacing: '-.01em',
  border: 'none', cursor: 'pointer',
  whiteSpace: 'nowrap', flexShrink: 0,
  boxShadow: '0 1px 4px rgba(15,35,64,.18)',
  transition: 'background .18s, transform .1s',
};

const baseStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: '1.6rem 2rem',
  display: 'flex',
  alignItems: 'center',
  gap: '1.25rem',
  transition: 'border-color .2s, background .2s',
};

export function PDFUpload({ onFileSelect, isProcessing, isComplete, error }: PDFUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setFileName(file.name);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  if (isProcessing) {
    return (
      <div style={{ ...baseStyle, border: '1px solid #e2e8f0' }}>
        <Loader2 size={22} className="animate-spin" style={{ color: '#8a9ab5', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '.88rem', fontWeight: 600, color: '#0f1f3d', marginBottom: '.15rem' }}>
            Processando relatório...
          </p>
          <p style={{ fontSize: '.76rem', color: '#8a9ab5' }}>{fileName}</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div style={{ ...baseStyle, border: '1px solid #86efac', background: '#f0fdf4' }}>
        <CheckCircle size={22} style={{ color: '#22c55e', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '.88rem', fontWeight: 600, color: '#0f1f3d', marginBottom: '.15rem' }}>
            Relatório processado com sucesso!
          </p>
          <p style={{ fontSize: '.76rem', color: '#8a9ab5' }}>{fileName}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...baseStyle, border: '1px solid #fca5a5', background: '#fef2f2' }}>
        <AlertCircle size={22} style={{ color: '#ef4444', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '.88rem', fontWeight: 600, color: '#ef4444', marginBottom: '.15rem' }}>
            {error}
          </p>
          <p style={{ fontSize: '.76rem', color: '#8a9ab5' }}>Clique para tentar novamente</p>
        </div>
        <button
          style={dropBtnStyle}
          onClick={() => inputRef.current?.click()}
          onMouseEnter={e => (e.currentTarget.style.background = '#1e4d8c')}
          onMouseLeave={e => (e.currentTarget.style.background = '#0f2340')}
        >
          Selecionar arquivo
        </button>
        <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />
      </div>
    );
  }

  // Idle — horizontal dropzone
  return (
    <div
      style={{
        ...baseStyle,
        border: '1px solid',
        borderColor: isDragOver ? '#c5d3e8' : '#e2e8f0',
        background: isDragOver ? '#e8eef7' : 'transparent',
      }}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <svg
        width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={isDragOver ? '#0f2340' : '#8a9ab5'}
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, transition: 'stroke .2s' }}
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>

      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '.88rem', fontWeight: 600, color: '#0f1f3d', letterSpacing: '-.01em', marginBottom: '.15rem' }}>
          Arraste o PDF aqui
        </p>
        <p style={{ fontSize: '.76rem', color: '#8a9ab5' }}>
          Relatório de plantões em formato PDF
        </p>
      </div>

      <button
        style={dropBtnStyle}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={e => (e.currentTarget.style.background = '#1e4d8c')}
        onMouseLeave={e => (e.currentTarget.style.background = '#0f2340')}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(.97)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Selecionar arquivo
      </button>

      <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />
    </div>
  );
}
