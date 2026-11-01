import { COLORS } from '@/lib/colors'

const HEX_GRID_SIZE = 60

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: { x: number; y: number; scale: number },
  showHexGrid: boolean,
): void {
  ctx.fillStyle = COLORS.void
  ctx.fillRect(0, 0, width, height)

  if (showHexGrid) drawHexGrid(ctx, width, height, transform)
}

const HEX_OFFSETS = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i - Math.PI / 2
  return { cos: Math.cos(angle), sin: Math.sin(angle) }
})

function drawHexGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: { x: number; y: number; scale: number },
): void {
  ctx.save()
  ctx.translate(transform.x, transform.y)
  ctx.scale(transform.scale, transform.scale)

  const size = HEX_GRID_SIZE
  const hexHeight = size * Math.sqrt(3)
  const startX = Math.floor(-transform.x / transform.scale / (size * 1.5)) * (size * 1.5) - size * 3
  const startY = Math.floor(-transform.y / transform.scale / hexHeight) * hexHeight - hexHeight * 2
  const endX = startX + width / transform.scale + size * 6
  const endY = startY + height / transform.scale + hexHeight * 4
  const radius = size * 0.4

  ctx.strokeStyle = COLORS.hexGrid
  ctx.lineWidth = 0.5
  ctx.globalAlpha = 0.78
  ctx.beginPath()
  for (let x = startX; x < endX; x += size * 1.5) {
    for (let y = startY; y < endY; y += hexHeight) {
      const offsetY = ((x - startX) / (size * 1.5)) % 2 === 0 ? 0 : hexHeight / 2
      const cx = x
      const cy = y + offsetY
      ctx.moveTo(cx + radius * HEX_OFFSETS[0].cos, cy + radius * HEX_OFFSETS[0].sin)
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(cx + radius * HEX_OFFSETS[i].cos, cy + radius * HEX_OFFSETS[i].sin)
      }
      ctx.closePath()
    }
  }
  ctx.stroke()
  ctx.restore()
}
