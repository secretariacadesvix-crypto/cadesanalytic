import { useState, useCallback, useRef } from 'react';
import { FileDown, FileSpreadsheet, FileText, Upload, Save, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PDFUpload } from '@/components/PDFUpload';
import { SummaryCards } from '@/components/SummaryCards';
import { ReportCharts } from '@/components/ReportCharts';
import { SectorTables } from '@/components/SectorTables';
import { ReportFilters } from '@/components/ReportFilters';
import { AdminNav } from '@/components/AdminNav';
import { SaveReportModal } from '@/components/SaveReportModal';
import { parsePDF, generateDemoData } from '@/lib/pdfParser';
import { exportToPDF, exportToExcel, exportToCSV } from '@/lib/exportUtils';
import { useAuth } from '@/contexts/AuthContext';
import type { ReportData, FilterState } from '@/types/report';

const Index = () => {
  const { profile } = useAuth();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string>();
  const [filters, setFilters] = useState<FilterState>({ setor: '', profissional: '', turno: '', profissao: '' });
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [selectedSetor, setSelectedSetor] = useState('all');
  const fileRef = useRef<File | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(undefined);
    setIsComplete(false);
    fileRef.current = file;
    try {
      const data = await parsePDF(file);
      setReportData(data);
      setIsComplete(true);
    } catch (err) {
      console.error(err);
      setError('Erro ao processar o PDF. Verifique o formato.');
      fileRef.current = null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleLoadDemo = useCallback(() => {
    setIsProcessing(true);
    fileRef.current = null;
    setTimeout(() => {
      const data = generateDemoData();
      setReportData(data);
      setIsComplete(true);
      setIsProcessing(false);
    }, 800);
  }, []);

  const handleNewReport = useCallback(() => {
    setReportData(null);
    setIsComplete(false);
    setError(undefined);
    setFilters({ setor: '', profissional: '', turno: '', profissao: '' });
    setSelectedSetor('all');
    fileRef.current = null;
  }, []);

  const isAdmin = profile?.role === 'admin';

  // Upload screen
  if (!reportData) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#f7f9fc' }}>
        {isAdmin && <AdminNav />}

        {!isAdmin && (
          <header style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                <div style={{ background: '#0f2340', borderRadius: 10, padding: '7px 14px', boxShadow: '0 2px 8px rgba(15,35,64,.18)' }}>
                  <img src="/logo_cades.png" alt="CADES" style={{ height: 30, width: 'auto', display: 'block' }} />
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <p style={{ fontSize: '.8rem', fontWeight: 600, color: '#0f2340' }}>CADES Analytics</p>
                  <p style={{ fontSize: '.65rem', color: '#8a9ab5' }}>Cooperativa Assistencial · ES</p>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Layout: sidebar + main */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* Sidebar */}
          {isAdmin && (
            <aside style={{
              width: 56, flexShrink: 0,
              background: '#fff', borderRight: '1px solid #e2e8f0',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', padding: '1.5rem 0', gap: 4,
            }}>
              {/* Dashboard */}
              <div title="Dashboard" style={{
                width: 40, height: 40, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#e8eef7', color: '#0f2340', cursor: 'pointer',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
              {/* Notifications */}
              <div title="Notificações" style={{
                width: 40, height: 40, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#8a9ab5', cursor: 'pointer',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              {/* Settings */}
              <div title="Configurações" style={{
                width: 40, height: 40, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#8a9ab5', cursor: 'pointer',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </div>
            </aside>
          )}

          {/* Main content */}
          <main style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '3rem 2rem',
          }}>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <h1 style={{
                fontSize: '1.9rem', fontWeight: 600,
                color: '#0f2340', letterSpacing: '-.03em',
                lineHeight: 1.2, marginBottom: '.6rem',
              }}>
                Análise de Relatórios
              </h1>
              <p style={{ fontSize: '.9rem', color: '#4a5568', maxWidth: 400, lineHeight: 1.65 }}>
                Envie o relatório de plantões em PDF para gerar uma análise profissional completa.
              </p>
            </div>

            {/* Dropzone */}
            <div style={{ width: '100%', maxWidth: 540 }}>
              <PDFUpload
                onFileSelect={handleFileSelect}
                isProcessing={isProcessing}
                isComplete={isComplete}
                error={error}
              />

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
                {[
                  { label: 'Relatórios', val: '—', sub: 'este mês' },
                  { label: 'Clientes', val: '—', sub: 'ativos' },
                  { label: 'Última análise', val: '—', sub: 'aguardando' },
                ].map(({ label, val, sub }) => (
                  <div key={label} style={{
                    flex: 1, background: '#fff',
                    border: '1px solid #e2e8f0', borderRadius: 14,
                    padding: '.9rem 1rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,.04)',
                  }}>
                    <p style={{ fontSize: '.68rem', fontWeight: 500, color: '#8a9ab5', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '.25rem' }}>
                      {label}
                    </p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0f2340', letterSpacing: '-.03em' }}>
                      {val}
                    </p>
                    <p style={{ fontSize: '.7rem', color: '#8a9ab5', marginTop: '.1rem' }}>{sub}</p>
                  </div>
                ))}
              </div>

              {/* Demo link */}
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Button variant="ghost" size="sm" onClick={handleLoadDemo}
                  style={{ fontSize: '.78rem', color: '#8a9ab5', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Carregar dados de demonstração
                </Button>
              </div>
            </div>
          </main>
        </div>

        <footer style={{ textAlign: 'center', padding: '1rem', fontSize: '.72rem', color: '#8a9ab5', borderTop: '1px solid #e2e8f0', letterSpacing: '.02em' }}>
          CADES – Cooperativa Assistencial de Trabalho do Espírito Santo
        </footer>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-background">
      {isAdmin && <AdminNav />}

      {/* Dashboard header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {!isAdmin && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-foreground">CADES Analytics</span>
            </div>
          )}
          {isAdmin && <div />}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNewReport} className="gap-2 text-xs">
              <Upload className="w-3.5 h-3.5" /> Novo
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setSaveModalOpen(true)} className="gap-2 text-xs">
                <Save className="w-3.5 h-3.5" /> Salvar para cliente
              </Button>
            )}
            <Select value={selectedSetor} onValueChange={setSelectedSetor}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os setores</SelectItem>
                {reportData.setores.map(s => (
                  <SelectItem key={s.setor} value={s.setor} className="text-xs">{s.setor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { void exportToPDF(reportData, reportData.cliente, reportData.periodo, selectedSetor !== 'all' ? selectedSetor : undefined); }} className="gap-2 text-xs">
              <FileText className="w-3.5 h-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(reportData)} className="gap-2 text-xs">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToCSV(reportData)} className="gap-2 text-xs">
              <FileDown className="w-3.5 h-3.5" /> CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="section-title mb-4">Resumo Executivo</h2>
          <SummaryCards data={reportData} />
        </section>
        <section>
          <h2 className="section-title mb-4">Análise Gráfica</h2>
          <ReportCharts data={reportData} />
        </section>
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Relatório Detalhado por Setor</h2>
          </div>
          <ReportFilters data={reportData} filters={filters} onFiltersChange={setFilters} />
        </section>
        <section>
          <SectorTables data={reportData} filters={filters} />
        </section>
      </main>

      <footer className="border-t border-border mt-12 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          CADES – Cooperativa Assistencial de Trabalho do Espírito Santo • Vitória/ES
        </p>
      </footer>

      {reportData && (
        <SaveReportModal
          open={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          reportData={reportData}
          file={fileRef.current}
        />
      )}
    </div>
  );
};

export default Index;
