const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Generate a waybill PDF for a shipment.
 * Returns the file path.
 */
async function generateWaybill(shipment) {
  return new Promise((resolve, reject) => {
    const dir = path.join(__dirname, '../../uploads/waybills');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `waybill-${shipment.trackingNumber}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const company = process.env.COMPANY_NAME || 'ShipTrack Logistics';
    const W = 595 - 100; // usable width

    // ── Header ──
    doc.rect(0, 0, 595, 90).fill('#0f1117');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(company, 50, 28);
    doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
       .text(`${process.env.COMPANY_ADDRESS || ''}  |  ${process.env.COMPANY_PHONE || ''}  |  ${process.env.COMPANY_EMAIL || ''}`, 50, 56);

    // ── Title row ──
    doc.fillColor('#0f1117').fontSize(14).font('Helvetica-Bold').text('WAYBILL / DELIVERY NOTE', 50, 110);
    doc.fontSize(11).font('Helvetica').fillColor('#5a5f72').text(`Tracking: ${shipment.trackingNumber}`, 50, 130);
    doc.text(`Date: ${fmtDate(shipment.createdAt)}`, 50, 146);
    doc.text(`Priority: ${shipment.priority}`, 50, 162);

    // Status badge area
    doc.rect(400, 108, 145, 60).fill('#f7f8fa').stroke('#e2e5ed');
    doc.fillColor('#0f1117').fontSize(9).font('Helvetica-Bold').text('STATUS', 408, 118);
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a6ef5').text(shipment.status, 408, 132);
    if (shipment.estimatedDelivery) {
      doc.fontSize(8).font('Helvetica').fillColor('#5a5f72').text(`Est: ${fmtDate(shipment.estimatedDelivery)}`, 408, 152);
    }

    // ── Divider ──
    doc.moveTo(50, 185).lineTo(545, 185).stroke('#e2e5ed');

    // ── Sender / Recipient columns ──
    const col1 = 50, col2 = 310, y = 200;
    const drawPartyBox = (x, label, party) => {
      doc.rect(x, y - 5, 240, 115).fill('#f7f8fa').stroke('#e2e5ed');
      doc.fillColor('#1a6ef5').fontSize(8).font('Helvetica-Bold').text(label, x + 10, y + 5);
      doc.fillColor('#0f1117').fontSize(12).font('Helvetica-Bold').text(party.name, x + 10, y + 20);
      doc.fontSize(9).font('Helvetica').fillColor('#2a2d36')
         .text(party.address, x + 10, y + 38, { width: 215 })
         .text(`Tel: ${party.phone}`, x + 10, y + 72)
         .text(party.email || '', x + 10, y + 86);
    };

    drawPartyBox(col1, 'SENDER', shipment.sender);
    drawPartyBox(col2, 'RECIPIENT', shipment.recipient);

    // ── Package Details ──
    const pd = 330;
    doc.moveTo(50, pd).lineTo(545, pd).stroke('#e2e5ed');
    doc.fillColor('#0f1117').fontSize(11).font('Helvetica-Bold').text('Package Details', 50, pd + 12);

    const details = [
      ['Description', shipment.description],
      ['Package Type', shipment.packageType || '—'],
      ['Weight', shipment.weight ? `${shipment.weight} kg` : '—'],
      ['Dimensions', shipment.dimensions?.width ? `${shipment.dimensions.width} × ${shipment.dimensions.height} × ${shipment.dimensions.length} cm` : '—'],
      ['Quantity', String(shipment.quantity || 1)],
    ];

    let dy = pd + 35;
    details.forEach(([label, val], i) => {
      if (i % 2 === 0) doc.rect(50, dy - 4, W, 20).fill('#f7f8fa');
      doc.fillColor('#5a5f72').fontSize(9).font('Helvetica').text(label, 55, dy);
      doc.fillColor('#0f1117').font('Helvetica-Bold').text(val, 220, dy);
      dy += 22;
    });

    // ── Payment Section ──
    const ps = dy + 15;
    doc.moveTo(50, ps).lineTo(545, ps).stroke('#e2e5ed');
    doc.fillColor('#0f1117').fontSize(11).font('Helvetica-Bold').text('Payment', 50, ps + 12);

    const payments = [
      ['Delivery Fee', `₦${Number(shipment.deliveryFee || 0).toLocaleString()}`],
      ['Payment Method', shipment.paymentMethod || 'Cash'],
      ['Payment Status', shipment.paymentStatus || 'Unpaid'],
    ];

    dy = ps + 35;
    payments.forEach(([label, val], i) => {
      if (i % 2 === 0) doc.rect(50, dy - 4, W, 20).fill('#f7f8fa');
      doc.fillColor('#5a5f72').fontSize(9).font('Helvetica').text(label, 55, dy);
      doc.fillColor('#0f1117').font('Helvetica-Bold').text(val, 220, dy);
      dy += 22;
    });

    // ── Notes ──
    if (shipment.notes) {
      doc.moveTo(50, dy + 10).lineTo(545, dy + 10).stroke('#e2e5ed');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f1117').text('Notes:', 50, dy + 22);
      doc.font('Helvetica').fillColor('#2a2d36').text(shipment.notes, 50, dy + 36, { width: W });
      dy += 60;
    }

    // ── Signature boxes ──
    const sigY = Math.max(dy + 30, 640);
    doc.moveTo(50, sigY).lineTo(545, sigY).stroke('#e2e5ed');

    [50, 220, 390].forEach((x, i) => {
      const labels = ['Sender Signature', 'Courier Signature', 'Recipient Signature'];
      doc.rect(x, sigY + 10, 140, 50).stroke('#e2e5ed');
      doc.fillColor('#5a5f72').fontSize(8).font('Helvetica').text(labels[i], x, sigY + 65);
      doc.text('Date: ___________', x, sigY + 78);
    });

    // ── Footer ──
    doc.rect(0, 770, 595, 72).fill('#f7f8fa');
    doc.fillColor('#9a9eb0').fontSize(8).font('Helvetica')
       .text(`This waybill is computer-generated and valid without a signature unless specified.`, 50, 780, { align: 'center', width: W })
       .text(`${company} · ${process.env.COMPANY_WEBSITE || ''}`, 50, 795, { align: 'center', width: W });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

module.exports = { generateWaybill };
