export interface PlantaoRecord {
  matricula: string;
  nome: string;
  escalas: number;
  escalasOriginal: string;
  valorHora: number;
  totalHoras: number;
  totalHorasOriginal: string;
  valorFinal: number;
  valorFinalOriginal: string;
  setor: string;
  turno: 'DIURNO' | 'NOTURNO' | string;
  profissao: string;
}

export interface SectorData {
  setor: string;
  registros: PlantaoRecord[];
  totalPlantoes: number;
  totalHoras: number;
  valorTotal: number;
}

export interface ReportData {
  registros: PlantaoRecord[];
  setores: SectorData[];
  totalProfissionais: number;
  totalPlantoes: number;
  totalHoras: number;
  totalSetores: number;
  valorTotal: number;
  profissoes: string[];
  cliente?: string;
  periodo?: string;
  subtotalOriginal?: string;
  totalOriginal?: string;
}

export interface FilterState {
  setor: string;
  profissional: string;
  turno: string;
  profissao: string;
}
