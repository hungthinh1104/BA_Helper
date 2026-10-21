import { act, render, screen, waitFor } from '@testing-library/react'
import mermaid from 'mermaid'
import { MermaidRenderer } from './mermaid-renderer'

jest.mock('mermaid', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), render: jest.fn() },
}))

const configuration = jest.mocked(mermaid.initialize).mock.calls[0][0]
const renderDiagram = jest.mocked(mermaid.render)

beforeEach(() => { renderDiagram.mockReset() })

it('uses strict SVG labels and strips active content at the DOM boundary', async () => {
  expect(configuration).toMatchObject({ securityLevel: 'strict', htmlLabels: false, suppressErrorRendering: true })
  renderDiagram.mockResolvedValue({ svg: `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
    <text>Booking refund</text><script>alert(1)</script>
    <foreignObject><iframe src="https://example.test/"></iframe></foreignObject>
    <a href="javascript:alert(1)"><text>unsafe link</text></a></svg>`, diagramType: 'flowchart-v2' })
  const { container } = render(<MermaidRenderer chart="flowchart TD; Booking --> Refund" />)
  await screen.findByText('Booking refund')
  const svg = container.querySelector('svg')!
  expect(svg).not.toHaveAttribute('onload')
  expect(svg.querySelector('script, foreignObject, iframe, [href^="javascript:"]')).toBeNull()
})

it('clears the previous diagram when the chart becomes empty', async () => {
  renderDiagram.mockResolvedValue({ svg: '<svg><text>Previous diagram</text></svg>', diagramType: 'flowchart-v2' })
  const { rerender } = render(<MermaidRenderer chart="old" />)
  await screen.findByText('Previous diagram')
  rerender(<MermaidRenderer chart="" />)
  expect(screen.queryByText('Previous diagram')).not.toBeInTheDocument()
})

it('ignores a stale render that finishes after a newer chart', async () => {
  let complete!: (value: { svg: string; diagramType: string }) => void
  renderDiagram.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  renderDiagram.mockResolvedValueOnce({ svg: '<svg><text>Current diagram</text></svg>', diagramType: 'flowchart-v2' })
  const { rerender } = render(<MermaidRenderer chart="old" />)
  rerender(<MermaidRenderer chart="current" />)
  await screen.findByText('Current diagram')
  await act(async () => { complete({ svg: '<svg><text>Stale diagram</text></svg>', diagramType: 'flowchart-v2' }) })
  expect(screen.queryByText('Stale diagram')).not.toBeInTheDocument()
})

it('falls back to text without rendering failed diagram markup', async () => {
  renderDiagram.mockRejectedValue(new Error('invalid diagram'))
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { container } = render(<MermaidRenderer chart="<script>unsafe chart</script>" />)
  await waitFor(() => expect(log).toHaveBeenCalled())
  expect(screen.getByText('<script>unsafe chart</script>')).toBeInTheDocument()
  expect(container.querySelector('svg, script')).toBeNull()
  log.mockRestore()
})
