import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

export async function generateReceipt(order) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([600, 750])
  const { height } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  const drawText = (text, x, y, size = 12) => {
    page.drawText(text, { x, y: height - y, size, font, color: rgb(0, 0, 0) })
  }

  drawText('e-Receipt', 250, 50, 18)
  drawText(`Order ID: ${order.orderId}`, 50, 100)
  drawText(`Customer: ${order.userName}`, 50, 130)
  drawText(`Date: ${new Date(order.createdAt).toLocaleString()}`, 50, 160)
  drawText(`Amount Paid: ₦${order.totals.grandTotal.toLocaleString()}`, 50, 190)
  drawText(`Payment Method: ${order.payment.gateway} (${order.payment.method})`, 50, 220)
  drawText(`Status: ${order.payment.status}`, 50, 250)

  let y = 300
  drawText('Items:', 50, y)
  order.items.forEach(item => {
    y += 30
    drawText(`${item.quantity}x ${item.serviceName} — ₦${item.price}`, 70, y)
  })

  y += 50
  drawText(`Subtotal: ₦${order.totals.itemsTotal}`, 50, y)
  y += 20
  drawText(`Discount: ₦${order.totals.discount || 0}`, 50, y)
  y += 20
  drawText(`Delivery: ₦${order.totals.deliveryFee}`, 50, y)
  y += 20
  drawText(`Grand Total: ₦${order.totals.grandTotal}`, 50, y)

  const receiptPath = path.join('/mnt/data', `receipt-${order._id}.pdf`)
  const pdfBytes = await pdf.save()
  fs.writeFileSync(receiptPath, pdfBytes)

  return receiptPath
}
