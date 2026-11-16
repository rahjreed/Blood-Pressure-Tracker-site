import { averages, chronological, dateLabel, displayAverage, displayNumber, offsetLabel, plotData, readingDay, readingLabel, sessionCount } from './measurements.js'

export function reportPeriod({ from, to, readings }) {
  const days = readings.map(readingDay).sort()
  const start = from || days[0]
  const end = to || days.at(-1)
  return start === end ? dateLabel(start) : `${dateLabel(start)} to ${dateLabel(end)}`
}

export const reportNote = 'Patient-maintained record for discussion with a healthcare professional. Only a qualified clinician can diagnose a condition.'

export async function createReport({ readings, patient, from, to }) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  pdf.setProperties({ title: 'PRESSURE | Blood pressure report', author: 'PRESSURE by Callista Digital' })
  const margin = 45
  const width = 522
  const bottom = 736
  let y = 52

  function text(value, x, baseline, { size = 11, bold = false, color = '#192a48' } = {}) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(color)
    pdf.text(value, x, baseline)
  }

  function nextPage() {
    pdf.addPage()
    y = 48
    text('PRESSURE  /  Blood pressure report', margin, y, { size: 11, bold: true, color: '#285b9f' })
    y += 28
  }

  function reserve(height) {
    if (y + height > bottom) nextPage()
  }

  function userText(value) {
    // Preserve line breaks while removing control characters that cannot be printed.
    // eslint-disable-next-line no-control-regex
    const printable = value.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    if (/^[\x20-\x7e\n]*$/.test(printable)) {
      for (const line of pdf.splitTextToSize(printable, width)) {
        reserve(14)
        text(line, margin, y + 10, { size: 10 })
        y += 14
      }
      return
    }
    // Use the browser's font fallback for names and notes outside Helvetica's character set.
    const canvas = document.createElement('canvas')
    canvas.width = width * 3
    canvas.height = 15 * 3
    const context = canvas.getContext('2d')
    context.scale(3, 3)
    context.font = '10px system-ui, sans-serif'
    context.fillStyle = '#192a48'
    const wrap = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
    for (const paragraph of printable.split('\n')) {
      let line = ''
      function draw() {
        reserve(15)
        context.clearRect(0, 0, width, 15)
        context.fillText(line, 0, 11)
        if (line) pdf.addImage(canvas, 'PNG', margin, y, width, 15)
        y += 15
        line = ''
      }
      const segments = wrap ? Array.from(wrap.segment(paragraph), part => part.segment) : Array.from(paragraph)
      for (const segment of segments) {
        if (context.measureText(line + segment).width > width) draw()
        line += segment
      }
      draw()
    }
  }

  const avg = averages(readings)
  text('PRESSURE', margin, y, { size: 11, bold: true, color: '#285b9f' })
  y += 34
  text('Blood pressure report', margin, y, { size: 27, bold: true })
  y += 23
  text(reportPeriod({ from, to, readings }), margin, y)
  y += 18
  if (patient) {
    userText(`Patient: ${patient}`)
    y += 9
  }
  text(`Average: ${displayAverage(avg)} mmHg  |  Readings: ${readings.length}  |  Sessions: ${sessionCount(readings)}`, margin, y, { bold: true })
  y += 18
  text(`Average pulse: ${avg?.pulse != null ? `${displayNumber(avg.pulse)} BPM` : 'Unavailable'}`, margin, y)
  y += 22
  pdf.setFontSize(10)
  for (const line of pdf.splitTextToSize(reportNote, width)) {
    text(line, margin, y, { size: 10, color: '#475b77' })
    y += 13
  }
  y += 18

  function chart(title, unit, fields, colors) {
    const plot = plotData(readings, fields)
    if (!plot) return
    reserve(189)
    text(`${title} (${unit})`, margin, y, { size: 13, bold: true })
    y += 18
    fields.forEach((field, index) => {
      const x = margin + index * 85
      pdf.setDrawColor(colors[index])
      pdf.setLineWidth(2)
      pdf.line(x, y - 4, x + 12, y - 4)
      text(field[0].toUpperCase() + field.slice(1), x + 16, y, { size: 9 })
    })
    y += 14
    const chartLeft = margin + 26
    const chartWidth = width - 34
    const chartHeight = 93
    const x = point => chartLeft + point.x * chartWidth
    const yValue = value => y + (plot.max - value) / (plot.max - plot.min) * chartHeight
    for (let index = 0; index <= 4; index++) {
      const tick = plot.max - (plot.max - plot.min) * index / 4
      pdf.setDrawColor('#d9e4f0')
      pdf.setLineWidth(0.6)
      pdf.line(chartLeft, yValue(tick), chartLeft + chartWidth, yValue(tick))
      text(String(Math.round(tick)), margin, yValue(tick) + 3, { size: 8 })
    }
    fields.forEach((field, index) => {
      const points = plot.points.filter(({ reading }) => reading[field] != null)
      pdf.setDrawColor(colors[index])
      pdf.setFillColor(colors[index])
      pdf.setLineWidth(1.1)
      points.forEach((point, index) => {
        const previous = points[index - 1]
        if (previous) pdf.line(x(previous), yValue(previous.reading[field]), x(point), yValue(point.reading[field]))
        pdf.circle(x(point), yValue(point.reading[field]), 1.9, 'F')
      })
    })
    y += chartHeight + 14
    const [first, last] = [plot.points[0].reading, plot.points.at(-1).reading]
    const firstLabel = readingLabel(first)
    const lastLabel = readingLabel(last)
    text(firstLabel, chartLeft, y, { size: 8 })
    if (firstLabel !== lastLabel) {
      const labelWidth = pdf.getTextWidth(lastLabel)
      text(lastLabel, chartLeft + chartWidth - labelWidth, y, { size: 8 })
    }
    y += 33
  }

  chart('Blood pressure trend', 'mmHg', ['systolic', 'diastolic'], ['#1f61d0', '#167d73'])
  chart('Pulse trend', 'BPM', ['pulse'], ['#7053b9'])
  reserve(60)
  text('Measurement log', margin, y, { size: 15, bold: true })
  y += 24
  for (const reading of chronological(readings)) {
    reserve(50)
    text(`${readingLabel(reading)} (${offsetLabel(reading.offset)})`, margin, y, { bold: true })
    const value = `${reading.systolic}/${reading.diastolic} mmHg${reading.pulse != null ? `  |  ${reading.pulse} BPM` : ''}`
    text(value, margin + 300, y, { bold: true })
    y += 15
    text(`${reading.period}  |  ${reading.arm} arm${reading.tags.length ? `  |  ${reading.tags.join(', ')}` : ''}`, margin, y, { size: 9 })
    y += 7
    if (reading.emergency) userText('Warning symptoms reported.')
    if (reading.notes) userText(`Notes: ${reading.notes}`)
    y += 8
    pdf.setDrawColor('#d9e4f0')
    pdf.setLineWidth(0.6)
    pdf.line(margin, y, margin + width, y)
    y += 17
  }

  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page)
    text('PRESSURE by Callista Digital', margin, 760, { size: 9, color: '#475b77' })
    text(`Page ${page} of ${pages}`, margin + width - 51, 760, { size: 9, color: '#475b77' })
  }
  return pdf.output('blob')
}
