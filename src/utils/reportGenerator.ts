import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx'
import type { EChartsOption } from 'echarts'

export interface ReportData {
  title: string
  type: 'product' | 'hotwords' | 'data'
  timestamp: string
  stats: Array<{
    label: string
    value: string | number
  }>
  content: string
  chartOption?: EChartsOption
}

export interface ReportOptions {
  format: 'pdf' | 'docx'
  includeChart: boolean
  includeStats: boolean
  fileName?: string
}

export class ReportGenerator {
  private data: ReportData
  private options: ReportOptions

  constructor(data: ReportData, options: ReportOptions) {
    this.data = data
    this.options = options
  }

  async generate(): Promise<void> {
    if (this.options.format === 'pdf') {
      await this.generatePDF()
    } else {
      await this.generateWord()
    }
  }

  private async generatePDF(): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    let yPosition = margin

    // 标题
    pdf.setFontSize(20)
    pdf.text(this.data.title, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 15

    // 时间戳
    pdf.setFontSize(10)
    pdf.text(`生成时间: ${this.data.timestamp}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 15

    // 统计数据
    if (this.options.includeStats && this.data.stats.length > 0) {
      pdf.setFontSize(14)
      pdf.text('数据统计', margin, yPosition)
      yPosition += 10

      pdf.setFontSize(10)
      this.data.stats.forEach(stat => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
        }
        pdf.text(`${stat.label}: ${stat.value}`, margin, yPosition)
        yPosition += 7
      })
      yPosition += 10
    }

    // 图表
    if (this.options.includeChart && this.data.chartOption) {
      const chartElement = document.getElementById('report-chart')
      if (chartElement) {
        try {
          const canvas = await html2canvas(chartElement, {
            scale: 2,
            backgroundColor: '#ffffff'
          })
          const imgData = canvas.toDataURL('image/png')
          const imgWidth = pageWidth - 2 * margin
          const imgHeight = (canvas.height * imgWidth) / canvas.width

          if (yPosition + imgHeight > pageHeight - margin) {
            pdf.addPage()
            yPosition = margin
          }

          pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight)
          yPosition += imgHeight + 10
        } catch (error) {
          console.error('图表生成失败:', error)
        }
      }
    }

    // 分析内容
    pdf.setFontSize(14)
    if (yPosition > pageHeight - margin - 20) {
      pdf.addPage()
      yPosition = margin
    }
    pdf.text('分析结果', margin, yPosition)
    yPosition += 10

    pdf.setFontSize(10)
    const lines = pdf.splitTextToSize(this.data.content, pageWidth - 2 * margin)
    lines.forEach((line: string) => {
      if (yPosition > pageHeight - margin) {
        pdf.addPage()
        yPosition = margin
      }
      pdf.text(line, margin, yPosition)
      yPosition += 7
    })

    // 保存
    const fileName = this.options.fileName || `${this.data.type}_report_${Date.now()}.pdf`
    pdf.save(fileName)
  }

  private async generateWord(): Promise<void> {
    const children: Paragraph[] = []

    // 标题
    children.push(
      new Paragraph({
        text: this.data.title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      })
    )

    // 时间戳
    children.push(
      new Paragraph({
        text: `生成时间: ${this.data.timestamp}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    )

    // 统计数据
    if (this.options.includeStats && this.data.stats.length > 0) {
      children.push(
        new Paragraph({
          text: '数据统计',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 }
        })
      )

      this.data.stats.forEach(stat => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${stat.label}: `,
                bold: true
              }),
              new TextRun({
                text: String(stat.value)
              })
            ],
            spacing: { after: 100 }
          })
        )
      })
    }

    // 图表
    if (this.options.includeChart && this.data.chartOption) {
      const chartElement = document.getElementById('report-chart')
      if (chartElement) {
        try {
          const canvas = await html2canvas(chartElement, {
            scale: 2,
            backgroundColor: '#ffffff'
          })
          const imgData = canvas.toDataURL('image/png')
          const base64Data = imgData.split(',')[1]

          children.push(
            new Paragraph({
              text: '数据图表',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            })
          )

          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  type: 'png',
                  data: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
                  transformation: {
                    width: 500,
                    height: 300
                  }
                })
              ],
              spacing: { after: 400 }
            })
          )
        } catch (error) {
          console.error('图表生成失败:', error)
        }
      }
    }

    // 分析内容
    children.push(
      new Paragraph({
        text: '分析结果',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    )

    const contentLines = this.data.content.split('\n')
    contentLines.forEach(line => {
      children.push(
        new Paragraph({
          text: line,
          spacing: { after: 100 }
        })
      )
    })

    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {},
          children
        }
      ]
    })

    // 保存
    const blob = await Packer.toBlob(doc)
    const fileName = this.options.fileName || `${this.data.type}_report_${Date.now()}.docx`
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }
}

export async function generateReport(data: ReportData, options: ReportOptions): Promise<void> {
  const generator = new ReportGenerator(data, options)
  await generator.generate()
}
