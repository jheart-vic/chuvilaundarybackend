import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function generateReceipt(order) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([600, 750])
  const { height } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  const safeText = text => String(text || '').replace(/₦/g, 'NGN ')

  const drawText = (text, x, y, size = 12) => {
    page.drawText(safeText(text), {
      x,
      y: height - y,
      size,
      font,
      color: rgb(0, 0, 0)
    })
  }

  // --- Header ---
  drawText('e-Receipt', 250, 50, 18)
  drawText(`Order ID: ${order.orderId}`, 50, 100)
  drawText(`Customer: ${order.userName}`, 50, 130)
  drawText(`Date: ${new Date(order.createdAt).toLocaleString()}`, 50, 160)
  drawText(`Amount Paid: NGN ${order.totals?.grandTotal?.toLocaleString()}`, 50, 190)
  drawText(`Payment Method: ${order.payment?.gateway || 'N/A'} (${order.payment?.method || 'N/A'})`, 50, 220)
  drawText(`Status: ${order.payment?.status || 'N/A'}`, 50, 250)

  // --- Items ---
  let y = 300
  drawText('Items:', 50, y)
  order.items?.forEach(item => {
    y += 30
    drawText(`${item.quantity}x ${item.serviceName} — NGN ${item.price}`, 70, y)
  })

  // --- Totals ---
  y += 50
  drawText(`Subtotal: NGN ${order.totals?.itemsTotal}`, 50, y)
  y += 20
  drawText(`Discount: NGN ${order.totals?.discount || 0}`, 50, y)
  y += 20
  drawText(`Delivery: NGN ${order.totals?.deliveryFee}`, 50, y)
  y += 20
  drawText(`Grand Total: NGN ${order.totals?.grandTotal}`, 50, y)

  // --- Save PDF ---
  const tmpDir = path.join(os.tmpdir(), 'receipts')
  fs.mkdirSync(tmpDir, { recursive: true })

  const receiptPath = path.join(tmpDir, `receipt-${order.orderId}.pdf`)
  const pdfBytes = await pdf.save()
  fs.writeFileSync(receiptPath, pdfBytes)

  const base64 = pdfBytes.toString('base64')

  return { receiptPath, base64 }
}
