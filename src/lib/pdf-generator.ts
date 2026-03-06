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

  // Header band
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
    data.type === 'herramienta_ot'
      ? 'ACTA DE ENTREGA DE HERRAMIENTAS'
      : 'ACTA DE ENTREGA DE KIT DE EMERGENCIA',
    14,
    24,
  );

  // Meta
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.text(`Fecha: ${data.date.toLocaleDateString('es-CO')}`, 14, 38);
  doc.text(`Hora: ${data.date.toLocaleTimeString('es-CO')}`, 100, 38);
  if (data.otCode) doc.text(`OT: ${data.otCode}`, 14, 45);
  if (data.machineName) doc.text(`Máquina: ${data.machineName}`, 100, 45);
  if (data.projectName) doc.text(`Proyecto: ${data.projectName}`, 14, 52);

  doc.setDrawColor(212, 136, 30);
  doc.line(14, 57, 196, 57);

  // Items table
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
    if (i % 2 === 0) {
      doc.setFillColor(249, 248, 246);
      doc.rect(14, y - 4, 182, 7, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text((item.name || '').substring(0, 35), 16, y);
    doc.text(item.code || '—', 90, y);
    doc.text(String(item.quantity || 1), 130, y);
    doc.text(item.unit || 'unidad', 160, y);
    y += 8;
  });

  y += 8;
  doc.setDrawColor(212, 136, 30);
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGA', 14, y);
  doc.text('RECIBE', 110, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nombre: ${data.deliveredBy}`, 14, y);
  doc.text(`Nombre: ${data.deliveredTo}`, 110, y);
  y += 5;
  doc.text('Firma:', 14, y);
  doc.text('Firma:', 110, y);
  y += 4;

  if (data.signatureDelivery) {
    try {
      doc.addImage(data.signatureDelivery, 'PNG', 14, y, 75, 30);
    } catch { /* skip */ }
  }
  if (data.signatureReceipt) {
    try {
      doc.addImage(data.signatureReceipt, 'PNG', 110, y, 75, 30);
    } catch { /* skip */ }
  }
  y += 35;

  doc.line(14, y, 89, y);
  doc.line(110, y, 185, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(data.deliveredBy, 14, y);
  doc.text(data.deliveredTo, 110, y);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Up & Down Solar · Barranquilla, Colombia · Power by God', 105, 285, {
    align: 'center',
  });

  return doc.output('blob');
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
