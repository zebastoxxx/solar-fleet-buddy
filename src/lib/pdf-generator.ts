import jsPDF from 'jspdf';

interface DeliveryActData {
  type: 'herramienta_ot' | 'kit_campo';
  title?: string;
  items: Array<{ name: string; code?: string; quantity?: number; unit?: string }>;
  deliveredTo: string;
  deliveredBy: string;
  otCode?: string;
  machineName?: string;
  projectName?: string;
  signatureDelivery: string;
  signatureReceipt?: string;
  date: Date;
}

export async function generateDeliveryActPDF(data: DeliveryActData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(212, 136, 30);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('UP & DOWN SOLAR', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Power by God', 14, 18);
  doc.text(
    data.type === 'herramienta_ot' ? 'ACTA DE ENTREGA DE HERRAMIENTAS' : 'ACTA DE ENTREGA DE KIT DE EMERGENCIA',
    14, 24,
  );

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.text(`Fecha: ${data.date.toLocaleDateString('es-CO')}`, 14, 38);
  doc.text(`Hora: ${data.date.toLocaleTimeString('es-CO')}`, 100, 38);
  if (data.otCode) doc.text(`OT: ${data.otCode}`, 14, 45);
  if (data.machineName) doc.text(`Máquina: ${data.machineName}`, 100, 45);
  if (data.projectName) doc.text(`Proyecto: ${data.projectName}`, 14, 52);

  doc.setDrawColor(212, 136, 30);
  doc.line(14, 57, 196, 57);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ÍTEMS ENTREGADOS', 14, 65);
  doc.setFillColor(240, 237, 232);
  doc.rect(14, 68, 182, 7, 'F');
  doc.setFontSize(9);
  doc.text('Ítem', 16, 73);
  doc.text('Código', 90, 73);
  doc.text('Cantidad', 130, 73);
  doc.text('Unidad', 160, 73);

  let y = 80;
  data.items.forEach((item, i) => {
    if (i % 2 === 0) { doc.setFillColor(249, 248, 246); doc.rect(14, y - 4, 182, 7, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text((item.name || '').substring(0, 35), 16, y);
    doc.text(item.code || '—', 90, y);
    doc.text(String(item.quantity || 1), 130, y);
    doc.text(item.unit || 'unidad', 160, y);
    y += 8;
  });

  y += 8; doc.setDrawColor(212, 136, 30); doc.line(14, y, 196, y); y += 8;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('ENTREGA', 14, y); doc.text('RECIBE', 110, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Nombre: ${data.deliveredBy}`, 14, y); doc.text(`Nombre: ${data.deliveredTo}`, 110, y); y += 5;
  doc.text('Firma:', 14, y); doc.text('Firma:', 110, y); y += 4;
  if (data.signatureDelivery) { try { doc.addImage(data.signatureDelivery, 'PNG', 14, y, 75, 30); } catch {} }
  if (data.signatureReceipt) { try { doc.addImage(data.signatureReceipt, 'PNG', 110, y, 75, 30); } catch {} }
  y += 35; doc.line(14, y, 89, y); doc.line(110, y, 185, y); y += 5;
  doc.setFontSize(8); doc.text(data.deliveredBy, 14, y); doc.text(data.deliveredTo, 110, y);
  doc.setFontSize(7); doc.setTextColor(150, 150, 150);
  doc.text('Up & Down Solar · Barranquilla, Colombia · Power by God', 105, 285, { align: 'center' });
  return doc.output('blob');
}

// =========== MACHINE REPORT (HOJA DE VIDA) ===========

interface MachineReportData {
  machine: any;
  conditions: any[];
  ots: any[];
  financials?: any;
}

export async function generateMachineReportPDF(data: MachineReportData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const m = data.machine;

  // Header
  doc.setFillColor(212, 136, 30);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('UP & DOWN SOLAR', 14, 12);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Power by God', 14, 18);
  doc.text('HOJA DE VIDA DEL EQUIPO', 14, 24);
  doc.setFontSize(8);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}`, 196, 24, { align: 'right' });

  let y = 38;
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL EQUIPO', 14, y); y += 8;

  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const fields: [string, any][] = [
    ['Código Interno', m.internal_code], ['Nombre', m.name], ['Marca', m.brand], ['Modelo', m.model],
    ['Año', m.year], ['Nº Serie', m.serial_number], ['Tipo', m.type], ['Estado', m.status],
    ['Horómetro actual', `${Number(m.horometer_current ?? 0).toLocaleString()} h`],
    ['Peso (kg)', m.weight_kg], ['Capacidad máx.', m.max_capacity],
    ['Altura máx.', (m as any).max_height], ['Motor', (m as any).engine_model],
    ['Combustible', (m as any).fuel_type], ['Placa', (m as any).plate_number],
  ];

  let col = 0;
  fields.forEach(([label, val]) => {
    const x = col === 0 ? 14 : col === 1 ? 80 : 146;
    doc.setFont('helvetica', 'bold'); doc.text(`${label}:`, x, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(val ?? '—'), x + 1, y + 4);
    col++;
    if (col >= 3) { col = 0; y += 10; }
  });
  if (col > 0) y += 10;

  // Financials summary
  if (data.financials) {
    y += 4;
    doc.setDrawColor(212, 136, 30); doc.line(14, y, 196, y); y += 8;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('INDICADORES FINANCIEROS', 14, y); y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const f = data.financials;
    doc.text(`Ingresos totales: $${Number(f.total_income ?? 0).toLocaleString()}`, 14, y);
    doc.text(`Gastos totales: $${Number(f.total_expenses ?? 0).toLocaleString()}`, 80, y);
    doc.text(`Utilidad: $${Number(f.profit ?? 0).toLocaleString()}`, 146, y); y += 5;
    doc.text(`Margen: ${Number(f.profit_margin_pct ?? 0).toFixed(1)}%`, 14, y); y += 4;
  }

  // Conditions
  if (data.conditions.length > 0) {
    y += 4;
    doc.setDrawColor(212, 136, 30); doc.line(14, y, 196, y); y += 8;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('CONDICIÓN DEL EQUIPO', 14, y); y += 7;
    doc.setFillColor(240, 237, 232); doc.rect(14, y - 4, 182, 7, 'F');
    doc.setFontSize(9);
    doc.text('Componente', 16, y); doc.text('Estado (%)', 160, y); y += 7;
    doc.setFont('helvetica', 'normal');
    data.conditions.forEach((c) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(c.item_name, 16, y);
      doc.text(`${c.condition_pct ?? 0}%`, 160, y);
      y += 6;
    });
  }

  // OT History
  if (data.ots.length > 0) {
    y += 4;
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setDrawColor(212, 136, 30); doc.line(14, y, 196, y); y += 8;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('HISTORIAL DE ÓRDENES DE TRABAJO', 14, y); y += 7;
    doc.setFillColor(240, 237, 232); doc.rect(14, y - 4, 182, 7, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Código', 16, y); doc.text('Tipo', 42, y); doc.text('Estado', 68, y);
    doc.text('Fecha', 100, y); doc.text('Horas', 130, y); doc.text('Costo', 150, y); y += 7;
    doc.setFont('helvetica', 'normal');
    data.ots.forEach((ot) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(ot.code ?? '', 16, y);
      doc.text(ot.type ?? '', 42, y);
      doc.text(ot.status ?? '', 68, y);
      doc.text(ot.created_at ? new Date(ot.created_at).toLocaleDateString('es-CO') : '', 100, y);
      doc.text(ot.actual_hours ? `${ot.actual_hours}h` : '—', 130, y);
      doc.text(ot.total_cost ? `$${Number(ot.total_cost).toLocaleString()}` : '—', 150, y);
      y += 5;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    doc.text(`Up & Down Solar · Barranquilla, Colombia · Power by God — Pág. ${i}/${pageCount}`, 105, 290, { align: 'center' });
  }

  return doc.output('blob');
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
