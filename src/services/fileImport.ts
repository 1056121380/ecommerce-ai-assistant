function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

export async function readDataFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'xlsx' || extension === 'xls') {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())
    const worksheet = workbook.worksheets[0]
    if (!worksheet) return ''

    const rows: string[] = []
    worksheet.eachRow((row) => {
      const cells = Array.isArray(row.values) ? row.values.slice(1) : []
      rows.push(cells.map(csvEscape).join(','))
    })
    return rows.join('\n')
  }

  return await file.text()
}
